//! Isolated decoded-frame to owned mono conversion. No resampling/ASR/runtime.
//! Input remains owned/charged; output is reserved BEFORE allocating its samples.

use crate::audio_decoder_v0::OwnedFrame;
use crate::audio_frame_v0::{parse_header, Header, HEADER_BYTES};
use crate::downmix::{downmix_f32le, DownmixError, MonoMix};
use crate::transport_budget::{BudgetError, BufferLease, TransportBudget};

#[derive(Debug, PartialEq, Eq)]
pub enum MonoFrameError {
    Budget(BudgetError),
    Downmix(DownmixError),
}
#[derive(Debug)]
pub struct OwnedMonoFrame {
    header: Header,
    samples: Vec<f32>,
    // Rust field drop order frees the sample buffer BEFORE returning capacity.
    _lease: BufferLease,
}
impl OwnedMonoFrame {
    pub fn header(&self) -> Header {
        self.header
    }
    pub fn samples(&self) -> &[f32] {
        &self.samples
    }
}
type Mix = fn(&[u8], u16, MonoMix, usize) -> Result<Vec<f32>, DownmixError>;

/// Host must use its actual shared session pool, not create one per copy.
/// Counts input+output concurrently, including duplicated duration/work as a
/// conservative bound, NOT extra media time. Capacity returns immediately; do
/// not hold every input forever waiting for output that can never fit.
/// Returned rate/count/epoch/source range stay unchanged; only layout is mono.
pub fn downmix_owned_frame(
    frame: &OwnedFrame,
    budget: &TransportBudget,
    policy: MonoMix,
) -> Result<OwnedMonoFrame, MonoFrameError> {
    convert(frame, budget, policy, downmix_f32le)
}
fn convert(
    frame: &OwnedFrame,
    budget: &TransportBudget,
    policy: MonoMix,
    mix: Mix,
) -> Result<OwnedMonoFrame, MonoFrameError> {
    if !frame.has_budget(budget) {
        return Err(MonoFrameError::Budget(BudgetError::WrongScope));
    }
    let original = frame.header();
    let mut raw: [u8; HEADER_BYTES] = frame.bytes()[..HEADER_BYTES].try_into().unwrap();
    // Original full frame was already validated/immutable, count*4<=4MiB.
    raw[8..12].copy_from_slice(&(original.frame_count * 4).to_le_bytes());
    raw[16..18].copy_from_slice(&1_u16.to_le_bytes());
    let header =
        parse_header(&raw).map_err(|_| MonoFrameError::Budget(BudgetError::InvalidAudioHeader))?;
    let lease = budget
        .try_reserve_frame(&raw)
        .map_err(MonoFrameError::Budget)?;
    let samples = mix(
        frame.payload(),
        original.channels,
        policy,
        original.frame_count as usize,
    )
    .map_err(MonoFrameError::Downmix)?;
    if samples.len() != original.frame_count as usize
        || samples.capacity() != original.frame_count as usize
        || samples.iter().any(|value| !value.is_finite())
    {
        // Local samples drop before lease on failure; no partial/invalid result.
        return Err(MonoFrameError::Downmix(DownmixError::Allocation));
    }
    Ok(OwnedMonoFrame {
        header,
        samples,
        _lease: lease,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio_decoder_v0::{AudioDecoderV0, ExpectedStream};
    use crate::transport_budget::{AudioTimeLimits, BudgetLimits, Usage};
    fn bytes() -> Vec<u8> {
        let json: serde_json::Value = serde_json::from_str(include_str!(
            "../../../contracts/copilot/audio-frame.v0.fixture.json"
        ))
        .unwrap();
        let text = format!(
            "{}{}",
            json["cases"][0]["headerHex"].as_str().unwrap(),
            json["cases"][0]["payloadHex"].as_str().unwrap()
        );
        (0..text.len())
            .step_by(2)
            .map(|at| u8::from_str_radix(&text[at..at + 2], 16).unwrap())
            .collect()
    }
    fn pool(bytes: &[u8], capacity: u64, time: u64) -> TransportBudget {
        TransportBudget::with_audio_time_limits(
            parse_header(&bytes[..80]).unwrap().session_nonce,
            BudgetLimits {
                global_bytes: capacity,
                source_bytes: capacity,
                global_frames: 4,
                source_frames: 4,
                in_flight: 2,
            },
            AudioTimeLimits {
                global_ns: time,
                source_ns: time,
            },
        )
        .unwrap()
    }
    fn decoded(bytes: &[u8], pool: &TransportBudget) -> OwnedFrame {
        let h = parse_header(&bytes[..80]).unwrap();
        let mut decoder = AudioDecoderV0::with_budget(
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
        assert_eq!(decoder.feed(bytes).unwrap(), 80);
        assert_eq!(decoder.feed(&bytes[80..]).unwrap(), bytes.len() - 80);
        decoder.take().unwrap()
    }
    #[test]
    fn mono_preserves_source_origin_and_reservation_through_both_ownership_orders() {
        for drop_input_first in [false, true] {
            let bytes = bytes();
            let pool = pool(&bytes, 184, 83_334);
            let input = decoded(&bytes, &pool);
            let mono = downmix_owned_frame(&input, &pool, MonoMix::AverageAll).unwrap();
            assert_eq!(mono.samples(), &[-0.375, 0.75]);
            let original = input.header();
            let output = mono.header();
            assert_eq!(output.channels, 1);
            assert_eq!(output.payload_bytes, 8);
            assert_eq!(
                (
                    output.source,
                    output.epoch,
                    output.sample_rate,
                    output.sample_start,
                    output.sample_end,
                    output.frame_count
                ),
                (
                    original.source,
                    original.epoch,
                    original.sample_rate,
                    original.sample_start,
                    original.sample_end,
                    original.frame_count
                )
            );
            assert_eq!(pool.usage().unwrap().bytes, 184);
            assert_eq!(pool.audio_time_usage_ns().unwrap().0, 83_334);
            if drop_input_first {
                drop(input);
                assert_eq!(pool.usage().unwrap().bytes, 88);
                assert_eq!(mono.samples(), &[-0.375, 0.75]);
                drop(mono);
            } else {
                drop(mono);
                assert_eq!(pool.usage().unwrap().bytes, 96);
                assert_eq!(input.bytes(), bytes);
                drop(input);
            }
            assert_eq!(pool.usage().unwrap(), Usage::default());
            assert_eq!(pool.audio_time_usage_ns().unwrap().0, 0);
        }
    }
    #[test]
    fn capacity_and_duration_refusals_precede_output_allocation_and_keep_input_valid() {
        for (capacity, time) in [(183, 83_334), (184, 83_333)] {
            let bytes = bytes();
            let pool = pool(&bytes, capacity, time);
            let input = decoded(&bytes, &pool);
            assert_eq!(
                convert(&input, &pool, MonoMix::AverageAll, |_, _, _, _| panic!(
                    "reservation must precede allocation"
                ))
                .unwrap_err(),
                MonoFrameError::Budget(BudgetError::Capacity)
            );
            assert_eq!(pool.usage().unwrap().bytes, 96);
            assert_eq!(input.bytes(), bytes);
            drop(input);
            assert_eq!(pool.usage().unwrap(), Usage::default());
        }
    }
    #[test]
    fn failed_or_invalid_mix_releases_only_output_not_input_without_partial_success() {
        let mixes: [Mix; 4] = [
            |_, _, _, _| Err(DownmixError::Allocation),
            |_, _, _, _| Ok(vec![0.0]),
            |_, _, _, _| Ok(vec![f32::NAN, 0.0]),
            |_, _, _, _| {
                let mut output = Vec::with_capacity(3);
                output.resize(2, 0.0);
                Ok(output)
            },
        ];
        let bytes = bytes();
        let pool = pool(&bytes, 184, 83_334);
        let input = decoded(&bytes, &pool);
        for mix in mixes {
            assert_eq!(
                convert(&input, &pool, MonoMix::AverageAll, mix).unwrap_err(),
                MonoFrameError::Downmix(DownmixError::Allocation)
            );
            assert_eq!(pool.usage().unwrap().bytes, 96);
            assert_eq!(pool.audio_time_usage_ns().unwrap().0, 41_667);
            assert_eq!(input.bytes(), bytes);
        }
    }
    #[test]
    fn closed_or_foreign_scope_pool_never_detaches_input_or_allocates_output() {
        let bytes = bytes();
        let pool = pool(&bytes, 184, 83_334);
        let input = decoded(&bytes, &pool);
        pool.close().unwrap();
        assert_eq!(
            downmix_owned_frame(&input, &pool, MonoMix::AverageAll).unwrap_err(),
            MonoFrameError::Budget(BudgetError::Closed)
        );
        let foreign = TransportBudget::new(
            [8; 16],
            BudgetLimits {
                global_bytes: 184,
                source_bytes: 184,
                global_frames: 4,
                source_frames: 4,
                in_flight: 2,
            },
        )
        .unwrap();
        assert_eq!(
            downmix_owned_frame(&input, &foreign, MonoMix::AverageAll).unwrap_err(),
            MonoFrameError::Budget(BudgetError::WrongScope)
        );
        assert_eq!(pool.usage().unwrap().bytes, 96);
        assert_eq!(foreign.usage().unwrap(), Usage::default());
    }

    #[test]
    fn equal_nonce_other_pool_and_unbudgeted_input_cannot_bypass_shared_accounting() {
        let bytes = bytes();
        let original = pool(&bytes, 184, 83_334);
        let other = pool(&bytes, 184, 83_334);
        let input = decoded(&bytes, &original);
        assert_eq!(
            convert(&input, &other, MonoMix::AverageAll, |_, _, _, _| panic!(
                "same nonce is not the same accounting pool"
            ))
            .unwrap_err(),
            MonoFrameError::Budget(BudgetError::WrongScope)
        );
        assert_eq!(original.usage().unwrap().bytes, 96);
        assert_eq!(other.usage().unwrap(), Usage::default());
        let h = input.header();
        let mut decoder = AudioDecoderV0::new(ExpectedStream {
            nonce: h.session_nonce,
            source: h.source,
            epoch: h.epoch,
            sample_rate: h.sample_rate,
            channels: h.channels,
            first_sequence: h.sequence,
            first_sample_start: h.sample_start,
            max_payload_bytes: h.payload_bytes,
        })
        .unwrap();
        decoder.feed(&bytes).unwrap();
        decoder.feed(&bytes[80..]).unwrap();
        let uncharged = decoder.take().unwrap();
        assert_eq!(
            downmix_owned_frame(&uncharged, &other, MonoMix::AverageAll).unwrap_err(),
            MonoFrameError::Budget(BudgetError::WrongScope)
        );
        assert_eq!(other.usage().unwrap(), Usage::default());
    }
}
