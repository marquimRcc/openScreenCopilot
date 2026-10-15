//! Isolated provider admission, NOT an engine/executor/worker shutdown guarantee.
//! Host must share ONE gate for the actual engine and retain managed futures.
//! Dropping an entered future fails closed: worker completion is then uncertain.

use crate::provider::{
    transcribe_checked, Cancellation, TranscriptResult, TranscriptionError, TranscriptionProvider,
    TranscriptionRequest,
};
use std::sync::{Arc, Mutex};

pub const MAX_PROVIDER_JOBS: usize = 16; // prototype guard, not a production policy
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AdmissionError {
    InvalidLimit,
    Busy,
    Closed,
    Uncertain,
    Poisoned,
}
#[derive(Debug, Clone, PartialEq)]
pub enum ManagedTranscriptionError {
    Admission(AdmissionError),
    Provider(TranscriptionError),
}
impl ManagedTranscriptionError {
    /// Static local category only, not serialization or a frozen wire contract.
    pub fn diagnostic_code(&self) -> &'static str {
        match self {
            Self::Provider(error) => error.diagnostic_code(),
            Self::Admission(error) => match error {
                AdmissionError::InvalidLimit => "admission-limit-invalid",
                AdmissionError::Busy => "admission-busy",
                AdmissionError::Closed => "admission-closed",
                AdmissionError::Uncertain => "admission-uncertain",
                AdmissionError::Poisoned => "admission-poisoned",
            },
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AdmissionStatus {
    /// Charged calls, including abandoned/uncertain ones. Not a thread count.
    /// active==0 alone is not drain proof; uncertain/poison must also be handled.
    pub active: usize,
    pub closed: bool,
    pub uncertain: bool,
}
#[derive(Debug)]
struct State {
    limit: usize,
    active: usize,
    closed: bool,
    uncertain: bool,
}
#[derive(Debug, Clone)]
pub struct ProviderAdmission(Arc<Mutex<State>>);
struct EnteredJob {
    state: Arc<Mutex<State>>,
    completed: bool,
}

impl ProviderAdmission {
    pub fn new(limit: usize) -> Result<Self, AdmissionError> {
        if !(1..=MAX_PROVIDER_JOBS).contains(&limit) {
            return Err(AdmissionError::InvalidLimit);
        }
        Ok(Self(Arc::new(Mutex::new(State {
            limit,
            active: 0,
            closed: false,
            uncertain: false,
        }))))
    }
    pub fn status(&self) -> Result<AdmissionStatus, AdmissionError> {
        let state = self.0.lock().map_err(|_| AdmissionError::Poisoned)?;
        Ok(AdmissionStatus {
            active: state.active,
            closed: state.closed,
            uncertain: state.uncertain,
        })
    }
    /// Stops admission only. Existing jobs must still be polled to completion.
    /// No reopen/reset: an uncertain engine needs external lifecycle supervision.
    pub fn close(&self) -> Result<(), AdmissionError> {
        self.0.lock().map_err(|_| AdmissionError::Poisoned)?.closed = true;
        Ok(())
    }
    fn enter(&self) -> Result<EnteredJob, AdmissionError> {
        let mut state = self.0.lock().map_err(|_| AdmissionError::Poisoned)?;
        if state.uncertain {
            return Err(AdmissionError::Uncertain);
        }
        if state.closed {
            return Err(AdmissionError::Closed);
        }
        if state.active >= state.limit {
            return Err(AdmissionError::Busy);
        }
        state.active += 1;
        Ok(EnteredJob {
            state: Arc::clone(&self.0),
            completed: false,
        })
    }
}
impl EnteredJob {
    fn complete(mut self) -> Result<(), AdmissionError> {
        let mut state = self.state.lock().map_err(|_| AdmissionError::Poisoned)?;
        let Some(active) = state.active.checked_sub(1) else {
            state.uncertain = true;
            return Err(AdmissionError::Uncertain);
        };
        state.active = active;
        self.completed = true;
        Ok(())
    }
}
impl Drop for EnteredJob {
    fn drop(&mut self) {
        if !self.completed {
            if let Ok(mut state) = self.state.lock() {
                state.uncertain = true;
                // Do NOT decrement active or advertise drained after detachment.
            }
        }
    }
}

/// Reservation precedes provider entry. Late cancellation awaits the existing
/// checked provider boundary, then releases admission and discards canceled output.
/// FutureDrop/panic leaves active charged and gate uncertain; it does NOT stop a
/// physical worker. Host must not create a replacement gate to bypass that state.
pub async fn transcribe_managed<'a>(
    gate: &ProviderAdmission,
    provider: &'a dyn TranscriptionProvider,
    request: &'a TranscriptionRequest<'a>,
    cancel: Cancellation,
) -> Result<TranscriptResult, ManagedTranscriptionError> {
    if cancel.is_canceled() {
        return Err(ManagedTranscriptionError::Provider(
            TranscriptionError::Canceled,
        ));
    }
    let job = gate.enter().map_err(ManagedTranscriptionError::Admission)?;
    let result = transcribe_checked(provider, request, cancel).await;
    job.complete()
        .map_err(ManagedTranscriptionError::Admission)?;
    result.map_err(ManagedTranscriptionError::Provider)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn managed_diagnostics_preserve_static_failure_categories_without_detail() {
        for (error, expected) in [
            (AdmissionError::InvalidLimit, "admission-limit-invalid"),
            (AdmissionError::Busy, "admission-busy"),
            (AdmissionError::Closed, "admission-closed"),
            (AdmissionError::Uncertain, "admission-uncertain"),
            (AdmissionError::Poisoned, "admission-poisoned"),
        ] {
            assert_eq!(
                ManagedTranscriptionError::Admission(error).diagnostic_code(),
                expected
            );
        }
        let error = TranscriptionError::EngineFailed("private-engine-detail".into());
        let managed = ManagedTranscriptionError::Provider(error.clone());
        assert_eq!(managed.diagnostic_code(), error.diagnostic_code());
        assert_eq!(managed, ManagedTranscriptionError::Provider(error));
    }
    use crate::provider::ProviderFuture;
    use std::future::Future;
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::task::{Context, Poll, Waker};
    struct Fake {
        done: AtomicBool,
        calls: AtomicUsize,
        result: Result<TranscriptResult, TranscriptionError>,
        panic_on_enter: bool,
    }
    impl TranscriptionProvider for Fake {
        fn transcribe<'a>(
            &'a self,
            _: &'a TranscriptionRequest<'a>,
            _: Cancellation,
        ) -> ProviderFuture<'a, Result<TranscriptResult, TranscriptionError>> {
            assert!(!self.panic_on_enter, "synthetic provider constructor panic");
            self.calls.fetch_add(1, Ordering::SeqCst);
            Box::pin(std::future::poll_fn(move |_| {
                if self.done.load(Ordering::Acquire) {
                    Poll::Ready(self.result.clone())
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
            "fake-only"
        }
    }
    fn fake(done: bool) -> Fake {
        Fake {
            panic_on_enter: false,
            done: AtomicBool::new(done),
            calls: AtomicUsize::new(0),
            result: Ok(TranscriptResult {
                text: "synthetic".into(),
                confidence: None,
                is_partial: false,
            }),
        }
    }
    #[test]
    fn busy_calls_do_not_enter_engine_and_late_cancel_keeps_slot_until_completion() {
        let gate = ProviderAdmission::new(1).unwrap();
        let provider = fake(false);
        let request = TranscriptionRequest::new(&[0.25, -0.25], 16000, None).unwrap();
        let cancel = Cancellation::default();
        let mut cx = Context::from_waker(Waker::noop());
        let mut first = Box::pin(transcribe_managed(
            &gate,
            &provider,
            &request,
            cancel.clone(),
        ));
        assert!(first.as_mut().poll(&mut cx).is_pending());
        let mut rejected = Box::pin(transcribe_managed(
            &gate,
            &provider,
            &request,
            Cancellation::default(),
        ));
        assert_eq!(
            rejected.as_mut().poll(&mut cx),
            Poll::Ready(Err(ManagedTranscriptionError::Admission(
                AdmissionError::Busy
            )))
        );
        cancel.cancel();
        assert!(first.as_mut().poll(&mut cx).is_pending());
        assert_eq!(gate.status().unwrap().active, 1);
        assert_eq!(provider.calls.load(Ordering::SeqCst), 1);
        provider.done.store(true, Ordering::Release);
        assert_eq!(
            first.as_mut().poll(&mut cx),
            Poll::Ready(Err(ManagedTranscriptionError::Provider(
                TranscriptionError::Canceled
            )))
        );
        assert_eq!(gate.status().unwrap().active, 0);
        assert!(!gate.status().unwrap().uncertain);
    }
    #[test]
    fn dropped_entered_future_never_fabricates_completion_or_new_admission() {
        let gate = ProviderAdmission::new(1).unwrap();
        let provider = fake(false);
        let request = TranscriptionRequest::new(&[0.0], 16000, None).unwrap();
        let mut cx = Context::from_waker(Waker::noop());
        let mut job = Box::pin(transcribe_managed(
            &gate,
            &provider,
            &request,
            Cancellation::default(),
        ));
        assert!(job.as_mut().poll(&mut cx).is_pending());
        drop(job);
        assert_eq!(
            gate.status().unwrap(),
            AdmissionStatus {
                active: 1,
                closed: false,
                uncertain: true
            }
        );
        provider.done.store(true, Ordering::Release); // unknown worker finishing later does not repair the detached gate
        let mut next = Box::pin(transcribe_managed(
            &gate,
            &provider,
            &request,
            Cancellation::default(),
        ));
        assert_eq!(
            next.as_mut().poll(&mut cx),
            Poll::Ready(Err(ManagedTranscriptionError::Admission(
                AdmissionError::Uncertain
            )))
        );
        gate.close().unwrap();
        assert_eq!(gate.status().unwrap().active, 1);
    }
    #[test]
    fn unpolled_or_pre_canceled_futures_do_not_reserve_or_enter_provider() {
        let gate = ProviderAdmission::new(1).unwrap();
        let provider = fake(true);
        let request = TranscriptionRequest::new(&[0.0], 16000, None).unwrap();
        drop(transcribe_managed(
            &gate,
            &provider,
            &request,
            Cancellation::default(),
        ));
        let cancel = Cancellation::default();
        cancel.cancel();
        let mut job = Box::pin(transcribe_managed(&gate, &provider, &request, cancel));
        assert_eq!(
            job.as_mut().poll(&mut Context::from_waker(Waker::noop())),
            Poll::Ready(Err(ManagedTranscriptionError::Provider(
                TranscriptionError::Canceled
            )))
        );
        assert_eq!(gate.status().unwrap().active, 0);
        assert_eq!(provider.calls.load(Ordering::SeqCst), 0);
    }
    #[test]
    fn close_does_not_cancel_or_discard_already_admitted_result() {
        let gate = ProviderAdmission::new(1).unwrap();
        let provider = fake(false);
        let request = TranscriptionRequest::new(&[0.0], 16000, None).unwrap();
        let mut cx = Context::from_waker(Waker::noop());
        let mut job = Box::pin(transcribe_managed(
            &gate,
            &provider,
            &request,
            Cancellation::default(),
        ));
        assert!(job.as_mut().poll(&mut cx).is_pending());
        gate.close().unwrap();
        gate.close().unwrap();
        let mut next = Box::pin(transcribe_managed(
            &gate,
            &provider,
            &request,
            Cancellation::default(),
        ));
        assert_eq!(
            next.as_mut().poll(&mut cx),
            Poll::Ready(Err(ManagedTranscriptionError::Admission(
                AdmissionError::Closed
            )))
        );
        assert_eq!(gate.status().unwrap().active, 1);
        provider.done.store(true, Ordering::Release);
        assert_eq!(
            job.as_mut().poll(&mut cx),
            Poll::Ready(
                provider
                    .result
                    .clone()
                    .map_err(ManagedTranscriptionError::Provider)
            )
        );
        assert_eq!(gate.status().unwrap().active, 0);
    }
    #[test]
    fn provider_errors_and_invalid_results_release_only_after_provider_returns() {
        for result in [
            Err(TranscriptionError::ModelNotLoaded),
            Ok(TranscriptResult {
                text: "synthetic".into(),
                confidence: Some(f32::NAN),
                is_partial: false,
            }),
        ] {
            let gate = ProviderAdmission::new(1).unwrap();
            let mut provider = fake(true);
            provider.result = result;
            let request = TranscriptionRequest::new(&[0.0], 16000, None).unwrap();
            let mut job = Box::pin(transcribe_managed(
                &gate,
                &provider,
                &request,
                Cancellation::default(),
            ));
            assert!(matches!(
                job.as_mut().poll(&mut Context::from_waker(Waker::noop())),
                Poll::Ready(Err(ManagedTranscriptionError::Provider(_)))
            ));
            assert_eq!(gate.status().unwrap().active, 0);
            assert!(!gate.status().unwrap().uncertain);
        }
    }
    #[test]
    fn invalid_limits_and_poisoned_gate_fail_without_entering_engine() {
        for limit in [0, MAX_PROVIDER_JOBS + 1] {
            assert_eq!(
                ProviderAdmission::new(limit).unwrap_err(),
                AdmissionError::InvalidLimit
            );
        }
        let gate = ProviderAdmission::new(MAX_PROVIDER_JOBS).unwrap();
        let other = gate.clone();
        assert!(std::thread::spawn(move || {
            let _guard = other.0.lock().unwrap();
            panic!("synthetic poison");
        })
        .join()
        .is_err());
        assert_eq!(gate.status(), Err(AdmissionError::Poisoned));
        assert_eq!(gate.enter().err(), Some(AdmissionError::Poisoned));
    }

    #[test]
    fn constructor_panic_leaves_slot_uncertain_not_reusable() {
        let gate = ProviderAdmission::new(1).unwrap();
        let mut provider = fake(true);
        provider.panic_on_enter = true;
        let request = TranscriptionRequest::new(&[0.0], 16000, None).unwrap();
        let mut job = Box::pin(transcribe_managed(
            &gate,
            &provider,
            &request,
            Cancellation::default(),
        ));
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _ = job.as_mut().poll(&mut Context::from_waker(Waker::noop()));
        }))
        .is_err());
        drop(job);
        assert_eq!(
            gate.status().unwrap(),
            AdmissionStatus {
                active: 1,
                closed: false,
                uncertain: true
            }
        );
    }

    #[test]
    fn concurrent_callers_share_one_engine_slot_until_actual_future_completion() {
        use std::sync::Barrier;
        let gate = ProviderAdmission::new(1).unwrap();
        let provider = fake(false);
        let request = TranscriptionRequest::new(&[0.0], 16000, None).unwrap();
        let entered = Barrier::new(3);
        let release = Barrier::new(3);
        std::thread::scope(|scope| {
            let mut handles = Vec::new();
            for _ in 0..2 {
                handles.push(scope.spawn(|| {
                    let mut job = Box::pin(transcribe_managed(
                        &gate,
                        &provider,
                        &request,
                        Cancellation::default(),
                    ));
                    let mut cx = Context::from_waker(Waker::noop());
                    let first = job.as_mut().poll(&mut cx);
                    entered.wait();
                    release.wait();
                    match first {
                        Poll::Pending => {
                            assert!(matches!(job.as_mut().poll(&mut cx), Poll::Ready(Ok(_))));
                            true
                        }
                        other => {
                            assert_eq!(
                                other,
                                Poll::Ready(Err(ManagedTranscriptionError::Admission(
                                    AdmissionError::Busy
                                )))
                            );
                            false
                        }
                    }
                }));
            }
            entered.wait();
            let status = gate.status();
            let calls = provider.calls.load(Ordering::SeqCst);
            provider.done.store(true, Ordering::Release);
            release.wait();
            let admitted = handles
                .into_iter()
                .map(|v| v.join().unwrap())
                .filter(|v| *v)
                .count();
            assert_eq!(admitted, 1);
            assert_eq!(calls, 1);
            assert_eq!(
                status.unwrap(),
                AdmissionStatus {
                    active: 1,
                    closed: false,
                    uncertain: false
                }
            );
        });
        assert_eq!(
            gate.status().unwrap(),
            AdmissionStatus {
                active: 0,
                closed: false,
                uncertain: false
            }
        );
    }

    #[test]
    fn completing_known_jobs_never_reclaims_abandoned_jobs_or_exceeds_inclusive_limit() {
        let gate = ProviderAdmission::new(MAX_PROVIDER_JOBS).unwrap();
        let provider = fake(false);
        let request = TranscriptionRequest::new(&[0.0], 16000, None).unwrap();
        let mut cx = Context::from_waker(Waker::noop());
        let mut jobs = Vec::new();
        for _ in 0..MAX_PROVIDER_JOBS {
            let mut job = Box::pin(transcribe_managed(
                &gate,
                &provider,
                &request,
                Cancellation::default(),
            ));
            assert!(job.as_mut().poll(&mut cx).is_pending());
            jobs.push(job);
        }
        assert_eq!(gate.status().unwrap().active, MAX_PROVIDER_JOBS);
        let mut excess = Box::pin(transcribe_managed(
            &gate,
            &provider,
            &request,
            Cancellation::default(),
        ));
        assert_eq!(
            excess.as_mut().poll(&mut cx),
            Poll::Ready(Err(ManagedTranscriptionError::Admission(
                AdmissionError::Busy
            )))
        );
        assert_eq!(provider.calls.load(Ordering::SeqCst), MAX_PROVIDER_JOBS);
        drop(jobs.pop().unwrap());
        assert!(gate.status().unwrap().uncertain);
        provider.done.store(true, Ordering::Release);
        for mut job in jobs {
            assert!(matches!(job.as_mut().poll(&mut cx), Poll::Ready(Ok(_))));
        }
        assert_eq!(
            gate.status().unwrap(),
            AdmissionStatus {
                active: 1,
                closed: false,
                uncertain: true
            }
        );
    }
}
