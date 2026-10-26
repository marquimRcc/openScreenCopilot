//! Bounded optional capacity-change notification, not an executor/host/pipe.
//! Snapshot BEFORE trying admission, await change after Capacity, then recheck.
//! One waiter per source role, no FIFO/fairness or promise that retry will fit.

use super::{index, BudgetError, Source, State, TransportBudget};
use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex, Weak};
use std::task::{Context, Poll, Waker};

#[derive(Debug, Clone)]
pub struct BudgetRevision {
    pool: Weak<Mutex<State>>,
    revision: u64,
}
#[derive(Debug)]
pub(super) struct WaitSlot {
    id: u64,
    waker: Option<Waker>,
}
#[derive(Debug)]
#[must_use = "poll the change future or drop it to cancel its registration"]
pub struct BudgetChange {
    pool: Arc<Mutex<State>>,
    source: Source,
    revision: u64,
    id: Option<u64>,
    done: bool,
}

impl State {
    pub(super) fn changed(&mut self) -> [Option<Waker>; 2] {
        match self.revision.checked_add(1) {
            Some(next) => self.revision = next,
            None => self.broken = true, // never wrap and accept a stale observation
        }
        std::array::from_fn(|at| self.waiters[at].as_mut().and_then(|v| v.waker.take()))
    }
}
pub(super) fn wake_all(wakers: [Option<Waker>; 2]) {
    // Trusted executor callbacks are invoked ONLY after releasing the pool lock.
    // A wake callback panic must not panic out of a buffer lease destructor.
    for waker in wakers.into_iter().flatten() {
        let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| waker.wake()));
    }
}

impl TransportBudget {
    pub fn observe_change(&self) -> Result<BudgetRevision, BudgetError> {
        let state = self.state.lock().map_err(|_| BudgetError::Poisoned)?;
        if state.broken {
            return Err(BudgetError::Invariant);
        }
        if state.closed {
            return Err(BudgetError::Closed);
        }
        Ok(BudgetRevision {
            pool: Arc::downgrade(&self.state),
            revision: state.revision,
        })
    }
    pub fn wait_for_change(
        &self,
        observed: &BudgetRevision,
        source: Source,
    ) -> Result<BudgetChange, BudgetError> {
        if !Weak::ptr_eq(&observed.pool, &Arc::downgrade(&self.state)) {
            return Err(BudgetError::WrongScope);
        }
        let mut state = self.state.lock().map_err(|_| BudgetError::Poisoned)?;
        if state.broken {
            return Err(BudgetError::Invariant);
        }
        if state.closed {
            return Err(BudgetError::Closed);
        }
        let id = if state.revision != observed.revision {
            None // change happened before registration: first poll is already ready
        } else {
            let at = index(source);
            if state.waiters[at].is_some() {
                return Err(BudgetError::WaiterBusy);
            }
            let id = state.next_waiter;
            let Some(next) = id.checked_add(1) else {
                state.broken = true;
                let wakes = state.changed();
                drop(state);
                wake_all(wakes);
                return Err(BudgetError::Invariant);
            };
            state.next_waiter = next;
            state.waiters[at] = Some(WaitSlot { id, waker: None });
            Some(id)
        };
        Ok(BudgetChange {
            pool: Arc::clone(&self.state),
            source,
            revision: observed.revision,
            id,
            done: false,
        })
    }
}

