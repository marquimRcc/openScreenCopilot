// Adapted from meeting-copilot audio_processing.rs::audio_to_mono,
// commit 3c299c99abf7c38c1e3bac34c4aecdc010c911dd.
// Copyright (c) 2024 Zackriya Solutions. SPDX-License-Identifier: MIT
// Full upstream notice: ../LICENSE-MEETING-COPILOT (distributed with this crate).
// Changes: explicit policy, bounded/validated complete frames, f64 accumulation,
// fallible mono allocation and explicit f32le byte input without reinterpret casts.
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
    Allocation,
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
    downmix_samples(
        Samples::Native(audio),
        channels,
        policy,
        max_frames,
        allocate_mono,
    )
}

/// Little-endian packed f32 scalars, including unaligned byte slices. Does not
/// parse an AudioFrame, authenticate a source or attach a timeline. One complete
/// input frame still produces one mono sample at the SAME rate (not16k resampling).
/// No intermediate interleaved f32 copy is allocated; caller owns input/output
/// and must budget both buffers when wiring a future pipeline.
pub fn downmix_f32le(
    bytes: &[u8],
    channels: u16,
    policy: MonoMix,
    max_frames: usize,
) -> Result<Vec<f32>, DownmixError> {
    downmix_samples(
        Samples::LittleEndian(bytes),
        channels,
        policy,
        max_frames,
        allocate_mono,
    )
}

