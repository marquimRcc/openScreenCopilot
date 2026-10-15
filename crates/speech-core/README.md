# speech-core foundation (draft)

Sample-to-media timeline arithmetic, a bounded draft metadata registry,
interleaved-to-mono downmix, a provider INTERFACE and a metadata window planner are implemented. No audio capture,
production resampling, loudness normalization, VAD, concrete model/provider, inference,
sidecar, journal or UI integration.
The original timeline code uses the repository MIT license. Downmix/provider boundary are adapted from
meeting-copilot (Zackriya Solutions); its MIT notice is preserved in
[LICENSE-MEETING-COPILOT](LICENSE-MEETING-COPILOT). Vendor remains immutable.

The library uses std only. serde_json is a pinned test dependency for the exact same
JSON fixture exercised by electron/copilot/sourceTimeline.test.ts. Cargo.lock is
local to this isolated workspace; the compositor's workspace/lock are unchanged.
No crate-owned build.rs, hardware API, model downloads or environment changes are required.
The test-only resampling spike below adds num-traits' compiler-feature build probe.

```text
cargo test --offline --locked --manifest-path crates/speech-core/Cargo.toml
cargo clippy --offline --locked --manifest-path crates/speech-core/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path crates/speech-core/Cargo.toml -- --check
```

Set CARGO_TARGET_DIR to a private ignored build directory when testing locally.
Initial validation used installed Rust/cargo1.98.1 on Windows, not a RegataOS test.
No new toolchain was installed. Root npm/Vitest and compositor tests do not exercise
this separate workspace. The CI now has an independent speech-core job: pinned
Rust1.98.1, exact lock fetch followed by offline debug/release/clippy/fmt on this
manifest, temp target directory, read-only repository permission and no native
backend/model/artifact steps. It is configured, not yet remotely observed passing;
local Windows results do not homologate Linux/RegataOS. Run the commands explicitly
when developing locally.

Caller must isolate a single session/source and supply trusted span metadata. The
raw mapping function is not a wire parser, global map validator, owner check or PCM permission.
Bounds/rate policy are draftv0, not a supported-hardware declaration. Protocolv1
remains unfrozen. See [timeline draft](../../project/SPEECH-TIMELINE-DRAFT.md).

`timeline_registry::TimelineRegistry` is optional, pure metadata scoped to one
session and exact source IDs. It validates append order, non-overlap, media order,
fixed rate within an epoch and exact idempotent replay. Invalid inserts do not
consume capacity. The caller chooses smaller positive limits within prototype
hard caps (64 sources, 4096 spans; each ID at most128 UTF-8 bytes). Capacity is an
explicit error, never silent eviction. This is NOT an audio queue, negotiated wire
limit, recording-duration guarantee, authorization service, journal or recovery.
No integration with the TS host/IPC or capture exists. All metadata is lost on drop.
Forty-four Rust unit tests now pass in debug/release, including the original shared fixtures.

`downmix::downmix_interleaved` adapts `audio_processing.rs::audio_to_mono` at
meeting-copilot commit3c299c99abf7c38c1e3bac34c4aecdc010c911dd. Changes: explicit
AverageAll/FirstStereoPair policy, channels1–32, complete-frame validation, caller
frame budget plus prototype cap1,048,576 input scalar samples, all-finite validation
before output allocation and f64 accumulation. The mic-array first-two-channel
behavior is NEVER implicit for system audio. AverageAll is an arithmetic mean, not
layout-aware surround downmix; antiphase cancellation remains possible. Finite
values outside[-1,1] are not clipped. No gain, noise suppression or delay is added.
Output sample count equals input frame count at the SAME rate, not automatically
16kHz. Caller must retain transport partial frames; no padding or flush is invented.
No runtime integration, endpoint access or new Cargo dependency/model download.

## File-only resampling experiment (not a library API)

`tests/resample_spike.rs` uses pinned rubato0.15.0 as a **dev-dependency** with
default features disabled. No FFT, realfft, complex, logging or live capture is
enabled. Cargo.lock adds rubato/num-integer/num-traits/autocfg from the existing
offline cache. MIT notices are in [LICENSE-RESAMPLING-SPIKE](LICENSE-RESAMPLING-SPIKE).
The library's normal dependency tree still contains only this crate/std.

The experiment accepts a complete mono file buffer, only44.1/48kHz, at most
1,048,576 input floats. It emits exactly floor(total_input*16000/input_rate), an
explicit prototype EOF policy, not a live timestamp/rounding contract. Fixed512
input scratch and reusable output scratch; at most four zero flush blocks; padding
is not captured audio. Input/output whole-file buffers are bounded but still held
in memory: this is NOT a constant-memory streaming implementation or long-file API.

Crucial measured convention: this exact SincFixedIn configuration declares46/42
output frames of delay, but the first block is shorter, NOT prefixed with that
many zero samples. Blindly trimming output_delay advanced the impulse by47 frames
in the initial failing test. Keeping output intact measured peaks within one output
frame of floor(source_position*16000/input_rate). No universal phase/latency claim;
future live metadata must represent availability separately from media position.

Eight integration tests cover tails0/1/2/3/511/512/513/1023/1024/1025, partition
invariance, late impulse, 1kHz passband, 12kHz rejection, invalid inputs and cancel
after partial conversion (no successful/original output returned). New calls have
independent filter history. An intentionally undersized output buffer triggers a
real rubato error after two successful blocks; no original or partial successful
result escapes. Cancel is also checked during EOF flush and before final delivery.
The inclusive whole-file budget is tested, not just budget+1 rejection.
This does not test continuous epoch reset, gap journal, streaming partial emissions,
realtime latency, all devices/rates or Linux. Those remain integration gates.

