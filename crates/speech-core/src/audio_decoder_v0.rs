//! Isolated incremental descriptor decoder, no pipe/process/IPC or authentication.
//! One stream/source/epoch per instance; trusted expectations must come from host.
//! Feed consumes at most one header or payload piece and returns byte count.
//! A completed frame blocks further feed until taken (no internal frame queue).

use crate::audio_frame_v0::{
    parse_header, validate_frame, FrameError, Header, Source, HEADER_BYTES, MAX_PAYLOAD_BYTES,
};
use crate::transport_budget::{BudgetError, BufferLease, TransportBudget};

#[derive(Debug, Clone, Copy)]
pub struct ExpectedStream {
    pub nonce: [u8; 16],
    pub source: Source,
    pub epoch: u64,
    pub sample_rate: u32,
    pub channels: u16,
    pub first_sequence: u64,
    pub first_sample_start: u64,
    pub max_payload_bytes: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DecoderError {
    InvalidExpectation,
    Frame(FrameError),
    Binding,
    Order,
    Budget,
    Busy,
    Truncated,
    SequenceExhausted,
    Allocation,
    GlobalBudget(BudgetError),
    WaitingForBudget,
    NotWaiting,
    Closed,
}

type BufferAllocator = fn(usize) -> Result<Vec<u8>, DecoderError>;
fn allocate_buffer(length: usize) -> Result<Vec<u8>, DecoderError> {
    let mut bytes = Vec::new();
    bytes
        .try_reserve_exact(length)
        .map_err(|_| DecoderError::Allocation)?;
    bytes.resize(length, 0);
    Ok(bytes)
}

#[derive(Debug)]
pub struct OwnedFrame {
    header: Header,
    bytes: Vec<u8>,
    // Field drop order: free bytes BEFORE returning the reservation.
    _lease: Option<BufferLease>,
}
impl OwnedFrame {
    pub(crate) fn has_budget(&self, pool: &TransportBudget) -> bool {
        self._lease
            .as_ref()
            .is_some_and(|lease| lease.belongs_to(pool))
    }
    /// Return a value snapshot; callers cannot detach the owned metadata from
    /// the validated bytes or change the accounting cost of this frame.
    pub fn header(&self) -> Header {
        self.header
    }
    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }
    pub fn payload(&self) -> &[u8] {
        &self.bytes[HEADER_BYTES..]
    }
}

#[derive(Debug)]
struct Pending {
    bytes: Vec<u8>,
    filled: usize,
    _lease: Option<BufferLease>,
}

#[derive(Debug)]
pub struct AudioDecoderV0 {
    expected: ExpectedStream,
    next_sequence: Option<u64>,
    next_sample_start: u64,
    header: [u8; HEADER_BYTES],
    header_used: usize,
    pending: Option<Pending>,
    ready: Option<OwnedFrame>,
    closed: bool,
    // Private fallible allocator permits refusal tests without exhausting RAM.
    allocate: BufferAllocator,
    budget: Option<TransportBudget>,
    waiting_for_budget: bool,
}

impl AudioDecoderV0 {
    pub fn new(expected: ExpectedStream) -> Result<Self, DecoderError> {
        if expected.nonce.iter().all(|&v| v == 0)
            || !(1..=192_000).contains(&expected.sample_rate)
            || !(1..=32).contains(&expected.channels)
            || expected.max_payload_bytes == 0
            || expected.max_payload_bytes > MAX_PAYLOAD_BYTES
        {
            return Err(DecoderError::InvalidExpectation);
        }
        Ok(Self {
            next_sequence: Some(expected.first_sequence),
            next_sample_start: expected.first_sample_start,
            expected,
            header: [0; HEADER_BYTES],
            header_used: 0,
            pending: None,
            ready: None,
            closed: false,
            allocate: allocate_buffer,
            budget: None,
            waiting_for_budget: false,
        })
    }
    /// Optional Rust-only experimental admission pool. Does not add a pipe,
    /// authenticate the scope or bound input queues/decoded copies elsewhere.
    pub fn with_budget(
        expected: ExpectedStream,
        budget: TransportBudget,
    ) -> Result<Self, DecoderError> {
        let mut decoder = Self::new(expected)?;
        decoder.budget = Some(budget);
        Ok(decoder)
    }
    pub fn is_waiting_for_budget(&self) -> bool {
        self.waiting_for_budget
    }
    pub fn is_ready(&self) -> bool {
        self.ready.is_some()
    }
    pub fn is_closed(&self) -> bool {
        self.closed
    }
    /// Audio buffer ownership only, excluding allocator/metadata and any frames
    /// already transferred to caller. Not a whole-pipeline memory guarantee.
    pub fn owned_buffer_bytes(&self) -> usize {
        HEADER_BYTES
            + self.pending.as_ref().map_or(0, |v| v.bytes.capacity())
            + self.ready.as_ref().map_or(0, |v| v.bytes.capacity())
    }
    fn poison<T>(&mut self, error: DecoderError) -> Result<T, DecoderError> {
        self.stop();
        Err(error)
    }
    pub fn stop(&mut self) {
        self.closed = true;
        self.pending = None;
        self.ready = None;
        self.header_used = 0;
        self.waiting_for_budget = false;
    }

