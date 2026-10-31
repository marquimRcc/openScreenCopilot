//! Bounded whole-buffer mono normalization for file/offline ingestion.
//!
//! This is not a live resampler: the complete mono input and normalized output
//! coexist until the caller drops one of them. The host must account both buffers
//! and split long recordings before using this boundary.

use rubato::{
    Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
};

use crate::provider::Cancellation;

const BLOCK: usize = 512;
const MAX_FLUSH_BLOCKS: usize = 4;

pub const NORMALIZED_SAMPLE_RATE: u32 = 16_000;
pub const NORMALIZER_MAX_INPUT_SAMPLES: usize = 1_048_576;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NormalizeError {
    InvalidRate,
    InvalidLimit,
    InputTooLarge,
    NonFinite,
    Canceled,
    Allocation,
    Resampler,
    IncompleteTail,
}

/// Owned mono 16 kHz output. Debug deliberately omits PCM values.
pub struct NormalizedMono16k {
    samples: Vec<f32>,
    source_rate: u32,
    availability_delay_frames: usize,
}

impl std::fmt::Debug for NormalizedMono16k {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NormalizedMono16k")
            .field("samples", &self.samples.len())
            .field("source_rate", &self.source_rate)
            .field("availability_delay_frames", &self.availability_delay_frames)
            .finish()
    }
}

impl NormalizedMono16k {
    pub fn samples(&self) -> &[f32] {
        &self.samples
    }

    pub fn into_samples(self) -> Vec<f32> {
        self.samples
    }

    pub fn source_rate(&self) -> u32 {
        self.source_rate
    }

    pub fn output_rate(&self) -> u32 {
        NORMALIZED_SAMPLE_RATE
    }

    /// Filter availability metadata, not media PTS to trim from the output.
    pub fn availability_delay_frames(&self) -> usize {
        self.availability_delay_frames
    }
}

fn allocate_f32(length: usize) -> Result<Vec<f32>, NormalizeError> {
    let mut values = Vec::new();
    values
        .try_reserve_exact(length)
        .map_err(|_| NormalizeError::Allocation)?;
    values.resize(length, 0.0);
    Ok(values)
}

fn validate(
    input: &[f32],
    source_rate: u32,
    max_input_samples: usize,
    canceled: bool,
) -> Result<(), NormalizeError> {
    if !matches!(source_rate, NORMALIZED_SAMPLE_RATE | 44_100 | 48_000) {
        return Err(NormalizeError::InvalidRate);
    }
    if max_input_samples == 0 || max_input_samples > NORMALIZER_MAX_INPUT_SAMPLES {
        return Err(NormalizeError::InvalidLimit);
    }
    if input.len() > max_input_samples {
        return Err(NormalizeError::InputTooLarge);
    }
    if input.iter().any(|sample| !sample.is_finite()) {
        return Err(NormalizeError::NonFinite);
    }
    if canceled {
        return Err(NormalizeError::Canceled);
    }
    Ok(())
}

/// Normalize a complete, already-downmixed file buffer to mono 16 kHz.
///
/// Only 16/44.1/48 kHz are admitted. The exact output-length policy is
/// `floor(input_samples * 16000 / source_rate)`. Padding used to flush the
/// filter is never reported as captured audio. Cancellation discards all output.
pub fn normalize_mono_file_16k(
    input: &[f32],
    source_rate: u32,
    max_input_samples: usize,
    cancel: &Cancellation,
) -> Result<NormalizedMono16k, NormalizeError> {
    normalize_mono_file_16k_with(input, source_rate, max_input_samples, || {
        cancel.is_canceled()
    })
}

