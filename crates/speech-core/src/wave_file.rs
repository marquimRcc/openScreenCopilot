//! Bounded WAV ingestion for trusted, host-authorized file paths.
//!
//! Only little-endian RIFF/WAVE PCM16 and IEEE-float32 are accepted. This is an
//! offline whole-file boundary: file bytes, decoded interleaved PCM, mono PCM and
//! normalized output may coexist. It is not streaming and grants no path access.

use std::fs::File;
use std::io::{Read, Take};
use std::path::Path;

use crate::downmix::{downmix_interleaved, DownmixError, MonoMix, MAX_INPUT_SCALARS};
use crate::normalizer::{
    normalize_mono_file_16k, NormalizeError, NormalizedMono16k, NORMALIZER_MAX_INPUT_SAMPLES,
};
use crate::provider::Cancellation;

pub const MAX_WAVE_FILE_BYTES: usize = 16 * 1024 * 1024;

#[derive(Debug, PartialEq, Eq)]
pub enum WaveError {
    InvalidLimit,
    Capacity,
    Io,
    InvalidContainer,
    MissingFormat,
    MissingData,
    DuplicateChunk,
    UnsupportedFormat,
    InvalidFormat,
    NonFinite,
    Allocation,
    Canceled,
    Downmix(DownmixError),
    Normalize(NormalizeError),
}

impl From<DownmixError> for WaveError {
    fn from(error: DownmixError) -> Self {
        Self::Downmix(error)
    }
}

impl From<NormalizeError> for WaveError {
    fn from(error: NormalizeError) -> Self {
        Self::Normalize(error)
    }
}

#[derive(Clone, Copy)]
enum Encoding {
    Pcm16,
    Float32,
}

#[derive(Clone, Copy)]
struct Format {
    encoding: Encoding,
    channels: u16,
    sample_rate: u32,
    block_align: usize,
}

pub struct DecodedWave {
    samples: Vec<f32>,
    channels: u16,
    sample_rate: u32,
}

impl std::fmt::Debug for DecodedWave {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DecodedWave")
            .field("samples", &self.samples.len())
            .field("channels", &self.channels)
            .field("sample_rate", &self.sample_rate)
            .finish()
    }
}

impl DecodedWave {
    pub fn samples(&self) -> &[f32] {
        &self.samples
    }

    pub fn channels(&self) -> u16 {
        self.channels
    }

    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    pub fn frames(&self) -> usize {
        self.samples.len() / usize::from(self.channels)
    }
}

fn u16le(bytes: &[u8], at: usize) -> Result<u16, WaveError> {
    bytes
        .get(at..at + 2)
        .and_then(|raw| raw.try_into().ok())
        .map(u16::from_le_bytes)
        .ok_or(WaveError::InvalidContainer)
}

fn u32le(bytes: &[u8], at: usize) -> Result<u32, WaveError> {
    bytes
        .get(at..at + 4)
        .and_then(|raw| raw.try_into().ok())
        .map(u32::from_le_bytes)
        .ok_or(WaveError::InvalidContainer)
}

fn parse_format(chunk: &[u8]) -> Result<Format, WaveError> {
    if chunk.len() < 16 {
        return Err(WaveError::InvalidFormat);
    }
    let tag = u16le(chunk, 0)?;
    let channels = u16le(chunk, 2)?;
    let sample_rate = u32le(chunk, 4)?;
    let byte_rate = u32le(chunk, 8)?;
    let block_align = usize::from(u16le(chunk, 12)?);
    let bits = u16le(chunk, 14)?;
    let (encoding, bytes_per_sample) = match (tag, bits) {
        (1, 16) => (Encoding::Pcm16, 2_usize),
        (3, 32) => (Encoding::Float32, 4_usize),
        _ => return Err(WaveError::UnsupportedFormat),
    };
    if channels == 0 || channels > 32 || !matches!(sample_rate, 16_000 | 44_100 | 48_000) {
        return Err(WaveError::InvalidFormat);
    }
    let expected_align = usize::from(channels)
        .checked_mul(bytes_per_sample)
        .ok_or(WaveError::InvalidFormat)?;
    let expected_rate = usize::try_from(sample_rate)
        .ok()
        .and_then(|rate| rate.checked_mul(expected_align))
        .ok_or(WaveError::InvalidFormat)?;
    if block_align != expected_align || usize::try_from(byte_rate).ok() != Some(expected_rate) {
        return Err(WaveError::InvalidFormat);
    }
    Ok(Format {
        encoding,
        channels,
        sample_rate,
        block_align,
    })
}