    pub fn feed(&mut self, input: &[u8]) -> Result<usize, DecoderError> {
        if self.closed {
            return Err(DecoderError::Closed);
        }
        if self.ready.is_some() {
            return Err(DecoderError::Busy);
        }
        if self.waiting_for_budget {
            return Err(DecoderError::WaitingForBudget);
        }
        if input.is_empty() {
            return Ok(0);
        }
        if let Some(pending) = self.pending.as_mut() {
            let count = input.len().min(pending.bytes.len() - pending.filled);
            pending.bytes[pending.filled..pending.filled + count].copy_from_slice(&input[..count]);
            pending.filled += count;
            if pending.filled == pending.bytes.len() {
                let complete = self.pending.take().unwrap();
                let header = match validate_frame(&complete.bytes) {
                    Ok(header) => header,
                    Err(error) => return self.poison(DecoderError::Frame(error)),
                };
                self.next_sequence = header.sequence.checked_add(1);
                self.next_sample_start = header.sample_end;
                self.ready = Some(OwnedFrame {
                    header,
                    bytes: complete.bytes,
                    _lease: complete._lease,
                });
            }
            return Ok(count);
        }
        let Some(sequence) = self.next_sequence else {
            return self.poison(DecoderError::SequenceExhausted);
        };
        let count = input.len().min(HEADER_BYTES - self.header_used);
        self.header[self.header_used..self.header_used + count].copy_from_slice(&input[..count]);
        self.header_used += count;
        if self.header_used != HEADER_BYTES {
            return Ok(count);
        }
        let header = match parse_header(&self.header) {
            Ok(header) => header,
            Err(error) => return self.poison(DecoderError::Frame(error)),
        };
        if header.session_nonce != self.expected.nonce
            || header.source != self.expected.source
            || header.epoch != self.expected.epoch
            || header.sample_rate != self.expected.sample_rate
            || header.channels != self.expected.channels
        {
            return self.poison(DecoderError::Binding);
        }
        if header.sequence != sequence || header.sample_start != self.next_sample_start {
            return self.poison(DecoderError::Order);
        }
        if header.payload_bytes > self.expected.max_payload_bytes {
            return self.poison(DecoderError::Budget);
        }
        self.activate_payload(header)?;
        Ok(count)
    }

    fn activate_payload(&mut self, header: Header) -> Result<bool, DecoderError> {
        let length = HEADER_BYTES + header.payload_bytes as usize;
        let lease = if let Some(budget) = &self.budget {
            match budget.try_reserve_frame(&self.header) {
                Ok(lease) => Some(lease),
                Err(BudgetError::Capacity) => {
                    self.waiting_for_budget = true;
                    return Ok(false);
                }
                Err(error) => return self.poison(DecoderError::GlobalBudget(error)),
            }
        } else {
            None
        };
        // Reservation BEFORE allocation, retained through pending/ready/handoff.
        // On error it drops only after any local buffer is freed.
        let mut bytes = match (self.allocate)(length) {
            Ok(bytes) if bytes.len() == length && bytes.capacity() == length => bytes,
            _ => return self.poison(DecoderError::Allocation),
        };
        bytes[..HEADER_BYTES].copy_from_slice(&self.header);
        self.pending = Some(Pending {
            bytes,
            filled: HEADER_BYTES,
            _lease: lease,
        });
        self.waiting_for_budget = false;
        Ok(true)
    }

