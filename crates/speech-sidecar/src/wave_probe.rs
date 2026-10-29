use std::path::Path;

use openscreen_speech_core::downmix::MonoMix;
use openscreen_speech_core::energy_activity::{
    ActivityTransition, EnergyActivityConfig, EnergyActivityDetector,
};
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
    pub activity_gate: &'static str,
    pub activity_frame_samples: u16,
    pub activity_frames: String,
    pub activity_starts: String,
    pub activity_stops: String,
    pub activity_tail_samples: u16,
    pub activity_at_end: bool,
}

const ACTIVITY_FRAME_SAMPLES: usize = 160;

fn activity_summary(samples: &[f32]) -> Result<(usize, usize, usize, usize, bool), &'static str> {
    let mut detector = EnergyActivityDetector::new(EnergyActivityConfig {
        frame_samples: ACTIVITY_FRAME_SAMPLES,
        start_rms: 0.02,
        stop_rms: 0.01,
        start_frames: 2,
        stop_frames: 3,
    })
    .map_err(|_| "activity")?;
    let mut frame_count = 0_usize;
    let mut starts = 0_usize;
    let mut stops = 0_usize;
    let (frames, tail) = samples.as_chunks::<ACTIVITY_FRAME_SAMPLES>();
    for frame in frames {
        match detector.analyze(frame).map_err(|_| "activity")?.transition {
            ActivityTransition::Started => starts += 1,
            ActivityTransition::Stopped => stops += 1,
            ActivityTransition::Silent | ActivityTransition::Active => {}
        }
        frame_count += 1;
    }
    Ok((frame_count, starts, stops, tail.len(), detector.is_active()))
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
    let (activity_frames, activity_starts, activity_stops, activity_tail, activity_at_end) =
        activity_summary(normalized.samples())?;
    Ok(WaveProbe {
        version: 0,
        kind: "wave.normalized",
        source_rate: normalized.source_rate(),
        sample_rate: normalized.output_rate(),
        samples: normalized.samples().len().to_string(),
        availability_delay_frames: normalized.availability_delay_frames().to_string(),
        activity_gate: "energy-rms-diagnostic-v0",
        activity_frame_samples: ACTIVITY_FRAME_SAMPLES as u16,
        activity_frames: activity_frames.to_string(),
        activity_starts: activity_starts.to_string(),
        activity_stops: activity_stops.to_string(),
        activity_tail_samples: activity_tail as u16,
        activity_at_end,
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
        assert_eq!(result.activity_frames, "0");
        assert_eq!(result.activity_tail_samples, 1);
        assert!(!result.activity_at_end);
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../../contracts/copilot/speech-sidecar-wave-probe.v0.fixture.json"
        ))
        .unwrap();
        assert_eq!(serde_json::to_value(&result).unwrap(), fixture);
    }

    #[test]
    fn reports_bounded_energy_activity_without_padding_the_tail() {
        let mut samples = vec![0.0_f32; 160];
        samples.extend(vec![0.25_f32; 320]);
        samples.extend(vec![0.0_f32; 480]);
        samples.push(0.5);
        let (frames, starts, stops, tail, active) = activity_summary(&samples).unwrap();
        assert_eq!((frames, starts, stops, tail, active), (6, 1, 1, 1, false));
    }
}
