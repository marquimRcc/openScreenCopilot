use std::path::Path;

use openscreen_speech_core::downmix::MonoMix;
use openscreen_speech_core::normalizer::NORMALIZER_MAX_INPUT_SAMPLES;
use openscreen_speech_core::provider::Cancellation;
use openscreen_speech_core::wave_file::{normalize_wave_file_16k, MAX_WAVE_FILE_BYTES};
use serde::Serialize;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WaveProbe {
    pub version: u8,
    pub kind: &'static str,
    pub source_rate: u32,
    pub sample_rate: u32,
    pub samples: String,
    pub availability_delay_frames: String,
}

pub fn probe_wave(path: &Path) -> Result<WaveProbe, &'static str> {
    let normalized = normalize_wave_file_16k(
        path,
        MAX_WAVE_FILE_BYTES,
        NORMALIZER_MAX_INPUT_SAMPLES,
        MonoMix::AverageAll,
        &Cancellation::default(),
    )
    .map_err(|_| "wave")?;
    Ok(WaveProbe {
        version: 0,
        kind: "wave.normalized",
        source_rate: normalized.source_rate(),
        sample_rate: normalized.output_rate(),
        samples: normalized.samples().len().to_string(),
        availability_delay_frames: normalized.availability_delay_frames().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn probes_a_bounded_host_authorized_wave_without_exposing_pcm() {
        let mut wave = Vec::new();
        wave.extend_from_slice(b"RIFF");
        wave.extend_from_slice(&38_u32.to_le_bytes());
        wave.extend_from_slice(b"WAVEfmt ");
        wave.extend_from_slice(&16_u32.to_le_bytes());
        wave.extend_from_slice(&1_u16.to_le_bytes());
        wave.extend_from_slice(&1_u16.to_le_bytes());
        wave.extend_from_slice(&16_000_u32.to_le_bytes());
        wave.extend_from_slice(&32_000_u32.to_le_bytes());
        wave.extend_from_slice(&2_u16.to_le_bytes());
        wave.extend_from_slice(&16_u16.to_le_bytes());
        wave.extend_from_slice(b"data");
        wave.extend_from_slice(&2_u32.to_le_bytes());
        wave.extend_from_slice(&0_i16.to_le_bytes());
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("openscreen-wave-probe-{unique}.wav"));
        fs::write(&path, wave).unwrap();
        let result = probe_wave(&path).unwrap();
        fs::remove_file(path).unwrap();
        assert_eq!(result.kind, "wave.normalized");
        assert_eq!(result.source_rate, 16_000);
        assert_eq!(result.sample_rate, 16_000);
        assert_eq!(result.samples, "1");
    }
}