/// Decode bounded WAV bytes without granting filesystem access.
pub fn decode_wave_bytes(bytes: &[u8], max_frames: usize) -> Result<DecodedWave, WaveError> {
    if max_frames == 0 || max_frames > NORMALIZER_MAX_INPUT_SAMPLES {
        return Err(WaveError::InvalidLimit);
    }
    if bytes.len() > MAX_WAVE_FILE_BYTES {
        return Err(WaveError::Capacity);
    }
    if bytes.len() < 12 || &bytes[..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return Err(WaveError::InvalidContainer);
    }
    let riff_len = usize::try_from(u32le(bytes, 4)?)
        .ok()
        .and_then(|size| size.checked_add(8))
        .ok_or(WaveError::InvalidContainer)?;
    if riff_len != bytes.len() {
        return Err(WaveError::InvalidContainer);
    }

    let mut format = None;
    let mut data = None;
    let mut at = 12;
    while at < riff_len {
        let header = bytes.get(at..at + 8).ok_or(WaveError::InvalidContainer)?;
        let size = usize::try_from(u32::from_le_bytes(header[4..8].try_into().unwrap()))
            .map_err(|_| WaveError::InvalidContainer)?;
        let start = at.checked_add(8).ok_or(WaveError::InvalidContainer)?;
        let end = start.checked_add(size).ok_or(WaveError::InvalidContainer)?;
        let chunk = bytes.get(start..end).ok_or(WaveError::InvalidContainer)?;
        match &header[..4] {
            b"fmt " => {
                if format.is_some() {
                    return Err(WaveError::DuplicateChunk);
                }
                format = Some(parse_format(chunk)?);
            }
            b"data" => {
                if data.is_some() {
                    return Err(WaveError::DuplicateChunk);
                }
                data = Some(chunk);
            }
            _ => {}
        }
        at = end
            .checked_add(size % 2)
            .ok_or(WaveError::InvalidContainer)?;
        if at > riff_len {
            return Err(WaveError::InvalidContainer);
        }
    }

    let format = format.ok_or(WaveError::MissingFormat)?;
    let data = data.ok_or(WaveError::MissingData)?;
    if !data.len().is_multiple_of(format.block_align) {
        return Err(WaveError::InvalidFormat);
    }
    let frames = data.len() / format.block_align;
    let scalars = frames
        .checked_mul(usize::from(format.channels))
        .ok_or(WaveError::Capacity)?;
    if frames > max_frames || scalars > MAX_INPUT_SCALARS {
        return Err(WaveError::Capacity);
    }
    let mut samples = Vec::new();
    samples
        .try_reserve_exact(scalars)
        .map_err(|_| WaveError::Allocation)?;
    match format.encoding {
        Encoding::Pcm16 => {
            for raw in data.as_chunks::<2>().0 {
                let value = i16::from_le_bytes(*raw);
                samples.push(f32::from(value) / 32_768.0);
            }
        }
        Encoding::Float32 => {
            for raw in data.as_chunks::<4>().0 {
                let value = f32::from_le_bytes(*raw);
                if !value.is_finite() {
                    return Err(WaveError::NonFinite);
                }
                samples.push(value);
            }
        }
    }
    Ok(DecodedWave {
        samples,
        channels: format.channels,
        sample_rate: format.sample_rate,
    })
}

/// Decode, explicitly downmix and normalize trusted WAV bytes to mono 16 kHz.
pub fn normalize_wave_bytes_16k(
    bytes: &[u8],
    max_frames: usize,
    policy: MonoMix,
    cancel: &Cancellation,
) -> Result<NormalizedMono16k, WaveError> {
    if cancel.is_canceled() {
        return Err(WaveError::Canceled);
    }
    let wave = decode_wave_bytes(bytes, max_frames)?;
    let mono = downmix_interleaved(wave.samples(), wave.channels(), policy, max_frames)?;
    if cancel.is_canceled() {
        return Err(WaveError::Canceled);
    }
    normalize_mono_file_16k(&mono, wave.sample_rate(), max_frames, cancel).map_err(Into::into)
}

fn read_bounded(mut reader: Take<File>, capacity: usize) -> Result<Vec<u8>, WaveError> {
    let mut bytes = Vec::new();
    bytes
        .try_reserve_exact(capacity)
        .map_err(|_| WaveError::Allocation)?;
    reader.read_to_end(&mut bytes).map_err(|_| WaveError::Io)?;
    if bytes.len() >= capacity {
        return Err(WaveError::Capacity);
    }
    Ok(bytes)
}

