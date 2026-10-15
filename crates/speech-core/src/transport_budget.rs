//! Prototype session-scoped transport-buffer accounting, not billing credits,
//! a durable ACK, clock map or a bound on whole-process/engine memory.
//! Main/host owns the scope and limits. Source-role caps aggregate all epochs.
//! A lease must outlive its buffer. No reset/reopen or unbounded waiter queue.

#[path = "budget_change.rs"]
mod change;
pub use change::{BudgetChange, BudgetRevision};

use crate::audio_frame_v0::{parse_header, Source, HEADER_BYTES};
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
enum ReservationTime {
    Audio(Option<u64>),
    UnparsedInput,
}
/// Optional summed audio-duration admission. Both source roles aggregate epochs.
/// Nanoseconds are a conservative per-packet bound, not media/capture timestamps.
#[derive(Debug, Clone, Copy)]
pub struct AudioTimeLimits {
    pub global_ns: u64,
    pub source_ns: u64,
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
    AudioTimeRequired,
    InvalidAudioHeader,
    WaiterBusy,
    DecoderBusy,
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
    audio_ns: u64,
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
    time_limits: Option<AudioTimeLimits>,
    audio_ns: u64,
    revision: u64,
    next_waiter: u64,
    waiters: [Option<change::WaitSlot>; 2],
    decoders: [bool; 2],
}
fn index(source: Source) -> usize {
    match source {
        Source::System => 0,
        Source::Microphone => 1,
    }
}

