//! Bounded, append-only draft metadata for one session. No PCM or persistence.
//! Identity matching is not caller authentication. Limits are prototype guards,
//! not negotiated transport credits or a supported recording duration.

use crate::{
    map_source_range, map_source_range_iter, u64_decimal, SourceRange, SourceSpan, TimelineError,
};

#[derive(Clone, Copy, Debug)]
pub struct RegistryLimits {
    pub sources: usize,
    pub spans: usize,
}

#[derive(Debug, PartialEq, Eq)]
pub enum RegistryError {
    InvalidLimits,
    InvalidIdentity,
    WrongSession,
    UnknownSource,
    Capacity,
    ConflictingReplay,
    SourceOrder,
    MediaOrder,
    RateChangedWithinEpoch,
    Timeline(TimelineError),
    Allocation,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Inserted {
    New,
    Duplicate,
}

#[derive(PartialEq, Eq)]
struct Entry {
    source: String,
    epoch: u64,
    rate: u32,
    start: String,
    end: String,
    media_start_ns: String,
    media_end_ns: u64,
}

impl Entry {
    fn span(&self) -> SourceSpan<'_> {
        SourceSpan {
            epoch: self.epoch,
            rate: self.rate,
            start: &self.start,
            end: &self.end,
            media_start_ns: &self.media_start_ns,
        }
    }
}

fn identity(value: &str) -> Result<(), RegistryError> {
    // UTF-8 byte cap is explicit. No normalization/case folding of opaque IDs.
    if value.is_empty() || value.len() > 128 {
        return Err(RegistryError::InvalidIdentity);
    }
    Ok(())
}
type TextCopier = fn(&str) -> Result<String, RegistryError>;
type EntryReserver = fn(&mut Vec<Entry>) -> Result<(), RegistryError>;
fn copy_text(value: &str) -> Result<String, RegistryError> {
    let mut text = String::new();
    text.try_reserve_exact(value.len())
        .map_err(|_| RegistryError::Allocation)?;
    text.push_str(value);
    Ok(text)
}
fn reserve_entry(entries: &mut Vec<Entry>) -> Result<(), RegistryError> {
    entries
        .try_reserve(1)
        .map_err(|_| RegistryError::Allocation)
}

pub struct TimelineRegistry {
    session: String,
    limits: RegistryLimits,
    entries: Vec<Entry>,
    // Private fault-injection seams; no caller-supplied allocator/API.
    copy_text: TextCopier,
    reserve_entry: EntryReserver,
}
impl std::fmt::Debug for TimelineRegistry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TimelineRegistry")
            .field("limits", &self.limits)
            .field("span_count", &self.entries.len())
            .finish_non_exhaustive()
    }
}

impl TimelineRegistry {
    pub fn new(session: &str, limits: RegistryLimits) -> Result<Self, RegistryError> {
        Self::with_copier(session, limits, copy_text)
    }
    fn with_copier(
        session: &str,
        limits: RegistryLimits,
        copy_text: TextCopier,
    ) -> Result<Self, RegistryError> {
        identity(session)?;
        if limits.sources == 0 || limits.sources > 64 || limits.spans == 0 || limits.spans > 4096 {
            return Err(RegistryError::InvalidLimits);
        }
        Ok(Self {
            session: copy_text(session)?,
            limits,
            entries: Vec::new(),
            copy_text,
            reserve_entry,
        })
    }

