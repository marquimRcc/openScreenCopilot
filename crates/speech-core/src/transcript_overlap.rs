//! Conservative, bounded reconciliation for overlapping ASR window text.
//!
//! This compares exact Unicode-whitespace-delimited tokens. It does not perform
//! fuzzy matching, punctuation/case normalization, language inference or storage.

use crate::provider::MAX_RESULT_TEXT_BYTES;

pub const MAX_OVERLAP_TOKENS: usize = 256;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OverlapError {
    InvalidLimit,
    TextTooLarge,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub struct OverlapDecision {
    novel_byte_start: usize,
    overlap_tokens: usize,
}

impl std::fmt::Debug for OverlapDecision {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("OverlapDecision")
            .field("novel_byte_start", &self.novel_byte_start)
            .field("overlap_tokens", &self.overlap_tokens)
            .finish()
    }
}

impl OverlapDecision {
    pub fn novel_byte_start(self) -> usize {
        self.novel_byte_start
    }

    pub fn overlap_tokens(self) -> usize {
        self.overlap_tokens
    }

    /// Slice the same current text used to create this decision. Returns `None`
    /// rather than panicking if a decision is accidentally paired with another
    /// string whose length or UTF-8 boundaries differ.
    pub fn novel_text(self, current: &str) -> Option<&str> {
        current.get(self.novel_byte_start..)
    }
}

#[derive(Clone, Copy, Default)]
struct Span {
    start: usize,
    end: usize,
}

fn token_count(text: &str) -> usize {
    text.split_whitespace().count()
}

fn fill_spans(text: &str, skip: usize, take: usize, spans: &mut [Span]) -> usize {
    let mut cursor = 0;
    let mut written = 0;
    for (index, token) in text.split_whitespace().enumerate() {
        let relative = text[cursor..]
            .find(token)
            .expect("split token must remain in its source");
        let start = cursor + relative;
        let end = start + token.len();
        cursor = end;
        if index >= skip && written < take {
            spans[written] = Span { start, end };
            written += 1;
        }
        if written == take {
            break;
        }
    }
    written
}

fn after_whitespace(text: &str, at: usize) -> usize {
    let mut end = at;
    for (offset, character) in text[at..].char_indices() {
        if !character.is_whitespace() {
            return at + offset;
        }
        end = at + offset + character.len_utf8();
    }
    end
}

/// Find the longest exact token suffix/prefix overlap and return the novel slice.
///
/// `previous` must be committed text from the immediately preceding continuous
/// window and `current` its accepted successor. The caller owns epoch/source
/// isolation and must not use partial or failed provider output as committed state.
pub fn reconcile_overlap(
    previous: &str,
    current: &str,
    max_overlap_tokens: usize,
) -> Result<OverlapDecision, OverlapError> {
    if max_overlap_tokens == 0 || max_overlap_tokens > MAX_OVERLAP_TOKENS {
        return Err(OverlapError::InvalidLimit);
    }
    if previous.len() > MAX_RESULT_TEXT_BYTES || current.len() > MAX_RESULT_TEXT_BYTES {
        return Err(OverlapError::TextTooLarge);
    }

    let previous_count = token_count(previous);
    let mut previous_spans = [Span::default(); MAX_OVERLAP_TOKENS];
    let mut current_spans = [Span::default(); MAX_OVERLAP_TOKENS];
    let previous_take = previous_count.min(max_overlap_tokens);
    let previous_written = fill_spans(
        previous,
        previous_count.saturating_sub(previous_take),
        previous_take,
        &mut previous_spans,
    );
    let current_written = fill_spans(current, 0, max_overlap_tokens, &mut current_spans);
    let possible = previous_written.min(current_written);

    for overlap in (1..=possible).rev() {
        let previous_start = previous_written - overlap;
        let matches = (0..overlap).all(|index| {
            let old = previous_spans[previous_start + index];
            let new = current_spans[index];
            previous[old.start..old.end] == current[new.start..new.end]
        });
        if matches {
            let end = current_spans[overlap - 1].end;
            return Ok(OverlapDecision {
                novel_byte_start: after_whitespace(current, end),
                overlap_tokens: overlap,
            });
        }
    }

    Ok(OverlapDecision {
        novel_byte_start: 0,
        overlap_tokens: 0,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn longest_exact_overlap_preserves_original_novel_text() {
        let decision = reconcile_overlap(
            "um teste com áudio claro",
            "com áudio claro   e pontuação!",
            8,
        )
        .unwrap();
        assert_eq!(decision.overlap_tokens(), 3);
        assert_eq!(
            decision.novel_text("com áudio claro   e pontuação!"),
            Some("e pontuação!")
        );
    }

    #[test]
    fn mismatch_is_conservative_and_complete_overlap_is_empty() {
        let mismatch = reconcile_overlap("Olá mundo", "olá mundo novo", 4).unwrap();
        assert_eq!(mismatch.overlap_tokens(), 0);
        assert_eq!(
            mismatch.novel_text("olá mundo novo"),
            Some("olá mundo novo")
        );

        let complete = reconcile_overlap("antes trecho igual", "trecho igual", 2).unwrap();
        assert_eq!(complete.overlap_tokens(), 2);
        assert_eq!(complete.novel_text("trecho igual"), Some(""));
    }

    #[test]
    fn unicode_whitespace_and_token_limit_are_explicit() {
        let current = "beta\u{2003}gama\nnovo";
        let decision = reconcile_overlap("alfa beta gama", current, 2).unwrap();
        assert_eq!(decision.overlap_tokens(), 2);
        assert_eq!(decision.novel_text(current), Some("novo"));

        let one = reconcile_overlap("a b c", "b c d", 1).unwrap();
        assert_eq!(one.overlap_tokens(), 0);
        assert_eq!(
            reconcile_overlap("", "", 0),
            Err(OverlapError::InvalidLimit)
        );
        assert_eq!(
            reconcile_overlap("", "", MAX_OVERLAP_TOKENS + 1),
            Err(OverlapError::InvalidLimit)
        );
        assert_eq!(
            reconcile_overlap(&"x".repeat(MAX_RESULT_TEXT_BYTES + 1), "", 1),
            Err(OverlapError::TextTooLarge)
        );
    }

    #[test]
    fn maximal_bound_uses_only_fixed_span_storage() {
        let previous = (0..400)
            .map(|index| format!("t{index}"))
            .collect::<Vec<_>>()
            .join(" ");
        let current = (144..401)
            .map(|index| format!("t{index}"))
            .collect::<Vec<_>>()
            .join(" ");
        let decision = reconcile_overlap(&previous, &current, MAX_OVERLAP_TOKENS).unwrap();
        assert_eq!(decision.overlap_tokens(), MAX_OVERLAP_TOKENS);
        assert_eq!(decision.novel_text(&current), Some("t400"));
        assert!(!format!("{decision:?}").contains("t400"));
    }
}
