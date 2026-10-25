//! Explicit session lifecycle state machine and atomic discontinuity handling.
//!
//! Does not duplicate transport-buffer accounting belonging to [`TransportBudget`];
//! instead, uses the pool's coherent snapshot and closed-admission state as the
//! source of truth for buffer and managed-decoder drain observation.
//!
//! Does not claim worker, thread, or process drain. No async, FFI, or IPC.

use crate::transport_budget::{BudgetError, BudgetSnapshot, TransportBudget};

/// Persistent states of an audio capture/ingestion session.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionState {
    /// Initial state: pool is assigned, awaiting activation.
    Opening,
    /// Active state: frames and sequence numbers may progress.
    Active,
    /// Draining state: admission is closed, waiting for existing leases and
    /// managed decoders to be released by external owners.
    Draining,
    /// Terminal state: admission is closed and all leases/decoders observed at zero.
    Closed,
}

/// Result of a drain progress check.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DrainStatus {
    /// In-flight leases or managed decoders remain unreleased by external holders.
    Pending {
        remaining_leases: usize,
        managed_decoders: usize,
    },
    /// Both leases and managed decoders were observed at zero; state transitioned to Closed.
    Closed,
}

/// Atomic notice produced by recording a discontinuity event.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DiscontinuityNotice {
    pub epoch: u64,
    pub sequence: u64,
}

/// Lifecycle errors for session state transitions and counter checks.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LifecycleError {
    /// Attempted transition or operation is invalid for current state.
    InvalidState {
        current: SessionState,
        expected: &'static str,
    },
    /// The session is already closed and cannot be reopened or mutated.
    Closed,
    /// Epoch counter overflowed `u64::MAX`.
    EpochOverflow,
    /// Sequence counter overflowed `u64::MAX`.
    SequenceOverflow,
    /// Underlying transport budget error.
    Budget(BudgetError),
}

impl std::fmt::Display for LifecycleError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidState { current, expected } => {
                write!(f, "invalid session state {current:?}, expected {expected}")
            }
            Self::Closed => write!(f, "session is closed and cannot be reopened"),
            Self::EpochOverflow => write!(f, "session epoch overflow"),
            Self::SequenceOverflow => write!(f, "session sequence overflow"),
            Self::Budget(err) => write!(f, "transport budget error: {err:?}"),
        }
    }
}

impl std::error::Error for LifecycleError {}

impl From<BudgetError> for LifecycleError {
    fn from(err: BudgetError) -> Self {
        Self::Budget(err)
    }
}

/// Session lifecycle controller.
///
/// Encapsulates persistent state transitions, checked monotonic epoch advancement,
/// atomic discontinuity handling, and drain observation against an exact [`TransportBudget`].
pub struct SessionLifecycle {
    state: SessionState,
    epoch: u64,
    sequence: u64,
    pool: TransportBudget,
}

impl std::fmt::Debug for SessionLifecycle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SessionLifecycle")
            .field("state", &self.state)
            .field("epoch", &self.epoch)
            .field("sequence", &self.sequence)
            .finish_non_exhaustive()
    }
}

impl SessionLifecycle {
    /// Creates a new session in `Opening` state.
    ///
    /// Fails closed if the provided pool is already closed.
    pub fn new(
        pool: TransportBudget,
        initial_epoch: u64,
        initial_sequence: u64,
    ) -> Result<Self, LifecycleError> {
        let snap = pool.snapshot().map_err(LifecycleError::Budget)?;
        if snap.admission_closed {
            return Err(LifecycleError::Closed);
        }
        Ok(Self {
            state: SessionState::Opening,
            epoch: initial_epoch,
            sequence: initial_sequence,
            pool,
        })
    }

    /// Convenience constructor starting at epoch 0 and sequence 0.
    pub fn open(pool: TransportBudget) -> Result<Self, LifecycleError> {
        Self::new(pool, 0, 0)
    }

