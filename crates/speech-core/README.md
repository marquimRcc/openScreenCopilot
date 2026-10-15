# speech-core foundation (draft)

Only sample-to-media timeline arithmetic, a bounded draft metadata registry and
isolated interleaved-to-mono downmix are implemented. No audio capture, resampling,
loudness normalization, VAD, model/provider, inference, sidecar, journal or UI integration.
The original timeline code uses the repository MIT license. Downmix is adapted from
meeting-copilot (Zackriya Solutions); its MIT notice is preserved in
[LICENSE-MEETING-COPILOT](LICENSE-MEETING-COPILOT). Vendor remains immutable.

The library uses std only. serde_json is a pinned test dependency for the exact same
JSON fixture exercised by electron/copilot/sourceTimeline.test.ts. Cargo.lock is
local to this isolated workspace; the compositor's workspace/lock are unchanged.
No build.rs, hardware API, model downloads or environment changes are required.

```text
cargo test --offline --locked --manifest-path crates/speech-core/Cargo.toml
cargo clippy --offline --locked --manifest-path crates/speech-core/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path crates/speech-core/Cargo.toml -- --check
```

Set CARGO_TARGET_DIR to a private ignored build directory when testing locally.
Initial validation used installed Rust/cargo1.98.1 on Windows, not a RegataOS test.
No new toolchain was installed. Root npm/Vitest and compositor CI do not automatically
exercise this separate workspace; explicit Rust tests are required until CI is wired.

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
Twenty-three Rust tests now pass in debug/release, including the original shared fixture.

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
