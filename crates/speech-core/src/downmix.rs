// Adapted from meeting-copilot audio_processing.rs::audio_to_mono,
// commit 3c299c99abf7c38c1e3bac34c4aecdc010c911dd.
// Copyright (c) 2024 Zackriya Solutions. SPDX-License-Identifier: MIT
// Full upstream notice: ../LICENSE-MEETING-COPILOT (distributed with this crate).
// Changes: explicit policy, bounded/validated complete frames, f64 accumulation.
// No capture, resampling, gain, noise suppression or ASR integration.

/// Draft per-call guard, not a queue/memory/recording-duration guarantee.
pub const MAX_INPUT_SCALARS: usize = 1_048_576;

#[derive(Clone, Copy, Debug)]
pub enum MonoMix {
    /// Arithmetic mean, not a layout-aware surround/ITU downmix.
    AverageAll,
    /// Opt-in upstream mic-array behavior. Never silently discard system channels.
    FirstStereoPair,
}

#[derive(Debug, PartialEq, Eq)]
pub enum DownmixError {
    InvalidChannels,
    InvalidLimit,
    PartialFrame,
    Capacity,
    NonFiniteSample,
}

/// One output sample per complete input frame; preserves sample rate and frame
/// positions. The caller must retain partial interleaved frames across transport
/// chunks. No padding, buffering, timestamps, normalization or clipping is added.
pub fn downmix_interleaved(
    audio: &[f32],
    channels: u16,
    policy: MonoMix,
    max_frames: usize,
) -> Result<Vec<f32>, DownmixError> {
    if channels == 0 || channels > 32 {
        return Err(DownmixError::InvalidChannels);
    }
    if max_frames == 0 || max_frames > MAX_INPUT_SCALARS {
        return Err(DownmixError::InvalidLimit);
    }
    let channels = usize::from(channels);
    if !audio.len().is_multiple_of(channels) {
        return Err(DownmixError::PartialFrame);
    }
    let frames = audio.len() / channels;
    if audio.len() > MAX_INPUT_SCALARS || frames > max_frames {
        return Err(DownmixError::Capacity);
    }
    // Validate even channels excluded by an explicit policy, before allocating.
    if audio.iter().any(|sample| !sample.is_finite()) {
        return Err(DownmixError::NonFiniteSample);
    }
    let effective = match policy {
        MonoMix::AverageAll => channels,
        MonoMix::FirstStereoPair => channels.min(2),
    };
    let mut mono = Vec::with_capacity(frames);
    for frame in audio.chunks_exact(channels) {
        // Summing finite f32 inputs in f64 avoids intermediate f32 overflow.
        let sum: f64 = frame[..effective]
            .iter()
            .map(|sample| f64::from(*sample))
            .sum();
        mono.push((sum / effective as f64) as f32);
    }
    Ok(mono)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mono_and_stereo_keep_frame_count_and_arithmetic_mean() {
        assert_eq!(
            downmix_interleaved(&[0.0, 0.5, -0.25], 1, MonoMix::AverageAll, 3),
            Ok(vec![0.0, 0.5, -0.25])
        );
        assert_eq!(
            downmix_interleaved(&[0.5, 0.5, 1.0, -1.0], 2, MonoMix::AverageAll, 2),
            Ok(vec![0.5, 0.0])
        );
        assert_eq!(
            downmix_interleaved(&[], 2, MonoMix::AverageAll, 1),
            Ok(vec![])
        );
    }

    #[test]
    fn auxiliary_channels_are_excluded_only_with_explicit_policy() {
        let audio = [0.0, 0.0, 0.75, 0.75, 0.5, 0.5, -0.5, -0.5];
        assert_eq!(
            downmix_interleaved(&audio, 4, MonoMix::AverageAll, 2),
            Ok(vec![0.375, 0.0])
        );
        assert_eq!(
            downmix_interleaved(&audio, 4, MonoMix::FirstStereoPair, 2),
            Ok(vec![0.0, 0.5])
        );
    }

    #[test]
    fn rejects_zero_channels_partial_frames_and_invalid_limits() {
        for channels in [0, 33, u16::MAX] {
            assert_eq!(
                downmix_interleaved(&[], channels, MonoMix::AverageAll, 1),
                Err(DownmixError::InvalidChannels)
            );
        }
        assert_eq!(
            downmix_interleaved(&[0.0; 3], 2, MonoMix::AverageAll, 2),
            Err(DownmixError::PartialFrame)
        );
        for limit in [0, MAX_INPUT_SCALARS + 1, usize::MAX] {
            assert_eq!(
                downmix_interleaved(&[], 1, MonoMix::AverageAll, limit),
                Err(DownmixError::InvalidLimit)
            );
        }
    }

    #[test]
    fn validates_all_channels_before_any_output() {
        for bad in [f32::NAN, f32::INFINITY, f32::NEG_INFINITY] {
            for policy in [MonoMix::AverageAll, MonoMix::FirstStereoPair] {
                assert_eq!(
                    downmix_interleaved(&[0.0, 0.0, bad], 3, policy, 1),
                    Err(DownmixError::NonFiniteSample)
                );
            }
        }
    }

    #[test]
    fn capacity_limits_both_frames_and_input_scalars() {
        assert_eq!(
            downmix_interleaved(&[0.0; 4], 2, MonoMix::AverageAll, 1),
            Err(DownmixError::Capacity)
        );
        let audio = vec![0.0; MAX_INPUT_SCALARS + 2];
        assert_eq!(
            downmix_interleaved(&audio, 2, MonoMix::AverageAll, MAX_INPUT_SCALARS),
            Err(DownmixError::Capacity)
        );
    }

    #[test]
    fn finite_extremes_do_not_overflow_sum_or_add_clipping() {
        assert_eq!(
            downmix_interleaved(&[f32::MAX; 32], 32, MonoMix::AverageAll, 1),
            Ok(vec![f32::MAX])
        );
        assert_eq!(
            downmix_interleaved(&[f32::MAX, -f32::MAX], 2, MonoMix::AverageAll, 1),
            Ok(vec![0.0])
        );
        assert_eq!(
            downmix_interleaved(&[2.0, 2.0], 2, MonoMix::AverageAll, 1),
            Ok(vec![2.0])
        );
    }

    #[test]
    fn complete_frame_partitions_are_identical_without_padding_or_delay() {
        let audio: Vec<f32> = (0..300).map(|n| (n as f32 - 150.0) / 150.0).collect();
        for channels in [1u16, 2, 3, 4, 6] {
            for policy in [MonoMix::AverageAll, MonoMix::FirstStereoPair] {
                let whole = downmix_interleaved(&audio, channels, policy, 300).unwrap();
                let partitioned: Vec<f32> = audio
                    .chunks(usize::from(channels) * 5)
                    .flat_map(|chunk| downmix_interleaved(chunk, channels, policy, 5).unwrap())
                    .collect();
                assert_eq!(partitioned, whole);
                assert_eq!(whole.len(), audio.len() / usize::from(channels));
            }
        }
    }
}
