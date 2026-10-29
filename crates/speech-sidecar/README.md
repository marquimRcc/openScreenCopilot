# speech-sidecar draft handshake

Local stdin/stdout NDJSON executable for protocol hardening only. It uses the
bounded `speech-core` line decoder and accepts exactly one strict `hello`, followed
by a matching, monotonically sequenced `shutdown`. It emits `ready` with
`providerAvailable:false`, then `completed`, flushing each line. Malformed framing,
JSON/schema/version, identity, replay, mismatched nonce, EOF before shutdown and
unexpected messages terminate fail-closed on stderr with exit code2.

This does not load a model, accept PCM, open a binary pipe/socket, grant path access,
authenticate another process, journal results or implement ASR. Session/nonce are
bounded ASCII correlation fields; they do not replace OS ACLs. Stdout contains only
protocol messages and stderr diagnostics omit supplied identity values. Draft
version0 is not frozen v1 and advertises no provider.

The separate diagnostic mode `--probe-wave <host-authorized-path>` exercises the
bounded core WAV decoder/downmix/16k normalizer and emits only rates/counts, never
PCM or a transcript. It does not run through the handshake and grants no new path
authorization; callers must already trust and canonicalize the supplied path.
The isolated TypeScript parser accepts only the exact probe schema, supported
rates and canonical counters within the same 1,048,576-sample ceiling.

`contracts/copilot/speech-sidecar.v0.fixture.json` is serialized by a Rust test
and parsed by the isolated main-only TypeScript parser
`electron/copilot/speechSidecarProtocolV0.ts`. The parser enforces exact fields,
version, identity, canonical u64 sequence strings and advertised limits, and
refuses `providerAvailable:true`. It does not spawn or trust a process.
`SpeechSidecarV0Session` additionally correlates ready/completed to one expected
session and exact hello/shutdown sequences, rejecting replay and out-of-order or
cross-session replies; it still does not supervise process lifetime.
The TypeScript encoder validates bounded ASCII identity and canonical u64
sequences before emitting exact hello/shutdown NDJSON.
`SpeechSidecarLineDecoderV0` provides the future TypeScript host with the same
bounded LF/CRLF and fatal UTF-8 framing, fixed storage and one-message
backpressure. It is isolated and not connected to a child process yet.
`SpeechSidecarStreamSessionV0` now composes codec, framing and reply correlation
without retaining a message queue, and fails closed on ordering, parsing or EOF.
`SpeechSidecarHostControllerV0` owns exact outbound writes and deterministic
handshake/shutdown deadlines with a typed abort receipt. It still owns no process,
path or OS permission.
`SpeechSidecarProcessBindingV0` can bind that controller to one already-created
process and the shared generation supervisor, retaining an observed exit receipt
and terminating on malformed or premature stdout. Spawn/path/ACL remain absent.
The dormant launcher now canonicalizes a caller-authorized absolute executable,
spawns it without a shell or arguments and starts only this handshake. It is not
wired into application startup. Stderr diagnostics are drained into a fixed 4KiB
host buffer (never an unbounded log queue) and remain separate from stdout framing.
An opt-in Vitest integration test (`OPENSCREEN_SPEECH_SIDECAR_V0=<absolute binary>`)
executes the real TypeScript -> Rust -> TypeScript handshake and requires a clean,
observed process exit. It is skipped when no explicitly built binary is supplied.
The resource resolver recognizes only the exact packaged/development
`electron/native/bin/<platform>-<arch>` slot, canonicalizes it and returns unavailable
when absent; it never searches PATH.
`npm run build:speech-sidecar` performs a locked offline release build into the
private cache and stages only the host executable into that slot. Official package
chains do not invoke it yet.
Electron-builder explicitly excludes this draft binary on all platforms, so a
local staging run cannot silently place it in an installer before the packaging,
licensing and privacy gates are approved.
`createSpeechSidecarServiceV0` composes resolver and launcher but returns `null`
without spawning when the exact resource is absent. It remains unreferenced by
application startup and therefore cannot activate transcription.
Identity generation uses separate 192-bit random values for the bounded session
and nonce fields. The nonce remains correlation material, not authentication.
The dormant service uses that generator by default when its caller omits identity.
Shutdown also defaults to the checked next u64 sequence, rejecting overflow before write.

```text
cargo test --offline --locked --manifest-path crates/speech-sidecar/Cargo.toml
cargo clippy --offline --locked --manifest-path crates/speech-sidecar/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path crates/speech-sidecar/Cargo.toml -- --check
```