#[derive(Clone)]
pub struct TransportBudget {
    nonce: [u8; 16],
    state: Arc<Mutex<State>>,
}
impl std::fmt::Debug for TransportBudget {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut out = f.debug_struct("TransportBudget");
        match self.state.try_lock() {
            Ok(state) => {
                out.field("bytes", &state.bytes)
                    .field("frames", &state.frames)
                    .field("leases", &state.leases)
                    .field("closed", &state.closed)
                    .field("broken", &state.broken);
            }
            Err(_) => {
                out.field("state", &"unavailable");
            }
        }
        out.finish_non_exhaustive()
    }
}
#[derive(Debug)]
pub struct BufferLease {
    state: Arc<Mutex<State>>,
    source: Source,
    cost: Cost,
    audio_ns: u64,
}
// Optional managed decoder ownership, independent of handed-off buffer leases.
pub(crate) struct DecoderPermit {
    state: Arc<Mutex<State>>,
    source: Source,
}
impl Drop for DecoderPermit {
    fn drop(&mut self) {
        let Ok(mut state) = self.state.lock() else {
            return;
        };
        if state.broken {
            return;
        }
        let slot = &mut state.decoders[index(self.source)];
        if !*slot {
            state.broken = true;
        } else {
            *slot = false;
        }
        let wakes = state.changed();
        drop(state);
        change::wake_all(wakes);
    }
}
impl BufferLease {
    pub(crate) fn belongs_to(&self, pool: &TransportBudget) -> bool {
        Arc::ptr_eq(&self.state, &pool.state)
    }
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
                time_limits: None,
                audio_ns: 0,
                revision: 0,
                next_waiter: 1,
                waiters: [None, None],
                decoders: [false; 2],
            })),
        })
    }
    pub fn with_audio_time_limits(
        nonce: [u8; 16],
        limits: BudgetLimits,
        time_limits: AudioTimeLimits,
    ) -> Result<Self, BudgetError> {
        if time_limits.global_ns == 0
            || time_limits.source_ns == 0
            || time_limits.source_ns > time_limits.global_ns
        {
            return Err(BudgetError::InvalidLimits);
        }
        let pool = Self::new(nonce, limits)?;
        pool.state
            .lock()
            .map_err(|_| BudgetError::Poisoned)?
            .time_limits = Some(time_limits);
        Ok(pool)
    }
    pub fn audio_time_usage_ns(&self) -> Result<(u64, [u64; 2]), BudgetError> {
        let state = self.state.lock().map_err(|_| BudgetError::Poisoned)?;
        if state.broken {
            return Err(BudgetError::Invariant);
        }
        Ok((
            state.audio_ns,
            [state.sources[0].audio_ns, state.sources[1].audio_ns],
        ))
    }
    /// Managed decoder factory only: a fixed slot per source, aggregated epochs.
    pub(crate) fn admit_decoder(
        &self,
        nonce: [u8; 16],
        source: Source,
    ) -> Result<DecoderPermit, BudgetError> {
        if nonce != self.nonce {
            return Err(BudgetError::WrongScope);
        }
        let mut state = self.state.lock().map_err(|_| BudgetError::Poisoned)?;
        if state.broken {
            return Err(BudgetError::Invariant);
        }
        if state.closed {
            return Err(BudgetError::Closed);
        }
        let slot = &mut state.decoders[index(source)];
        if *slot {
            return Err(BudgetError::DecoderBusy);
        }
        *slot = true;
        Ok(DecoderPermit {
            state: Arc::clone(&self.state),
            source,
        })
    }
    pub fn managed_decoder_count(&self) -> Result<usize, BudgetError> {
        let state = self.state.lock().map_err(|_| BudgetError::Poisoned)?;
        if state.broken {
            return Err(BudgetError::Invariant);
        }
        Ok(state.decoders.iter().filter(|&&used| used).count())
    }
    /// Reparse fixed raw metadata; payload validity remains the decoder's job.
    /// Rounded UP per packet so tiny packets can never obtain free duration.
    /// This is intentionally conservative and not partition-invariant clock math.
    pub fn try_reserve_frame(&self, bytes: &[u8]) -> Result<BufferLease, BudgetError> {
        let header = parse_header(bytes).map_err(|_| BudgetError::InvalidAudioHeader)?;
        let numerator = u128::from(header.frame_count) * 1_000_000_000;
        let audio_ns = numerator.div_ceil(u128::from(header.sample_rate));
        let audio_ns = u64::try_from(audio_ns).map_err(|_| BudgetError::InvalidCost)?;
        self.reserve(
            header.session_nonce,
            header.source,
            Cost {
                bytes: HEADER_BYTES as u64 + u64::from(header.payload_bytes),
                frames: u64::from(header.frame_count),
            },
            ReservationTime::Audio(Some(audio_ns)),
        )
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
        if state.closed {
            return Ok(());
        }
        state.closed = true;
        let wakes = state.changed();
        drop(state);
        change::wake_all(wakes);
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
        self.reserve(nonce, source, cost, ReservationTime::Audio(None))
    }
    // Raw bounded input is counted by bytes/lease, never invented sample frames
    // or duration. Its destination audio frame must separately pass admission.
    pub(crate) fn reserve_input(
        &self,
        nonce: [u8; 16],
        source: Source,
        bytes: u64,
    ) -> Result<BufferLease, BudgetError> {
        self.reserve(
            nonce,
            source,
            Cost { bytes, frames: 0 },
            ReservationTime::UnparsedInput,
        )
    }
    fn reserve(
        &self,
        nonce: [u8; 16],
        source: Source,
        cost: Cost,
        time: ReservationTime,
    ) -> Result<BufferLease, BudgetError> {
        if nonce != self.nonce {
            return Err(BudgetError::WrongScope);
        }
        let unparsed_input = matches!(time, ReservationTime::UnparsedInput);
        let audio_ns = match time {
            ReservationTime::Audio(duration) => duration,
            ReservationTime::UnparsedInput => Some(0),
        };
        if cost.bytes == 0 || (cost.frames == 0) != unparsed_input {
            return Err(BudgetError::InvalidCost);
        }
        let mut state = self.state.lock().map_err(|_| BudgetError::Poisoned)?;
        if state.broken {
            return Err(BudgetError::Invariant);
        }
        if state.closed {
            return Err(BudgetError::Closed);
        }
        if state.time_limits.is_some() && audio_ns.is_none() {
            return Err(BudgetError::AudioTimeRequired);
        }
        let audio_ns = audio_ns.unwrap_or(0);
        let limits = state.limits;
        if cost.bytes > limits.global_bytes
            || cost.bytes > limits.source_bytes
            || cost.frames > limits.global_frames
            || cost.frames > limits.source_frames
        {
            return Err(BudgetError::CostTooLarge);
        }
        let old = state.sources[index(source)];
        if let Some(time) = state.time_limits {
            if audio_ns > time.global_ns || audio_ns > time.source_ns {
                return Err(BudgetError::CostTooLarge);
            }
        }
        let (Some(total_ns), Some(source_ns)) = (
            state.audio_ns.checked_add(audio_ns),
            old.audio_ns.checked_add(audio_ns),
        ) else {
            return Err(BudgetError::Capacity);
        };
        if state
            .time_limits
            .is_some_and(|time| total_ns > time.global_ns || source_ns > time.source_ns)
        {
            return Err(BudgetError::Capacity);
        }
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
        state.audio_ns = total_ns;
        state.sources[index(source)] = SourceUsage {
            bytes: source_bytes,
            frames: source_frames,
            leases: old.leases + 1,
            audio_ns: source_ns,
        };
        Ok(BufferLease {
            state: Arc::clone(&self.state),
            source,
            cost,
            audio_ns,
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
        let (Some(total_ns), Some(source_ns)) = (
            state.audio_ns.checked_sub(self.audio_ns),
            old.audio_ns.checked_sub(self.audio_ns),
        ) else {
            state.broken = true;
            let wakes = state.changed();
            drop(state);
            change::wake_all(wakes);
            return;
        };
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
            let wakes = state.changed();
            drop(state);
            change::wake_all(wakes);
            return;
        };
        state.bytes = bytes;
        state.frames = frames;
        state.leases = leases;
        state.audio_ns = total_ns;
        state.sources[index(self.source)] = SourceUsage {
            bytes: source_bytes,
            frames: source_frames,
            leases: source_leases,
            audio_ns: source_ns,
        };
        let wakes = state.changed();
        drop(state);
        change::wake_all(wakes);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const NONCE: [u8; 16] = [1; 16];

    #[test]
    fn mixed_unparsed_input_and_audio_reservations_match_independent_duration_model() {
        let pool = TransportBudget::with_audio_time_limits(
            NONCE,
            BudgetLimits {
                global_bytes: 1024,
                source_bytes: 768,
                global_frames: 16,
                source_frames: 12,
                in_flight: 8,
            },
            AudioTimeLimits {
                global_ns: 200_000,
                source_ns: 150_000,
            },
        )
        .unwrap();
        let mut held: Vec<(usize, u64, u64, u64, BufferLease)> = Vec::new();
        let mut seed = 0x9532u64;
        let mut closed = false;
        for step in 0..10_000 {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
            if step == 9000 {
                pool.close().unwrap();
                closed = true;
            }
            if seed.is_multiple_of(3) && !held.is_empty() {
                let at = (seed as usize) % held.len();
                drop(held.swap_remove(at));
            } else {
                let source = if seed & 8 == 0 {
                    Source::System
                } else {
                    Source::Microphone
                };
                let at = index(source);
                let raw = seed & 16 == 0;
                let count = 1 + (seed >> 8) % 4;
                let rate = [16_000u32, 44_100, 48_000][((seed >> 12) % 3) as usize];
                let bytes = if raw {
                    1 + (seed >> 16) % 128
                } else {
                    80 + count * 4
                };
                let frames = if raw { 0 } else { count };
                let ns = if raw {
                    0
                } else {
                    (frames * 1_000_000_000).div_ceil(u64::from(rate))
                };
                let sum = |source: Option<usize>| {
                    held.iter()
                        .filter(|entry| source.is_none_or(|wanted| wanted == entry.0))
                        .fold((0u64, 0u64, 0u64), |a, e| (a.0 + e.1, a.1 + e.2, a.2 + e.3))
                };
                let total = sum(None);
                let own = sum(Some(at));
                let expected = if closed {
                    Some(BudgetError::Closed)
                } else if bytes > 768 || frames > 12 || ns > 150_000 {
                    Some(BudgetError::CostTooLarge)
                } else if held.len() >= 8
                    || total.0 + bytes > 1024
                    || own.0 + bytes > 768
                    || total.1 + frames > 16
                    || own.1 + frames > 12
                    || total.2 + ns > 200_000
                    || own.2 + ns > 150_000
                {
                    Some(BudgetError::Capacity)
                } else {
                    None
                };
                let actual = if raw {
                    pool.reserve_input(NONCE, source, bytes)
                } else {
                    pool.try_reserve_frame(&audio_header(rate, count as u32, source, step))
                };
                match (actual, expected) {
                    (Ok(lease), None) => held.push((at, bytes, frames, ns, lease)),
                    (Err(actual), Some(expected)) => assert_eq!(actual, expected),
                    _ => panic!("mixed admission mismatch at step {step}"),
                }
            }
            let total_bytes: u64 = held.iter().map(|entry| entry.1).sum();
            let total_frames: u64 = held.iter().map(|entry| entry.2).sum();
            let source_ns: [u64; 2] = std::array::from_fn(|at| {
                held.iter()
                    .filter(|entry| entry.0 == at)
                    .map(|entry| entry.3)
                    .sum()
            });
            assert_eq!(
                pool.usage().unwrap(),
                Usage {
                    bytes: total_bytes,
                    frames: total_frames,
                    leases: held.len(),
                    sources: (0..2)
                        .filter(|&at| held.iter().any(|entry| entry.0 == at))
                        .count(),
                }
            );
            assert_eq!(
                pool.audio_time_usage_ns().unwrap(),
                (source_ns.iter().sum(), source_ns)
            );
        }
        drop(held);
        assert_eq!(pool.usage().unwrap(), Usage::default());
        assert_eq!(pool.audio_time_usage_ns(), Ok((0, [0, 0])));
    }

    #[test]
    fn managed_permit_corruption_and_revision_overflow_fail_closed() {
        for corrupt_slot in [false, true] {
            let pool = pool();
            let permit = pool.admit_decoder(NONCE, Source::System).unwrap();
            if corrupt_slot {
                pool.state.lock().unwrap().decoders[0] = false;
            } else {
                pool.state.lock().unwrap().revision = u64::MAX;
            }
            drop(permit);
            assert_eq!(pool.managed_decoder_count(), Err(BudgetError::Invariant));
            assert!(matches!(
                pool.admit_decoder(NONCE, Source::System),
                Err(BudgetError::Invariant)
            ));
        }
    }

    #[test]
    fn poisoned_pool_never_reopens_a_managed_slot_or_panics_in_permit_drop() {
        let pool = pool();
        let permit = pool.admit_decoder(NONCE, Source::System).unwrap();
        let other = pool.clone();
        assert!(std::thread::spawn(move || {
            let _guard = other.state.lock().unwrap();
            panic!("synthetic poison only");
        })
        .join()
        .is_err());
        drop(permit);
        assert_eq!(pool.managed_decoder_count(), Err(BudgetError::Poisoned));
        assert!(matches!(
            pool.admit_decoder(NONCE, Source::System),
            Err(BudgetError::Poisoned)
        ));
    }

    #[test]
    fn pool_debug_never_relocks_a_held_mutex_or_exposes_nonce() {
        let pool = pool();
        assert!(!format!("{pool:?}").contains("nonce"));
        let guard = pool.state.lock().unwrap();
        assert!(format!("{pool:?}").contains("unavailable"));
        drop(guard);
        assert!(!format!("{pool:?}").contains("unavailable"));
    }
    fn audio_header(rate: u32, frames: u32, source: Source, epoch: u64) -> [u8; HEADER_BYTES] {
        let mut bytes = [0; HEADER_BYTES];
        bytes[..4].copy_from_slice(b"OSCP");
        bytes[5] = 1;
        bytes[6..8].copy_from_slice(&(HEADER_BYTES as u16).to_le_bytes());
        bytes[8..12].copy_from_slice(&(frames * 4).to_le_bytes());
        bytes[12..16].copy_from_slice(&rate.to_le_bytes());
        bytes[16..18].copy_from_slice(&1_u16.to_le_bytes());
        bytes[18] = 1;
        bytes[19] = if source == Source::System { 1 } else { 2 };
        bytes[24..40].copy_from_slice(&NONCE);
        bytes[40..48].copy_from_slice(&epoch.to_le_bytes());
        bytes[64..68].copy_from_slice(&frames.to_le_bytes());
        bytes
    }
    fn timed(global_ns: u64, source_ns: u64) -> TransportBudget {
        TransportBudget::with_audio_time_limits(
            NONCE,
            BudgetLimits {
                global_bytes: MAX_GLOBAL_BUFFER_BYTES,
                source_bytes: MAX_GLOBAL_BUFFER_BYTES,
                global_frames: 1_000_000,
                source_frames: 1_000_000,
                in_flight: 32,
            },
            AudioTimeLimits {
                global_ns,
                source_ns,
            },
        )
        .unwrap()
    }
    #[test]
    fn time_caps_sum_audio_across_rates_sources_and_epochs_without_releasing_live_owners() {
        let pool = timed(20_000_000, 15_000_000);
        let system = pool
            .try_reserve_frame(&audio_header(48_000, 480, Source::System, 0))
            .unwrap();
        let mic = pool
            .try_reserve_frame(&audio_header(16_000, 160, Source::Microphone, 2))
            .unwrap();
        assert_eq!(
            pool.audio_time_usage_ns().unwrap(),
            (20_000_000, [10_000_000; 2])
        );
        let next = audio_header(44_100, 1, Source::System, 1);
        assert_eq!(
            pool.try_reserve_frame(&next).unwrap_err(),
            BudgetError::Capacity
        );
        drop(mic);
        let newer = pool.try_reserve_frame(&next).unwrap();
        assert_eq!(pool.audio_time_usage_ns().unwrap().0, 10_022_676);
        assert_eq!(
            pool.try_reserve_frame(&audio_header(16_000, 96, Source::System, 9))
                .unwrap_err(),
            BudgetError::Capacity
        );
        pool.close().unwrap();
        assert_eq!(pool.audio_time_usage_ns().unwrap().0, 10_022_676);
        drop(system);
        drop(newer);
        assert_eq!(pool.audio_time_usage_ns().unwrap(), (0, [0; 2]));
    }
    #[test]
    fn timed_pool_refuses_untyped_cost_invalid_header_and_permanent_time_oversize() {
        let pool = timed(1, 1);
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
            BudgetError::AudioTimeRequired
        );
        assert_eq!(
            pool.try_reserve_frame(&audio_header(0, 1, Source::System, 0))
                .unwrap_err(),
            BudgetError::InvalidAudioHeader
        );
        assert_eq!(
            pool.try_reserve_frame(&audio_header(192_000, 1, Source::System, 0))
                .unwrap_err(),
            BudgetError::CostTooLarge
        );
        assert_eq!(pool.usage().unwrap(), Usage::default());
        assert_eq!(pool.audio_time_usage_ns().unwrap(), (0, [0; 2]));
        for time in [
            AudioTimeLimits {
                global_ns: 0,
                source_ns: 1,
            },
            AudioTimeLimits {
                global_ns: 1,
                source_ns: 0,
            },
            AudioTimeLimits {
                global_ns: 1,
                source_ns: 2,
            },
        ] {
            assert_eq!(
                TransportBudget::with_audio_time_limits(NONCE, limits(), time).unwrap_err(),
                BudgetError::InvalidLimits
            );
        }
    }
    #[test]
    fn per_packet_ceiling_is_conservative_not_a_partition_invariant_timeline() {
        let pool = timed(158_731, 158_731);
        let combined = pool
            .try_reserve_frame(&audio_header(44_100, 7, Source::System, 0))
            .unwrap();
        assert_eq!(pool.audio_time_usage_ns().unwrap().0, 158_731);
        drop(combined);
        let mut owners = Vec::new();
        for _ in 0..6 {
            owners.push(
                pool.try_reserve_frame(&audio_header(44_100, 1, Source::System, 0))
                    .unwrap(),
            );
        }
        assert_eq!(
            pool.try_reserve_frame(&audio_header(44_100, 1, Source::System, 0))
                .unwrap_err(),
            BudgetError::Capacity
        );
        assert_eq!(pool.audio_time_usage_ns().unwrap().0, 6 * 22_676);
        drop(owners);
        assert_eq!(pool.audio_time_usage_ns().unwrap(), (0, [0; 2]));
    }
    #[test]
    fn frame_duration_bounds_hold_at_all_draft_rates_without_float_or_free_packets() {
        let pool = timed(u64::MAX, u64::MAX);
        for rate in [1, 8_000, 16_000, 44_100, 48_000, 96_000, 192_000] {
            for frames in [1, 7, 1_048_576] {
                // Pool frame cap is intentionally independent of duration.
                let frames = frames.min(1_000_000);
                let held = pool
                    .try_reserve_frame(&audio_header(rate, frames, Source::System, 0))
                    .unwrap();
                let nanos = pool.audio_time_usage_ns().unwrap().0;
                let numerator = u128::from(frames) * 1_000_000_000;
                assert!(u128::from(nanos) * u128::from(rate) >= numerator);
                assert!(u128::from(nanos - 1) * u128::from(rate) < numerator);
                drop(held);
                assert_eq!(pool.audio_time_usage_ns().unwrap().0, 0);
            }
        }
    }
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

    #[test]
    fn deterministic_admission_release_schedule_matches_independent_model() {
        let limits = limits();
        let pool = pool();
        let mut owners: Vec<(Source, Cost, BufferLease)> = Vec::new();
        let mut seed = 0x24a8_31d5_u64;
        for step in 0..10_000 {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
            if !owners.is_empty() && seed.is_multiple_of(3) {
                drop(owners.swap_remove((seed as usize) % owners.len()));
            } else {
                let source = if seed & 8 == 0 {
                    Source::System
                } else {
                    Source::Microphone
                };
                let cost = Cost {
                    bytes: 1 + ((seed >> 8) % 220),
                    frames: 1 + ((seed >> 24) % 24),
                };
                let total_bytes: u64 = owners.iter().map(|v| v.1.bytes).sum();
                let total_frames: u64 = owners.iter().map(|v| v.1.frames).sum();
                let source_bytes: u64 = owners
                    .iter()
                    .filter(|v| v.0 == source)
                    .map(|v| v.1.bytes)
                    .sum();
                let source_frames: u64 = owners
                    .iter()
                    .filter(|v| v.0 == source)
                    .map(|v| v.1.frames)
                    .sum();
                let error =
                    if cost.bytes > limits.source_bytes || cost.frames > limits.source_frames {
                        Some(BudgetError::CostTooLarge)
                    } else if total_bytes + cost.bytes > limits.global_bytes
                        || total_frames + cost.frames > limits.global_frames
                        || source_bytes + cost.bytes > limits.source_bytes
                        || source_frames + cost.frames > limits.source_frames
                        || owners.len() == limits.in_flight
                    {
                        Some(BudgetError::Capacity)
                    } else {
                        None
                    };
                match (pool.try_reserve(NONCE, source, cost), error) {
                    (Ok(lease), None) => owners.push((source, cost, lease)),
                    (Err(actual), Some(expected)) => assert_eq!(actual, expected, "step {step}"),
                    mismatch => panic!("model mismatch at {step}: {mismatch:?}"),
                }
            }
            assert_eq!(
                pool.usage().unwrap(),
                Usage {
                    bytes: owners.iter().map(|v| v.1.bytes).sum(),
                    frames: owners.iter().map(|v| v.1.frames).sum(),
                    leases: owners.len(),
                    sources: [Source::System, Source::Microphone]
                        .iter()
                        .filter(|&&source| owners.iter().any(|v| v.0 == source))
                        .count(),
                },
                "step {step}"
            );
        }
        drop(owners);
        assert_eq!(pool.usage().unwrap(), Usage::default());
    }
}