Private offline voice QA reused the repository's existing synthetic pt-BR fixture:
44.1k and48k inputs through this exact test-local candidate each produced204,608
samples (12.788s), then the existing CPU Whisper manager transcribed both with
0word edits/24reference words. One manager, sequential requests, cached models,
external network forbidden and helper shutdown awaited. No microphone/desktop/
meeting captured, no new provider or live ASR integration. This single synthetic
sentence does not qualify diverse speakers, timing accuracy or thirty-minute ASR.

Run `cargo test --offline --locked --manifest-path crates/speech-core/Cargo.toml
--test resample_spike -- --nocapture` for measured values. Existing23 unit tests
remain separate from these eight experiment tests. No npm suite or app rebuild is
needed for this test-only change; app runtime/package are unchanged.

Additional DC/ramp characterization: interior DC gain error measured7.451ppm at
44.1k and1.550ppm at48k (20ppm regression ceiling). Remove the same-phase DC gain
before interpreting ramp amplitude as position. Measured source-frame offsets
~1.76/~2.01 match this configuration's index/table prediction within0.05 input
frame; they are NOT the declared46/42 OUTPUT-frame availability delay. These are
empirical characterization bounds, not an exact live timestamp/wire convention,
voice-quality certificate or hardware-clock measurement. An initial3ppm DC
assumption failed; the measurement distinguishes gain ripple from phase shift.

## Isolated provider boundary (no engine)

`provider.rs` adapts only the meeting-copilot provider trait/common types, preserving
the same MIT provenance. std boxed Send futures replace async_trait; no dependency
or executor is added. PCM is borrowed rather than cloned into an owned Vec. The
request accepts only declared mono16kHz,1..1,048,576 finite samples and an optional
bounded ASCII language hint (syntax, NOT support). Finite amplitudes are not clipped.
The host must prove actual rate, source/session/epoch and normalization separately.

`Cancellation` is monotonic and per job. `transcribe_checked` checks before entry,
awaits the provider even after cancel, then discards a canceled result; no early
select/drop branch detaches inference. Concrete providers MUST complete only after
their owned workers finish. A caller dropping the future or killing the process is
NOT drain; an actual job owner/sidecar lifecycle is still absent. Tests use a delayed
fake provider, not Whisper. This boundary is not wired to the voice QA above.

Result acceptance checks UTF-8 text bytes<=65,536 and optional finite confidence
0..1. Empty text/silence and partial flag are preserved. This is post-inference
validation, not a bound on a third-party engine's internal allocations. Engine error
strings/model metadata are internal domain data, not sanitized IPC messages; do not
forward them blindly. No provider identity grants file/model/PCM permissions.
Text has no timestamps/source IDs here: it cannot be exported as a durable final
or mapped to MP4 without the host's validated envelope/maps and journal. Protocolv1,
concrete providers, shared-engine coordination and live ASR remain pending.

## Metadata-only speech window planner

`speech_windows.rs` is original code, not a Silero extraction. Caller supplies
speech boundaries in a single normalized mono16k source/epoch. It cuts uninterrupted
speech at a positive caller bound<=provider request cap, with explicit overlap<=25%.
It emits context and novel ownership ranges; these are NOT duplicate-free words or
accurate ASR timestamps. No model, voice detection, pre/post padding or PCM is owned.

Each advance admits at most one max-window worth of new frames and returns a fixed
two-slot event array. Invalid calls are atomic; equal endpoint replay is empty.
Finish emits only novel real tail, not overlap-only/padded audio. Discontinuity and
new begin discard previous context; same epoch requires forward counters, newer
epoch permits counter reset. `discard` reports unissued novel tail only, not a
persisted gap and not cancellation of windows already passed to a provider.
Host must cancel/drain those jobs, retain PCM with backpressure, validate origin
maps, record gaps and deduplicate actual text separately. Never pass these16k
counters directly to the original44.1/48k capture timeline registry.

Nine tests cover packet invariance, limits, order/replay, continuous speech,
overlap ownership, gaps/epochs, discard and u64 extremes. A five-minute COUNTER
simulation retains no segment list/PCM; it is not a five-minute ASR or memory
benchmark of a real pipeline. Tuning max/overlap for natural speech remains open.

## Experimental binary descriptor v0 (not a transport)

`audio_frame_v0.rs` validates a fixed80-byte header before payload sizing: schema,
source/format, prototype rate/channel/scalar caps, reserved fields and checkedu64
end counter. Complete-frame validation reparses raw header, verifies actual byte
count and all finite f32le scalars without copying PCM. Public Header metadata is
not authorization; changing it does not bypass the raw-frame validator.

The TS main-only parser exercises the same27 synthetic JSON fixtures, snapshots
u64 as decimal strings and respects Uint8Array byteOffset. Additional tests cover
all truncated lengths/exact4MiB cap/finite extremes. This is not a reader, pipe,
ACL/nonce authentication, replay check, backpressure, clock map or PCM integration.
The current timeline TS draft's safeNumber epoch differs from this descriptor's
u64 epoch; future adapters must reconcile or refuse, never cast silently.
See [descriptor draft](../../project/AUDIO-FRAME-DRAFT.md). No library dependency,
hardware API, runtime import or binary channel is added to the application.
