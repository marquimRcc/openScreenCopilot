//! Original, metadata-only window planner for ONE normalized mono16k source.
//! Not a VAD/model, PCM buffer, capture clock map, wire protocol or text deduper.
//! Caller supplies trusted speech boundaries and drains each returned window.
//! Continuous speech is cut at a fixed bound without waiting forever for silence.

use crate::provider::MAX_REQUEST_SAMPLES;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WindowLimits {
    pub max_frames: u64,
    pub overlap_frames: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EndReason {
    Limit,
    SpeechEnd,
    Discontinuity,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct SpeechWindow {
    pub epoch: u64,
    /// Provider context, including explicit overlap (half-open mono16k frames).
    pub context_start: u64,
    pub context_end: u64,
    /// Novel ownership, excluding context repeated from the preceding window.
    /// This is not an automatic text/word-timestamp deduplication algorithm.
    pub novel_start: u64,
    pub novel_end: u64,
    pub reason: EndReason,
}
impl std::fmt::Debug for SpeechWindow {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SpeechWindow")
            .field("reason", &self.reason)
            .finish_non_exhaustive()
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct DiscardedRange {
    pub epoch: u64,
    pub start: u64,
    pub end: u64,
}
impl std::fmt::Debug for DiscardedRange {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DiscardedRange").finish_non_exhaustive()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WindowError {
    InvalidLimits,
    AlreadyActive,
    NotActive,
    Order,
    AdvanceTooLarge,
}

#[derive(Clone, Copy, PartialEq, Eq)]
struct Active {
    epoch: u64,
    context_start: u64,
    received_end: u64,
    committed_end: u64,
}

pub struct SpeechWindowPlanner {
    limits: WindowLimits,
    active: Option<Active>,
    last_end: Option<(u64, u64)>,
}
impl std::fmt::Debug for SpeechWindowPlanner {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SpeechWindowPlanner")
            .field("limits", &self.limits)
            .field("active", &self.active.is_some())
            .field("has_previous_end", &self.last_end.is_some())
            .finish_non_exhaustive()
    }
}

impl SpeechWindowPlanner {
    pub fn new(limits: WindowLimits) -> Result<Self, WindowError> {
        // Prototype bounds, not negotiated audio credits or language/model tuning.
        if limits.max_frames == 0
            || limits.max_frames > MAX_REQUEST_SAMPLES as u64
            || limits.overlap_frames > limits.max_frames / 4
        {
            return Err(WindowError::InvalidLimits);
        }
        Ok(Self {
            limits,
            active: None,
            last_end: None,
        })
    }

    /// May begin after a gap in the same epoch, or at a reset counter in a newer
    /// epoch. Never carries context across begin/finish. Session/source isolation
    /// is still the caller's responsibility; an epoch integer is not authorization.
    pub fn begin(&mut self, epoch: u64, start: u64) -> Result<(), WindowError> {
        if self.active.is_some() {
            return Err(WindowError::AlreadyActive);
        }
        if self.last_end.is_some_and(|(old_epoch, old_end)| {
            epoch < old_epoch || (epoch == old_epoch && start < old_end)
        }) {
            return Err(WindowError::Order);
        }
        self.active = Some(Active {
            epoch,
            context_start: start,
            received_end: start,
            committed_end: start,
        });
        Ok(())
    }

    /// At most max_frames newly available per call; at most two completed
    /// windows. No PCM allocation or unbounded event list. Equal end is a replay
    /// returning no new windows. Invalid calls leave all planner state intact.
    pub fn advance(&mut self, end: u64) -> Result<[Option<SpeechWindow>; 2], WindowError> {
        let mut active = self.active.ok_or(WindowError::NotActive)?;
        let added = end
            .checked_sub(active.received_end)
            .ok_or(WindowError::Order)?;
        if added > self.limits.max_frames {
            return Err(WindowError::AdvanceTooLarge);
        }
        active.received_end = end;
        let mut windows = [None; 2];
        let mut count = 0;
        while end - active.context_start >= self.limits.max_frames {
            // Addition cannot overflow: the loop proves this endpoint <= end.
            let window_end = active.context_start + self.limits.max_frames;
            windows[count] = Some(SpeechWindow {
                epoch: active.epoch,
                context_start: active.context_start,
                context_end: window_end,
                novel_start: active.committed_end,
                novel_end: window_end,
                reason: EndReason::Limit,
            });
            count += 1;
            active.committed_end = window_end;
            active.context_start = window_end - self.limits.overlap_frames;
        }
        self.active = Some(active);
        Ok(windows)
    }

    /// No padding/silence or future samples are invented. Empty speech, or an
    /// overlap-only tail after an exact limit, emits nothing. Call before a pause,
    /// gap, rate/endpoint change; the new context must be begun separately.
    pub fn finish(&mut self, discontinuity: bool) -> Result<Option<SpeechWindow>, WindowError> {
        let active = self.active.take().ok_or(WindowError::NotActive)?;
        self.last_end = Some((active.epoch, active.received_end));
        if active.received_end == active.committed_end {
            return Ok(None);
        }
        Ok(Some(SpeechWindow {
            epoch: active.epoch,
            context_start: active.context_start,
            context_end: active.received_end,
            novel_start: active.committed_end,
            novel_end: active.received_end,
            reason: if discontinuity {
                EndReason::Discontinuity
            } else {
                EndReason::SpeechEnd
            },
        }))
    }

    /// Discards only the not-yet-issued novel tail. Already returned windows
    /// are NOT canceled by this metadata operation; the host must cancel/drain
    /// its provider jobs separately. Returned gap metadata is NOT persisted.
    pub fn discard(&mut self) -> Result<Option<DiscardedRange>, WindowError> {
        let active = self.active.take().ok_or(WindowError::NotActive)?;
        self.last_end = Some((active.epoch, active.received_end));
        Ok(
            (active.committed_end < active.received_end).then_some(DiscardedRange {
                epoch: active.epoch,
                start: active.committed_end,
                end: active.received_end,
            }),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn window_diagnostics_do_not_echo_epoch_ranges_or_previous_context() {
        let mut planner = SpeechWindowPlanner::new(WindowLimits {
            max_frames: 10,
            overlap_frames: 2,
        })
        .unwrap();
        planner.begin(54321, 345678).unwrap();
        let active_debug = format!("{planner:?}");
        planner.advance(345681).unwrap();
        let window = planner.finish(true).unwrap().unwrap();
        let last_debug = format!("{planner:?}");
        planner.begin(54322, 345690).unwrap();
        planner.advance(345693).unwrap();
        let discarded = planner.discard().unwrap().unwrap();
        for debug in [
            active_debug,
            last_debug,
            format!("{window:?}"),
            format!("{discarded:?}"),
            format!("{planner:?}"),
        ] {
            for secret in ["54321", "54322", "345678", "345681", "345690", "345693"] {
                assert!(!debug.contains(secret));
            }
        }
        assert_eq!(
            (window.epoch, window.novel_start, window.novel_end),
            (54321, 345678, 345681)
        );
        assert_eq!(
            (discarded.epoch, discarded.start, discarded.end),
            (54322, 345690, 345693)
        );
    }
    #[test]
    fn varied_limits_fragments_finish_and_discard_partition_only_novel_ownership() {
        for max_frames in 1..=64u64 {
            for overlap_frames in 0..=max_frames / 4 {
                let mut planner = SpeechWindowPlanner::new(WindowLimits {
                    max_frames,
                    overlap_frames,
                })
                .unwrap();
                let mut seed = 0x73a5u64;
                let mut cursor = 1000u64;
                for epoch in 0..4 {
                    for segment in 0..5 {
                        let start = cursor;
                        planner.begin(epoch, start).unwrap();
                        let mut owned_end = start;
                        for _ in 0..23 {
                            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
                            cursor += seed % (max_frames + 1); // includes empty replay
                            for window in planner.advance(cursor).unwrap().into_iter().flatten() {
                                assert_eq!(window.epoch, epoch);
                                assert_eq!(window.novel_start, owned_end);
                                assert!(window.novel_end > window.novel_start);
                                assert!(window.context_start >= start);
                                assert!(window.context_start <= window.novel_start);
                                assert_eq!(window.context_end, window.novel_end);
                                assert!(window.context_end - window.context_start <= max_frames);
                                assert_eq!(window.reason, EndReason::Limit);
                                owned_end = window.novel_end;
                            }
                        }
                        if segment % 2 == 0 {
                            if let Some(window) = planner.finish(true).unwrap() {
                                assert_eq!(window.epoch, epoch);
                                assert_eq!(window.novel_start, owned_end);
                                assert!(window.novel_end > owned_end);
                                assert!(window.context_start >= start);
                                assert!(window.context_start <= window.novel_start);
                                assert!(window.context_end - window.context_start <= max_frames);
                                assert_eq!(window.context_end, window.novel_end);
                                assert_eq!(window.reason, EndReason::Discontinuity);
                                owned_end = window.novel_end;
                            }
                        } else if let Some(discarded) = planner.discard().unwrap() {
                            assert_eq!(discarded.epoch, epoch);
                            assert_eq!(discarded.start, owned_end);
                            assert!(discarded.end > owned_end);
                            owned_end = discarded.end;
                        }
                        // Issued novel ranges + explicit discard cover exactly
                        // supplied frames; overlap never adds novel ownership.
                        assert_eq!(owned_end, cursor);
                        cursor += 7; // explicit unsupplied gap, never synthesized
                    }
                    cursor = 1000; // a newer epoch can restart source counters
                }
            }
        }
    }

    fn planner() -> SpeechWindowPlanner {
        SpeechWindowPlanner::new(WindowLimits {
            max_frames: 16000,
            overlap_frames: 1600,
        })
        .unwrap()
    }
    fn collect(partitions: &[u64], end: u64) -> Vec<SpeechWindow> {
        let mut planner = planner();
        planner.begin(3, 0).unwrap();
        let mut windows = Vec::new();
        let mut at = 0;
        let mut part = 0;
        while at < end {
            at += partitions[part % partitions.len()].min(end - at);
            part += 1;
            windows.extend(planner.advance(at).unwrap().into_iter().flatten());
        }
        windows.extend(planner.finish(false).unwrap());
        windows
    }
    #[test]
    fn continuous_speech_emits_before_silence_and_novel_ranges_partition_input() {
        let windows = collect(&[480], 160000);
        assert!(windows.len() > 1);
        let mut novel_end = 0;
        for window in windows {
            assert_eq!(window.novel_start, novel_end);
            assert!(window.novel_end > window.novel_start);
            assert!(window.context_end - window.context_start <= 16000);
            assert!(window.context_start <= window.novel_start);
            assert_eq!(window.context_end, window.novel_end);
            novel_end = window.novel_end;
        }
        assert_eq!(novel_end, 160000);
    }
    #[test]
    fn packet_partitions_do_not_change_windows_or_add_duration() {
        for end in [0, 1, 15999, 16000, 16001, 30400, 30401, 160003] {
            let expected = collect(&[16000], end);
            for parts in [&[1][..], &[479, 480, 513][..], &[16000, 17][..]] {
                assert_eq!(collect(parts, end), expected);
            }
        }
    }
    #[test]
    fn at_most_two_windows_per_advance_even_at_max_overlap() {
        let mut planner = SpeechWindowPlanner::new(WindowLimits {
            max_frames: 4,
            overlap_frames: 1,
        })
        .unwrap();
        planner.begin(0, 0).unwrap();
        assert!(planner.advance(3).unwrap().iter().all(Option::is_none));
        let two = planner.advance(7).unwrap();
        assert_eq!(two[0].unwrap().context_start, 0);
        assert_eq!(two[1].unwrap().context_start, 3);
        assert!(planner.finish(false).unwrap().is_none());
    }
    #[test]
    fn gap_and_new_epoch_never_carry_previous_context() {
        let mut planner = planner();
        planner.begin(7, 100).unwrap();
        planner.advance(500).unwrap();
        assert_eq!(
            planner.finish(true).unwrap().unwrap().reason,
            EndReason::Discontinuity
        );
        planner.begin(7, 1000).unwrap();
        planner.advance(1100).unwrap();
        let after_gap = planner.finish(false).unwrap().unwrap();
        assert_eq!(
            (after_gap.context_start, after_gap.novel_start),
            (1000, 1000)
        );
        planner.begin(8, 0).unwrap();
        planner.advance(1).unwrap();
        let reset = planner.finish(false).unwrap().unwrap();
        assert_eq!(
            (reset.epoch, reset.context_start, reset.context_end),
            (8, 0, 1)
        );
        assert_eq!(planner.begin(7, 2000), Err(WindowError::Order));
    }
    #[test]
    fn replay_empty_and_exact_limit_tail_do_not_duplicate_context() {
        let mut planner = planner();
        planner.begin(0, 50).unwrap();
        assert_eq!(planner.advance(50).unwrap(), [None, None]);
        assert!(planner.finish(false).unwrap().is_none());
        planner.begin(0, 50).unwrap();
        let windows = planner.advance(16050).unwrap();
        assert!(windows[0].is_some());
        assert_eq!(planner.advance(16050).unwrap(), [None, None]);
        assert!(planner.finish(false).unwrap().is_none());
        assert_eq!(planner.finish(false), Err(WindowError::NotActive));
    }
    #[test]
    fn invalid_calls_are_atomic_and_limits_do_not_allow_unbounded_batches() {
        for limits in [
            WindowLimits {
                max_frames: 0,
                overlap_frames: 0,
            },
            WindowLimits {
                max_frames: MAX_REQUEST_SAMPLES as u64 + 1,
                overlap_frames: 0,
            },
            WindowLimits {
                max_frames: 4,
                overlap_frames: 2,
            },
        ] {
            assert_eq!(
                SpeechWindowPlanner::new(limits).unwrap_err(),
                WindowError::InvalidLimits
            );
        }
        let mut planner = planner();
        assert_eq!(planner.advance(1), Err(WindowError::NotActive));
        planner.begin(0, 100).unwrap();
        assert_eq!(planner.begin(0, 100), Err(WindowError::AlreadyActive));
        assert_eq!(planner.advance(99), Err(WindowError::Order));
        assert_eq!(planner.advance(16101), Err(WindowError::AdvanceTooLarge));
        planner.advance(101).unwrap();
        assert_eq!(planner.finish(false).unwrap().unwrap().context_start, 100);
        assert_eq!(planner.begin(0, 100), Err(WindowError::Order));
        planner.begin(0, 101).unwrap();
    }
    #[test]
    fn extreme_u64_counters_and_single_frame_limit_do_not_overflow() {
        let mut planner = SpeechWindowPlanner::new(WindowLimits {
            max_frames: 1,
            overlap_frames: 0,
        })
        .unwrap();
        planner.begin(u64::MAX, u64::MAX - 1).unwrap();
        let window = planner.advance(u64::MAX).unwrap()[0].unwrap();
        assert_eq!(
            (window.context_start, window.context_end),
            (u64::MAX - 1, u64::MAX)
        );
        assert!(planner.finish(false).unwrap().is_none());
    }
    #[test]
    fn long_metadata_run_retains_no_segment_list_or_pcm() {
        let mut planner = planner();
        planner.begin(0, 0).unwrap();
        let mut novel_end = 0;
        let mut windows_count = 0;
        for end in (480..=16000 * 300).step_by(480) {
            for window in planner.advance(end).unwrap().into_iter().flatten() {
                assert_eq!(window.novel_start, novel_end);
                novel_end = window.novel_end;
                windows_count += 1;
            }
        }
        if let Some(window) = planner.finish(false).unwrap() {
            assert_eq!(window.novel_start, novel_end);
            novel_end = window.novel_end;
        }
        assert_eq!(novel_end, 16000 * 300);
        assert!(windows_count > 300);
        // Metadata-only simulation is not a five-minute capture/ASR benchmark.
        assert!(std::mem::size_of::<SpeechWindowPlanner>() < 256);
    }

    #[test]
    fn discard_reports_only_unissued_tail_and_never_retracts_previous_windows() {
        let mut planner = planner();
        planner.begin(2, 0).unwrap();
        let already_issued = planner.advance(16000).unwrap()[0].unwrap();
        planner.advance(17000).unwrap();
        assert_eq!(
            planner.discard().unwrap(),
            Some(DiscardedRange {
                epoch: 2,
                start: 16000,
                end: 17000
            })
        );
        assert_eq!(already_issued.novel_end, 16000);
        assert_eq!(planner.discard(), Err(WindowError::NotActive));
        planner.begin(2, 17000).unwrap();
        planner.advance(17001).unwrap();
        let fresh = planner.finish(false).unwrap().unwrap();
        assert_eq!((fresh.context_start, fresh.novel_start), (17000, 17000));
        planner.begin(3, 0).unwrap();
        planner.advance(16000).unwrap();
        assert!(
            planner.discard().unwrap().is_none(),
            "overlap-only tail is not new lost audio"
        );
    }
}