    /// Returns the current persistent state.
    pub fn state(&self) -> SessionState {
        self.state
    }

    /// Returns the current epoch.
    pub fn epoch(&self) -> u64 {
        self.epoch
    }

    /// Returns the current sequence number.
    pub fn sequence(&self) -> u64 {
        self.sequence
    }

    /// Reference to the underlying transport budget pool.
    pub fn pool(&self) -> &TransportBudget {
        &self.pool
    }

    pub fn is_opening(&self) -> bool {
        self.state == SessionState::Opening
    }

    pub fn is_active(&self) -> bool {
        self.state == SessionState::Active
    }

    pub fn is_draining(&self) -> bool {
        self.state == SessionState::Draining
    }

    pub fn is_closed(&self) -> bool {
        self.state == SessionState::Closed
    }

    /// Transitions from `Opening` to `Active`.
    ///
    /// Fails without mutation if not in `Opening` state.
    pub fn activate(&mut self) -> Result<(), LifecycleError> {
        match self.state {
            SessionState::Opening => {
                self.state = SessionState::Active;
                Ok(())
            }
            SessionState::Closed => Err(LifecycleError::Closed),
            other => Err(LifecycleError::InvalidState {
                current: other,
                expected: "Opening",
            }),
        }
    }

    /// Atomically records a discontinuity event.
    ///
    /// Discontinuity is an atomic event, NOT a persistent state:
    /// - Advances `epoch` by checked addition of 1.
    /// - Sets the `sequence` to `next_sequence`.
    /// - Preserves `Active` state.
    ///
    /// Fails closed without mutation if:
    /// - State is not `Active`.
    /// - `epoch` would overflow `u64::MAX`.
    pub fn record_discontinuity(
        &mut self,
        next_sequence: u64,
    ) -> Result<DiscontinuityNotice, LifecycleError> {
        if self.state != SessionState::Active {
            return Err(if self.state == SessionState::Closed {
                LifecycleError::Closed
            } else {
                LifecycleError::InvalidState {
                    current: self.state,
                    expected: "Active",
                }
            });
        }

        let next_epoch = self
            .epoch
            .checked_add(1)
            .ok_or(LifecycleError::EpochOverflow)?;
        self.epoch = next_epoch;
        self.sequence = next_sequence;

        Ok(DiscontinuityNotice {
            epoch: next_epoch,
            sequence: next_sequence,
        })
    }

    /// Returns the current sequence and advances it by checked addition of 1.
    ///
    /// Fails without mutation if not in `Active` state or if sequence would overflow.
    pub fn advance_sequence(&mut self) -> Result<u64, LifecycleError> {
        if self.state != SessionState::Active {
            return Err(if self.state == SessionState::Closed {
                LifecycleError::Closed
            } else {
                LifecycleError::InvalidState {
                    current: self.state,
                    expected: "Active",
                }
            });
        }

        let current = self.sequence;
        let next = current
            .checked_add(1)
            .ok_or(LifecycleError::SequenceOverflow)?;
        self.sequence = next;
        Ok(current)
    }

    /// Closes admission on the exact transport pool and begins drain observation.
    ///
    /// - Closes the underlying `TransportBudget` to prevent new admissions.
    /// - Reads a coherent snapshot:
    ///   - If `leases == 0` and `managed_decoders == 0`, transitions immediately to `Closed`.
    ///   - Otherwise, transitions to `Draining` and reports remaining counts.
    ///
    /// Idempotent when called repeatedly in `Draining` or `Closed`.
    pub fn begin_drain(&mut self) -> Result<DrainStatus, LifecycleError> {
        match self.state {
            SessionState::Closed => Ok(DrainStatus::Closed),
            SessionState::Draining => self.poll_drain(),
            SessionState::Opening | SessionState::Active => {
                self.pool.close().map_err(LifecycleError::Budget)?;
                let snap = self.pool.snapshot().map_err(LifecycleError::Budget)?;
                self.evaluate_snapshot(&snap)
            }
        }
    }

