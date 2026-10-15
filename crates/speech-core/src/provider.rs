//! Isolated provider boundary, NOT a wire protocol or a concrete ASR engine.
//!
//! Adapted from meeting-copilot audio/transcription/provider.rs at
//! 3c299c99abf7c38c1e3bac34c4aecdc010c911dd.
//! Copyright (c) 2024 Zackriya Solutions. MIT: ../LICENSE-MEETING-COPILOT.
//! Changes: std boxed futures instead of async_trait, borrowed validated PCM,
//! prototype bounds, cooperative cancellation and acceptance validation.
//! No Tauri, model loading, engine singleton, timestamps, queue or persistence.

use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub const MAX_REQUEST_SAMPLES: usize = 1_048_576;
pub const MAX_RESULT_TEXT_BYTES: usize = 65_536;

#[derive(Debug, Clone, PartialEq)]
pub enum TranscriptionError {
    ModelNotLoaded,
    AudioTooShort { samples: usize, minimum: usize },
    EngineFailed(String),
    UnsupportedLanguage(String),
    InvalidAudio,
    InvalidLanguageHint,
    InvalidResult,
    Canceled,
}

impl std::fmt::Display for TranscriptionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ModelNotLoaded => write!(f, "No transcription model is loaded"),
            Self::AudioTooShort { samples, minimum } => {
                write!(f, "Audio too short: {samples} samples (minimum {minimum})")
            }
            Self::EngineFailed(message) => write!(f, "Transcription engine failed: {message}"),
            Self::UnsupportedLanguage(language) => {
                write!(f, "Language '{language}' is not supported by this provider")
            }
            Self::InvalidAudio => write!(f, "Invalid mono 16kHz request"),
            Self::InvalidLanguageHint => write!(f, "Invalid language hint"),
            Self::InvalidResult => write!(f, "Invalid provider result"),
            Self::Canceled => write!(f, "Transcription canceled after provider completion"),
        }
    }
}
impl std::error::Error for TranscriptionError {}

/// Borrowed mono file/segment, not evidence that an untrusted buffer really has
/// this rate. Host/normalizer must supply truthful metadata and source identity.
#[derive(Debug)]
pub struct TranscriptionRequest<'a> {
    samples: &'a [f32],
    language: Option<&'a str>,
}

impl<'a> TranscriptionRequest<'a> {
    pub fn new(
        samples: &'a [f32],
        sample_rate: u32,
        language: Option<&'a str>,
    ) -> Result<Self, TranscriptionError> {
        if sample_rate != 16_000
            || samples.is_empty()
            || samples.len() > MAX_REQUEST_SAMPLES
            || samples.iter().any(|value| !value.is_finite())
        {
            return Err(TranscriptionError::InvalidAudio);
        }
        if language.is_some_and(|hint| {
            hint.is_empty()
                || hint.len() > 32
                || !hint
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'-' | b'_'))
        }) {
            return Err(TranscriptionError::InvalidLanguageHint);
        }
        Ok(Self { samples, language })
    }
    pub fn samples(&self) -> &'a [f32] {
        self.samples
    }
    pub fn language(&self) -> Option<&'a str> {
        self.language
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct TranscriptResult {
    pub text: String,
    pub confidence: Option<f32>,
    pub is_partial: bool,
}

impl TranscriptResult {
    /// Post-provider acceptance bound, not a promise about engine allocation.
    /// Empty text can represent silence. Text is not trimmed or normalized.
    pub fn validate(&self) -> Result<(), TranscriptionError> {
        if self.text.len() > MAX_RESULT_TEXT_BYTES
            || self
                .confidence
                .is_some_and(|value| !value.is_finite() || !(0.0..=1.0).contains(&value))
        {
            return Err(TranscriptionError::InvalidResult);
        }
        Ok(())
    }
}

/// Per-job, monotonic cancellation. Never reuse/reset it for a different job.
#[derive(Debug, Clone, Default)]
pub struct Cancellation(Arc<AtomicBool>);
impl Cancellation {
    pub fn cancel(&self) {
        self.0.store(true, Ordering::Release);
    }
    pub fn is_canceled(&self) -> bool {
        self.0.load(Ordering::Acquire)
    }
}

pub type ProviderFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

