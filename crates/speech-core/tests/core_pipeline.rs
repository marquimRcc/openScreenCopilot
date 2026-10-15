//! Synthetic in-memory component integration, no engine/pipe/capture or journal.
use openscreen_speech_core::audio_decoder_v0::{AudioDecoderV0, ExpectedStream};
use openscreen_speech_core::audio_frame_v0::{parse_header, HEADER_BYTES};
use openscreen_speech_core::downmix::MonoMix;
use openscreen_speech_core::mono_frame::{downmix_owned_frame, MonoFrameError};
use openscreen_speech_core::provider::{
    Cancellation, ProviderFuture, TranscriptResult, TranscriptionError, TranscriptionProvider,
    TranscriptionRequest,
};
use openscreen_speech_core::provider_admission::{
    transcribe_managed, ManagedTranscriptionError, ProviderAdmission,
};
use openscreen_speech_core::transport_budget::{
    AudioTimeLimits, BudgetError, BudgetLimits, TransportBudget, Usage,
};
use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::task::{Context, Poll, Waker};

fn frame(rate: u32) -> Vec<u8> {
    let json: serde_json::Value = serde_json::from_str(include_str!(
        "../../../contracts/copilot/audio-frame.v0.fixture.json"
    ))
    .unwrap();
    let text = format!(
        "{}{}",
        json["cases"][0]["headerHex"].as_str().unwrap(),
        json["cases"][0]["payloadHex"].as_str().unwrap()
    );
    let mut bytes: Vec<u8> = (0..text.len())
        .step_by(2)
        .map(|at| u8::from_str_radix(&text[at..at + 2], 16).unwrap())
        .collect();
    bytes[12..16].copy_from_slice(&rate.to_le_bytes());
    bytes
}
fn setup(bytes: &[u8]) -> (TransportBudget, AudioDecoderV0) {
    let h = parse_header(&bytes[..80]).unwrap();
    let pool = TransportBudget::with_audio_time_limits(
        h.session_nonce,
        BudgetLimits {
            global_bytes: 184,
            source_bytes: 184,
            global_frames: 4,
            source_frames: 4,
            in_flight: 2,
        },
        AudioTimeLimits {
            global_ns: 250_000,
            source_ns: 250_000,
        },
    )
    .unwrap();
    let decoder = AudioDecoderV0::with_budget(
        ExpectedStream {
            nonce: h.session_nonce,
            source: h.source,
            epoch: h.epoch,
            sample_rate: h.sample_rate,
            channels: h.channels,
            first_sequence: h.sequence,
            first_sample_start: h.sample_start,
            max_payload_bytes: h.payload_bytes,
        },
        pool.clone(),
    )
    .unwrap();
    (pool, decoder)
}
fn feed(decoder: &mut AudioDecoderV0, bytes: &[u8]) {
    // Deliberately split header and floats at arbitrary byte positions.
    for chunk in bytes.chunks(7) {
        let mut at = 0;
        while at < chunk.len() {
            let count = decoder.feed(&chunk[at..]).unwrap();
            assert!(count > 0);
            at += count;
        }
    }
}
struct Slow {
    done: AtomicBool,
    calls: AtomicUsize,
}
impl Slow {
    fn new() -> Self {
        Self {
            done: AtomicBool::new(false),
            calls: AtomicUsize::new(0),
        }
    }
}
impl TranscriptionProvider for Slow {
    fn transcribe<'a>(
        &'a self,
        request: &'a TranscriptionRequest<'a>,
        _: Cancellation,
    ) -> ProviderFuture<'a, Result<TranscriptResult, TranscriptionError>> {
        assert_eq!(request.samples(), &[-0.375, 0.75]);
        self.calls.fetch_add(1, Ordering::SeqCst);
        Box::pin(std::future::poll_fn(move |_| {
            if self.done.load(Ordering::Acquire) {
                Poll::Ready(Ok(TranscriptResult {
                    text: "synthetic only".into(),
                    confidence: None,
                    is_partial: false,
                }))
            } else {
                Poll::Pending
            }
        }))
    }
    fn is_model_loaded(&self) -> ProviderFuture<'_, bool> {
        Box::pin(std::future::ready(true))
    }
    fn get_current_model(&self) -> ProviderFuture<'_, Option<String>> {
        Box::pin(std::future::ready(None))
    }
    fn provider_name(&self) -> &'static str {
        "synthetic-slow-no-engine"
    }
}

#[test]
fn original_rate_mono_never_masquerades_as_normalized_16k_provider_input() {
    let bytes = frame(48_000);
    let (pool, mut decoder) = setup(&bytes);
    feed(&mut decoder, &bytes);
    let input = decoder.take().unwrap();
    let mono = downmix_owned_frame(&input, &pool, MonoMix::AverageAll).unwrap();
    assert_eq!(mono.header().sample_rate, 48_000);
    assert!(matches!(
        TranscriptionRequest::new(mono.samples(), mono.header().sample_rate, None),
        Err(TranscriptionError::InvalidAudio)
    ));
    assert_eq!(pool.usage().unwrap().bytes, 184);
    drop(input);
    drop(mono);
    assert_eq!(pool.usage().unwrap(), Usage::default());
}