fn normalize_mono_file_16k_with(
    input: &[f32],
    source_rate: u32,
    max_input_samples: usize,
    mut is_canceled: impl FnMut() -> bool,
) -> Result<NormalizedMono16k, NormalizeError> {
    validate(input, source_rate, max_input_samples, is_canceled())?;

    if source_rate == NORMALIZED_SAMPLE_RATE {
        let mut samples = Vec::new();
        samples
            .try_reserve_exact(input.len())
            .map_err(|_| NormalizeError::Allocation)?;
        samples.extend_from_slice(input);
        if is_canceled() {
            return Err(NormalizeError::Canceled);
        }
        return Ok(NormalizedMono16k {
            samples,
            source_rate,
            availability_delay_frames: 0,
        });
    }

    let expected =
        (input.len() as u64 * u64::from(NORMALIZED_SAMPLE_RATE) / u64::from(source_rate)) as usize;
    let mut resampler = SincFixedIn::<f32>::new(
        f64::from(NORMALIZED_SAMPLE_RATE) / f64::from(source_rate),
        1.0,
        SincInterpolationParameters {
            sinc_len: 256,
            f_cutoff: 0.95,
            oversampling_factor: 128,
            interpolation: SincInterpolationType::Cubic,
            window: WindowFunction::BlackmanHarris2,
        },
        BLOCK,
        1,
    )
    .map_err(|_| NormalizeError::Resampler)?;
    let availability_delay_frames = resampler.output_delay();
    let mut output = vec![allocate_f32(resampler.output_frames_max())?];
    let mut samples = Vec::new();
    samples
        .try_reserve_exact(expected)
        .map_err(|_| NormalizeError::Allocation)?;
    let mut block = [0.0_f32; BLOCK];
    let mut offset = 0;

    let mut process = |block: &[f32; BLOCK], samples: &mut Vec<f32>| {
        if is_canceled() {
            return Err(NormalizeError::Canceled);
        }
        let (read, written) = resampler
            .process_into_buffer(&[block.as_slice()], &mut output, None)
            .map_err(|_| NormalizeError::Resampler)?;
        if read != BLOCK || written > output[0].len() {
            return Err(NormalizeError::Resampler);
        }
        let take = (expected - samples.len()).min(written);
        let valid = &output[0][..take];
        if valid.iter().any(|sample| !sample.is_finite()) {
            return Err(NormalizeError::Resampler);
        }
        samples.extend_from_slice(valid);
        Ok(())
    };

    while input.len() - offset >= BLOCK {
        block.copy_from_slice(&input[offset..offset + BLOCK]);
        process(&block, &mut samples)?;
        offset += BLOCK;
    }
    if offset < input.len() {
        let tail = input.len() - offset;
        block[..tail].copy_from_slice(&input[offset..]);
        block[tail..].fill(0.0);
        process(&block, &mut samples)?;
    }

    block.fill(0.0);
    let mut flush_blocks = 0;
    while samples.len() < expected && flush_blocks < MAX_FLUSH_BLOCKS {
        process(&block, &mut samples)?;
        flush_blocks += 1;
    }
    if is_canceled() {
        return Err(NormalizeError::Canceled);
    }
    if samples.len() != expected {
        return Err(NormalizeError::IncompleteTail);
    }

    Ok(NormalizedMono16k {
        samples,
        source_rate,
        availability_delay_frames,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tone(rate: u32, hz: f64, count: usize) -> Vec<f32> {
        (0..count)
            .map(|n| (std::f64::consts::TAU * hz * n as f64 / f64::from(rate)).sin() as f32)
            .collect()
    }

    #[test]
    fn supported_rates_have_exact_counts_and_fresh_filter_state() {
        for rate in [44_100, 48_000] {
            for count in [0, 1, 511, 512, 513, rate as usize + 17] {
                let input = tone(rate, 1_000.0, count);
                let output = normalize_mono_file_16k(
                    &input,
                    rate,
                    NORMALIZER_MAX_INPUT_SAMPLES,
                    &Cancellation::default(),
                )
                .unwrap();
                assert_eq!(
                    output.samples().len(),
                    count * NORMALIZED_SAMPLE_RATE as usize / rate as usize
                );
                assert_eq!(output.source_rate(), rate);
                assert_eq!(output.output_rate(), NORMALIZED_SAMPLE_RATE);
            }
            let silence = normalize_mono_file_16k(
                &vec![0.0; 513],
                rate,
                NORMALIZER_MAX_INPUT_SAMPLES,
                &Cancellation::default(),
            )
            .unwrap();
            assert!(silence.samples().iter().all(|sample| *sample == 0.0));
        }
    }

    #[test]
    fn native_16k_is_copied_not_aliased_and_debug_redacts_pcm() {
        let input = vec![0.25, -0.5, 0.75];
        let output = normalize_mono_file_16k(&input, 16_000, 3, &Cancellation::default()).unwrap();
        assert_eq!(output.samples(), input);
        assert_eq!(output.availability_delay_frames(), 0);
        let debug = format!("{output:?}");
        assert!(debug.contains("samples: 3"));
        assert!(!debug.contains("0.25"));
    }

    #[test]
    fn validation_and_cancel_fail_without_partial_success() {
        assert_eq!(
            normalize_mono_file_16k(&[], 8_000, 1, &Cancellation::default()).unwrap_err(),
            NormalizeError::InvalidRate
        );
        assert_eq!(
            normalize_mono_file_16k(&[], 16_000, 0, &Cancellation::default()).unwrap_err(),
            NormalizeError::InvalidLimit
        );
        assert_eq!(
            normalize_mono_file_16k(&[0.0, 1.0], 16_000, 1, &Cancellation::default()).unwrap_err(),
            NormalizeError::InputTooLarge
        );
        assert_eq!(
            normalize_mono_file_16k(&[f32::NAN], 16_000, 1, &Cancellation::default()).unwrap_err(),
            NormalizeError::NonFinite
        );
        let cancel = Cancellation::default();
        cancel.cancel();
        assert_eq!(
            normalize_mono_file_16k(&[0.0], 16_000, 1, &cancel).unwrap_err(),
            NormalizeError::Canceled
        );

        let mut checks = 0;
        assert_eq!(
            normalize_mono_file_16k_with(&vec![0.0; 4 * BLOCK], 48_000, 4 * BLOCK, || {
                checks += 1;
                checks >= 3
            },)
            .unwrap_err(),
            NormalizeError::Canceled
        );
    }

    #[test]
    fn impulse_alignment_and_alias_rejection_match_characterized_candidate() {
        for rate in [44_100, 48_000] {
            let count = rate as usize + 17;
            let position = count - 20;
            let mut impulse = vec![0.0; count];
            impulse[position] = 1.0;
            let converted = normalize_mono_file_16k(
                &impulse,
                rate,
                NORMALIZER_MAX_INPUT_SAMPLES,
                &Cancellation::default(),
            )
            .unwrap();
            let peak = converted
                .samples()
                .iter()
                .enumerate()
                .max_by(|a, b| a.1.abs().total_cmp(&b.1.abs()))
                .unwrap();
            let expected = position * NORMALIZED_SAMPLE_RATE as usize / rate as usize;
            assert!(peak.0.abs_diff(expected) <= 1);
            assert!(peak.1.abs() > 0.1);

            let high = normalize_mono_file_16k(
                &tone(rate, 12_000.0, rate as usize),
                rate,
                NORMALIZER_MAX_INPUT_SAMPLES,
                &Cancellation::default(),
            )
            .unwrap();
            let rms = (high.samples()[256..NORMALIZED_SAMPLE_RATE as usize - 256]
                .iter()
                .map(|value| f64::from(*value).powi(2))
                .sum::<f64>()
                / f64::from(NORMALIZED_SAMPLE_RATE - 512))
            .sqrt();
            assert!(rms < 0.005, "alias RMS={rms}");
        }
    }
}
