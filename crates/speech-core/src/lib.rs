//! Isolated timeline metadata, mono downmix and provider boundary, not an ASR runtime.
//! The caller must scope spans to one session/source. No Tauri, hardware, or models.

pub mod audio_decoder_v0;
pub mod audio_frame_v0;
pub mod control_lines;
pub mod downmix;
pub mod input_chunk;
pub mod mono_frame;
pub mod normalizer;
pub mod provider;
pub mod provider_admission;
pub mod session_lifecycle;
pub mod speech_windows;
pub mod timeline_registry;
pub mod transcript_overlap;
pub mod transport_budget;
pub mod wave_file;

#[derive(Clone, Copy)]
pub struct SourceSpan<'a> {
    pub epoch: u64,
    pub rate: u32,
    pub start: &'a str,
    pub end: &'a str,
    pub media_start_ns: &'a str,
}

impl std::fmt::Debug for SourceSpan<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SourceSpan")
            .field("rate", &self.rate)
            .finish_non_exhaustive()
    }
}

#[derive(Clone, Copy)]
pub struct SourceRange<'a> {
    pub epoch: u64,
    pub start: &'a str,
    pub end: &'a str,
}
impl std::fmt::Debug for SourceRange<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SourceRange").finish_non_exhaustive()
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum TimelineError {
    InvalidU64,
    InvalidEpoch,
    InvalidRate,
    InvalidRange,
    InvalidSpan,
    MediaOverflow,
    NoSingleSpan,
    AmbiguousSpan,
}

impl TimelineError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidU64 => "invalid-u64",
            Self::InvalidEpoch => "invalid-epoch",
            Self::InvalidRate => "invalid-rate",
            Self::InvalidRange => "invalid-range",
            Self::InvalidSpan => "invalid-span",
            Self::MediaOverflow => "media-overflow",
            Self::NoSingleSpan => "no-single-span",
            Self::AmbiguousSpan => "ambiguous-span",
        }
    }
}

fn u64_decimal(value: &str) -> Result<u64, TimelineError> {
    if value.is_empty()
        || value.len() > 20
        || (value.len() > 1 && value.starts_with('0'))
        || !value.bytes().all(|b| b.is_ascii_digit())
    {
        return Err(TimelineError::InvalidU64);
    }
    value.parse().map_err(|_| TimelineError::InvalidU64)
}

fn epoch(value: u64) -> Result<(), TimelineError> {
    // Same draft constraint as TS Number.isSafeInteger, not a frozen wire schema.
    if value > 9_007_199_254_740_991 {
        return Err(TimelineError::InvalidEpoch);
    }
    Ok(())
}

