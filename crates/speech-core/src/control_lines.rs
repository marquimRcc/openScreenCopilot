//! Draft bounded UTF-8 line framing only. NOT JSON/schema/authentication/IPC.
//! Caller owns/limits input chunks and decoder instances. No pipe is opened.

pub const MAX_CONTROL_LINE_BYTES: usize = 1_048_576; // prototype hard cap
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ControlLineError {
    InvalidLimit,
    Capacity,
    InvalidUtf8,
    EmptyLine,
    Truncated,
    Busy,
    Closed,
    Allocation,
    CounterOverflow,
}
pub struct ControlLineDecoder {
    limit: usize,
    bytes: Vec<u8>,
    utf8_checked: usize,
    ready: Option<String>,
    closed: bool,
    received: u64,
    messages: u64,
}
impl std::fmt::Debug for ControlLineDecoder {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ControlLineDecoder")
            .field("limit", &self.limit)
            .field("owned_buffer_bytes", &self.owned_buffer_bytes())
            .field("ready", &self.is_ready())
            .field("closed", &self.closed)
            .field("counts", &self.counts())
            .finish()
    }
}
impl ControlLineDecoder {
    pub fn new(limit: usize) -> Result<Self, ControlLineError> {
        if !(1..=MAX_CONTROL_LINE_BYTES).contains(&limit) {
            return Err(ControlLineError::InvalidLimit);
        }
        Ok(Self {
            limit,
            bytes: Vec::new(),
            utf8_checked: 0,
            ready: None,
            closed: false,
            received: 0,
            messages: 0,
        })
    }
    pub fn is_ready(&self) -> bool {
        self.ready.is_some()
    }
    pub fn is_closed(&self) -> bool {
        self.closed
    }
    pub fn owned_buffer_bytes(&self) -> usize {
        self.bytes.capacity() + self.ready.as_ref().map_or(0, |v| v.capacity())
    }
    pub fn counts(&self) -> (u64, u64) {
        (self.received, self.messages)
    }
    pub fn stop(&mut self) {
        self.closed = true;
        self.bytes = Vec::new();
        self.ready = None;
        self.utf8_checked = 0;
    }
    fn fail<T>(&mut self, error: ControlLineError) -> Result<T, ControlLineError> {
        self.stop();
        Err(error)
    }
    /// Consumes at most one line/piece, returns bytes consumed, never queues an
    /// arbitrary chunk. Limit counts bytes before LF, INCLUDING optional CR.
    /// LF/CRLF accepted; trailing CR is removed, all other text stays verbatim.
    /// Empty lines fail; whitespace/non-JSON text still requires a JSON validator.
    pub fn feed(&mut self, input: &[u8]) -> Result<usize, ControlLineError> {
        if self.closed {
            return Err(ControlLineError::Closed);
        }
        if self.ready.is_some() {
            return Err(ControlLineError::Busy);
        }
        if input.is_empty() {
            return Ok(0);
        }
        let remaining = self.limit - self.bytes.len();
        // Bound scanning too: inspect at most remaining+1 bytes, not a huge chunk.
        let scan = &input[..input.len().min(remaining + 1)];
        let newline = scan.iter().position(|&v| v == b'\n');
        let count = newline.unwrap_or(scan.len());
        if count > remaining {
            return self.fail(ControlLineError::Capacity);
        }
        let consumed = count + usize::from(newline.is_some());
        let Some(received) = self.received.checked_add(consumed as u64) else {
            return self.fail(ControlLineError::CounterOverflow);
        };
        let needed = self.bytes.len() + count;
        if needed > self.bytes.capacity() {
            let target = needed
                .max(self.bytes.capacity().saturating_mul(2))
                .min(self.limit);
            if self
                .bytes
                .try_reserve_exact(target - self.bytes.len())
                .is_err()
                || self.bytes.capacity() > self.limit
            {
                return self.fail(ControlLineError::Allocation);
            }
        }
        self.bytes.extend_from_slice(&input[..count]);
        // Recheck only the unfinished UTF-8 suffix (at most3 old bytes), avoiding
        // quadratic rescans under one-byte fragmentation.
        match std::str::from_utf8(&self.bytes[self.utf8_checked..]) {
            Ok(_) => self.utf8_checked = self.bytes.len(),
            Err(error) if error.error_len().is_none() => self.utf8_checked += error.valid_up_to(),
            Err(_) => return self.fail(ControlLineError::InvalidUtf8),
        }
        self.received = received;
        if newline.is_some() {
            if self.utf8_checked != self.bytes.len() {
                return self.fail(ControlLineError::InvalidUtf8);
            }
            if self.bytes.last() == Some(&b'\r') {
                self.bytes.pop();
            }
            if self.bytes.is_empty() {
                return self.fail(ControlLineError::EmptyLine);
            }
            let Some(messages) = self.messages.checked_add(1) else {
                return self.fail(ControlLineError::CounterOverflow);
            };
            let bytes = std::mem::take(&mut self.bytes);
            self.ready = Some(match String::from_utf8(bytes) {
                Ok(text) => text,
                Err(_) => return self.fail(ControlLineError::InvalidUtf8),
            });
            self.messages = messages;
            self.utf8_checked = 0;
        }
        Ok(consumed)
    }
    pub fn take(&mut self) -> Option<String> {
        self.ready.take()
    }
    /// Unterminated text/partial codepoint is an error, not an implicit message.
    /// Ready survives clean EOF for take; stop discards only still-owned text.
    pub fn finish(&mut self) -> Result<(), ControlLineError> {
        if self.closed {
            return Err(ControlLineError::Closed);
        }
        if !self.bytes.is_empty() {
            return self.fail(ControlLineError::Truncated);
        }
        self.closed = true;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn every_unicode_scalar_survives_each_fragment_boundary() {
        // No random seed or external corpus: cover every legal scalar, including
        // four-byte values and noncharacters. LF is the protocol delimiter.
        for value in 0..=0x10ffff {
            let Some(scalar) = char::from_u32(value) else {
                continue; // surrogate codepoints are not Unicode scalars
            };
            if scalar == '\n' {
                continue;
            }
            let mut wire = [0u8; 6];
            let text_len = scalar.encode_utf8(&mut wire[..4]).len();
            wire[text_len] = b'x'; // CR remains payload instead of CRLF framing
            wire[text_len + 1] = b'\n';
            let wire = &wire[..text_len + 2];
            let expected = std::str::from_utf8(&wire[..text_len + 1]).unwrap();
            for split in 1..wire.len() {
                let mut decoder = ControlLineDecoder::new(5).unwrap();
                assert_eq!(decoder.feed(&wire[..split]).unwrap(), split);
                assert_eq!(decoder.feed(&wire[split..]).unwrap(), wire.len() - split);
                decoder.finish().unwrap();
                assert_eq!(decoder.take().as_deref(), Some(expected));
                assert_eq!(decoder.counts(), (wire.len() as u64, 1));
                assert_eq!(decoder.owned_buffer_bytes(), 0);
            }
        }
    }
    #[test]
    fn exhaustive_short_byte_payloads_match_utf8_acceptance_across_partitions() {
        // LF is the framing delimiter, not a payload byte. Include CR, NUL,
        // overlong prefixes, continuation bytes and incomplete codepoints.
        let check = |payload: &[u8]| {
            let mut wire = payload.to_vec();
            wire.push(b'\n');
            let expected = std::str::from_utf8(payload).ok().and_then(|text| {
                let text = text.strip_suffix('\r').unwrap_or(text);
                (!text.is_empty()).then_some(text)
            });
            for split in 0..=wire.len() {
                let mut decoder = ControlLineDecoder::new(2).unwrap();
                let result = decoder.feed(&wire[..split]).and_then(|used| {
                    assert_eq!(used, split);
                    if split == wire.len() {
                        Ok(0) // A ready line intentionally rejects even empty feed.
                    } else {
                        decoder.feed(&wire[split..])
                    }
                });
                match expected {
                    Some(text) => {
                        assert!(result.is_ok(), "payload={payload:?}, split={split}");
                        decoder.finish().unwrap();
                        assert_eq!(decoder.take().as_deref(), Some(text));
                        assert_eq!(decoder.counts(), (wire.len() as u64, 1));
                    }
                    None => {
                        assert!(result.is_err(), "payload={payload:?}, split={split}");
                        assert!(decoder.is_closed());
                        assert_eq!(decoder.owned_buffer_bytes(), 0);
                        assert!(decoder.take().is_none());
                    }
                }
            }
        };
        for first in 0..=255u8 {
            if first == b'\n' {
                continue;
            }
            check(&[first]);
            for second in 0..=255u8 {
                if second != b'\n' {
                    check(&[first, second]);
                }
            }
        }
    }
    #[test]
    fn all_utf8_partitions_preserve_one_message_and_bound_owned_buffers() {
        let text = "{\"type\":\"synthetic\",\"text\":\"Olá 🦀\"}";
        let wire = format!("{text}\n");
        for size in 1..=wire.len() + 1 {
            let mut decoder = ControlLineDecoder::new(wire.len()).unwrap();
            for part in wire.as_bytes().chunks(size) {
                assert_eq!(decoder.feed(part).unwrap(), part.len());
                assert!(decoder.owned_buffer_bytes() <= wire.len());
            }
            decoder.finish().unwrap();
            assert_eq!(decoder.take().unwrap(), text);
            assert_eq!(decoder.counts(), (wire.len() as u64, 1));
            assert_eq!(decoder.owned_buffer_bytes(), 0);
            assert_eq!(decoder.feed(b"x"), Err(ControlLineError::Closed));
        }
    }
    #[test]
    fn coalesced_lf_crlf_lines_are_consumed_one_at_a_time_without_queue() {
        let wire = b"{\"n\":1}\r\n{\"n\":2}\n";
        let mut decoder = ControlLineDecoder::new(32).unwrap();
        let used = decoder.feed(wire).unwrap();
        assert_eq!(used, 9);
        assert_eq!(decoder.feed(&wire[used..]), Err(ControlLineError::Busy));
        assert_eq!(decoder.take().unwrap(), "{\"n\":1}");
        assert_eq!(decoder.feed(&wire[used..]).unwrap(), 8);
        assert_eq!(decoder.take().unwrap(), "{\"n\":2}");
        decoder.finish().unwrap();
        assert_eq!(decoder.counts(), (17, 2));
    }
    #[test]
    fn invalid_utf8_is_fatal_and_incomplete_suffix_is_not_implicit_eof_message() {
        for bad in [
            &b"\xff\n"[..],
            &b"\xc0\x80\n"[..],
            &b"\xed\xa0\x80\n"[..],
            &b"\xf4\x90\x80\x80\n"[..],
            &b"\xe2\n"[..],
        ] {
            let mut decoder = ControlLineDecoder::new(32).unwrap();
            assert_eq!(decoder.feed(bad), Err(ControlLineError::InvalidUtf8));
            assert_eq!(decoder.owned_buffer_bytes(), 0);
            assert_eq!(decoder.feed(b"{}\n"), Err(ControlLineError::Closed));
        }
        for partial in [&b"{}"[..], &b"\xe2\x82"[..]] {
            let mut decoder = ControlLineDecoder::new(8).unwrap();
            decoder.feed(partial).unwrap();
            assert_eq!(decoder.finish(), Err(ControlLineError::Truncated));
            assert!(decoder.take().is_none());
        }
    }
    #[test]
    fn inclusive_byte_cap_empty_lines_and_large_chunk_do_not_invent_success() {
        for limit in [0, MAX_CONTROL_LINE_BYTES + 1] {
            assert_eq!(
                ControlLineDecoder::new(limit).unwrap_err(),
                ControlLineError::InvalidLimit
            );
        }
        let mut exact = ControlLineDecoder::new(2).unwrap();
        assert_eq!(exact.feed(b"{}\n"), Ok(3));
        assert_eq!(exact.take().unwrap(), "{}");
        let mut crlf = ControlLineDecoder::new(2).unwrap();
        assert_eq!(crlf.feed(b"{}\r\n"), Err(ControlLineError::Capacity));
        for blank in [b"\n".as_slice(), b"\r\n".as_slice()] {
            let mut decoder = ControlLineDecoder::new(2).unwrap();
            assert_eq!(decoder.feed(blank), Err(ControlLineError::EmptyLine));
        }
        let huge = vec![b'x'; MAX_CONTROL_LINE_BYTES + 20];
        let mut small = ControlLineDecoder::new(4).unwrap();
        assert_eq!(small.feed(&huge), Err(ControlLineError::Capacity));
        assert_eq!(small.owned_buffer_bytes(), 0);
    }
    #[test]
    fn framing_is_not_json_validation_and_stop_does_not_retract_handed_text() {
        let mut decoder = ControlLineDecoder::new(32).unwrap();
        decoder.feed(b"not JSON \r\n").unwrap();
        let text = decoder.take().unwrap();
        decoder.feed(b"partial").unwrap();
        decoder.stop();
        decoder.stop();
        assert_eq!(text, "not JSON ");
        assert_eq!(decoder.owned_buffer_bytes(), 0);
        let mut empty = ControlLineDecoder::new(1).unwrap();
        assert_eq!(empty.finish(), Ok(()));
    }
    #[test]
    fn counters_never_wrap_or_publish_a_partial_line() {
        let mut decoder = ControlLineDecoder::new(4).unwrap();
        decoder.received = u64::MAX;
        assert_eq!(decoder.feed(b"x"), Err(ControlLineError::CounterOverflow));
        assert!(decoder.take().is_none());
        let mut decoder = ControlLineDecoder::new(4).unwrap();
        decoder.messages = u64::MAX;
        assert_eq!(
            decoder.feed(b"{}\n"),
            Err(ControlLineError::CounterOverflow)
        );
        assert!(decoder.take().is_none());
        assert_eq!(decoder.owned_buffer_bytes(), 0);
    }

    #[test]
    fn maximal_line_and_one_byte_unicode_fragments_keep_bounded_incremental_state() {
        let mut wire = vec![b'x'; MAX_CONTROL_LINE_BYTES];
        wire.push(b'\n');
        let mut decoder = ControlLineDecoder::new(MAX_CONTROL_LINE_BYTES).unwrap();
        assert_eq!(decoder.feed(&wire), Ok(wire.len()));
        assert_eq!(decoder.owned_buffer_bytes(), MAX_CONTROL_LINE_BYTES);
        assert_eq!(decoder.take().unwrap().len(), MAX_CONTROL_LINE_BYTES);
        let text = "é🦀".repeat(4096);
        let mut decoder = ControlLineDecoder::new(text.len()).unwrap();
        for byte in text.as_bytes() {
            decoder.feed(&[*byte]).unwrap();
            assert!(decoder.bytes.len() - decoder.utf8_checked <= 3);
            assert!(decoder.owned_buffer_bytes() <= text.len());
        }
        assert_eq!(decoder.feed(b"\n"), Ok(1));
        assert_eq!(decoder.take().unwrap(), text);
    }

    #[test]
    fn debug_redacts_pending_and_ready_message_text() {
        let mut decoder = ControlLineDecoder::new(100).unwrap();
        decoder.feed(b"private-synthetic-sentinel").unwrap();
        assert!(!format!("{decoder:?}").contains("sentinel"));
        decoder.feed(b"\n").unwrap();
        assert!(!format!("{decoder:?}").contains("sentinel"));
        assert!(format!("{decoder:?}").contains("ready: true"));
        decoder.finish().unwrap();
        assert!(decoder.is_closed());
        assert_eq!(decoder.take().unwrap(), "private-synthetic-sentinel");
    }
}