enum Samples<'a> {
    Native(&'a [f32]),
    LittleEndian(&'a [u8]),
}
impl Samples<'_> {
    fn len(&self) -> usize {
        match self {
            Self::Native(values) => values.len(),
            Self::LittleEndian(bytes) => bytes.len() / 4,
        }
    }
    fn complete_scalars(&self) -> bool {
        match self {
            Self::Native(_) => true,
            Self::LittleEndian(bytes) => bytes.len().is_multiple_of(4),
        }
    }
    fn at(&self, at: usize) -> f32 {
        match self {
            Self::Native(values) => values[at],
            Self::LittleEndian(bytes) => {
                f32::from_le_bytes(bytes[at * 4..at * 4 + 4].try_into().unwrap())
            }
        }
    }
}
type MonoAllocator = fn(usize) -> Result<Vec<f32>, DownmixError>;
fn allocate_mono(frames: usize) -> Result<Vec<f32>, DownmixError> {
    let mut mono = Vec::new();
    mono.try_reserve_exact(frames)
        .map_err(|_| DownmixError::Allocation)?;
    Ok(mono)
}
fn downmix_samples(
    audio: Samples<'_>,
    channels: u16,
    policy: MonoMix,
    max_frames: usize,
    allocate: MonoAllocator,
) -> Result<Vec<f32>, DownmixError> {
    if channels == 0 || channels > 32 {
        return Err(DownmixError::InvalidChannels);
    }
    if max_frames == 0 || max_frames > MAX_INPUT_SCALARS {
        return Err(DownmixError::InvalidLimit);
    }
    let channels = usize::from(channels);
    if !audio.complete_scalars() || !audio.len().is_multiple_of(channels) {
        return Err(DownmixError::PartialFrame);
    }
    let frames = audio.len() / channels;
    if audio.len() > MAX_INPUT_SCALARS || frames > max_frames {
        return Err(DownmixError::Capacity);
    }
    // Validate even channels excluded by an explicit policy, before allocating.
    if (0..audio.len()).any(|at| !audio.at(at).is_finite()) {
        return Err(DownmixError::NonFiniteSample);
    }
    let effective = match policy {
        MonoMix::AverageAll => channels,
        MonoMix::FirstStereoPair => channels.min(2),
    };
    let mut mono = allocate(frames)?;
    if !mono.is_empty() || mono.capacity() != frames {
        return Err(DownmixError::Allocation);
    }
    for frame in 0..frames {
        // Summing finite f32 inputs in f64 avoids intermediate f32 overflow.
        let sum: f64 = (0..effective)
            .map(|channel| f64::from(audio.at(frame * channels + channel)))
            .sum();
        mono.push((sum / effective as f64) as f32);
    }
    Ok(mono)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn packed(audio: &[f32]) -> Vec<u8> {
        audio.iter().flat_map(|value| value.to_le_bytes()).collect()
    }

    #[test]
    fn byte_input_matches_native_for_unaligned_slices_channels_policies_and_extremes() {
        let audio = [f32::MAX, -f32::MAX, 2.0, 2.0, -0.0, 0.0, 0.25, -0.5];
        let mut padded = vec![0x99];
        padded.extend_from_slice(&packed(&audio));
        padded.push(0x99);
        for channels in [1, 2, 4, 8] {
            for policy in [MonoMix::AverageAll, MonoMix::FirstStereoPair] {
                assert_eq!(
                    downmix_f32le(&padded[1..padded.len() - 1], channels, policy, 8),
                    downmix_interleaved(&audio, channels, policy, 8)
                );
            }
        }
        assert_eq!(
            downmix_f32le(&0.5_f32.to_le_bytes(), 1, MonoMix::AverageAll, 1),
            Ok(vec![0.5])
        );
    }
    #[test]
    fn partial_scalar_frame_and_excluded_bad_channels_fail_before_allocating() {
        for bytes in [vec![0; 1], vec![0; 3], vec![0; 5], vec![0; 12]] {
            assert_eq!(
                downmix_samples(
                    Samples::LittleEndian(&bytes),
                    2,
                    MonoMix::AverageAll,
                    8,
                    |_| panic!("invalid bytes must fail before allocation")
                ),
                Err(DownmixError::PartialFrame)
            );
        }
        for bad in [f32::NAN, f32::INFINITY, f32::NEG_INFINITY] {
            let bytes = packed(&[0.0, 0.0, bad]);
            assert_eq!(
                downmix_samples(
                    Samples::LittleEndian(&bytes),
                    3,
                    MonoMix::FirstStereoPair,
                    1,
                    |_| panic!("excluded invalid channel must still fail before allocation")
                ),
                Err(DownmixError::NonFiniteSample)
            );
        }
    }
    #[test]
    fn byte_input_preserves_complete_frame_partitions_without_copying_interleaved_pcm() {
        let audio: Vec<f32> = (0..320).map(|v| (v as f32 - 160.0) / 160.0).collect();
        let bytes = packed(&audio);
        for channels in [1, 2, 4, 5, 8, 10, 16, 32] {
            for policy in [MonoMix::AverageAll, MonoMix::FirstStereoPair] {
                let whole = downmix_f32le(&bytes, channels, policy, 320).unwrap();
                let pieces: Vec<f32> = bytes
                    .chunks(usize::from(channels) * 4 * 3)
                    .flat_map(|part| downmix_f32le(part, channels, policy, 3).unwrap())
                    .collect();
                assert_eq!(whole, pieces);
                assert_eq!(
                    whole,
                    downmix_interleaved(&audio, channels, policy, 320).unwrap()
                );
            }
        }
    }
    #[test]
    fn mono_allocation_refusal_and_wrong_allocator_shape_are_explicit_not_partial_success() {
        let allocators: [MonoAllocator; 3] = [
            |_| Err(DownmixError::Allocation),
            |length| Ok(vec![0.0; length]),
            |length| Ok(Vec::with_capacity(length + 1)),
        ];
        for allocate in allocators {
            let bytes = packed(&[0.5, 0.5]);
            assert_eq!(
                downmix_samples(
                    Samples::LittleEndian(&bytes),
                    2,
                    MonoMix::AverageAll,
                    1,
                    allocate
                ),
                Err(DownmixError::Allocation)
            );
            assert_eq!(
                downmix_samples(
                    Samples::Native(&[0.5, 0.5]),
                    2,
                    MonoMix::AverageAll,
                    1,
                    allocate
                ),
                Err(DownmixError::Allocation)
            );
        }
    }
    #[test]
    fn byte_cap_and_empty_inputs_match_native_bounds_without_padding() {
        for channels in [0, 33] {
            assert_eq!(
                downmix_f32le(&[], channels, MonoMix::AverageAll, 1),
                Err(DownmixError::InvalidChannels)
            );
        }
        for limit in [0, MAX_INPUT_SCALARS + 1] {
            assert_eq!(
                downmix_f32le(&[], 1, MonoMix::AverageAll, limit),
                Err(DownmixError::InvalidLimit)
            );
        }
        assert_eq!(downmix_f32le(&[], 2, MonoMix::AverageAll, 1), Ok(vec![]));
        let bytes = vec![0; MAX_INPUT_SCALARS * 4];
        assert_eq!(
            downmix_f32le(&bytes, 1, MonoMix::AverageAll, MAX_INPUT_SCALARS)
                .unwrap()
                .len(),
            MAX_INPUT_SCALARS
        );
        let oversized = vec![0; MAX_INPUT_SCALARS * 4 + 4];
        assert_eq!(
            downmix_samples(
                Samples::LittleEndian(&oversized),
                1,
                MonoMix::AverageAll,
                MAX_INPUT_SCALARS,
                |_| panic!("capacity must be checked before allocation")
            ),
            Err(DownmixError::Capacity)
        );
    }

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
    fn exact_scalar_and_frame_budget_is_accepted_without_extra_output() {
        let audio = vec![0.125; MAX_INPUT_SCALARS];
        for channels in [1u16, 2, 4, 32] {
            let frames = MAX_INPUT_SCALARS / usize::from(channels);
            for policy in [MonoMix::AverageAll, MonoMix::FirstStereoPair] {
                let output = downmix_interleaved(&audio, channels, policy, frames).unwrap();
                assert_eq!(output.len(), frames);
                assert!(output.iter().all(|value| *value == 0.125));
                assert_eq!(
                    downmix_interleaved(&audio, channels, policy, frames - 1),
                    Err(DownmixError::Capacity)
                );
            }
        }
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