/// Maps a half-open range inside one unambiguous span; never subtracts pause twice.
pub fn map_source_range(
    spans: &[SourceSpan<'_>],
    range: SourceRange<'_>,
) -> Result<(u64, u64), TimelineError> {
    map_source_range_iter(spans.iter().copied(), range)
}

fn map_source_range_iter<'a>(
    spans: impl IntoIterator<Item = SourceSpan<'a>>,
    range: SourceRange<'_>,
) -> Result<(u64, u64), TimelineError> {
    epoch(range.epoch)?;
    let start = u64_decimal(range.start)?;
    let end = u64_decimal(range.end)?;
    if end <= start {
        return Err(TimelineError::InvalidRange);
    }
    let mut result = None;
    let mut intersections = 0usize;
    for span in spans {
        epoch(span.epoch)?;
        if span.rate == 0 || span.rate > 192_000 {
            return Err(TimelineError::InvalidRate);
        }
        let span_start = u64_decimal(span.start)?;
        let span_end = u64_decimal(span.end)?;
        let media_start = u64_decimal(span.media_start_ns)?;
        if span_end <= span_start {
            return Err(TimelineError::InvalidSpan);
        }
        // u64 delta * 1e9 + u64 anchor fits u128, even at the maximum input.
        let map = |sample: u64| {
            u64::try_from(
                u128::from(media_start)
                    + u128::from(sample - span_start) * 1_000_000_000 / u128::from(span.rate),
            )
            .map_err(|_| TimelineError::MediaOverflow)
        };
        map(span_end)?;
        if span.epoch != range.epoch || start >= span_end || end <= span_start {
            continue;
        }
        intersections += 1;
        if start < span_start || end > span_end {
            continue;
        }
        if result.is_some() {
            return Err(TimelineError::AmbiguousSpan);
        }
        result = Some((map(start)?, map(end)?));
    }
    let result = result.ok_or(TimelineError::NoSingleSpan)?;
    if intersections != 1 {
        return Err(TimelineError::AmbiguousSpan);
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    const SPAN: SourceSpan<'static> = SourceSpan {
        epoch: 0,
        rate: 48_000,
        start: "0",
        end: "48000",
        media_start_ns: "0",
    };
    const RANGE: SourceRange<'static> = SourceRange {
        epoch: 0,
        start: "0",
        end: "1",
    };

    #[test]
    fn shared_ts_rust_fixture() {
        let fixture: Value = serde_json::from_str(include_str!(
            "../../../contracts/copilot/source-timeline.v0.fixture.json"
        ))
        .unwrap();
        let spans: Vec<_> = fixture["spans"]
            .as_array()
            .unwrap()
            .iter()
            .map(|s| SourceSpan {
                epoch: s["epoch"].as_u64().unwrap(),
                rate: s["rate"].as_u64().unwrap().try_into().unwrap(),
                start: s["start"].as_str().unwrap(),
                end: s["end"].as_str().unwrap(),
                media_start_ns: s["mediaStartNs"].as_str().unwrap(),
            })
            .collect();
        let cases = fixture["cases"].as_array().unwrap();
        assert_eq!(cases.len(), 8);
        for case in cases {
            let actual = map_source_range(
                &spans,
                SourceRange {
                    epoch: case["epoch"].as_u64().unwrap(),
                    start: case["start"].as_str().unwrap(),
                    end: case["end"].as_str().unwrap(),
                },
            );
            if let Some(expected) = case["expectedError"].as_str() {
                assert_eq!(actual.unwrap_err().code(), expected, "{}", case["name"]);
            } else {
                let (start, end) = actual.unwrap();
                assert_eq!(start.to_string(), case["expectedNs"][0].as_str().unwrap());
                assert_eq!(end.to_string(), case["expectedNs"][1].as_str().unwrap());
            }
        }
    }

    #[test]
    fn rejects_noncanonical_and_overflowing_decimals() {
        for value in [
            "",
            "-1",
            "+1",
            "01",
            "1.0",
            "1e3",
            " 1",
            "1\n",
            "18446744073709551616",
            "１２",
        ] {
            assert_eq!(u64_decimal(value), Err(TimelineError::InvalidU64));
        }
        assert_eq!(u64_decimal("18446744073709551615"), Ok(u64::MAX));
    }

    #[test]
    fn rejects_ambiguity_including_partial_intersection() {
        for second in [SPAN, SourceSpan { start: "5", ..SPAN }] {
            assert_eq!(
                map_source_range(&[SPAN, second], SourceRange { end: "10", ..RANGE }),
                Err(TimelineError::AmbiguousSpan)
            );
        }
    }

    #[test]
    fn validates_entire_span_before_mapping_prefix() {
        assert_eq!(
            map_source_range(
                &[SourceSpan {
                    media_start_ns: "18446744073709551615",
                    ..SPAN
                }],
                RANGE
            ),
            Err(TimelineError::MediaOverflow)
        );
        for rate in [0, 192_001] {
            assert_eq!(
                map_source_range(&[SourceSpan { rate, ..SPAN }], RANGE),
                Err(TimelineError::InvalidRate)
            );
        }
        assert_eq!(
            map_source_range(
                &[SPAN],
                SourceRange {
                    epoch: 9_007_199_254_740_992,
                    ..RANGE
                }
            ),
            Err(TimelineError::InvalidEpoch)
        );
        assert_eq!(
            map_source_range(&[SourceSpan { end: "0", ..SPAN }], RANGE),
            Err(TimelineError::InvalidSpan)
        );
        assert_eq!(
            map_source_range(&[SPAN], SourceRange { end: "0", ..RANGE }),
            Err(TimelineError::InvalidRange)
        );
    }

    #[test]
    fn partitions_do_not_accumulate_rounding() {
        let span = SourceSpan {
            rate: 44_100,
            end: "44100",
            ..SPAN
        };
        let mut total = 0;
        for start in (0..44_100).step_by(147) {
            let a = start.to_string();
            let b = (start + 147).to_string();
            let (a, b) = map_source_range(
                &[span],
                SourceRange {
                    epoch: 0,
                    start: &a,
                    end: &b,
                },
            )
            .unwrap();
            total += b - a;
        }
        assert_eq!(total, 1_000_000_000);
    }

    #[test]
    fn extreme_source_counters_do_not_overflow_intermediate_math() {
        let start = (u64::MAX - 48_000).to_string();
        let end = u64::MAX.to_string();
        let span = SourceSpan {
            start: &start,
            end: &end,
            ..SPAN
        };
        assert_eq!(
            map_source_range(
                &[span],
                SourceRange {
                    epoch: 0,
                    start: &start,
                    end: &end
                }
            ),
            Ok((0, 1_000_000_000))
        );
        assert_eq!(
            map_source_range(&[SourceSpan { end: &end, ..SPAN }], RANGE),
            Err(TimelineError::MediaOverflow)
        );
    }

    #[test]
    fn varied_partitions_preserve_exact_one_second_at_each_rate() {
        for rate in [8_000u32, 16_000, 22_050, 44_100, 48_000, 96_000, 192_000] {
            let end = rate.to_string();
            let span = SourceSpan {
                rate,
                end: &end,
                ..SPAN
            };
            let mut start = 0u32;
            let mut previous = 0;
            let mut sequence = 1u32;
            while start < rate {
                sequence = sequence.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                let next = (start + 1 + sequence % 997).min(rate);
                let a = start.to_string();
                let b = next.to_string();
                let (a, b) = map_source_range(
                    &[span],
                    SourceRange {
                        epoch: 0,
                        start: &a,
                        end: &b,
                    },
                )
                .unwrap();
                assert_eq!(a, previous);
                assert!(b > a);
                previous = b;
                start = next;
            }
            assert_eq!(previous, 1_000_000_000);
        }
    }
}
