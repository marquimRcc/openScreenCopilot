use serde::{Deserialize, Serialize};

pub const DRAFT_VERSION: u16 = 0;
const MAX_ID_BYTES: usize = 128;
const MAX_NONCE_BYTES: usize = 128;

#[derive(Debug, Deserialize)]
#[serde(tag = "type", deny_unknown_fields)]
pub enum HostMessage {
    #[serde(rename = "hello")]
    Hello {
        version: u16,
        #[serde(rename = "sessionId")]
        session_id: String,
        nonce: String,
        seq: String,
    },
    #[serde(rename = "shutdown")]
    Shutdown {
        version: u16,
        #[serde(rename = "sessionId")]
        session_id: String,
        nonce: String,
        seq: String,
    },
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "type")]
pub enum SidecarMessage {
    #[serde(rename = "ready")]
    Ready {
        version: u16,
        #[serde(rename = "sessionId")]
        session_id: String,
        seq: String,
        capabilities: Capabilities,
    },
    #[serde(rename = "completed")]
    Completed {
        version: u16,
        #[serde(rename = "sessionId")]
        session_id: String,
        seq: String,
    },
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub audio_descriptor_version: u8,
    pub max_control_line_bytes: usize,
    pub provider_available: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProtocolError {
    InvalidJson,
    InvalidVersion,
    InvalidIdentity,
    InvalidSequence,
    UnexpectedMessage,
}

pub enum ProtocolReply {
    Message(SidecarMessage),
    Complete(SidecarMessage),
}

pub struct ProtocolState {
    session_id: Option<String>,
    nonce: Option<String>,
    last_seq: Option<u64>,
}

impl std::fmt::Debug for ProtocolState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ProtocolState")
            .field("has_session", &self.session_id.is_some())
            .field("last_seq", &self.last_seq)
            .finish()
    }
}

fn parse_seq(value: &str) -> Result<u64, ProtocolError> {
    if value.is_empty()
        || (value.len() > 1 && value.starts_with('0'))
        || !value.bytes().all(|byte| byte.is_ascii_digit())
    {
        return Err(ProtocolError::InvalidSequence);
    }
    value
        .parse::<u64>()
        .map_err(|_| ProtocolError::InvalidSequence)
}

fn valid_identity(value: &str, limit: usize) -> bool {
    !value.is_empty()
        && value.len() <= limit
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

impl ProtocolState {
    pub fn new() -> Self {
        Self {
            session_id: None,
            nonce: None,
            last_seq: None,
        }
    }

    pub fn accept(&mut self, line: &str) -> Result<ProtocolReply, ProtocolError> {
        let message: HostMessage =
            serde_json::from_str(line).map_err(|_| ProtocolError::InvalidJson)?;
        match message {
            HostMessage::Hello {
                version,
                session_id,
                nonce,
                seq,
            } => {
                if self.session_id.is_some() {
                    return Err(ProtocolError::UnexpectedMessage);
                }
                if version != DRAFT_VERSION {
                    return Err(ProtocolError::InvalidVersion);
                }
                if !valid_identity(&session_id, MAX_ID_BYTES)
                    || !valid_identity(&nonce, MAX_NONCE_BYTES)
                {
                    return Err(ProtocolError::InvalidIdentity);
                }
                let parsed = parse_seq(&seq)?;
                self.session_id = Some(session_id);
                self.nonce = Some(nonce);
                self.last_seq = Some(parsed);
                Ok(ProtocolReply::Message(SidecarMessage::Ready {
                    version: DRAFT_VERSION,
                    session_id: self.session_id.as_ref().unwrap().clone(),
                    seq,
                    capabilities: Capabilities {
                        audio_descriptor_version: 0,
                        max_control_line_bytes:
                            openscreen_speech_core::control_lines::MAX_CONTROL_LINE_BYTES,
                        provider_available: false,
                    },
                }))
            }
            HostMessage::Shutdown {
                version,
                session_id,
                nonce,
                seq,
            } => {
                if version != DRAFT_VERSION {
                    return Err(ProtocolError::InvalidVersion);
                }
                if self.session_id.as_deref() != Some(session_id.as_str())
                    || self.nonce.as_deref() != Some(nonce.as_str())
                {
                    return Err(ProtocolError::InvalidIdentity);
                }
                let parsed = parse_seq(&seq)?;
                if self.last_seq.is_none_or(|last| parsed <= last) {
                    return Err(ProtocolError::InvalidSequence);
                }
                self.last_seq = Some(parsed);
                Ok(ProtocolReply::Complete(SidecarMessage::Completed {
                    version: DRAFT_VERSION,
                    session_id: self.session_id.as_ref().unwrap().clone(),
                    seq,
                }))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hello_and_matching_shutdown_form_a_complete_session() {
        let mut state = ProtocolState::new();
        let ready = match state
            .accept(r#"{"type":"hello","version":0,"sessionId":"s_1","nonce":"n-1","seq":"0"}"#)
            .unwrap()
        {
            ProtocolReply::Message(message) => serde_json::to_value(message).unwrap(),
            ProtocolReply::Complete(_) => panic!("hello completed"),
        };
        assert_eq!(ready["type"], "ready");
        assert_eq!(ready["capabilities"]["providerAvailable"], false);
        let completed = match state
            .accept(r#"{"type":"shutdown","version":0,"sessionId":"s_1","nonce":"n-1","seq":"1"}"#)
            .unwrap()
        {
            ProtocolReply::Complete(message) => serde_json::to_value(message).unwrap(),
            ProtocolReply::Message(_) => panic!("shutdown stayed open"),
        };
        assert_eq!(completed["type"], "completed");
        assert_eq!(completed["seq"], "1");
    }

    #[test]
    fn schema_identity_version_and_sequence_fail_closed() {
        for line in [
            r#"{}"#,
            r#"{"type":"hello","version":1,"sessionId":"s","nonce":"n","seq":"0"}"#,
            r#"{"type":"hello","version":0,"sessionId":"../x","nonce":"n","seq":"0"}"#,
            r#"{"type":"hello","version":0,"sessionId":"s","nonce":"n","seq":"00"}"#,
            r#"{"type":"hello","version":0,"sessionId":"s","nonce":"n","seq":"0","extra":true}"#,
        ] {
            assert!(ProtocolState::new().accept(line).is_err(), "{line}");
        }
    }

    #[test]
    fn replay_wrong_identity_and_second_hello_are_rejected() {
        let mut state = ProtocolState::new();
        state
            .accept(r#"{"type":"hello","version":0,"sessionId":"s","nonce":"n","seq":"8"}"#)
            .unwrap();
        for line in [
            r#"{"type":"hello","version":0,"sessionId":"s","nonce":"n","seq":"9"}"#,
            r#"{"type":"shutdown","version":0,"sessionId":"s","nonce":"bad","seq":"9"}"#,
            r#"{"type":"shutdown","version":0,"sessionId":"s","nonce":"n","seq":"8"}"#,
        ] {
            assert!(state.accept(line).is_err(), "{line}");
        }
    }

    #[test]
    fn diagnostics_do_not_expose_session_or_nonce() {
        let mut state = ProtocolState::new();
        state
            .accept(r#"{"type":"hello","version":0,"sessionId":"private_session","nonce":"private_nonce","seq":"4"}"#)
            .unwrap();
        let debug = format!("{state:?}");
        assert!(!debug.contains("private_session"));
        assert!(!debug.contains("private_nonce"));
    }
}