    fn check_identity(&self, session: &str, source: &str) -> Result<(), RegistryError> {
        identity(session)?;
        identity(source)?;
        if session != self.session {
            return Err(RegistryError::WrongSession);
        }
        Ok(())
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Atomic rejection: errors never insert a source/span or evict old metadata.
    /// An exact replay is idempotent even after capacity was reached.
    pub fn insert(
        &mut self,
        session: &str,
        source: &str,
        span: SourceSpan<'_>,
    ) -> Result<Inserted, RegistryError> {
        self.check_identity(session, source)?;
        let (_, media_end_ns) = map_source_range(
            &[span],
            SourceRange {
                epoch: span.epoch,
                start: span.start,
                end: span.end,
            },
        )
        .map_err(RegistryError::Timeline)?;
        // These strings are canonical u64 decimals, already validated above.
        if let Some(replay) = self
            .entries
            .iter()
            .find(|e| e.source == source && e.epoch == span.epoch && e.start == span.start)
        {
            if replay.end == span.end
                && replay.rate == span.rate
                && replay.media_start_ns == span.media_start_ns
            {
                return Ok(Inserted::Duplicate);
            }
            return Err(RegistryError::ConflictingReplay);
        }
        let last = self.entries.iter().rev().find(|e| e.source == source);
        if let Some(previous) = last {
            if span.epoch < previous.epoch
                || (span.epoch == previous.epoch
                    && u64_decimal(span.start).map_err(RegistryError::Timeline)?
                        < u64_decimal(&previous.end).map_err(RegistryError::Timeline)?)
            {
                return Err(RegistryError::SourceOrder);
            }
            if span.epoch == previous.epoch && span.rate != previous.rate {
                return Err(RegistryError::RateChangedWithinEpoch);
            }
            if u64_decimal(span.media_start_ns).map_err(RegistryError::Timeline)?
                < previous.media_end_ns
            {
                return Err(RegistryError::MediaOrder);
            }
        } else {
            let mut sources = [None; 64];
            let mut count = 0;
            for entry in &self.entries {
                let source = Some(entry.source.as_str());
                if !sources[..count].contains(&source) {
                    sources[count] = source;
                    count += 1;
                    if count >= self.limits.sources {
                        return Err(RegistryError::Capacity);
                    }
                }
            }
        }
        if self.entries.len() >= self.limits.spans {
            return Err(RegistryError::Capacity);
        }
        let entry = Entry {
            source: (self.copy_text)(source)?,
            epoch: span.epoch,
            rate: span.rate,
            start: (self.copy_text)(span.start)?,
            end: (self.copy_text)(span.end)?,
            media_start_ns: (self.copy_text)(span.media_start_ns)?,
            media_end_ns,
        };
        (self.reserve_entry)(&mut self.entries)?;
        self.entries.push(entry);
        Ok(Inserted::New)
    }

    pub fn map(
        &self,
        session: &str,
        source: &str,
        range: SourceRange<'_>,
    ) -> Result<(u64, u64), RegistryError> {
        self.check_identity(session, source)?;
        if !self.entries.iter().any(|entry| entry.source == source) {
            return Err(RegistryError::UnknownSource);
        }
        let spans = self
            .entries
            .iter()
            .filter(|entry| entry.source == source)
            .map(Entry::span);
        map_source_range_iter(spans, range).map_err(RegistryError::Timeline)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    thread_local! { static COPIES_BEFORE_REFUSAL: Cell<usize> = const { Cell::new(usize::MAX) }; }
    fn refusing_copy(value: &str) -> Result<String, RegistryError> {
        COPIES_BEFORE_REFUSAL.with(|remaining| {
            let count = remaining.get();
            if count == 0 {
                return Err(RegistryError::Allocation);
            }
            remaining.set(count - 1);
            copy_text(value)
        })
    }
    fn refuse_entry(_: &mut Vec<Entry>) -> Result<(), RegistryError> {
        Err(RegistryError::Allocation)
    }
    #[test]
    fn constructor_validates_identity_and_limits_before_fallible_session_copy() {
        let limits = RegistryLimits {
            sources: 1,
            spans: 1,
        };
        COPIES_BEFORE_REFUSAL.set(0);
        assert!(matches!(
            TimelineRegistry::with_copier("", limits, refusing_copy),
            Err(RegistryError::InvalidIdentity)
        ));
        assert!(matches!(
            TimelineRegistry::with_copier(
                "session-A",
                RegistryLimits {
                    sources: 0,
                    ..limits
                },
                refusing_copy
            ),
            Err(RegistryError::InvalidLimits)
        ));
        assert!(matches!(
            TimelineRegistry::with_copier("session-A", limits, refusing_copy),
            Err(RegistryError::Allocation)
        ));
    }
    #[test]
    fn every_entry_copy_and_reserve_refusal_preserves_old_spans_and_allows_retry() {
        let next = SourceSpan {
            media_start_ns: "2000000000",
            ..SPAN
        };
        for failure in 0..5 {
            let mut r = registry(2, 3);
            r.insert("session-A", "system", SPAN).unwrap();
            r.copy_text = refusing_copy;
            COPIES_BEFORE_REFUSAL.set(failure);
            if failure == 4 {
                r.reserve_entry = refuse_entry;
            }
            assert_eq!(
                r.insert("session-A", "mic", next),
                Err(RegistryError::Allocation)
            );
            assert_eq!(r.len(), 1);
            assert_eq!(r.map("session-A", "system", RANGE), Ok((0, 1_000_000_000)));
            assert_eq!(
                r.map("session-A", "mic", RANGE),
                Err(RegistryError::UnknownSource)
            );
            assert_eq!(
                r.insert("session-A", "system", SPAN),
                Ok(Inserted::Duplicate)
            );
            r.copy_text = copy_text;
            r.reserve_entry = reserve_entry;
            assert_eq!(r.insert("session-A", "mic", next), Ok(Inserted::New));
            assert_eq!(
                r.map("session-A", "mic", RANGE),
                Ok((2_000_000_000, 3_000_000_000))
            );
        }
    }
    #[test]
    fn queries_replay_and_capacity_checks_need_no_metadata_copies_or_entry_reserve() {
        let mut r = registry(1, 1);
        r.insert("session-A", "system", SPAN).unwrap();
        r.copy_text = refusing_copy;
        r.reserve_entry = refuse_entry;
        COPIES_BEFORE_REFUSAL.set(0);
        assert_eq!(r.map("session-A", "system", RANGE), Ok((0, 1_000_000_000)));
        assert_eq!(
            r.map("session-A", "unknown", RANGE),
            Err(RegistryError::UnknownSource)
        );
        assert_eq!(
            r.insert("session-A", "system", SPAN),
            Ok(Inserted::Duplicate)
        );
        assert_eq!(
            r.insert("session-A", "mic", SPAN),
            Err(RegistryError::Capacity)
        );
        assert_eq!(
            r.insert(
                "session-A",
                "system",
                SourceSpan {
                    end: "47999",
                    ..SPAN
                }
            ),
            Err(RegistryError::ConflictingReplay)
        );
        assert_eq!(r.len(), 1);
    }
    #[test]
    fn fixed_source_scratch_handles_inclusive_sixty_four_source_cap() {
        let mut r = registry(64, 65);
        for at in 0..64 {
            let source = format!("source-{at}");
            assert_eq!(r.insert("session-A", &source, SPAN), Ok(Inserted::New));
        }
        assert_eq!(r.len(), 64);
        assert_eq!(
            r.insert("session-A", "source-64", SPAN),
            Err(RegistryError::Capacity)
        );
        assert_eq!(
            r.insert("session-A", "source-63", SPAN),
            Ok(Inserted::Duplicate)
        );
        assert_eq!(
            r.map("session-A", "source-63", RANGE),
            Ok((0, 1_000_000_000))
        );
        assert_eq!(r.len(), 64);
    }
    #[test]
    fn full_registry_preserves_interleaved_sources_epochs_and_exact_mapping() {
        let mut r = registry(64, 4096);
        // Fully populate both prototype caps. Every epoch has one second of
        // source samples; anchors include source-specific offsets and gaps.
        for epoch in 0..64u64 {
            for source in 0..64u64 {
                let id = format!("source-{source}");
                let rate = [16000u32, 44100, 48000][source as usize % 3];
                let end = rate.to_string();
                let anchor = (epoch * 2_000_000_000 + source * 1_000_000).to_string();
                r.insert(
                    "session-A",
                    &id,
                    SourceSpan {
                        epoch,
                        rate,
                        start: "0",
                        end: &end,
                        media_start_ns: &anchor,
                    },
                )
                .unwrap();
            }
        }
        assert_eq!(r.len(), 4096);
        r.copy_text = refusing_copy;
        r.reserve_entry = refuse_entry;
        COPIES_BEFORE_REFUSAL.set(0);
        for epoch in [0, 31, 63] {
            for source in 0..64u64 {
                let id = format!("source-{source}");
                let rate = [16000u32, 44100, 48000][source as usize % 3];
                let end = rate.to_string();
                let anchor = epoch * 2_000_000_000 + source * 1_000_000;
                let anchor_text = anchor.to_string();
                assert_eq!(
                    r.insert(
                        "session-A",
                        &id,
                        SourceSpan {
                            epoch,
                            rate,
                            start: "0",
                            end: &end,
                            media_start_ns: &anchor_text,
                        }
                    ),
                    Ok(Inserted::Duplicate)
                );
                assert_eq!(
                    r.map(
                        "session-A",
                        &id,
                        SourceRange {
                            epoch,
                            start: "1",
                            end: &end,
                        }
                    ),
                    Ok((
                        anchor + 1_000_000_000 / u64::from(rate),
                        anchor + 1_000_000_000
                    ))
                );
            }
        }
        assert_eq!(
            r.insert(
                "session-A",
                "source-0",
                SourceSpan {
                    epoch: 64,
                    rate: 16000,
                    start: "0",
                    end: "16000",
                    media_start_ns: "128000000000",
                }
            ),
            Err(RegistryError::Capacity)
        );
        assert_eq!(r.len(), 4096);
    }
    #[test]
    fn diagnostics_omit_session_source_and_raw_timeline_values() {
        let span = SourceSpan {
            epoch: 54321,
            rate: 48000,
            start: "345678",
            end: "393678",
            media_start_ns: "987654321",
        };
        let range = SourceRange {
            epoch: span.epoch,
            start: span.start,
            end: span.end,
        };
        let mut registry = TimelineRegistry::new(
            "private-session-marker",
            RegistryLimits {
                sources: 2,
                spans: 3,
            },
        )
        .unwrap();
        registry
            .insert("private-session-marker", "private-source-marker", span)
            .unwrap();
        for debug in [
            format!("{span:?}"),
            format!("{range:?}"),
            format!("{registry:?}"),
        ] {
            for secret in [
                "private-session-marker",
                "private-source-marker",
                "54321",
                "345678",
                "393678",
                "987654321",
            ] {
                assert!(!debug.contains(secret));
            }
        }
        assert_eq!(
            map_source_range(&[span], range),
            Ok((987654321, 1987654321))
        );
        assert_eq!(registry.len(), 1);
    }
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
        end: "48000",
    };
    fn registry(sources: usize, spans: usize) -> TimelineRegistry {
        TimelineRegistry::new("session-A", RegistryLimits { sources, spans }).unwrap()
    }

    #[test]
    fn scopes_same_counters_to_session_and_source() {
        let mut r = registry(2, 4);
        r.insert("session-A", "system", SPAN).unwrap();
        r.insert(
            "session-A",
            "mic",
            SourceSpan {
                media_start_ns: "2000000000",
                ..SPAN
            },
        )
        .unwrap();
        assert_eq!(r.map("session-A", "system", RANGE), Ok((0, 1_000_000_000)));
        assert_eq!(
            r.map("session-A", "mic", RANGE),
            Ok((2_000_000_000, 3_000_000_000))
        );
        assert_eq!(
            r.map("session-B", "system", RANGE),
            Err(RegistryError::WrongSession)
        );
        assert_eq!(
            r.map("session-A", "unknown", RANGE),
            Err(RegistryError::UnknownSource)
        );
        assert_eq!(
            r.insert("session-B", "system", SPAN),
            Err(RegistryError::WrongSession)
        );
        assert_eq!(r.len(), 2);
    }

    #[test]
    fn opaque_ids_are_byte_exact_and_utf8_byte_cap_is_inclusive() {
        let session = "á".repeat(64);
        let source = "ç".repeat(64);
        let mut r = TimelineRegistry::new(
            &session,
            RegistryLimits {
                sources: 2,
                spans: 2,
            },
        )
        .unwrap();
        r.insert(&session, &source, SPAN).unwrap();
        assert_eq!(r.map(&session, &source, RANGE), Ok((0, 1_000_000_000)));
        assert_eq!(
            r.map(&session.to_uppercase(), &source, RANGE),
            Err(RegistryError::WrongSession)
        );
        assert_eq!(
            r.map(&session, &source.to_uppercase(), RANGE),
            Err(RegistryError::UnknownSource)
        );
        assert_eq!(
            r.map(&session, &(source.clone() + "x"), RANGE),
            Err(RegistryError::InvalidIdentity)
        );
        assert_eq!(r.len(), 1);
    }

    #[test]
    fn replay_is_idempotent_at_capacity_but_changed_map_is_not() {
        let mut r = registry(1, 1);
        assert_eq!(r.insert("session-A", "system", SPAN), Ok(Inserted::New));
        assert_eq!(
            r.insert("session-A", "system", SPAN),
            Ok(Inserted::Duplicate)
        );
        assert_eq!(
            r.insert(
                "session-A",
                "system",
                SourceSpan {
                    media_start_ns: "1",
                    ..SPAN
                }
            ),
            Err(RegistryError::ConflictingReplay)
        );
        assert_eq!(
            r.insert("session-A", "mic", SPAN),
            Err(RegistryError::Capacity)
        );
        assert_eq!(
            r.insert(
                "session-A",
                "system",
                SourceSpan {
                    epoch: 1,
                    media_start_ns: "1000000000",
                    ..SPAN
                }
            ),
            Err(RegistryError::Capacity)
        );
        assert_eq!(r.len(), 1);
        assert_eq!(r.map("session-A", "system", RANGE), Ok((0, 1_000_000_000)));
    }

    #[test]
    fn touching_spans_and_pause_gaps_do_not_add_pause_twice() {
        let mut r = registry(1, 3);
        r.insert("session-A", "system", SPAN).unwrap();
        r.insert(
            "session-A",
            "system",
            SourceSpan {
                start: "48000",
                end: "96000",
                media_start_ns: "1000000000",
                ..SPAN
            },
        )
        .unwrap();
        r.insert(
            "session-A",
            "system",
            SourceSpan {
                start: "144000",
                end: "192000",
                media_start_ns: "2000000000",
                ..SPAN
            },
        )
        .unwrap();
        assert_eq!(
            r.map(
                "session-A",
                "system",
                SourceRange {
                    start: "144000",
                    end: "192000",
                    ..RANGE
                }
            ),
            Ok((2_000_000_000, 3_000_000_000))
        );
        assert_eq!(
            r.map(
                "session-A",
                "system",
                SourceRange {
                    start: "95000",
                    end: "145000",
                    ..RANGE
                }
            ),
            Err(RegistryError::Timeline(TimelineError::NoSingleSpan))
        );
    }

    #[test]
    fn rejects_order_overlap_and_rate_change_atomically() {
        let mut r = registry(1, 4);
        r.insert("session-A", "system", SPAN).unwrap();
        assert_eq!(
            r.insert(
                "session-A",
                "system",
                SourceSpan {
                    start: "47999",
                    end: "96000",
                    media_start_ns: "1000000000",
                    ..SPAN
                }
            ),
            Err(RegistryError::SourceOrder)
        );
        assert_eq!(
            r.insert(
                "session-A",
                "system",
                SourceSpan {
                    rate: 16_000,
                    start: "48000",
                    end: "64000",
                    media_start_ns: "1000000000",
                    ..SPAN
                }
            ),
            Err(RegistryError::RateChangedWithinEpoch)
        );
        assert_eq!(
            r.insert(
                "session-A",
                "system",
                SourceSpan {
                    start: "48000",
                    end: "96000",
                    media_start_ns: "999999999",
                    ..SPAN
                }
            ),
            Err(RegistryError::MediaOrder)
        );
        assert_eq!(r.len(), 1);
    }

    #[test]
    fn new_epoch_allows_counter_and_rate_reset_not_media_reset() {
        let mut r = registry(1, 4);
        r.insert("session-A", "system", SPAN).unwrap();
        assert_eq!(
            r.insert("session-A", "system", SourceSpan { epoch: 1, ..SPAN }),
            Err(RegistryError::MediaOrder)
        );
        r.insert(
            "session-A",
            "system",
            SourceSpan {
                epoch: 1,
                rate: 16_000,
                end: "16000",
                media_start_ns: "1000000000",
                ..SPAN
            },
        )
        .unwrap();
        assert_eq!(
            r.map(
                "session-A",
                "system",
                SourceRange {
                    epoch: 1,
                    end: "16000",
                    ..RANGE
                }
            ),
            Ok((1_000_000_000, 2_000_000_000))
        );
        assert_eq!(
            r.insert(
                "session-A",
                "system",
                SourceSpan {
                    start: "48000",
                    end: "96000",
                    media_start_ns: "2000000000",
                    ..SPAN
                }
            ),
            Err(RegistryError::SourceOrder)
        );
    }

    #[test]
    fn rejects_bad_metadata_without_reserving_source_or_capacity() {
        let mut r = registry(1, 1);
        for span in [
            SourceSpan {
                start: "01",
                ..SPAN
            },
            SourceSpan {
                media_start_ns: "18446744073709551615",
                ..SPAN
            },
        ] {
            assert!(matches!(
                r.insert("session-A", "system", span),
                Err(RegistryError::Timeline(_))
            ));
        }
        assert!(r.is_empty());
        assert_eq!(r.insert("session-A", "mic", SPAN), Ok(Inserted::New));
    }

    #[test]
    fn bounds_identity_and_capacity_configuration_before_copying() {
        for limits in [
            RegistryLimits {
                sources: 0,
                spans: 1,
            },
            RegistryLimits {
                sources: 65,
                spans: 1,
            },
            RegistryLimits {
                sources: 1,
                spans: 0,
            },
            RegistryLimits {
                sources: 1,
                spans: 4097,
            },
        ] {
            assert!(matches!(
                TimelineRegistry::new("session-A", limits),
                Err(RegistryError::InvalidLimits)
            ));
        }
        for id in ["".to_owned(), "x".repeat(129), "á".repeat(65)] {
            assert!(matches!(
                TimelineRegistry::new(
                    &id,
                    RegistryLimits {
                        sources: 1,
                        spans: 1
                    }
                ),
                Err(RegistryError::InvalidIdentity)
            ));
            let mut r = registry(1, 1);
            assert_eq!(
                r.insert("session-A", &id, SPAN),
                Err(RegistryError::InvalidIdentity)
            );
            assert!(r.is_empty());
        }
    }
}
