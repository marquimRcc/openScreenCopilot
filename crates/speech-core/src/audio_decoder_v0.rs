//! Isolated incremental descriptor decoder, no pipe/process/IPC or authentication.
//! One stream/source/epoch per instance; trusted expectations must come from host.
//! Feed consumes at most one header or payload piece and returns byte count.
//! A completed frame blocks further feed until taken (no internal frame queue).

use crate::audio_frame_v0::{
    parse_header, validate_frame, FrameError, Header, Source, HEADER_BYTES, MAX_PAYLOAD_BYTES,
};

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
    pub header: Header,
    bytes: Vec<u8>,
}
impl OwnedFrame {
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
        })
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
    }

    pub fn feed(&mut self, input: &[u8]) -> Result<usize, DecoderError> {
        if self.closed {
            return Err(DecoderError::Closed);
        }
        if self.ready.is_some() {
            return Err(DecoderError::Busy);
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
        // Allocate only after schema, cap, binding and order all passed. One
        // complete-frame buffer plus80-byte header scratch, never a frame queue.
        let length = HEADER_BYTES + header.payload_bytes as usize;
        let mut bytes = match (self.allocate)(length) {
            Ok(bytes) if bytes.len() == length && bytes.capacity() == length => bytes,
            _ => return self.poison(DecoderError::Allocation),
        };
        bytes[..HEADER_BYTES].copy_from_slice(&self.header);
        self.pending = Some(Pending {
            bytes,
            filled: HEADER_BYTES,
        });
        Ok(count)
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
}
