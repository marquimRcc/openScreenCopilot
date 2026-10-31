//! Optional bounded owned input copy, NOT a reader, validated frame or audio.
//! Caller still bounds original received chunks, sessions and process resources.
use crate::audio_frame_v0::Source;
use crate::transport_budget::{BudgetError, BufferLease, TransportBudget};

pub const MAX_INPUT_CHUNK_BYTES: usize = 65_536; // prototype, not wire negotiation
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputChunkError {
    InvalidLimit,
    InvalidLength,
    Budget(BudgetError),
    Allocation,
}
pub struct OwnedInputChunk {
    bytes: Vec<u8>,
    // Free bytes BEFORE giving the shared reservation back.
    _lease: BufferLease,
}
impl std::fmt::Debug for OwnedInputChunk {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OwnedInputChunk")
            .field("bytes", &self.bytes.len())
            .finish_non_exhaustive()
    }
}
fn allocate(length: usize) -> Result<Vec<u8>, InputChunkError> {
    let mut bytes = Vec::new();
    bytes
        .try_reserve_exact(length)
        .map_err(|_| InputChunkError::Allocation)?;
    bytes.resize(length, 0);
    Ok(bytes)
}
impl OwnedInputChunk {
    pub fn copy_from(
        pool: &TransportBudget,
        nonce: [u8; 16],
        source: Source,
        input: &[u8],
        max_bytes: usize,
    ) -> Result<Self, InputChunkError> {
        Self::copy_with(pool, nonce, source, input, max_bytes, allocate)
    }
    fn copy_with(
        pool: &TransportBudget,
        nonce: [u8; 16],
        source: Source,
        input: &[u8],
        max_bytes: usize,
        allocate: fn(usize) -> Result<Vec<u8>, InputChunkError>,
    ) -> Result<Self, InputChunkError> {
        if !(1..=MAX_INPUT_CHUNK_BYTES).contains(&max_bytes) {
            return Err(InputChunkError::InvalidLimit);
        }
        if input.is_empty() || input.len() > max_bytes {
            return Err(InputChunkError::InvalidLength);
        }
        let lease = pool
            .reserve_input(nonce, source, input.len() as u64)
            .map_err(InputChunkError::Budget)?;
        let mut bytes = allocate(input.len())?;
        // Refuse allocator oversizing rather than undercount actual Vec capacity.
        if bytes.len() != input.len() || bytes.capacity() > input.len() {
            return Err(InputChunkError::Allocation);
        }
        bytes.copy_from_slice(input);
        Ok(Self {
            bytes,
            _lease: lease,
        })
    }
    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transport_budget::{AudioTimeLimits, BudgetLimits, Cost, Usage};
    #[test]
    fn hard_cap_is_inclusive_and_copy_is_independent_of_original_input() {
        let pool = TransportBudget::new(
            [1; 16],
            BudgetLimits {
                global_bytes: MAX_INPUT_CHUNK_BYTES as u64,
                source_bytes: MAX_INPUT_CHUNK_BYTES as u64,
                global_frames: 1,
                source_frames: 1,
                in_flight: 1,
            },
        )
        .unwrap();
        let mut original = vec![0x5a; MAX_INPUT_CHUNK_BYTES];
        let owned = OwnedInputChunk::copy_from(
            &pool,
            [1; 16],
            Source::System,
            &original,
            MAX_INPUT_CHUNK_BYTES,
        )
        .unwrap();
        original.fill(0);
        assert!(owned.bytes().iter().all(|&byte| byte == 0x5a));
        assert_eq!(pool.usage().unwrap().bytes, MAX_INPUT_CHUNK_BYTES as u64);
        drop(owned);
        original.push(0);
        assert!(matches!(
            OwnedInputChunk::copy_from(
                &pool,
                [1; 16],
                Source::System,
                &original,
                MAX_INPUT_CHUNK_BYTES
            ),
            Err(InputChunkError::InvalidLength)
        ));
        assert_eq!(pool.usage().unwrap(), Usage::default());
    }
    fn pool() -> TransportBudget {
        TransportBudget::with_audio_time_limits(
            [1; 16],
            BudgetLimits {
                global_bytes: 16,
                source_bytes: 12,
                global_frames: 1,
                source_frames: 1,
                in_flight: 2,
            },
            AudioTimeLimits {
                global_ns: 1,
                source_ns: 1,
            },
        )
        .unwrap()
    }
    #[test]
    fn copies_count_bytes_and_leases_without_inventing_audio_time_or_frames() {
        let pool = pool();
        let first = OwnedInputChunk::copy_from(&pool, [1; 16], Source::System, b"private-data", 12)
            .unwrap();
        assert_eq!(first.bytes(), b"private-data");
        assert_eq!(
            pool.usage().unwrap(),
            Usage {
                bytes: 12,
                frames: 0,
                leases: 1,
                sources: 1
            }
        );
        assert_eq!(pool.audio_time_usage_ns(), Ok((0, [0, 0])));
        assert!(matches!(
            OwnedInputChunk::copy_from(&pool, [1; 16], Source::System, b"x", 1),
            Err(InputChunkError::Budget(BudgetError::Capacity))
        ));
        let mic =
            OwnedInputChunk::copy_from(&pool, [1; 16], Source::Microphone, b"four", 4).unwrap();
        assert_eq!(pool.usage().unwrap().bytes, 16);
        assert!(matches!(
            OwnedInputChunk::copy_from(&pool, [1; 16], Source::Microphone, b"x", 1),
            Err(InputChunkError::Budget(BudgetError::Capacity))
        ));
        drop((first, mic));
        assert_eq!(pool.usage().unwrap(), Usage::default());
        // The public generic audio reservation still cannot bypass duration.
        assert!(matches!(
            pool.try_reserve(
                [1; 16],
                Source::System,
                Cost {
                    bytes: 1,
                    frames: 1
                }
            ),
            Err(BudgetError::AudioTimeRequired)
        ));
        assert!(matches!(
            pool.try_reserve(
                [1; 16],
                Source::System,
                Cost {
                    bytes: 1,
                    frames: 0
                }
            ),
            Err(BudgetError::InvalidCost)
        ));
    }
    #[test]
    fn limits_scope_and_impossible_size_refuse_without_a_reservation() {
        let pool = pool();
        for limit in [0, MAX_INPUT_CHUNK_BYTES + 1] {
            assert!(matches!(
                OwnedInputChunk::copy_from(&pool, [1; 16], Source::System, b"x", limit),
                Err(InputChunkError::InvalidLimit)
            ));
        }
        for bytes in [&b""[..], &b"xx"[..]] {
            assert!(matches!(
                OwnedInputChunk::copy_from(&pool, [1; 16], Source::System, bytes, 1),
                Err(InputChunkError::InvalidLength)
            ));
        }
        assert!(matches!(
            OwnedInputChunk::copy_from(&pool, [2; 16], Source::System, b"x", 1),
            Err(InputChunkError::Budget(BudgetError::WrongScope))
        ));
        assert!(matches!(
            OwnedInputChunk::copy_from(&pool, [1; 16], Source::System, b"thirteenbytes", 13),
            Err(InputChunkError::Budget(BudgetError::CostTooLarge))
        ));
        assert_eq!(pool.usage().unwrap(), Usage::default());
    }
    #[test]
    fn allocation_refusal_or_bad_allocator_shape_releases_only_its_input_lease() {
        let pool = pool();
        let retained =
            OwnedInputChunk::copy_from(&pool, [1; 16], Source::System, b"keep", 4).unwrap();
        for allocate in [
            (|_| Err(InputChunkError::Allocation)) as fn(usize) -> Result<Vec<u8>, InputChunkError>,
            |_| Ok(Vec::new()),
            |length| Ok(vec![0; length + 1]),
        ] {
            assert!(matches!(
                OwnedInputChunk::copy_with(&pool, [1; 16], Source::System, b"x", 1, allocate),
                Err(InputChunkError::Allocation)
            ));
            assert_eq!(pool.usage().unwrap().bytes, 4);
        }
        assert_eq!(retained.bytes(), b"keep");
    }
    #[test]
    fn close_and_debug_never_revoke_or_dump_owned_input() {
        let pool = pool();
        let input = OwnedInputChunk::copy_from(&pool, [1; 16], Source::System, b"private-data", 12)
            .unwrap();
        assert!(!format!("{input:?}").contains("private-data"));
        pool.close().unwrap();
        assert_eq!(pool.usage().unwrap().bytes, 12);
        assert_eq!(input.bytes(), b"private-data");
        assert!(matches!(
            OwnedInputChunk::copy_from(&pool, [1; 16], Source::Microphone, b"x", 1),
            Err(InputChunkError::Budget(BudgetError::Closed))
        ));
        drop(input);
        assert_eq!(pool.usage().unwrap(), Usage::default());
    }
}