/// Read a trusted host-authorized path, then decode/downmix/normalize it.
/// Path authorization, symlink policy and journaling remain host responsibilities.
pub fn normalize_wave_file_16k(
    path: &Path,
    max_file_bytes: usize,
    max_frames: usize,
    policy: MonoMix,
    cancel: &Cancellation,
) -> Result<NormalizedMono16k, WaveError> {
    if max_file_bytes == 0 || max_file_bytes > MAX_WAVE_FILE_BYTES {
        return Err(WaveError::InvalidLimit);
    }
    if cancel.is_canceled() {
        return Err(WaveError::Canceled);
    }
    let file = File::open(path).map_err(|_| WaveError::Io)?;
    let length = file.metadata().map_err(|_| WaveError::Io)?.len();
    if length > max_file_bytes as u64 {
        return Err(WaveError::Capacity);
    }
    let capacity = max_file_bytes.checked_add(1).ok_or(WaveError::Capacity)?;
    let bytes = read_bounded(file.take(capacity as u64), capacity)?;
    if cancel.is_canceled() {
        return Err(WaveError::Canceled);
    }
    normalize_wave_bytes_16k(&bytes, max_frames, policy, cancel)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn wave(tag: u16, channels: u16, rate: u32, bits: u16, data: &[u8]) -> Vec<u8> {
        let bytes_per_sample = usize::from(bits / 8);
        let align = usize::from(channels) * bytes_per_sample;
        let mut out = Vec::new();
        out.extend_from_slice(b"RIFF");
        out.extend_from_slice(&(36_u32 + data.len() as u32).to_le_bytes());
        out.extend_from_slice(b"WAVEfmt ");
        out.extend_from_slice(&16_u32.to_le_bytes());
        out.extend_from_slice(&tag.to_le_bytes());
        out.extend_from_slice(&channels.to_le_bytes());
        out.extend_from_slice(&rate.to_le_bytes());
        out.extend_from_slice(&(rate * align as u32).to_le_bytes());
        out.extend_from_slice(&(align as u16).to_le_bytes());
        out.extend_from_slice(&bits.to_le_bytes());
        out.extend_from_slice(b"data");
        out.extend_from_slice(&(data.len() as u32).to_le_bytes());
        out.extend_from_slice(data);
        out
    }

    #[test]
    fn pcm16_stereo_decodes_downmixes_and_normalizes_exactly() {
        let mut data = Vec::new();
        for frame in 0..48_000 {
            let left = if frame % 2 == 0 {
                16_384_i16
            } else {
                -16_384_i16
            };
            data.extend_from_slice(&left.to_le_bytes());
            data.extend_from_slice(&0_i16.to_le_bytes());
        }
        let bytes = wave(1, 2, 48_000, 16, &data);
        let decoded = decode_wave_bytes(&bytes, 48_000).unwrap();
        assert_eq!(decoded.frames(), 48_000);
        assert_eq!(decoded.channels(), 2);
        assert_eq!(decoded.samples()[0], 0.5);
        let normalized = normalize_wave_bytes_16k(
            &bytes,
            48_000,
            MonoMix::AverageAll,
            &Cancellation::default(),
        )
        .unwrap();
        assert_eq!(normalized.samples().len(), 16_000);
        assert_eq!(normalized.source_rate(), 48_000);
    }

    #[test]
    fn float32_file_path_round_trip_is_bounded_and_pcm_is_redacted() {
        let data: Vec<u8> = [0.25_f32, -0.5, 0.75, -1.0]
            .iter()
            .flat_map(|value| value.to_le_bytes())
            .collect();
        let bytes = wave(3, 1, 16_000, 32, &data);
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "openscreen-speech-core-wave-{}-{stamp}.wav",
            std::process::id()
        ));
        std::fs::write(&path, &bytes).unwrap();
        let result = normalize_wave_file_16k(
            &path,
            bytes.len(),
            4,
            MonoMix::AverageAll,
            &Cancellation::default(),
        );
        std::fs::remove_file(&path).unwrap();
        let normalized = result.unwrap();
        assert_eq!(normalized.samples(), &[0.25, -0.5, 0.75, -1.0]);
        assert!(!format!("{normalized:?}").contains("0.25"));
    }

    #[test]
    fn malformed_unsupported_nonfinite_capacity_and_cancel_are_explicit() {
        assert_eq!(
            decode_wave_bytes(b"not-wave", 1).unwrap_err(),
            WaveError::InvalidContainer
        );
        let unsupported = wave(1, 1, 16_000, 24, &[0, 0, 0]);
        assert_eq!(
            decode_wave_bytes(&unsupported, 1).unwrap_err(),
            WaveError::UnsupportedFormat
        );
        let nonfinite = wave(3, 1, 16_000, 32, &f32::NAN.to_le_bytes());
        assert_eq!(
            decode_wave_bytes(&nonfinite, 1).unwrap_err(),
            WaveError::NonFinite
        );
        let too_many = wave(1, 1, 16_000, 16, &[0, 0, 0, 0]);
        assert_eq!(
            decode_wave_bytes(&too_many, 1).unwrap_err(),
            WaveError::Capacity
        );
        let cancel = Cancellation::default();
        cancel.cancel();
        assert_eq!(
            normalize_wave_bytes_16k(&too_many, 2, MonoMix::AverageAll, &cancel).unwrap_err(),
            WaveError::Canceled
        );
    }
}
