mod protocol;

use std::io::{Read, Write};

use openscreen_speech_core::control_lines::{ControlLineDecoder, MAX_CONTROL_LINE_BYTES};
use protocol::{ProtocolReply, ProtocolState};

fn run() -> Result<(), &'static str> {
    let mut decoder = ControlLineDecoder::new(MAX_CONTROL_LINE_BYTES).map_err(|_| "decoder")?;
    let mut state = ProtocolState::new();
    let mut input = std::io::stdin().lock();
    let mut output = std::io::stdout().lock();
    let mut chunk = [0_u8; 4_096];
    loop {
        let count = input.read(&mut chunk).map_err(|_| "read")?;
        if count == 0 {
            decoder.finish().map_err(|_| "truncated")?;
            return Err("shutdown-required");
        }
        let mut consumed = 0;
        while consumed < count {
            let used = decoder
                .feed(&chunk[consumed..count])
                .map_err(|_| "framing")?;
            consumed += used;
            let Some(line) = decoder.take() else {
                if used == 0 {
                    return Err("decoder-stalled");
                }
                continue;
            };
            let reply = state.accept(&line).map_err(|_| "protocol")?;
            let (message, complete) = match reply {
                ProtocolReply::Message(message) => (message, false),
                ProtocolReply::Complete(message) => (message, true),
            };
            serde_json::to_writer(&mut output, &message).map_err(|_| "serialize")?;
            output.write_all(b"\n").map_err(|_| "write")?;
            output.flush().map_err(|_| "flush")?;
            if complete {
                return Ok(());
            }
        }
    }
}

fn main() {
    if let Err(code) = run() {
        eprintln!("speech-sidecar stopped: {code}");
        std::process::exit(2);
    }
}