    /// Observes whether remaining leases and decoders have drained to zero.
    ///
    /// Fails without mutation if the session has not started draining.
    pub fn poll_drain(&mut self) -> Result<DrainStatus, LifecycleError> {
        match self.state {
            SessionState::Closed => Ok(DrainStatus::Closed),
            SessionState::Draining => {
                let snap = self.pool.snapshot().map_err(LifecycleError::Budget)?;
                self.evaluate_snapshot(&snap)
            }
            other => Err(LifecycleError::InvalidState {
                current: other,
                expected: "Draining",
            }),
        }
    }

    fn evaluate_snapshot(&mut self, snap: &BudgetSnapshot) -> Result<DrainStatus, LifecycleError> {
        if snap.usage.leases == 0 && snap.managed_decoders == 0 {
            self.state = SessionState::Closed;
            Ok(DrainStatus::Closed)
        } else {
            self.state = SessionState::Draining;
            Ok(DrainStatus::Pending {
                remaining_leases: snap.usage.leases,
                managed_decoders: snap.managed_decoders,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio_frame_v0::Source;
    use crate::transport_budget::{BudgetLimits, Cost};

    const TEST_NONCE: [u8; 16] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

    fn test_limits() -> BudgetLimits {
        BudgetLimits {
            global_bytes: 4096,
            source_bytes: 2048,
            global_frames: 400,
            source_frames: 200,
            in_flight: 10,
        }
    }

    fn test_pool() -> TransportBudget {
        TransportBudget::new(TEST_NONCE, test_limits()).unwrap()
    }

    #[test]
    fn valid_lifecycle_progression_from_open_to_closed() {
        let pool = test_pool();
        let mut lifecycle = SessionLifecycle::open(pool).unwrap();
        assert_eq!(lifecycle.state(), SessionState::Opening);
        assert!(lifecycle.is_opening());

        lifecycle.activate().unwrap();
        assert_eq!(lifecycle.state(), SessionState::Active);
        assert!(lifecycle.is_active());

        assert_eq!(lifecycle.advance_sequence().unwrap(), 0);
        assert_eq!(lifecycle.sequence(), 1);
        assert_eq!(lifecycle.advance_sequence().unwrap(), 1);
        assert_eq!(lifecycle.sequence(), 2);

        // Immediate drain when pool has no active leases/decoders
        let status = lifecycle.begin_drain().unwrap();
        assert_eq!(status, DrainStatus::Closed);
        assert_eq!(lifecycle.state(), SessionState::Closed);
        assert!(lifecycle.is_closed());

        // Idempotent drain poll on closed lifecycle
        assert_eq!(lifecycle.poll_drain().unwrap(), DrainStatus::Closed);
        assert_eq!(lifecycle.begin_drain().unwrap(), DrainStatus::Closed);
    }

    #[test]
    fn invalid_transitions_fail_without_mutating_state() {
        let pool = test_pool();
        let mut lifecycle = SessionLifecycle::open(pool).unwrap();

        // Advance sequence not allowed while Opening
        assert_eq!(
            lifecycle.advance_sequence().unwrap_err(),
            LifecycleError::InvalidState {
                current: SessionState::Opening,
                expected: "Active",
            }
        );
        assert_eq!(lifecycle.sequence(), 0);

        // Discontinuity not allowed while Opening
        assert_eq!(
            lifecycle.record_discontinuity(10).unwrap_err(),
            LifecycleError::InvalidState {
                current: SessionState::Opening,
                expected: "Active",
            }
        );
        assert_eq!(lifecycle.epoch(), 0);
        assert_eq!(lifecycle.sequence(), 0);

        // Poll drain not allowed while Opening
        assert_eq!(
            lifecycle.poll_drain().unwrap_err(),
            LifecycleError::InvalidState {
                current: SessionState::Opening,
                expected: "Draining",
            }
        );
        assert_eq!(lifecycle.state(), SessionState::Opening);

        // Activate to Active
        lifecycle.activate().unwrap();
        assert_eq!(lifecycle.state(), SessionState::Active);

        // Cannot activate again
        assert_eq!(
            lifecycle.activate().unwrap_err(),
            LifecycleError::InvalidState {
                current: SessionState::Active,
                expected: "Opening",
            }
        );
        assert_eq!(lifecycle.state(), SessionState::Active);

        // Poll drain not allowed while Active
        assert_eq!(
            lifecycle.poll_drain().unwrap_err(),
            LifecycleError::InvalidState {
                current: SessionState::Active,
                expected: "Draining",
            }
        );

        // Drain directly to Closed
        lifecycle.begin_drain().unwrap();
        assert_eq!(lifecycle.state(), SessionState::Closed);

        // Reopening from Closed is forbidden
        assert_eq!(lifecycle.activate().unwrap_err(), LifecycleError::Closed);
        assert_eq!(
            lifecycle.advance_sequence().unwrap_err(),
            LifecycleError::Closed
        );
        assert_eq!(
            lifecycle.record_discontinuity(50).unwrap_err(),
            LifecycleError::Closed
        );
        assert_eq!(lifecycle.state(), SessionState::Closed);
    }

    #[test]
    fn discontinuity_is_atomic_event_and_does_not_persist_as_state() {
        let pool = test_pool();
        let mut lifecycle = SessionLifecycle::open(pool).unwrap();
        lifecycle.activate().unwrap();

        assert_eq!(lifecycle.epoch(), 0);
        assert_eq!(lifecycle.sequence(), 0);

        let notice = lifecycle.record_discontinuity(42).unwrap();
        assert_eq!(
            notice,
            DiscontinuityNotice {
                epoch: 1,
                sequence: 42,
            }
        );
        assert_eq!(lifecycle.epoch(), 1);
        assert_eq!(lifecycle.sequence(), 42);
        // State remains Active
        assert_eq!(lifecycle.state(), SessionState::Active);

        let next = lifecycle.advance_sequence().unwrap();
        assert_eq!(next, 42);
        assert_eq!(lifecycle.sequence(), 43);

        let second_notice = lifecycle.record_discontinuity(0).unwrap();
        assert_eq!(
            second_notice,
            DiscontinuityNotice {
                epoch: 2,
                sequence: 0,
            }
        );
        assert_eq!(lifecycle.epoch(), 2);
        assert_eq!(lifecycle.sequence(), 0);
        assert_eq!(lifecycle.state(), SessionState::Active);
    }

    #[test]
    fn epoch_and_sequence_overflow_fail_closed_without_mutation() {
        let pool = test_pool();
        let mut lifecycle = SessionLifecycle::new(pool, u64::MAX, u64::MAX).unwrap();
        lifecycle.activate().unwrap();

        // Sequence overflow
        assert_eq!(
            lifecycle.advance_sequence().unwrap_err(),
            LifecycleError::SequenceOverflow
        );
        assert_eq!(lifecycle.sequence(), u64::MAX);

        // Epoch overflow
        assert_eq!(
            lifecycle.record_discontinuity(100).unwrap_err(),
            LifecycleError::EpochOverflow
        );
        assert_eq!(lifecycle.epoch(), u64::MAX);
        // Sequence was NOT updated to 100 because epoch overflowed atomically
        assert_eq!(lifecycle.sequence(), u64::MAX);
        assert_eq!(lifecycle.state(), SessionState::Active);
    }

    #[test]
    fn pending_drain_with_active_leases_blocks_until_drop() {
        let pool = test_pool();
        // Reserve an active lease from the pool
        let lease = pool
            .try_reserve(
                TEST_NONCE,
                Source::System,
                Cost {
                    bytes: 100,
                    frames: 10,
                },
            )
            .unwrap();

        let mut lifecycle = SessionLifecycle::open(pool.clone()).unwrap();
        lifecycle.activate().unwrap();

        // begin_drain closes admission and observes 1 active lease
        let status = lifecycle.begin_drain().unwrap();
        assert_eq!(
            status,
            DrainStatus::Pending {
                remaining_leases: 1,
                managed_decoders: 0,
            }
        );
        assert_eq!(lifecycle.state(), SessionState::Draining);
        assert!(lifecycle.is_draining());

        // Subsequent reservation on the closed pool is rejected
        assert_eq!(
            pool.try_reserve(
                TEST_NONCE,
                Source::System,
                Cost {
                    bytes: 100,
                    frames: 10,
                },
            )
            .unwrap_err(),
            BudgetError::Closed
        );

        // Repeated polling still pending while lease is held
        assert_eq!(
            lifecycle.poll_drain().unwrap(),
            DrainStatus::Pending {
                remaining_leases: 1,
                managed_decoders: 0,
            }
        );
        assert_eq!(lifecycle.state(), SessionState::Draining);

        // Drop the lease: releases ownership in the pool
        drop(lease);

        // Now poll_drain observes 0 leases and transitions to Closed
        assert_eq!(lifecycle.poll_drain().unwrap(), DrainStatus::Closed);
        assert_eq!(lifecycle.state(), SessionState::Closed);
        assert!(lifecycle.is_closed());
    }

    #[test]
    fn pending_drain_with_managed_decoder_blocks_until_permit_drop() {
        let pool = test_pool();
        let permit = pool.admit_decoder(TEST_NONCE, Source::Microphone).unwrap();

        let mut lifecycle = SessionLifecycle::open(pool.clone()).unwrap();
        lifecycle.activate().unwrap();

        let status = lifecycle.begin_drain().unwrap();
        assert_eq!(
            status,
            DrainStatus::Pending {
                remaining_leases: 0,
                managed_decoders: 1,
            }
        );
        assert_eq!(lifecycle.state(), SessionState::Draining);

        // New decoder admission rejected on closed pool
        match pool.admit_decoder(TEST_NONCE, Source::System) {
            Err(BudgetError::Closed) => {}
            Ok(_) => panic!("expected Closed error, got Ok"),
            Err(err) => panic!("expected Closed error, got {err:?}"),
        }

        // Polling still pending
        assert_eq!(
            lifecycle.poll_drain().unwrap(),
            DrainStatus::Pending {
                remaining_leases: 0,
                managed_decoders: 1,
            }
        );

        // Drop permit
        drop(permit);

        // Transitions to Closed
        assert_eq!(lifecycle.poll_drain().unwrap(), DrainStatus::Closed);
        assert_eq!(lifecycle.state(), SessionState::Closed);
    }

    #[test]
    fn opening_cancellation_via_begin_drain() {
        let pool = test_pool();
        let mut lifecycle = SessionLifecycle::open(pool).unwrap();
        assert_eq!(lifecycle.state(), SessionState::Opening);

        // Cancel before ever activating
        let status = lifecycle.begin_drain().unwrap();
        assert_eq!(status, DrainStatus::Closed);
        assert_eq!(lifecycle.state(), SessionState::Closed);
    }

    #[test]
    fn cannot_open_on_already_closed_pool() {
        let pool = test_pool();
        pool.close().unwrap();

        assert_eq!(
            SessionLifecycle::open(pool).unwrap_err(),
            LifecycleError::Closed
        );
    }

    #[test]
    fn debug_output_does_not_leak_nonce_or_private_data() {
        let pool = test_pool();
        let lifecycle = SessionLifecycle::open(pool).unwrap();
        let debug = format!("{lifecycle:?}");
        assert!(!debug.contains("nonce"));
        assert!(!debug.contains("1, 2, 3"));
        assert!(debug.contains("Opening"));
    }
}