#[test]
fn slow_provider_keeps_mono_charged_and_next_copy_waits_without_an_unbounded_queue() {
    let bytes = frame(16_000);
    let (pool, mut decoder) = setup(&bytes);
    feed(&mut decoder, &bytes);
    let first = decoder.take().unwrap();
    let original = first.header();
    let mono = downmix_owned_frame(&first, &pool, MonoMix::AverageAll).unwrap();
    drop(first);
    assert_eq!(pool.usage().unwrap().bytes, 88);
    let request =
        TranscriptionRequest::new(mono.samples(), mono.header().sample_rate, Some("pt")).unwrap();
    let provider = Slow::new();
    let gate = ProviderAdmission::new(1).unwrap();
    let mut cx = Context::from_waker(Waker::noop());
    let mut job = Box::pin(transcribe_managed(
        &gate,
        &provider,
        &request,
        Cancellation::default(),
    ));
    assert!(job.as_mut().poll(&mut cx).is_pending());
    let mut next = bytes.clone();
    next[48..56].copy_from_slice(&(original.sequence + 1).to_le_bytes());
    next[56..64].copy_from_slice(&original.sample_end.to_le_bytes());
    feed(&mut decoder, &next);
    let second = decoder.take().unwrap();
    assert_eq!(pool.usage().unwrap().bytes, 184);
    let observed = pool.observe_change().unwrap();
    assert_eq!(
        downmix_owned_frame(&second, &pool, MonoMix::AverageAll).unwrap_err(),
        MonoFrameError::Budget(BudgetError::Capacity)
    );
    let mut changed = pool.wait_for_change(&observed, original.source).unwrap();
    assert_eq!(Pin::new(&mut changed).poll(&mut cx), Poll::Pending);
    assert_eq!(gate.status().unwrap().active, 1);
    assert_eq!(provider.calls.load(Ordering::SeqCst), 1);
    provider.done.store(true, Ordering::Release);
    assert!(matches!(job.as_mut().poll(&mut cx), Poll::Ready(Ok(_))));
    drop(job);
    drop(mono);
    assert_eq!(Pin::new(&mut changed).poll(&mut cx), Poll::Ready(Ok(())));
    let mono2 = downmix_owned_frame(&second, &pool, MonoMix::AverageAll).unwrap();
    assert_eq!(pool.usage().unwrap().bytes, 184);
    assert_eq!(mono2.header().sample_start, original.sample_end);
    drop(second);
    drop(mono2);
    assert_eq!(pool.usage().unwrap(), Usage::default());
    assert_eq!(gate.status().unwrap().active, 0);
    // No persisted result, watermark, clock mapping or recovery is implied.
}

#[test]
fn cancellation_and_close_keep_live_request_charged_until_provider_completion() {
    let bytes = frame(16_000);
    let (pool, mut decoder) = setup(&bytes);
    feed(&mut decoder, &bytes);
    let input = decoder.take().unwrap();
    let mono = downmix_owned_frame(&input, &pool, MonoMix::AverageAll).unwrap();
    drop(input);
    let request =
        TranscriptionRequest::new(mono.samples(), mono.header().sample_rate, None).unwrap();
    let provider = Slow::new();
    let gate = ProviderAdmission::new(1).unwrap();
    let cancel = Cancellation::default();
    let mut cx = Context::from_waker(Waker::noop());
    let mut job = Box::pin(transcribe_managed(
        &gate,
        &provider,
        &request,
        cancel.clone(),
    ));
    assert!(job.as_mut().poll(&mut cx).is_pending());
    gate.close().unwrap();
    pool.close().unwrap();
    cancel.cancel();
    assert!(job.as_mut().poll(&mut cx).is_pending());
    assert_eq!(pool.usage().unwrap().bytes, 88);
    assert_eq!(gate.status().unwrap().active, 1);
    provider.done.store(true, Ordering::Release);
    assert_eq!(
        job.as_mut().poll(&mut cx),
        Poll::Ready(Err(ManagedTranscriptionError::Provider(
            TranscriptionError::Canceled
        )))
    );
    drop(job);
    assert_eq!(pool.usage().unwrap().bytes, 88);
    drop(mono);
    assert_eq!(pool.usage().unwrap(), Usage::default());
    assert_eq!(gate.status().unwrap().active, 0);
    assert!(!gate.status().unwrap().uncertain);
    assert_eq!(decoder.owned_buffer_bytes(), HEADER_BYTES);
}
