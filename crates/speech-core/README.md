# speech-core foundation (draft)

Only sample-to-media timeline arithmetic and a bounded draft metadata registry
are implemented. No audio capture,
normalization, VAD, model/provider, inference, sidecar, journal or UI integration.
This original code does not copy DSP/provider code from the frozen vendor snapshot.
MIT license from the repository applies; future extractions must retain provenance.

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
Fourteen Rust tests now pass in debug/release, including the original shared fixture.
