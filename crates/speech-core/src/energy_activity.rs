//! Deterministic mono16k energy activity gate.
//!
//! This is real PCM signal analysis, but not semantic speech recognition: steady
//! noise, music or clicks can trigger it. It allocates nothing and owns no PCM.

pub const MIN_FRAME_SAMPLES: usize = 80;
pub const MAX_FRAME_SAMPLES: usize = 1_600;
pub const MAX_DEBOUNCE_FRAMES: u16 = 100;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct EnergyActivityConfig {
    pub frame_samples: usize,
    pub start_rms: f32,
    pub stop_rms: f32,
    pub start_frames: u16,
    pub stop_frames: u16,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ActivityError {
    InvalidConfig,
    InvalidFrame,
    CounterExhausted,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ActivityTransition {
    Silent,
    Started,
    Active,
    Stopped,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ActivityDecision {
    pub transition: ActivityTransition,
    /// Zero-based index of the accepted frame in the current continuity epoch.
    pub frame_index: u64,
}

pub struct EnergyActivityDetector {
    config: EnergyActivityConfig,
    active: bool,
    above_run: u16,
    below_run: u16,
    next_frame: u64,
}

impl std::fmt::Debug for EnergyActivityDetector {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("EnergyActivityDetector")
            .field("frame_samples", &self.config.frame_samples)
            .field("active", &self.active)
            .field("above_run", &self.above_run)
            .field("below_run", &self.below_run)
            .field("next_frame", &self.next_frame)
            .finish()
    }
}

impl EnergyActivityDetector {
    pub fn new(config: EnergyActivityConfig) -> Result<Self, ActivityError> {
        if !(MIN_FRAME_SAMPLES..=MAX_FRAME_SAMPLES).contains(&config.frame_samples)
            || !config.start_rms.is_finite()
            || !config.stop_rms.is_finite()
            || config.start_rms <= 0.0
            || config.stop_rms < 0.0
            || config.stop_rms > config.start_rms
            || !(1..=MAX_DEBOUNCE_FRAMES).contains(&config.start_frames)
            || !(1..=MAX_DEBOUNCE_FRAMES).contains(&config.stop_frames)
        {
            return Err(ActivityError::InvalidConfig);
        }
        Ok(Self {
            config,
            active: false,
            above_run: 0,
            below_run: 0,
            next_frame: 0,
        })
    }

    pub fn config(&self) -> EnergyActivityConfig {
        self.config
    }

    pub fn is_active(&self) -> bool {
        self.active
    }

    /// Reset debounce and frame numbering at a gap, pause, source or epoch change.
    /// Returns whether an active region was interrupted; it does not invent a
    /// synthetic stop frame.
    pub fn reset_discontinuity(&mut self) -> bool {
        let interrupted = self.active;
        self.active = false;
        self.above_run = 0;
        self.below_run = 0;
        self.next_frame = 0;
        interrupted
    }

    /// Analyze exactly one configured mono16k frame. Invalid input and exhausted
    /// counters leave all state unchanged.
    pub fn analyze(&mut self, samples: &[f32]) -> Result<ActivityDecision, ActivityError> {
        if samples.len() != self.config.frame_samples
            || samples.iter().any(|sample| !sample.is_finite())
        {
            return Err(ActivityError::InvalidFrame);
        }
        let following = self
            .next_frame
            .checked_add(1)
            .ok_or(ActivityError::CounterExhausted)?;
        let mean_square = samples.iter().fold(0.0_f64, |sum, sample| {
            let value = f64::from(*sample);
            sum + value * value
        }) / samples.len() as f64;
        let start_square = f64::from(self.config.start_rms).powi(2);
        let stop_square = f64::from(self.config.stop_rms).powi(2);

        let transition = if self.active {
            self.above_run = 0;
            if mean_square <= stop_square {
                self.below_run += 1;
                if self.below_run >= self.config.stop_frames {
                    self.active = false;
                    self.below_run = 0;
                    ActivityTransition::Stopped
                } else {
                    ActivityTransition::Active
                }
            } else {
                self.below_run = 0;
                ActivityTransition::Active
            }
        } else {
            self.below_run = 0;
            if mean_square >= start_square {
                self.above_run += 1;
                if self.above_run >= self.config.start_frames {
                    self.active = true;
                    self.above_run = 0;
                    ActivityTransition::Started
                } else {
                    ActivityTransition::Silent
                }
            } else {
                self.above_run = 0;
                ActivityTransition::Silent
            }
        };
        let decision = ActivityDecision {
            transition,
            frame_index: self.next_frame,
        };
        self.next_frame = following;
        Ok(decision)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> EnergyActivityConfig {
        EnergyActivityConfig {
            frame_samples: 160,
            start_rms: 0.1,
            stop_rms: 0.04,
            start_frames: 2,
            stop_frames: 3,
        }
    }

    #[test]
    fn debounce_and_hysteresis_emit_exact_transitions() {
        let mut detector = EnergyActivityDetector::new(config()).unwrap();
        let loud = [0.2; 160];
        let middle = [0.07; 160];
        let quiet = [0.01; 160];
        let transitions = [
            detector.analyze(&loud).unwrap().transition,
            detector.analyze(&loud).unwrap().transition,
            detector.analyze(&middle).unwrap().transition,
            detector.analyze(&quiet).unwrap().transition,
            detector.analyze(&quiet).unwrap().transition,
            detector.analyze(&quiet).unwrap().transition,
        ];
        assert_eq!(
            transitions,
            [
                ActivityTransition::Silent,
                ActivityTransition::Started,
                ActivityTransition::Active,
                ActivityTransition::Active,
                ActivityTransition::Active,
                ActivityTransition::Stopped,
            ]
        );
        assert!(!detector.is_active());
    }

    #[test]
    fn alternating_threshold_crossings_do_not_accumulate_debounce() {
        let mut detector = EnergyActivityDetector::new(config()).unwrap();
        let loud = [0.2; 160];
        let quiet = [0.0; 160];
        for frame in [&loud[..], &quiet, &loud, &quiet] {
            assert_eq!(
                detector.analyze(frame).unwrap().transition,
                ActivityTransition::Silent
            );
        }
        assert!(!detector.is_active());
    }

    #[test]
    fn invalid_frames_are_atomic_and_discontinuity_reports_interruption() {
        let mut detector = EnergyActivityDetector::new(EnergyActivityConfig {
            start_frames: 1,
            ..config()
        })
        .unwrap();
        assert_eq!(
            detector.analyze(&[0.2; 160]).unwrap(),
            ActivityDecision {
                transition: ActivityTransition::Started,
                frame_index: 0,
            }
        );
        let before = format!("{detector:?}");
        assert_eq!(
            detector.analyze(&[f32::NAN; 160]),
            Err(ActivityError::InvalidFrame)
        );
        assert_eq!(format!("{detector:?}"), before);
        assert!(detector.reset_discontinuity());
        assert!(!detector.reset_discontinuity());
        assert_eq!(detector.analyze(&[0.0; 160]).unwrap().frame_index, 0);
    }

    #[test]
    fn configuration_bounds_are_explicit() {
        for bad in [
            EnergyActivityConfig {
                frame_samples: 79,
                ..config()
            },
            EnergyActivityConfig {
                stop_rms: 0.2,
                ..config()
            },
            EnergyActivityConfig {
                start_frames: 0,
                ..config()
            },
            EnergyActivityConfig {
                start_rms: f32::NAN,
                ..config()
            },
        ] {
            assert!(matches!(
                EnergyActivityDetector::new(bad),
                Err(ActivityError::InvalidConfig)
            ));
        }
        assert!(EnergyActivityDetector::new(EnergyActivityConfig {
            frame_samples: MAX_FRAME_SAMPLES,
            start_frames: MAX_DEBOUNCE_FRAMES,
            stop_frames: MAX_DEBOUNCE_FRAMES,
            ..config()
        })
        .is_ok());
    }

    #[test]
    fn counter_exhaustion_is_fail_closed_and_atomic() {
        let mut detector = EnergyActivityDetector::new(config()).unwrap();
        detector.next_frame = u64::MAX;
        let before = format!("{detector:?}");
        assert_eq!(
            detector.analyze(&[0.2; 160]),
            Err(ActivityError::CounterExhausted)
        );
        assert_eq!(format!("{detector:?}"), before);
    }
}