impl Future for BudgetChange {
    type Output = Result<(), BudgetError>;
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let this = self.get_mut();
        if this.done {
            return Poll::Ready(Err(BudgetError::Closed));
        }
        // Clone/drop custom executor wakers outside the accounting lock.
        let candidate = cx.waker().clone();
        let pool = Arc::clone(&this.pool);
        let mut state = match pool.lock() {
            Ok(state) => state,
            Err(_) => {
                this.done = true;
                return Poll::Ready(Err(BudgetError::Poisoned));
            }
        };
        let result = if state.broken {
            Some(Err(BudgetError::Invariant))
        } else if state.closed {
            Some(Err(BudgetError::Closed))
        } else if state.revision != this.revision {
            Some(Ok(()))
        } else {
            None
        };
        let at = index(this.source);
        if let Some(result) = result {
            let old = if state.waiters[at]
                .as_ref()
                .is_some_and(|v| Some(v.id) == this.id)
            {
                state.waiters[at].take()
            } else {
                None
            };
            this.done = true;
            this.id = None;
            drop(state);
            drop(old);
            return Poll::Ready(result);
        }
        let Some(slot) = state.waiters[at].as_mut().filter(|v| Some(v.id) == this.id) else {
            this.done = true;
            return Poll::Ready(Err(BudgetError::Invariant));
        };
        let old = slot.waker.replace(candidate);
        drop(state);
        drop(old);
        Poll::Pending
    }
}
impl Drop for BudgetChange {
    fn drop(&mut self) {
        let old = {
            let Ok(mut state) = self.pool.lock() else {
                return;
            };
            let at = index(self.source);
            if state.waiters[at]
                .as_ref()
                .is_some_and(|v| Some(v.id) == self.id)
            {
                state.waiters[at].take()
            } else {
                None
            }
        };
        drop(old); // dropping a waiter cancels its notification, not a worker
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transport_budget::{BudgetLimits, Cost};
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::task::Wake;

    struct Counter(AtomicUsize);
    impl Wake for Counter {
        fn wake(self: Arc<Self>) {
            self.0.fetch_add(1, Ordering::SeqCst);
        }
    }
    fn pool() -> TransportBudget {
        TransportBudget::new(
            [1; 16],
            BudgetLimits {
                global_bytes: 100,
                source_bytes: 100,
                global_frames: 10,
                source_frames: 10,
                in_flight: 1,
            },
        )
        .unwrap()
    }
    fn poll(wait: &mut BudgetChange, counter: &Arc<Counter>) -> Poll<Result<(), BudgetError>> {
        let waker = Waker::from(Arc::clone(counter));
        Pin::new(wait).poll(&mut Context::from_waker(&waker))
    }
    fn counter() -> Arc<Counter> {
        Arc::new(Counter(AtomicUsize::new(0)))
    }
    fn held(pool: &TransportBudget) -> super::super::BufferLease {
        pool.try_reserve(
            [1; 16],
            Source::System,
            Cost {
                bytes: 100,
                frames: 10,
            },
        )
        .unwrap()
    }
    #[test]
    fn release_before_registration_or_first_poll_is_not_lost() {
        for release_before_register in [true, false] {
            let pool = pool();
            let held = held(&pool);
            let observed = pool.observe_change().unwrap();
            assert_eq!(
                pool.try_reserve(
                    [1; 16],
                    Source::System,
                    Cost {
                        bytes: 1,
                        frames: 1
                    }
                )
                .unwrap_err(),
                BudgetError::Capacity
            );
            let mut wait = if release_before_register {
                drop(held);
                pool.wait_for_change(&observed, Source::System).unwrap()
            } else {
                let wait = pool.wait_for_change(&observed, Source::System).unwrap();
                drop(held);
                wait
            };
            assert_eq!(poll(&mut wait, &counter()), Poll::Ready(Ok(())));
            assert!(pool
                .state
                .lock()
                .unwrap()
                .waiters
                .iter()
                .all(Option::is_none));
        }
    }
    #[test]
    fn release_wakes_both_roles_and_replacing_waker_does_not_wake_stale_executor() {
        let pool = pool();
        let held = held(&pool);
        let observed = pool.observe_change().unwrap();
        let mut system = pool.wait_for_change(&observed, Source::System).unwrap();
        let mut mic = pool.wait_for_change(&observed, Source::Microphone).unwrap();
        let stale = counter();
        let current = counter();
        let other = counter();
        assert_eq!(poll(&mut system, &stale), Poll::Pending);
        assert_eq!(poll(&mut system, &current), Poll::Pending);
        assert_eq!(poll(&mut mic, &other), Poll::Pending);
        drop(held);
        assert_eq!(stale.0.load(Ordering::SeqCst), 0);
        assert_eq!(current.0.load(Ordering::SeqCst), 1);
        assert_eq!(other.0.load(Ordering::SeqCst), 1);
        assert_eq!(poll(&mut system, &current), Poll::Ready(Ok(())));
        assert_eq!(poll(&mut mic, &other), Poll::Ready(Ok(())));
        assert_eq!(
            poll(&mut system, &current),
            Poll::Ready(Err(BudgetError::Closed))
        );
    }
    #[test]
    fn only_two_registrations_and_dropping_waiter_frees_its_own_slot_not_credit() {
        let pool = pool();
        let held = held(&pool);
        let observed = pool.observe_change().unwrap();
        let wait = pool.wait_for_change(&observed, Source::System).unwrap();
        let mut mic = pool.wait_for_change(&observed, Source::Microphone).unwrap();
        assert_eq!(
            pool.wait_for_change(&observed, Source::System).unwrap_err(),
            BudgetError::WaiterBusy
        );
        drop(wait);
        let mut replacement = pool.wait_for_change(&observed, Source::System).unwrap();
        assert_eq!(pool.usage().unwrap().bytes, 100);
        drop(held);
        assert_eq!(poll(&mut replacement, &counter()), Poll::Ready(Ok(())));
        assert_eq!(poll(&mut mic, &counter()), Poll::Ready(Ok(())));
    }
    #[test]
    fn close_wakes_without_revoking_live_credit_and_foreign_pool_is_rejected() {
        let pool = pool();
        let held = held(&pool);
        let observed = pool.observe_change().unwrap();
        let foreign = super::tests::pool();
        assert_eq!(
            foreign
                .wait_for_change(&observed, Source::System)
                .unwrap_err(),
            BudgetError::WrongScope
        );
        let mut wait = pool.wait_for_change(&observed, Source::System).unwrap();
        let count = counter();
        assert_eq!(poll(&mut wait, &count), Poll::Pending);
        let closed = pool.close_and_snapshot().unwrap();
        assert!(closed.admission_closed);
        assert_eq!(closed.usage.bytes, 100);
        assert_eq!(pool.close_and_snapshot().unwrap(), closed);
        assert_eq!(count.0.load(Ordering::SeqCst), 1);
        assert_eq!(pool.usage().unwrap().bytes, 100);
        assert_eq!(
            poll(&mut wait, &count),
            Poll::Ready(Err(BudgetError::Closed))
        );
        assert_eq!(pool.observe_change().unwrap_err(), BudgetError::Closed);
        drop(held);
        assert_eq!(pool.usage().unwrap().bytes, 0);
    }
    #[test]
    fn wake_callbacks_can_reenter_pool_after_unlock_and_panic_does_not_escape_lease_drop() {
        struct Reentrant(TransportBudget);
        impl Wake for Reentrant {
            fn wake(self: Arc<Self>) {
                assert!(self.0.state.try_lock().is_ok());
                assert_eq!(self.0.usage().unwrap().bytes, 0);
            }
        }
        struct Panics;
        impl Wake for Panics {
            fn wake(self: Arc<Self>) {
                panic!("synthetic executor wake panic");
            }
        }
        for panics in [false, true] {
            let pool = pool();
            let held = held(&pool);
            let observed = pool.observe_change().unwrap();
            let mut wait = pool.wait_for_change(&observed, Source::System).unwrap();
            let waker = if panics {
                Waker::from(Arc::new(Panics))
            } else {
                Waker::from(Arc::new(Reentrant(pool.clone())))
            };
            assert_eq!(
                Pin::new(&mut wait).poll(&mut Context::from_waker(&waker)),
                Poll::Pending
            );
            drop(held);
            assert_eq!(poll(&mut wait, &counter()), Poll::Ready(Ok(())));
        }
    }
    #[test]
    fn revision_and_registration_exhaustion_never_wrap_or_park_forever() {
        for revisions in [true, false] {
            let pool = pool();
            let held = held(&pool);
            {
                let mut state = pool.state.lock().unwrap();
                if revisions {
                    state.revision = u64::MAX;
                } else {
                    state.next_waiter = u64::MAX - 1;
                }
            }
            let observed = pool.observe_change().unwrap();
            let mut wait = pool.wait_for_change(&observed, Source::System).unwrap();
            let count = counter();
            assert_eq!(poll(&mut wait, &count), Poll::Pending);
            if revisions {
                drop(held);
            } else {
                assert_eq!(
                    pool.wait_for_change(&observed, Source::Microphone)
                        .unwrap_err(),
                    BudgetError::Invariant
                );
                drop(held);
            }
            assert_eq!(count.0.load(Ordering::SeqCst), 1);
            assert_eq!(
                poll(&mut wait, &count),
                Poll::Ready(Err(BudgetError::Invariant))
            );
            assert_eq!(pool.usage().unwrap_err(), BudgetError::Invariant);
        }
    }

    #[test]
    fn completed_old_future_drop_cannot_unregister_replacement() {
        let pool = pool();
        let held = held(&pool);
        let observed = pool.observe_change().unwrap();
        let mut old = pool.wait_for_change(&observed, Source::System).unwrap();
        drop(held);
        assert_eq!(poll(&mut old, &counter()), Poll::Ready(Ok(())));
        let latest = pool.observe_change().unwrap();
        let mut new = pool.wait_for_change(&latest, Source::System).unwrap();
        let count = counter();
        assert_eq!(poll(&mut new, &count), Poll::Pending);
        drop(old);
        pool.close().unwrap();
        assert_eq!(count.0.load(Ordering::SeqCst), 1);
        assert_eq!(
            poll(&mut new, &count),
            Poll::Ready(Err(BudgetError::Closed))
        );
    }

    #[test]
    fn racing_release_with_registration_and_poll_never_loses_notification() {
        use std::sync::Barrier;
        for _ in 0..100 {
            let pool = pool();
            let held = held(&pool);
            let observed = pool.observe_change().unwrap();
            let ready = Arc::new(Barrier::new(2));
            let other = Arc::clone(&ready);
            let release = std::thread::spawn(move || {
                other.wait();
                drop(held);
            });
            ready.wait();
            let mut wait = pool.wait_for_change(&observed, Source::System).unwrap();
            let count = counter();
            let first = poll(&mut wait, &count);
            release.join().unwrap();
            match first {
                Poll::Ready(result) => assert_eq!(result, Ok(())),
                Poll::Pending => {
                    assert_eq!(count.0.load(Ordering::SeqCst), 1);
                    assert_eq!(poll(&mut wait, &count), Poll::Ready(Ok(())));
                }
            }
            assert!(pool
                .state
                .lock()
                .unwrap()
                .waiters
                .iter()
                .all(Option::is_none));
        }
    }
}