    /// Explicit retry after an external capacity notification; no polling,
    /// waiter queue or implicit reading. false means keep producer paused.
    pub fn retry_budget(&mut self) -> Result<bool, DecoderError> {
        if self.closed {
            return Err(DecoderError::Closed);
        }
        if !self.waiting_for_budget {
            return Err(DecoderError::NotWaiting);
        }
        let header = match parse_header(&self.header) {
            Ok(header) => header,
            Err(error) => return self.poison(DecoderError::Frame(error)),
        };
        self.activate_payload(header)
    }

    /// Ownership handoff, not durable ACK. Caller must bound retained frames;
    /// dropping them does not create a journal or cancel provider inference.
    pub fn take(&mut self) -> Option<OwnedFrame> {
        let frame = self.ready.take();
        if frame.is_some() {
            self.header_used = 0;
        }
        frame
    }
    /// EOF after a complete ready frame preserves it for take. Partial header/
    /// payload poisons the stream; no resync scan or synthetic zero padding.
    pub fn finish(&mut self) -> Result<(), DecoderError> {
        if self.closed {
            return Err(DecoderError::Closed);
        }
        if self.ready.is_none() && (self.header_used != 0 || self.pending.is_some()) {
            return self.poison(DecoderError::Truncated);
        }
        self.closed = true;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transport_budget::{AudioTimeLimits, BudgetLimits, Usage};
    fn fixture() -> Vec<u8> {
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
            .map(|i| u8::from_str_radix(&text[i..i + 2], 16).unwrap())
            .collect()
    }
    fn expected(bytes: &[u8]) -> ExpectedStream {
        let h = parse_header(&bytes[..HEADER_BYTES]).unwrap();
        ExpectedStream {
            nonce: h.session_nonce,
            source: h.source,
            epoch: h.epoch,
            sample_rate: h.sample_rate,
            channels: h.channels,
            first_sequence: h.sequence,
            first_sample_start: h.sample_start,
            max_payload_bytes: MAX_PAYLOAD_BYTES,
        }
    }
    fn feed_all(decoder: &mut AudioDecoderV0, bytes: &[u8]) -> Result<(), DecoderError> {
        let mut at = 0;
        while at < bytes.len() {
            let used = decoder.feed(&bytes[at..])?;
            assert!(used > 0);
            at += used;
        }
        Ok(())
    }
    #[test]
    fn every_packet_partition_preserves_complete_frame_and_bounded_ownership() {
        let bytes = fixture();
        for size in 1..=bytes.len() + 1 {
            let mut decoder = AudioDecoderV0::new(expected(&bytes)).unwrap();
            for chunk in bytes.chunks(size) {
                feed_all(&mut decoder, chunk).unwrap();
                assert!(decoder.owned_buffer_bytes() <= HEADER_BYTES * 2 + 16);
            }
            assert!(decoder.is_ready());
            decoder.finish().unwrap();
            let frame = decoder.take().unwrap();
            assert_eq!(frame.bytes(), bytes);
            assert_eq!(frame.payload(), &bytes[HEADER_BYTES..]);
            assert_eq!(decoder.owned_buffer_bytes(), HEADER_BYTES);
            assert!(decoder.is_closed());
        }
    }
    #[test]
    fn eof_at_every_partial_position_is_terminal_without_padding() {
        let bytes = fixture();
        for end in 0..bytes.len() {
            let mut decoder = AudioDecoderV0::new(expected(&bytes)).unwrap();
            feed_all(&mut decoder, &bytes[..end]).unwrap();
            assert_eq!(
                decoder.finish(),
                if end == 0 {
                    Ok(())
                } else {
                    Err(DecoderError::Truncated)
                }
            );
            assert_eq!(decoder.feed(&bytes), Err(DecoderError::Closed));
            assert!(decoder.take().is_none());
            assert_eq!(decoder.owned_buffer_bytes(), HEADER_BYTES);
        }
    }
    #[test]
    fn invalid_binding_order_budget_and_header_reject_before_payload_allocation() {
        let bytes = fixture();
        for field in [0, 1, 2, 3, 4, 5, 6, 7] {
            let mut expectation = expected(&bytes);
            let error = match field {
                0 => {
                    expectation.nonce[0] ^= 1;
                    DecoderError::Binding
                }
                1 => {
                    expectation.source = Source::Microphone;
                    DecoderError::Binding
                }
                2 => {
                    expectation.epoch += 1;
                    DecoderError::Binding
                }
                3 => {
                    expectation.sample_rate = 44100;
                    DecoderError::Binding
                }
                4 => {
                    expectation.channels = 1;
                    DecoderError::Binding
                }
                5 => {
                    expectation.first_sequence += 1;
                    DecoderError::Order
                }
                6 => {
                    expectation.first_sample_start += 1;
                    DecoderError::Order
                }
                _ => {
                    expectation.max_payload_bytes = 4;
                    DecoderError::Budget
                }
            };
            let mut decoder = AudioDecoderV0::new(expectation).unwrap();
            decoder.allocate = |_| panic!("reject invalid metadata before payload allocation");
            assert_eq!(decoder.feed(&bytes), Err(error));
            assert!(decoder.is_closed());
            assert_eq!(decoder.owned_buffer_bytes(), HEADER_BYTES);
        }
        let mut decoder = AudioDecoderV0::new(expected(&bytes)).unwrap();
        let mut huge = bytes.clone();
        huge[8..12].copy_from_slice(&u32::MAX.to_le_bytes());
        assert_eq!(
            decoder.feed(&huge),
            Err(DecoderError::Frame(FrameError::Limits))
        );
        assert_eq!(decoder.owned_buffer_bytes(), HEADER_BYTES);
    }
    #[test]
    fn ready_blocks_admission_and_next_frame_requires_exact_sequence_and_samples() {
        let bytes = fixture();
        let h = parse_header(&bytes[..HEADER_BYTES]).unwrap();
        let mut decoder = AudioDecoderV0::new(expected(&bytes)).unwrap();
        feed_all(&mut decoder, &bytes).unwrap();
        assert_eq!(decoder.feed(&bytes), Err(DecoderError::Busy));
        assert!(decoder.take().is_some());
        let mut next = bytes.clone();
        next[48..56].copy_from_slice(&(h.sequence + 1).to_le_bytes());
        next[56..64].copy_from_slice(&h.sample_end.to_le_bytes());
        feed_all(&mut decoder, &next).unwrap();
        assert_eq!(decoder.take().unwrap().bytes(), next);
        assert_eq!(decoder.feed(&bytes), Err(DecoderError::Order));
        assert!(decoder.is_closed());
    }
    #[test]
    fn bad_payload_poison_and_stop_do_not_retract_already_handed_frames() {
        let bytes = fixture();
        let mut bad = bytes.clone();
        bad[80..84].copy_from_slice(&f32::NAN.to_le_bytes());
        let mut decoder = AudioDecoderV0::new(expected(&bytes)).unwrap();
        assert_eq!(
            feed_all(&mut decoder, &bad),
            Err(DecoderError::Frame(FrameError::NonFinite))
        );
        assert_eq!(decoder.feed(&bytes), Err(DecoderError::Closed));
        for stop_at in [1, 80, 85, 96] {
            let mut decoder = AudioDecoderV0::new(expected(&bytes)).unwrap();
            feed_all(&mut decoder, &bytes[..stop_at]).unwrap();
            decoder.stop();
            decoder.stop();
            assert!(decoder.take().is_none());
            assert_eq!(decoder.owned_buffer_bytes(), HEADER_BYTES);
        }
        let mut decoder = AudioDecoderV0::new(expected(&bytes)).unwrap();
        feed_all(&mut decoder, &bytes).unwrap();
        let frame = decoder.take().unwrap();
        decoder.stop();
        assert_eq!(frame.bytes(), bytes);
    }
    #[test]
    fn sequence_exhaustion_never_wraps_and_invalid_expectations_fail() {
        let mut bytes = fixture();
        bytes[48..56].copy_from_slice(&u64::MAX.to_le_bytes());
        let mut expectation = expected(&bytes);
        let mut decoder = AudioDecoderV0::new(expectation).unwrap();
        feed_all(&mut decoder, &bytes).unwrap();
        decoder.take().unwrap();
        assert_eq!(decoder.feed(&bytes), Err(DecoderError::SequenceExhausted));
        expectation.max_payload_bytes = MAX_PAYLOAD_BYTES + 1;
        assert_eq!(
            AudioDecoderV0::new(expectation).unwrap_err(),
            DecoderError::InvalidExpectation
        );
        expectation.max_payload_bytes = MAX_PAYLOAD_BYTES;
        expectation.nonce = [0; 16];
        assert_eq!(
            AudioDecoderV0::new(expectation).unwrap_err(),
            DecoderError::InvalidExpectation
        );
    }

    #[test]
    fn fallible_allocation_refusal_is_terminal_without_forcing_oom() {
        let bytes = fixture();
        let allocators: [BufferAllocator; 3] = [
            |_| Err(DecoderError::Allocation),
            |length| Ok(vec![0; length - 1]),
            |length| {
                let mut bytes = Vec::with_capacity(length + 1);
                bytes.resize(length, 0);
                Ok(bytes)
            },
        ];
        for allocate in allocators {
            let mut decoder = AudioDecoderV0::new(expected(&bytes)).unwrap();
            decoder.allocate = allocate;
            assert_eq!(decoder.feed(&bytes), Err(DecoderError::Allocation));
            assert!(decoder.is_closed());
            assert_eq!(decoder.owned_buffer_bytes(), HEADER_BYTES);
            assert_eq!(decoder.feed(&bytes), Err(DecoderError::Closed));
        }
    }

    #[test]
    fn coalesced_frames_are_consumed_one_at_a_time_without_internal_queue() {
        let bytes = fixture();
        let h = parse_header(&bytes[..HEADER_BYTES]).unwrap();
        let mut next = bytes.clone();
        next[48..56].copy_from_slice(&(h.sequence + 1).to_le_bytes());
        next[56..64].copy_from_slice(&h.sample_end.to_le_bytes());
        let mut joined = bytes.clone();
        joined.extend_from_slice(&next);
        let mut decoder = AudioDecoderV0::new(expected(&bytes)).unwrap();
        let mut at = 0;
        let mut count = 0;
        while at < joined.len() {
            at += decoder.feed(&joined[at..]).unwrap();
            assert!(decoder.owned_buffer_bytes() <= HEADER_BYTES * 2 + 16);
            if let Some(frame) = decoder.take() {
                assert_eq!(
                    frame.bytes(),
                    if count == 0 {
                        bytes.as_slice()
                    } else {
                        next.as_slice()
                    }
                );
                count += 1;
            }
        }
        assert_eq!(count, 2);
        decoder.finish().unwrap();
    }

    #[test]
    fn full_payload_cap_is_inclusive_and_handoff_releases_decoder_ownership() {
        let mut bytes = fixture();
        bytes[8..12].copy_from_slice(&MAX_PAYLOAD_BYTES.to_le_bytes());
        bytes[64..68].copy_from_slice(&(MAX_PAYLOAD_BYTES / 8).to_le_bytes());
        bytes.resize(HEADER_BYTES + MAX_PAYLOAD_BYTES as usize, 0);
        let mut decoder = AudioDecoderV0::new(expected(&bytes)).unwrap();
        assert_eq!(decoder.feed(&bytes).unwrap(), HEADER_BYTES);
        assert_eq!(
            decoder.owned_buffer_bytes(),
            HEADER_BYTES * 2 + MAX_PAYLOAD_BYTES as usize
        );
        assert_eq!(
            decoder.feed(&bytes[HEADER_BYTES..]).unwrap(),
            MAX_PAYLOAD_BYTES as usize
        );
        let frame = decoder.take().unwrap();
        assert_eq!(
            frame.bytes().len(),
            HEADER_BYTES + MAX_PAYLOAD_BYTES as usize
        );
        assert_eq!(decoder.owned_buffer_bytes(), HEADER_BYTES);
        decoder.finish().unwrap();
    }

    fn budget(bytes: &[u8], source_bytes: u64) -> TransportBudget {
        TransportBudget::new(
            expected(bytes).nonce,
            BudgetLimits {
                global_bytes: 192,
                source_bytes,
                global_frames: 4,
                source_frames: 4,
                in_flight: 2,
            },
        )
        .unwrap()
    }

    #[test]
    fn budget_reservation_survives_handoff_and_pauses_before_third_payload() {
        let bytes = fixture();
        let h = parse_header(&bytes[..HEADER_BYTES]).unwrap();
        let pool = budget(&bytes, 192);
        let mut decoder = AudioDecoderV0::with_budget(expected(&bytes), pool.clone()).unwrap();
        feed_all(&mut decoder, &bytes).unwrap();
        let first = decoder.take().unwrap();
        assert_eq!(pool.usage().unwrap().bytes, 96);
        let mut next = bytes.clone();
        next[48..56].copy_from_slice(&(h.sequence + 1).to_le_bytes());
        next[56..64].copy_from_slice(&h.sample_end.to_le_bytes());
        feed_all(&mut decoder, &next).unwrap();
        let second = decoder.take().unwrap();
        let mut third = bytes.clone();
        third[48..56].copy_from_slice(&(h.sequence + 2).to_le_bytes());
        third[56..64].copy_from_slice(&(h.sample_end + 2).to_le_bytes());
        assert_eq!(decoder.feed(&third).unwrap(), HEADER_BYTES);
        assert!(decoder.is_waiting_for_budget());
        assert_eq!(decoder.owned_buffer_bytes(), HEADER_BYTES);
        assert_eq!(
            decoder.feed(&third[HEADER_BYTES..]),
            Err(DecoderError::WaitingForBudget)
        );
        assert_eq!(decoder.retry_budget(), Ok(false));
        drop(first);
        assert_eq!(decoder.retry_budget(), Ok(true));
        decoder.feed(&third[HEADER_BYTES..]).unwrap();
        let third = decoder.take().unwrap();
        decoder.stop();
        assert_eq!(pool.usage().unwrap().bytes, 192);
        drop(second);
        drop(third);
        assert_eq!(pool.usage().unwrap(), Usage::default());
    }

    #[test]
    fn source_budget_aggregates_epochs_and_stop_while_waiting_prevents_late_allocation() {
        let bytes = fixture();
        let pool = budget(&bytes, 96);
        let mut old = AudioDecoderV0::with_budget(expected(&bytes), pool.clone()).unwrap();
        feed_all(&mut old, &bytes).unwrap();
        let held = old.take().unwrap();
        let mut newer = bytes.clone();
        newer[40..48].copy_from_slice(&8_u64.to_le_bytes());
        newer[48..56].copy_from_slice(&0_u64.to_le_bytes());
        newer[56..64].copy_from_slice(&0_u64.to_le_bytes());
        let mut new = AudioDecoderV0::with_budget(expected(&newer), pool.clone()).unwrap();
        new.feed(&newer).unwrap();
        assert!(new.is_waiting_for_budget());
        new.stop();
        drop(held);
        assert_eq!(new.retry_budget(), Err(DecoderError::Closed));
        assert_eq!(pool.usage().unwrap(), Usage::default());
    }

    #[test]
    fn budget_cleanup_covers_allocation_failure_truncation_and_pool_close() {
        let bytes = fixture();
        let pool = budget(&bytes, 192);
        let mut fail = AudioDecoderV0::with_budget(expected(&bytes), pool.clone()).unwrap();
        fail.allocate = |_| Err(DecoderError::Allocation);
        assert_eq!(fail.feed(&bytes), Err(DecoderError::Allocation));
        assert_eq!(pool.usage().unwrap(), Usage::default());
        let mut partial = AudioDecoderV0::with_budget(expected(&bytes), pool.clone()).unwrap();
        partial.feed(&bytes).unwrap();
        assert_eq!(pool.usage().unwrap().bytes, 96);
        assert_eq!(partial.finish(), Err(DecoderError::Truncated));
        assert_eq!(pool.usage().unwrap(), Usage::default());
        let mut ready = AudioDecoderV0::with_budget(expected(&bytes), pool.clone()).unwrap();
        feed_all(&mut ready, &bytes).unwrap();
        pool.close().unwrap();
        assert_eq!(pool.usage().unwrap().bytes, 96);
        ready.stop();
        assert_eq!(pool.usage().unwrap(), Usage::default());
        let mut closed = AudioDecoderV0::with_budget(expected(&bytes), pool).unwrap();
        assert_eq!(
            closed.feed(&bytes),
            Err(DecoderError::GlobalBudget(BudgetError::Closed))
        );
        let small = budget(&bytes, 95);
        let mut impossible = AudioDecoderV0::with_budget(expected(&bytes), small).unwrap();
        assert_eq!(
            impossible.feed(&bytes),
            Err(DecoderError::GlobalBudget(BudgetError::CostTooLarge))
        );
        assert!(impossible.is_closed());
    }

    #[test]
    fn waiting_eof_and_foreign_pool_do_not_allocate_or_lose_live_credit() {
        let bytes = fixture();
        let pool = budget(&bytes, 96);
        let mut first = AudioDecoderV0::with_budget(expected(&bytes), pool.clone()).unwrap();
        feed_all(&mut first, &bytes).unwrap();
        let held = first.take().unwrap();
        let mut waiting = AudioDecoderV0::with_budget(expected(&bytes), pool.clone()).unwrap();
        waiting.allocate = |_| panic!("no allocation while source budget is exhausted");
        assert_eq!(waiting.feed(&bytes), Ok(HEADER_BYTES));
        assert!(waiting.is_waiting_for_budget());
        assert_eq!(waiting.finish(), Err(DecoderError::Truncated));
        assert_eq!(pool.usage().unwrap().bytes, 96);
        assert_eq!(waiting.retry_budget(), Err(DecoderError::Closed));
        drop(held);
        assert_eq!(pool.usage().unwrap(), Usage::default());

        let mut foreign = expected(&bytes);
        foreign.nonce = [9; 16];
        let mut altered = bytes.clone();
        altered[24..40].copy_from_slice(&foreign.nonce);
        let mut decoder = AudioDecoderV0::with_budget(foreign, pool.clone()).unwrap();
        decoder.allocate = |_| panic!("scope refusal must precede allocation");
        assert_eq!(
            decoder.feed(&altered),
            Err(DecoderError::GlobalBudget(BudgetError::WrongScope))
        );
        assert_eq!(pool.usage().unwrap(), Usage::default());
    }

    #[test]
    fn malformed_payload_and_decoder_drop_release_only_their_own_lease() {
        let bytes = fixture();
        let pool = budget(&bytes, 192);
        let mut first = AudioDecoderV0::with_budget(expected(&bytes), pool.clone()).unwrap();
        feed_all(&mut first, &bytes).unwrap();
        let held = first.take().unwrap();
        let mut bad = bytes.clone();
        bad[80..84].copy_from_slice(&f32::INFINITY.to_le_bytes());
        let mut invalid = AudioDecoderV0::with_budget(expected(&bad), pool.clone()).unwrap();
        assert_eq!(
            feed_all(&mut invalid, &bad),
            Err(DecoderError::Frame(FrameError::NonFinite))
        );
        assert_eq!(pool.usage().unwrap().bytes, 96);
        for ready in [false, true] {
            let mut abandoned =
                AudioDecoderV0::with_budget(expected(&bytes), pool.clone()).unwrap();
            abandoned.feed(&bytes).unwrap();
            if ready {
                abandoned.feed(&bytes[HEADER_BYTES..]).unwrap();
            }
            assert_eq!(pool.usage().unwrap().bytes, 192);
            drop(abandoned);
            assert_eq!(pool.usage().unwrap().bytes, 96);
        }
        drop(first);
        assert_eq!(held.bytes(), bytes);
        assert_eq!(pool.usage().unwrap().bytes, 96);
        drop(held);
        assert_eq!(pool.usage().unwrap(), Usage::default());
    }

    #[test]
    fn handed_frame_metadata_snapshot_cannot_mutate_validated_owner() {
        let bytes = fixture();
        let pool = budget(&bytes, 192);
        let mut decoder = AudioDecoderV0::with_budget(expected(&bytes), pool.clone()).unwrap();
        feed_all(&mut decoder, &bytes).unwrap();
        let frame = decoder.take().unwrap();
        let original = frame.header();
        let mut snapshot = frame.header();
        snapshot.session_nonce = [9; 16];
        snapshot.frame_count = u32::MAX;
        snapshot.source = Source::Microphone;
        assert_ne!(snapshot, original);
        assert_eq!(frame.header(), original);
        assert_eq!(validate_frame(frame.bytes()).unwrap(), original);
        assert_eq!(
            pool.usage().unwrap().frames,
            u64::from(original.frame_count)
        );
        drop(frame);
        assert_eq!(pool.usage().unwrap(), Usage::default());
    }

    #[test]
    fn duration_exhaustion_pauses_before_allocation_and_follows_handoff_cleanup() {
        let bytes = fixture();
        let pool = TransportBudget::with_audio_time_limits(
            expected(&bytes).nonce,
            BudgetLimits {
                global_bytes: 192,
                source_bytes: 192,
                global_frames: 4,
                source_frames: 4,
                in_flight: 2,
            },
            AudioTimeLimits {
                global_ns: 41_667,
                source_ns: 41_667,
            },
        )
        .unwrap();
        let mut decoder = AudioDecoderV0::with_budget(expected(&bytes), pool.clone()).unwrap();
        feed_all(&mut decoder, &bytes).unwrap();
        let held = decoder.take().unwrap();
        let h = held.header();
        let mut next = bytes.clone();
        next[48..56].copy_from_slice(&(h.sequence + 1).to_le_bytes());
        next[56..64].copy_from_slice(&h.sample_end.to_le_bytes());
        assert_eq!(decoder.feed(&next), Ok(HEADER_BYTES));
        assert!(decoder.is_waiting_for_budget());
        assert_eq!(decoder.owned_buffer_bytes(), HEADER_BYTES);
        assert_eq!(pool.audio_time_usage_ns().unwrap().0, 41_667);
        drop(held);
        assert_eq!(decoder.retry_budget(), Ok(true));
        let mut bad = next[HEADER_BYTES..].to_vec();
        bad[..4].copy_from_slice(&f32::NAN.to_le_bytes());
        assert_eq!(
            decoder.feed(&bad),
            Err(DecoderError::Frame(FrameError::NonFinite))
        );
        assert_eq!(pool.audio_time_usage_ns().unwrap(), (0, [0; 2]));
        assert_eq!(pool.usage().unwrap(), Usage::default());
    }

    #[test]
    fn optional_change_future_resumes_waiting_decoder_without_polling_input() {
        use std::future::Future;
        use std::pin::Pin;
        use std::task::{Context, Poll, Waker};
        for close in [false, true] {
            let bytes = fixture();
            let pool = budget(&bytes, 96);
            let mut first = AudioDecoderV0::with_budget(expected(&bytes), pool.clone()).unwrap();
            feed_all(&mut first, &bytes).unwrap();
            let held = first.take().unwrap();
            let mut waiting = AudioDecoderV0::with_budget(expected(&bytes), pool.clone()).unwrap();
            // Observe BEFORE admission: a release before registering is visible.
            let revision = pool.observe_change().unwrap();
            assert_eq!(waiting.feed(&bytes), Ok(HEADER_BYTES));
            assert!(waiting.is_waiting_for_budget());
            let mut changed = pool
                .wait_for_change(&revision, expected(&bytes).source)
                .unwrap();
            let mut cx = Context::from_waker(Waker::noop());
            assert_eq!(Pin::new(&mut changed).poll(&mut cx), Poll::Pending);
            if close {
                pool.close().unwrap();
                assert_eq!(
                    Pin::new(&mut changed).poll(&mut cx),
                    Poll::Ready(Err(BudgetError::Closed))
                );
                waiting.stop();
                assert_eq!(pool.usage().unwrap().bytes, 96);
                drop(held);
            } else {
                drop(held);
                assert_eq!(Pin::new(&mut changed).poll(&mut cx), Poll::Ready(Ok(())));
                assert_eq!(waiting.retry_budget(), Ok(true));
                waiting.feed(&bytes[HEADER_BYTES..]).unwrap();
                let delivered = waiting.take().unwrap();
                waiting.stop();
                assert_eq!(pool.usage().unwrap().bytes, 96);
                drop(delivered);
            }
            assert_eq!(pool.usage().unwrap(), Usage::default());
        }
    }
}
