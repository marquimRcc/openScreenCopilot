//! Experimental fixed binary descriptor v0, NOT an active transport or permission.
//! Parsing a nonce/source does not authenticate the sender. No allocation, PCM
//! copying, replay registry, clock mapping, queue, journal or live capture here.

pub const HEADER_BYTES: usize = 80;
pub const MAX_PAYLOAD_BYTES: u32 = 4_194_304;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FrameError {
    Length,
    Schema,
    Format,
    Limits,
    Arithmetic,
    Payload,
    NonFinite,
}
impl FrameError {
    pub fn code(self) -> &'static str {
        match self {
            Self::Length => "length",
            Self::Schema => "schema",
            Self::Format => "format",
            Self::Limits => "limits",
            Self::Arithmetic => "arithmetic",
            Self::Payload => "payload",
            Self::NonFinite => "non-finite",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Source {
    System,
    Microphone,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Header {
    pub payload_bytes: u32,
    pub sample_rate: u32,
    pub channels: u16,
    pub source: Source,
    pub discontinuity: bool,
    pub session_nonce: [u8; 16],
    pub epoch: u64,
    pub sequence: u64,
    pub sample_start: u64,
    pub sample_end: u64,
    pub frame_count: u32,
    /// Raw capture-domain metadata. Never treated as media PTS/ASR arrival time.
    pub capture_monotonic_ns: u64,
}

pub fn parse_header(bytes: &[u8]) -> Result<Header, FrameError> {
    if bytes.len() != HEADER_BYTES {
        return Err(FrameError::Length);
    }
    // Slice sizes proven by the fixed-header length check, not payload metadata.
    let u16_at = |at| u16::from_le_bytes(bytes[at..at + 2].try_into().unwrap());
    let u32_at = |at| u32::from_le_bytes(bytes[at..at + 4].try_into().unwrap());
    let u64_at = |at| u64::from_le_bytes(bytes[at..at + 8].try_into().unwrap());
    if &bytes[..4] != b"OSCP"
        || bytes[4] != 0
        || bytes[5] != 1
        || u16_at(6) != HEADER_BYTES as u16
        || u32_at(68) != 0
        || u32_at(20) & !1 != 0
    {
        return Err(FrameError::Schema);
    }
    let source = match bytes[19] {
        1 => Source::System,
        2 => Source::Microphone,
        _ => return Err(FrameError::Format),
    };
    if bytes[18] != 1 {
        return Err(FrameError::Format);
    } // f32 little-endian only
    let payload_bytes = u32_at(8);
    let sample_rate = u32_at(12);
    let channels = u16_at(16);
    let frame_count = u32_at(64);
    if !(1..=192_000).contains(&sample_rate)
        || !(1..=32).contains(&channels)
        || frame_count == 0
        || payload_bytes > MAX_PAYLOAD_BYTES
    {
        return Err(FrameError::Limits);
    }
    let expected = u64::from(frame_count) * u64::from(channels) * 4;
    if expected > u64::from(MAX_PAYLOAD_BYTES) {
        return Err(FrameError::Limits);
    }
    if u64::from(payload_bytes) != expected {
        return Err(FrameError::Payload);
    }
    let sample_start = u64_at(56);
    let sample_end = sample_start
        .checked_add(u64::from(frame_count))
        .ok_or(FrameError::Arithmetic)?;
    let session_nonce: [u8; 16] = bytes[24..40].try_into().unwrap();
    if session_nonce.iter().all(|&v| v == 0) {
        return Err(FrameError::Schema);
    }
    Ok(Header {
        payload_bytes,
        sample_rate,
        channels,
        source,
        discontinuity: u32_at(20) != 0,
        session_nonce,
        epoch: u64_at(40),
        sequence: u64_at(48),
        sample_start,
        sample_end,
        frame_count,
        capture_monotonic_ns: u64_at(72),
    })
}

/// Reparses the raw header, so caller-mutated Header fields never authorize a
/// payload length. Validate header BEFORE reserving payload space in a future
/// transport. This complete-frame helper only borrows an already bounded slice.
pub fn validate_frame(bytes: &[u8]) -> Result<Header, FrameError> {
    if bytes.len() < HEADER_BYTES {
        return Err(FrameError::Length);
    }
    let header = parse_header(&bytes[..HEADER_BYTES])?;
    if bytes.len() - HEADER_BYTES != header.payload_bytes as usize {
        return Err(FrameError::Payload);
    }
    for scalar in bytes[HEADER_BYTES..].as_chunks::<4>().0 {
        if !f32::from_le_bytes(*scalar).is_finite() {
            return Err(FrameError::NonFinite);
        }
    }
    Ok(header)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn decode_hex(text: &str) -> Vec<u8> {
        assert!(text.len().is_multiple_of(2));
        (0..text.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&text[i..i + 2], 16).unwrap())
            .collect()
    }
    #[test]
    fn shared_binary_fixtures_match_header_and_full_payload_results() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../../contracts/copilot/audio-frame.v0.fixture.json"
        ))
        .unwrap();
        for case in fixture["cases"].as_array().unwrap() {
            let header_bytes = decode_hex(case["headerHex"].as_str().unwrap());
            let parsed = parse_header(&header_bytes);
            if let Some(error) = case["headerError"].as_str() {
                assert_eq!(parsed.unwrap_err().code(), error, "{}", case["name"]);
                continue;
            }
            let header = parsed.unwrap();
            for (key, value) in [
                ("payloadBytes", u64::from(header.payload_bytes)),
                ("sampleRate", u64::from(header.sample_rate)),
                ("channels", u64::from(header.channels)),
                ("frameCount", u64::from(header.frame_count)),
            ] {
                assert_eq!(
                    value,
                    case["expected"][key].as_u64().unwrap(),
                    "{} {key}",
                    case["name"]
                );
            }
            assert_eq!(
                header.discontinuity,
                case["expected"]["discontinuity"].as_bool().unwrap()
            );
            assert_eq!(
                match header.source {
                    Source::System => "system",
                    Source::Microphone => "microphone",
                },
                case["expected"]["source"].as_str().unwrap()
            );
            let nonce: String = header
                .session_nonce
                .iter()
                .map(|v| format!("{v:02x}"))
                .collect();
            assert_eq!(nonce, case["expected"]["sessionNonceHex"].as_str().unwrap());
            assert_eq!(
                header.epoch.to_string(),
                case["expected"]["epoch"].as_str().unwrap()
            );
            assert_eq!(
                header.sequence.to_string(),
                case["expected"]["sequence"].as_str().unwrap()
            );
            assert_eq!(
                header.sample_start.to_string(),
                case["expected"]["sampleStart"].as_str().unwrap()
            );
            assert_eq!(
                header.sample_end.to_string(),
                case["expected"]["sampleEnd"].as_str().unwrap()
            );
            assert_eq!(
                header.capture_monotonic_ns.to_string(),
                case["expected"]["captureMonotonicNs"].as_str().unwrap()
            );
            let mut complete = header_bytes;
            complete.extend(decode_hex(case["payloadHex"].as_str().unwrap()));
            match case["frameError"].as_str() {
                Some(error) => assert_eq!(
                    validate_frame(&complete).unwrap_err().code(),
                    error,
                    "{}",
                    case["name"]
                ),
                None => assert_eq!(validate_frame(&complete).unwrap(), header),
            }
        }
    }
    #[test]
    fn all_truncated_header_lengths_reject_without_indexing_payload() {
        for length in 0..HEADER_BYTES {
            assert_eq!(parse_header(&vec![0; length]), Err(FrameError::Length));
        }
        assert_eq!(
            parse_header(&[0; HEADER_BYTES + 1]),
            Err(FrameError::Length)
        );
    }
    #[test]
    fn scalar_budget_is_inclusive_and_actual_payload_is_required() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../../contracts/copilot/audio-frame.v0.fixture.json"
        ))
        .unwrap();
        let mut bytes = decode_hex(fixture["cases"][0]["headerHex"].as_str().unwrap());
        bytes[8..12].copy_from_slice(&MAX_PAYLOAD_BYTES.to_le_bytes());
        bytes[64..68].copy_from_slice(&(MAX_PAYLOAD_BYTES / 4).to_le_bytes());
        bytes[16..18].copy_from_slice(&1_u16.to_le_bytes());
        assert!(parse_header(&bytes).is_ok());
        assert_eq!(validate_frame(&bytes), Err(FrameError::Payload));
        bytes.resize(HEADER_BYTES + MAX_PAYLOAD_BYTES as usize, 0);
        assert!(validate_frame(&bytes).is_ok());
        bytes[64..68].copy_from_slice(&(MAX_PAYLOAD_BYTES / 4 + 1).to_le_bytes());
        assert_eq!(
            parse_header(&bytes[..HEADER_BYTES]),
            Err(FrameError::Limits)
        );
    }

    #[test]
    fn finite_amplitudes_are_not_clipped_and_complete_frame_reparses_raw_header() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../../contracts/copilot/audio-frame.v0.fixture.json"
        ))
        .unwrap();
        let mut bytes = decode_hex(fixture["cases"][0]["headerHex"].as_str().unwrap());
        let parsed = parse_header(&bytes).unwrap();
        bytes.extend(
            [f32::MAX, -f32::MAX, 0.0, -0.0]
                .into_iter()
                .flat_map(f32::to_le_bytes),
        );
        assert_eq!(validate_frame(&bytes).unwrap(), parsed);
        bytes[68] = 1;
        assert_eq!(validate_frame(&bytes), Err(FrameError::Schema));
        assert_eq!(
            parsed.payload_bytes, 16,
            "previous scalar snapshot is immutable by raw bytes"
        );
    }
}
