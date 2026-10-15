//! File-only candidate experiment, NOT a public/runtime normalizer.
//! Uses rubato 0.15.0 (MIT, Henrik Enquist); no vendor code copied here.
//! Full input is known: floor(total_in * 16000 / rate) is an explicit experiment
//! policy, not a live timestamp contract. Zero flush padding is never reported
//! as captured input. A fresh converter is required for every discontinuity.

use rubato::{
    Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
};

const BLOCK: usize = 512;
const MAX_INPUT: usize = 1_048_576;
const OUTPUT_RATE: usize = 16_000;

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Error {
    Rate,
    Input,
    Partition,
    Canceled,
    Resampler,
    Tail,
}

#[derive(Debug)]
pub(crate) struct Report {
    pub(crate) samples: Vec<f32>,
    pub(crate) delay_out: usize,
    blocks: usize,
    flush_blocks: usize,
    max_pending: usize,
}

// Deliberately test-local: no lib exports, capture callbacks, queue, IPC or file IO.
pub(crate) fn convert_file(
    input: &[f32],
    rate: usize,
    partitions: &[usize],
    canceled: impl FnMut(usize) -> bool,
) -> Result<Report, Error> {
    convert_file_with_fault(input, rate, partitions, canceled, None)
}

fn convert_file_with_fault(
    input: &[f32],
    rate: usize,
    partitions: &[usize],
    mut canceled: impl FnMut(usize) -> bool,
    undersized_output_at: Option<usize>,
) -> Result<Report, Error> {
    if !matches!(rate, 44_100 | 48_000) {
        return Err(Error::Rate);
    }
    if input.len() > MAX_INPUT || input.iter().any(|s| !s.is_finite()) {
        return Err(Error::Input);
    }
    if partitions.is_empty() || partitions.contains(&0) {
        return Err(Error::Partition);
    }
    if canceled(0) {
        return Err(Error::Canceled);
    }
    let expected = (input.len() as u64 * OUTPUT_RATE as u64 / rate as u64) as usize;
    let mut resampler = SincFixedIn::<f32>::new(
        OUTPUT_RATE as f64 / rate as f64,
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
    .map_err(|_| Error::Resampler)?;
    let delay_out = resampler.output_delay();
    let mut output = vec![vec![0.0; resampler.output_frames_max()]];
    let mut block = [0.0_f32; BLOCK];
    let mut pending = 0;
    let mut offset = 0;
    let mut partition_index = 0;
    let mut report = Report {
        samples: Vec::with_capacity(expected),
        delay_out,
        blocks: 0,
        flush_blocks: 0,
        max_pending: 0,
    };
    let mut process = |block: &[f32; BLOCK], report: &mut Report| -> Result<(), Error> {
        if canceled(report.blocks) {
            return Err(Error::Canceled);
        }
        // Fault injection only in this experiment: force rubato's REAL
        // InsufficientOutputBuffer error after some earlier blocks succeeded.
        if undersized_output_at == Some(report.blocks) {
            output[0].clear();
        }
        let (read, written) = resampler
            .process_into_buffer(&[block.as_slice()], &mut output, None)
            .map_err(|_| Error::Resampler)?;
        if read != BLOCK || written > output[0].len() {
            return Err(Error::Resampler);
        }
        report.blocks += 1;
        // In this exact SincFixedIn version/configuration, first-block output is
        // shorter, not prefixed with output_delay zeros. Trimming delay_out here
        // moves the impulse early (regression measured by the test below).
        // Retain the declared availability delay separately, never subtract it
        // from sample PTS without proving the converter's phase convention.
        let take = (expected - report.samples.len()).min(written);
        let valid = &output[0][..take];
        if valid.iter().any(|s| !s.is_finite()) {
            return Err(Error::Resampler);
        }
        report.samples.extend_from_slice(valid);
        Ok(())
    };
    while offset < input.len() {
        let part = partitions[partition_index % partitions.len()].min(input.len() - offset);
        partition_index += 1;
        let end = offset + part;
        while offset < end {
            let take = (BLOCK - pending).min(end - offset);
            block[pending..pending + take].copy_from_slice(&input[offset..offset + take]);
            pending += take;
            offset += take;
            report.max_pending = report.max_pending.max(pending);
            if pending == BLOCK {
                process(&block, &mut report)?;
                pending = 0;
            }
        }
    }
    if pending != 0 {
        block[pending..].fill(0.0);
        process(&block, &mut report)?;
    }
    // Finite guard, not an unbounded "flush until silence" loop. The final block
    // may already contain padding; at most four further zero blocks are allowed.
    block.fill(0.0);
    while report.samples.len() < expected && report.flush_blocks < 4 {
        process(&block, &mut report)?;
        report.flush_blocks += 1;
    }
    if canceled(report.blocks) {
        return Err(Error::Canceled);
    }
    if report.samples.len() != expected {
        return Err(Error::Tail);
    }
    Ok(report)
}

fn tone(rate: usize, hz: f64, count: usize) -> Vec<f32> {
    (0..count)
        .map(|n| (std::f64::consts::TAU * hz * n as f64 / rate as f64).sin() as f32)
        .collect()
}

fn rms(samples: &[f32]) -> f64 {
    (samples.iter().map(|&v| f64::from(v).powi(2)).sum::<f64>() / samples.len() as f64).sqrt()
}

#[test]
fn exact_file_count_and_partition_invariance_include_short_tail() {
    for rate in [44_100, 48_000] {
        for count in [0, 1, 2, 3, 511, 512, 513, 1023, 1024, 1025, rate + 17] {
            let input = tone(rate, 1000.0, count);
            let whole = convert_file(&input, rate, &[usize::MAX], |_| false).unwrap();
            for partition in [&[1][..], &[511, 1, 513, 7][..], &[512][..]] {
                let split = convert_file(&input, rate, partition, |_| false).unwrap();
                assert_eq!(split.samples, whole.samples, "rate={rate}, count={count}");
                assert_eq!(split.samples.len(), count * OUTPUT_RATE / rate);
                assert!(split.max_pending <= BLOCK);
                assert!(split.flush_blocks <= 4);
            }
            assert_eq!(whole.delay_out, 256 * OUTPUT_RATE / rate / 2);
            println!(
                "rate={rate} input={count} output={} delay_out={} blocks={} flush={}",
                whole.samples.len(),
                whole.delay_out,
                whole.blocks,
                whole.flush_blocks
            );
        }
    }
}

#[test]
fn impulse_alignment_and_final_impulse_survive_flush() {
    for rate in [44_100, 48_000] {
        let count = rate + 17;
        for position in [rate / 4, count - 20] {
            let mut input = vec![0.0; count];
            input[position] = 1.0;
            let report = convert_file(&input, rate, &[1, 513, 511], |_| false).unwrap();
            let peak = report
                .samples
                .iter()
                .enumerate()
                .max_by(|a, b| a.1.abs().total_cmp(&b.1.abs()))
                .unwrap();
            let expected = position * OUTPUT_RATE / rate;
            assert!(
                peak.0.abs_diff(expected) <= 1,
                "rate={rate} peak={} expected={expected}",
                peak.0
            );
            assert!(peak.1.abs() > 0.1, "tail impulse lost");
            println!(
                "impulse rate={rate} input={position} peak={} expected={expected}",
                peak.0
            );
        }
    }
}

#[test]
fn passband_tone_and_above_nyquist_rejection_are_measured() {
    for rate in [44_100, 48_000] {
        let low = convert_file(&tone(rate, 1000.0, rate), rate, &[513], |_| false).unwrap();
        let high = convert_file(&tone(rate, 12000.0, rate), rate, &[511], |_| false).unwrap();
        let low_rms = rms(&low.samples[256..OUTPUT_RATE - 256]);
        let high_rms = rms(&high.samples[256..OUTPUT_RATE - 256]);
        assert!((low_rms - std::f64::consts::FRAC_1_SQRT_2).abs() < 0.01);
        assert!(high_rms < 0.005, "alias RMS={high_rms}");
        println!("tone rate={rate} 1k_rms={low_rms:.8} 12k_rms={high_rms:.8}");
    }
}

#[test]
fn malformed_inputs_and_cancel_never_return_original_as_16k() {
    for rate in [44_100, 48_000] {
        for bad in [f32::NAN, f32::INFINITY, f32::NEG_INFINITY] {
            assert_eq!(
                convert_file(&[0.0, bad], rate, &[1], |_| false).unwrap_err(),
                Error::Input
            );
        }
        assert_eq!(
            convert_file(&vec![0.0; MAX_INPUT + 1], rate, &[512], |_| false).unwrap_err(),
            Error::Input
        );
        assert_eq!(
            convert_file(&[], rate, &[0], |_| false).unwrap_err(),
            Error::Partition
        );
        let input = tone(rate, 1000.0, rate);
        for stop_after in [0, 1, 2, 10] {
            assert_eq!(
                convert_file(&input, rate, &[1, 511], |blocks| blocks >= stop_after).unwrap_err(),
                Error::Canceled
            );
        }
        // A fresh epoch/file never retains the previous file's sinc history.
        let silent = convert_file(&vec![0.0; 513], rate, &[1], |_| false).unwrap();
        assert!(silent.samples.iter().all(|&v| v == 0.0));
    }
    assert_eq!(
        convert_file(&[], 0, &[1], |_| false).unwrap_err(),
        Error::Rate
    );
    assert_eq!(
        convert_file(&[], 16_000, &[1], |_| false).unwrap_err(),
        Error::Rate
    );
}

#[test]
fn actual_buffer_failure_after_partial_conversion_is_not_success_or_fallback() {
    for rate in [44_100, 48_000] {
        let input = tone(rate, 1000.0, 4096);
        let seen = std::cell::Cell::new(0);
        let result = convert_file_with_fault(
            &input,
            rate,
            &[511, 513],
            |blocks| {
                seen.set(blocks);
                false
            },
            Some(2),
        );
        assert_eq!(result.unwrap_err(), Error::Resampler);
        assert_eq!(
            seen.get(),
            2,
            "two blocks must succeed before the real error"
        );
        let retry = convert_file(&input, rate, &[512], |_| false).unwrap();
        let fresh = convert_file(&input, rate, &[1], |_| false).unwrap();
        assert_eq!(retry.samples, fresh.samples);
        assert_eq!(retry.samples.len(), input.len() * OUTPUT_RATE / rate);
    }
}

#[test]
fn cancellation_during_flush_and_after_final_block_drops_complete_file() {
    for rate in [44_100, 48_000] {
        let input = tone(rate, 1000.0, 512);
        let report = convert_file(&input, rate, &[512], |_| false).unwrap();
        assert_eq!(report.flush_blocks, 1);
        // After one data block, flush is still necessary. Then also cancel at
        // final commit check, after all output exists but before success returns.
        for stop_after in [1, report.blocks] {
            assert_eq!(
                convert_file(&input, rate, &[512], |n| n >= stop_after).unwrap_err(),
                Error::Canceled
            );
        }
    }
}

#[test]
fn inclusive_file_budget_keeps_exact_count_and_bounded_scratch() {
    for rate in [44_100, 48_000] {
        let report = convert_file(&vec![0.25; MAX_INPUT], rate, &[usize::MAX], |_| false).unwrap();
        assert_eq!(report.samples.len(), MAX_INPUT * OUTPUT_RATE / rate);
        assert_eq!(report.max_pending, BLOCK);
        assert!(report.flush_blocks <= 4);
        assert!((report.samples[1000] - 0.25).abs() < 0.001);
    }
}