pub trait TranscriptionProvider: Send + Sync {
    /// Implementations may observe cancel cooperatively, but MUST NOT resolve
    /// while their owned worker/inference is still using the request. No engine
    /// implementation exists here. The job owner must retain/poll the future to
    /// completion: dropping it or killing the host is NOT a demonstrated drain.
    fn transcribe<'a>(
        &'a self,
        request: &'a TranscriptionRequest<'a>,
        cancel: Cancellation,
    ) -> ProviderFuture<'a, Result<TranscriptResult, TranscriptionError>>;
    fn is_model_loaded(&self) -> ProviderFuture<'_, bool>;
    fn get_current_model(&self) -> ProviderFuture<'_, Option<String>>;
    fn provider_name(&self) -> &'static str;
}

/// Does not race cancellation against/detach a running provider future. A late
/// result is discarded only AFTER provider completion. No journal/final ACK is
/// implied by this function; caller still owns session/source/map/persistence.
pub async fn transcribe_checked<'a>(
    provider: &'a dyn TranscriptionProvider,
    request: &'a TranscriptionRequest<'a>,
    cancel: Cancellation,
) -> Result<TranscriptResult, TranscriptionError> {
    if cancel.is_canceled() {
        return Err(TranscriptionError::Canceled);
    }
    let result = provider.transcribe(request, cancel.clone()).await;
    if cancel.is_canceled() {
        return Err(TranscriptionError::Canceled);
    }
    let result = result?;
    result.validate()?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;
    use std::task::{Context, Poll, Waker};

    struct FakeProvider {
        calls: AtomicUsize,
        done: Arc<AtomicBool>,
        response: Result<TranscriptResult, TranscriptionError>,
    }
    impl TranscriptionProvider for FakeProvider {
        fn transcribe<'a>(
            &'a self,
            request: &'a TranscriptionRequest<'a>,
            _cancel: Cancellation,
        ) -> ProviderFuture<'a, Result<TranscriptResult, TranscriptionError>> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            assert_eq!(request.samples(), &[0.25, -0.25]);
            Box::pin(std::future::poll_fn(move |_cx| {
                if self.done.load(Ordering::Acquire) {
                    Poll::Ready(self.response.clone())
                } else {
                    Poll::Pending
                }
            }))
        }
        fn is_model_loaded(&self) -> ProviderFuture<'_, bool> {
            Box::pin(std::future::ready(true))
        }
        fn get_current_model(&self) -> ProviderFuture<'_, Option<String>> {
            Box::pin(std::future::ready(Some("fake-model".into())))
        }
        fn provider_name(&self) -> &'static str {
            "fake-only"
        }
    }
    fn response() -> TranscriptResult {
        TranscriptResult {
            text: " Olá, teste. ".into(),
            confidence: Some(0.9),
            is_partial: false,
        }
    }
    fn provider(done: bool) -> FakeProvider {
        FakeProvider {
            calls: AtomicUsize::new(0),
            done: Arc::new(AtomicBool::new(done)),
            response: Ok(response()),
        }
    }

    #[test]
    fn requests_validate_before_borrowing_and_keep_exact_samples() {
        let samples = [0.25, -0.25];
        let request = TranscriptionRequest::new(&samples, 16000, Some("pt-BR")).unwrap();
        assert_eq!(request.samples().as_ptr(), samples.as_ptr());
        assert_eq!(request.language(), Some("pt-BR"));
        for rate in [0, 44100, 48000] {
            assert_eq!(
                TranscriptionRequest::new(&samples, rate, None).unwrap_err(),
                TranscriptionError::InvalidAudio
            );
        }
        assert!(TranscriptionRequest::new(&[], 16000, None).is_err());
        for bad in [f32::NAN, f32::INFINITY, f32::NEG_INFINITY] {
            assert!(TranscriptionRequest::new(&[bad], 16000, None).is_err());
        }
        // No clipping or loudness normalization is silently introduced.
        assert!(TranscriptionRequest::new(&[f32::MAX, -f32::MAX], 16000, None).is_ok());
    }
    #[test]
    fn request_and_language_bounds_are_inclusive_and_not_language_support_claims() {
        assert!(TranscriptionRequest::new(&vec![0.0; MAX_REQUEST_SAMPLES], 16000, None).is_ok());
        assert!(
            TranscriptionRequest::new(&vec![0.0; MAX_REQUEST_SAMPLES + 1], 16000, None).is_err()
        );
        for bad in ["", "pt BR", "pt\n", "português", "../../model"] {
            assert!(TranscriptionRequest::new(&[0.0], 16000, Some(bad)).is_err());
        }
        assert!(TranscriptionRequest::new(&[0.0], 16000, Some(&"x".repeat(32))).is_ok());
        assert!(TranscriptionRequest::new(&[0.0], 16000, Some(&"x".repeat(33))).is_err());
    }
    #[test]
    fn cancellation_is_monotonic_across_clones_and_threads() {
        let token = Cancellation::default();
        assert!(!token.is_canceled());
        let other = token.clone();
        std::thread::spawn(move || {
            other.cancel();
            other.cancel();
        })
        .join()
        .unwrap();
        assert!(token.is_canceled());
        assert!(token.clone().is_canceled());
    }
    #[test]
    fn result_acceptance_checks_utf8_bytes_and_confidence_without_rewriting_text() {
        let mut result = response();
        result.text = "é".repeat(MAX_RESULT_TEXT_BYTES / 2);
        assert!(result.validate().is_ok());
        result.text.push('é');
        assert_eq!(result.validate(), Err(TranscriptionError::InvalidResult));
        for confidence in [None, Some(0.0), Some(1.0)] {
            result.text.clear();
            result.confidence = confidence;
            assert!(result.validate().is_ok());
        }
        for confidence in [f32::NAN, f32::INFINITY, -0.1, 1.1] {
            result.confidence = Some(confidence);
            assert!(result.validate().is_err());
        }
    }
    #[test]
    fn pre_canceled_request_never_enters_provider() {
        let provider = provider(true);
        let request = TranscriptionRequest::new(&[0.25, -0.25], 16000, None).unwrap();
        let token = Cancellation::default();
        token.cancel();
        let mut future = Box::pin(transcribe_checked(&provider, &request, token));
        assert_eq!(
            future
                .as_mut()
                .poll(&mut Context::from_waker(Waker::noop())),
            Poll::Ready(Err(TranscriptionError::Canceled))
        );
        assert_eq!(provider.calls.load(Ordering::SeqCst), 0);
    }
    #[test]
    fn late_cancel_waits_for_provider_completion_then_discards_result() {
        let provider = provider(false);
        let request = TranscriptionRequest::new(&[0.25, -0.25], 16000, Some("pt")).unwrap();
        let token = Cancellation::default();
        let mut future = Box::pin(transcribe_checked(&provider, &request, token.clone()));
        let mut context = Context::from_waker(Waker::noop());
        assert!(future.as_mut().poll(&mut context).is_pending());
        token.cancel();
        assert!(
            future.as_mut().poll(&mut context).is_pending(),
            "cancel must not detach provider"
        );
        provider.done.store(true, Ordering::Release);
        assert_eq!(
            future.as_mut().poll(&mut context),
            Poll::Ready(Err(TranscriptionError::Canceled))
        );
        assert_eq!(provider.calls.load(Ordering::SeqCst), 1);
    }
    #[test]
    fn valid_result_preserves_text_partial_flag_and_provider_errors() {
        let request = TranscriptionRequest::new(&[0.25, -0.25], 16000, None).unwrap();
        let mut provider = provider(true);
        let mut expected = response();
        expected.is_partial = true;
        provider.response = Ok(expected.clone());
        let mut future = Box::pin(transcribe_checked(
            &provider,
            &request,
            Cancellation::default(),
        ));
        assert_eq!(
            future
                .as_mut()
                .poll(&mut Context::from_waker(Waker::noop())),
            Poll::Ready(Ok(expected))
        );
        drop(future);
        provider.response = Err(TranscriptionError::ModelNotLoaded);
        let mut future = Box::pin(transcribe_checked(
            &provider,
            &request,
            Cancellation::default(),
        ));
        assert_eq!(
            future
                .as_mut()
                .poll(&mut Context::from_waker(Waker::noop())),
            Poll::Ready(Err(TranscriptionError::ModelNotLoaded))
        );
    }
    #[test]
    fn invalid_provider_result_is_rejected_after_completion() {
        let mut provider = provider(true);
        provider.response = Ok(TranscriptResult {
            confidence: Some(f32::NAN),
            ..response()
        });
        let request = TranscriptionRequest::new(&[0.25, -0.25], 16000, None).unwrap();
        let mut future = Box::pin(transcribe_checked(
            &provider,
            &request,
            Cancellation::default(),
        ));
        assert_eq!(
            future
                .as_mut()
                .poll(&mut Context::from_waker(Waker::noop())),
            Poll::Ready(Err(TranscriptionError::InvalidResult))
        );
    }
}
