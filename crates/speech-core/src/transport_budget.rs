//! Prototype session-scoped transport-buffer accounting, not billing credits,
//! a durable ACK, clock map or a bound on whole-process/engine memory.
//! Main/host owns the scope and limits. Source-role caps aggregate all epochs.
//! A lease must outlive its buffer. No reset/reopen or waiter queue is provided.

use crate::audio_frame_v0::Source;
use std::sync::{Arc, Mutex};

pub const MAX_GLOBAL_BUFFER_BYTES: u64 = 64 * 1024 * 1024;
pub const MAX_IN_FLIGHT: usize = 4096;

#[derive(Debug, Clone, Copy)]
pub struct BudgetLimits {
    pub global_bytes: u64,
    pub source_bytes: u64,
    pub global_frames: u64,
    pub source_frames: u64,
    pub in_flight: usize,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Cost {
    pub bytes: u64,
    pub frames: u64,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BudgetError {
    InvalidLimits,
    InvalidScope,
    WrongScope,
    InvalidCost,
    CostTooLarge,
    Capacity,
    Closed,
    Poisoned,
    Invariant,
}
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Usage {
    pub bytes: u64,
    pub frames: u64,
    pub leases: usize,
    pub sources: usize,
}
#[derive(Debug, Clone, Copy, Default)]
struct SourceUsage {
    bytes: u64,
    frames: u64,
    leases: usize,
}
#[derive(Debug)]
struct State {
    limits: BudgetLimits,
    bytes: u64,
    frames: u64,
    leases: usize,
    sources: [SourceUsage; 2],
    closed: bool,
    broken: bool,
}
fn index(source: Source) -> usize {
    match source {
        Source::System => 0,
        Source::Microphone => 1,
    }
}

#[derive(Debug, Clone)]
pub struct TransportBudget {
    nonce: [u8; 16],
    state: Arc<Mutex<State>>,
}
#[derive(Debug)]
pub struct BufferLease {
    state: Arc<Mutex<State>>,
    source: Source,
    cost: Cost,
}

impl TransportBudget {
    pub fn new(nonce: [u8; 16], limits: BudgetLimits) -> Result<Self, BudgetError> {
        if nonce.iter().all(|&v| v == 0) {
            return Err(BudgetError::InvalidScope);
        }
        if limits.global_bytes == 0
            || limits.global_bytes > MAX_GLOBAL_BUFFER_BYTES
            || limits.source_bytes == 0
            || limits.source_bytes > limits.global_bytes
            || limits.global_frames == 0
            || limits.source_frames == 0
            || limits.source_frames > limits.global_frames
            || limits.in_flight == 0
            || limits.in_flight > MAX_IN_FLIGHT
        {
            return Err(BudgetError::InvalidLimits);
        }
        Ok(Self {
            nonce,
            state: Arc::new(Mutex::new(State {
                limits,
                bytes: 0,
                frames: 0,
                leases: 0,
                sources: [SourceUsage::default(); 2],
                closed: false,
                broken: false,
            })),
        })
    }
    pub fn usage(&self) -> Result<Usage, BudgetError> {
        let state = self.state.lock().map_err(|_| BudgetError::Poisoned)?;
        if state.broken {
            return Err(BudgetError::Invariant);
        }
        Ok(Usage {
            bytes: state.bytes,
            frames: state.frames,
            leases: state.leases,
            sources: state.sources.iter().filter(|v| v.leases != 0).count(),
        })
    }
    pub fn close(&self) -> Result<(), BudgetError> {
        let mut state = self.state.lock().map_err(|_| BudgetError::Poisoned)?;
        if state.broken {
            return Err(BudgetError::Invariant);
        }
        state.closed = true;
        Ok(())
    }
    /// Pure accounting. Caller must derive truthful costs from owned buffers;
    /// this method does not allocate/authorize audio or authenticate a nonce.
    pub fn try_reserve(
        &self,
        nonce: [u8; 16],
        source: Source,
        cost: Cost,
    ) -> Result<BufferLease, BudgetError> {
        if nonce != self.nonce {
            return Err(BudgetError::WrongScope);
        }
        if cost.bytes == 0 || cost.frames == 0 {
            return Err(BudgetError::InvalidCost);
        }
        let mut state = self.state.lock().map_err(|_| BudgetError::Poisoned)?;
        if state.broken {
            return Err(BudgetError::Invariant);
        }
        if state.closed {
            return Err(BudgetError::Closed);
        }
        let limits = state.limits;
        if cost.bytes > limits.global_bytes
            || cost.bytes > limits.source_bytes
            || cost.frames > limits.global_frames
            || cost.frames > limits.source_frames
        {
            return Err(BudgetError::CostTooLarge);
        }
        let old = state.sources[index(source)];
        let next = (
            state.bytes.checked_add(cost.bytes),
            state.frames.checked_add(cost.frames),
            old.bytes.checked_add(cost.bytes),
            old.frames.checked_add(cost.frames),
        );
        let (Some(bytes), Some(frames), Some(source_bytes), Some(source_frames)) = next else {
            return Err(BudgetError::Capacity);
        };
        if bytes > limits.global_bytes
            || frames > limits.global_frames
            || source_bytes > limits.source_bytes
            || source_frames > limits.source_frames
            || state.leases >= limits.in_flight
        {
            return Err(BudgetError::Capacity);
        }
        state.bytes = bytes;
        state.frames = frames;
        state.leases += 1;
        state.sources[index(source)] = SourceUsage {
            bytes: source_bytes,
            frames: source_frames,
            leases: old.leases + 1,
        };
        Ok(BufferLease {
            state: Arc::clone(&self.state),
            source,
            cost,
        })
    }
}

impl Drop for BufferLease {
    fn drop(&mut self) {
        // Poison/corruption fails closed; never panic in Drop or fabricate zero
        // credit. A future host must drain old owners before replacing a pool.
        let Ok(mut state) = self.state.lock() else {
            return;
        };
        if state.broken {
            return;
        }
        let old = state.sources[index(self.source)];
        let next = (
            state.bytes.checked_sub(self.cost.bytes),
            state.frames.checked_sub(self.cost.frames),
            state.leases.checked_sub(1),
            old.bytes.checked_sub(self.cost.bytes),
            old.frames.checked_sub(self.cost.frames),
            old.leases.checked_sub(1),
        );
        let (
            Some(bytes),
            Some(frames),
            Some(leases),
            Some(source_bytes),
            Some(source_frames),
            Some(source_leases),
        ) = next
        else {
            state.broken = true;
            return;
        };
        state.bytes = bytes;
        state.frames = frames;
        state.leases = leases;
        state.sources[index(self.source)] = SourceUsage {
            bytes: source_bytes,
            frames: source_frames,
            leases: source_leases,
        };
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const NONCE: [u8; 16] = [1; 16];
    fn limits() -> BudgetLimits {
        BudgetLimits {
            global_bytes: 300,
            source_bytes: 200,
            global_frames: 30,
            source_frames: 20,
            in_flight: 3,
        }
    }
    fn pool() -> TransportBudget {
        TransportBudget::new(NONCE, limits()).unwrap()
    }
    #[test]
    fn invalid_configuration_and_costs_never_create_credit() {
        assert_eq!(
            TransportBudget::new([0; 16], limits()).unwrap_err(),
            BudgetError::InvalidScope
        );
        for config in [
            BudgetLimits {
                global_bytes: 0,
                ..limits()
            },
            BudgetLimits {
                global_bytes: MAX_GLOBAL_BUFFER_BYTES + 1,
                ..limits()
            },
            BudgetLimits {
                source_bytes: 301,
                ..limits()
            },
            BudgetLimits {
                global_frames: 0,
                ..limits()
            },
            BudgetLimits {
                source_frames: 31,
                ..limits()
            },
            BudgetLimits {
                in_flight: 0,
                ..limits()
            },
            BudgetLimits {
                in_flight: MAX_IN_FLIGHT + 1,
                ..limits()
            },
        ] {
            assert_eq!(
                TransportBudget::new(NONCE, config).unwrap_err(),
                BudgetError::InvalidLimits
            );
        }
        let pool = pool();
        for cost in [
            Cost {
                bytes: 0,
                frames: 1,
            },
            Cost {
                bytes: 1,
                frames: 0,
            },
        ] {
            assert_eq!(
                pool.try_reserve(NONCE, Source::System, cost).unwrap_err(),
                BudgetError::InvalidCost
            );
        }
        assert_eq!(
            pool.try_reserve(
                [2; 16],
                Source::System,
                Cost {
                    bytes: 1,
                    frames: 1
                }
            )
            .unwrap_err(),
            BudgetError::WrongScope
        );
        assert_eq!(pool.usage().unwrap(), Usage::default());
    }
    #[test]
    fn inclusive_global_source_and_slot_bounds_release_exact_cost_once() {
        let pool = pool();
        let a = pool
            .try_reserve(
                NONCE,
                Source::System,
                Cost {
                    bytes: 100,
                    frames: 10,
                },
            )
            .unwrap();
        let b = pool
            .try_reserve(
                NONCE,
                Source::System,
                Cost {
                    bytes: 100,
                    frames: 10,
                },
            )
            .unwrap();
        let before = pool.usage().unwrap();
        assert_eq!(
            pool.try_reserve(
                NONCE,
                Source::System,
                Cost {
                    bytes: 1,
                    frames: 1
                }
            )
            .unwrap_err(),
            BudgetError::Capacity
        );
        assert_eq!(pool.usage().unwrap(), before);
        let c = pool
            .try_reserve(
                NONCE,
                Source::Microphone,
                Cost {
                    bytes: 100,
                    frames: 10,
                },
            )
            .unwrap();
        assert_eq!(
            pool.usage().unwrap(),
            Usage {
                bytes: 300,
                frames: 30,
                leases: 3,
                sources: 2
            }
        );
        assert_eq!(
            pool.try_reserve(
                NONCE,
                Source::Microphone,
                Cost {
                    bytes: 1,
                    frames: 1
                }
            )
            .unwrap_err(),
            BudgetError::Capacity
        );
        drop(a);
        assert_eq!(pool.usage().unwrap().bytes, 200);
        drop(b);
        drop(c);
        assert_eq!(pool.usage().unwrap(), Usage::default());
    }
    #[test]
    fn permanently_oversized_cost_is_not_temporary_backpressure() {
        let pool = pool();
        for cost in [
            Cost {
                bytes: 201,
                frames: 1,
            },
            Cost {
                bytes: 1,
                frames: 21,
            },
        ] {
            assert_eq!(
                pool.try_reserve(NONCE, Source::System, cost).unwrap_err(),
                BudgetError::CostTooLarge
            );
        }
        assert_eq!(pool.usage().unwrap(), Usage::default());
    }
    #[test]
    fn checked_u64_work_counts_cannot_wrap_credit() {
        let pool = TransportBudget::new(
            NONCE,
            BudgetLimits {
                global_frames: u64::MAX,
                source_frames: u64::MAX,
                ..limits()
            },
        )
        .unwrap();
        let lease = pool
            .try_reserve(
                NONCE,
                Source::System,
                Cost {
                    bytes: 1,
                    frames: u64::MAX,
                },
            )
            .unwrap();
        assert_eq!(
            pool.try_reserve(
                NONCE,
                Source::Microphone,
                Cost {
                    bytes: 1,
                    frames: 1
                }
            )
            .unwrap_err(),
            BudgetError::Capacity
        );
        assert_eq!(pool.usage().unwrap().frames, u64::MAX);
        drop(lease);
        assert_eq!(pool.usage().unwrap(), Usage::default());
    }
    #[test]
    fn closed_admission_does_not_release_live_owners() {
        let pool = pool();
        let lease = pool
            .try_reserve(
                NONCE,
                Source::System,
                Cost {
                    bytes: 100,
                    frames: 10,
                },
            )
            .unwrap();
        pool.close().unwrap();
        pool.close().unwrap();
        assert_eq!(pool.usage().unwrap().bytes, 100);
        assert_eq!(
            pool.try_reserve(
                NONCE,
                Source::System,
                Cost {
                    bytes: 1,
                    frames: 1
                }
            )
            .unwrap_err(),
            BudgetError::Closed
        );
        drop(lease);
        assert_eq!(pool.usage().unwrap(), Usage::default());
    }
    #[test]
    fn concurrent_reservations_cannot_overbook_before_release() {
        use std::sync::Barrier;
        let pool = TransportBudget::new(
            NONCE,
            BudgetLimits {
                global_bytes: 150,
                source_bytes: 150,
                ..limits()
            },
        )
        .unwrap();
        let attempted = Arc::new(Barrier::new(3));
        let release = Arc::new(Barrier::new(3));
        let mut workers = Vec::new();
        for source in [Source::System, Source::Microphone] {
            let pool = pool.clone();
            let attempted = Arc::clone(&attempted);
            let release = Arc::clone(&release);
            workers.push(std::thread::spawn(move || {
                let result = pool.try_reserve(
                    NONCE,
                    source,
                    Cost {
                        bytes: 100,
                        frames: 10,
                    },
                );
                attempted.wait();
                release.wait();
                result.is_ok()
            }));
        }
        attempted.wait();
        let during = pool.usage();
        release.wait();
        assert_eq!(
            workers
                .into_iter()
                .map(|worker| worker.join().unwrap())
                .filter(|successful| *successful)
                .count(),
            1
        );
        assert_eq!(during.unwrap().bytes, 100);
        assert_eq!(pool.usage().unwrap(), Usage::default());
    }
    #[test]
    fn poisoned_mutex_and_broken_accounting_fail_closed_without_panicking_in_drop() {
        let pool = pool();
        let lease = pool
            .try_reserve(
                NONCE,
                Source::System,
                Cost {
                    bytes: 100,
                    frames: 10,
                },
            )
            .unwrap();
        {
            let mut state = pool.state.lock().unwrap();
            state.bytes = 0;
        }
        drop(lease);
        assert_eq!(pool.usage(), Err(BudgetError::Invariant));
        assert_eq!(
            pool.try_reserve(
                NONCE,
                Source::System,
                Cost {
                    bytes: 1,
                    frames: 1
                }
            )
            .unwrap_err(),
            BudgetError::Invariant
        );
        let pool = TransportBudget::new(NONCE, limits()).unwrap();
        let other = pool.clone();
        assert!(std::thread::spawn(move || {
            let _guard = other.state.lock().unwrap();
            panic!("synthetic poison");
        })
        .join()
        .is_err());
        assert_eq!(pool.usage(), Err(BudgetError::Poisoned));
    }
}
