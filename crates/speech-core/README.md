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
One hundred Rust unit tests now pass in debug/release, including the original shared fixtures.

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

`downmix_f32le` shares the same private implementation with native f32 input:
explicit little-endian decoding of unaligned bytes, no unsafe casts and no
intermediate interleaved f32 copy. Partial scalar/frame and excluded-channel NaN
still fail before allocation. Mono allocation is now fallible; refusal or wrong
allocator shape is an explicit error, not partial output. Five additional tests
cover format/alignment/extremes/partitions/exact cap/refusal. Raw Vec output alone
has no global lease; caller must account its lifetime if using that low-level API.

`mono_frame::downmix_owned_frame` is the optional budgeted boundary. It requires
an immutable decoded input already leased to the EXACT same pool (nonce equality
alone is insufficient). It reserves output before allocation and retains input;
no premature release to make the copy fit. OwnedMonoFrame frees samples before its
lease. Metadata preserves source/epoch/sequence/rate/sample range/count, changing
only channels/payloadBytes. This is mono at the original rate, NOT resampling or
automatic16k provider input. Five tests verify either ownership release order,
capacity/duration/closed/foreign pool refusal and failed/invalid allocator cleanup.

Input+output duration/work is conservatively counted twice while both exist, not
extra media time. Capacity fails immediately: future host policy must avoid holding
all inputs while indefinitely waiting for output that cannot fit. Charges include
a header-sized allowance but not allocator/metadata overhead, therefore NOT RSS.
No capture/normalizer runtime or model was connected by this boundary.

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

## Incremental decoder v0 (still no pipe)

`audio_decoder_v0.rs` and the independent TS decoder now assemble one frame from
fragments. Schema/caps/trusted expectation/order are validated before payload
allocation. Ready blocks feed until ownership handoff; no internal frame queue.
Source/epoch/rate/channels are fixed per instance, sequence/start exact, no u64 wrap.
EOF partial fails, ready survives clean EOF, stop discards only still-owned data.
Rust allocation is fallible; tests inject refusal, not actual OOM. None of these
operations cancel/drain a worker or prove sender authentication/durable ACK.

Owned audio buffers are bounded to payloadcap+160bytes, excluding metadata,
allocator/GC, external input queue and frames already taken by caller. Nine Rust
tests include exact4MiB cap, every split/EOF, two coalesced frames, invalid binding
before allocation, failure/stop/busy and sequence exhaustion. Ten TS decoder tests
add primitive expectation snapshot/input alias checks and allocation refusal.
No process/transport is opened and no PCM is sent to the renderer. Journal and
actual host/provider supervision remain gates.

## Optional Rust transport-buffer accounting

`transport_budget.rs` is a session-scoped shared admission pool, not account usage,
authentication, a durable ACK or a whole-process RAM limit. Caller supplies positive
global/source byte and sample-frame bounds plus an in-flight count. Prototype hard
caps are64MiB/4096leases, not negotiated production settings. The two source-role
caps aggregate all epochs; replacing an epoch does not release retained old audio.
Sample frames are work counts, not equal-duration units across different rates.

`AudioDecoderV0::with_budget` reserves a complete frame before allocating payload.
Temporary capacity exhaustion retains only the fixed header, consumes no payload,
and requires explicit `retry_budget` after a capacity-change notification. An optional
bounded future is described below; no polling loop or input queue is implemented. An impossible cost is terminal rather
than an infinite wait. The non-cloneable lease moves with pending/ready/handed-off
frame ownership and releases only after its bytes are freed. Stop cannot reclaim
a consumer-owned frame. Pool close blocks new admissions without revoking owners;
poisoned/broken accounting fails closed. Cancellation of workers is still external.

Eight pool and six decoder integration tests cover exact caps, concurrent
admission, overflow, scope, epochs, handoff, waiting/stop, allocation failure and
EOF cleanup, malformed PCM, dropped owners and10,000 deterministic operations
against an independent accounting model. Rust OwnedFrame exposes metadata only
as a value snapshot, with immutable byte access; neither can detach its reservation.
The TS decoder has NO shared-pool integration yet. Input chunks,
header scratch/metadata, normalized copies and engine allocations remain outside
this accounting; future host must bound them and the number of decoder instances.

Optional `with_audio_time_limits` adds global/source summed audio nanosecond bounds.
The decoder calls `try_reserve_frame`, which reparses the fixed raw header and
derives byte/frame/time costs before allocation. Generic untyped reservations are
refused in a time-limited pool. Duration is ceil(frame_count*1e9/sample_rate), with
u128 intermediates and checked sums; channels do not multiply audio duration.
Per-packet rounding is conservative, deliberately NOT partition-invariant timeline
math, PTS or wall-clock latency. Packetized audio may hit its cap earlier than a
coalesced frame. Leases retain/release duration across epochs and ownership handoff.
Four additional pool tests and one decoder test cover mixed rates, exact duration
caps, no-free tiny packets, invalid/untyped requests and waiting/PCM-error cleanup.
No host policy is chosen, no transport/model is opened and no TS integration exists.

## Optional capacity-change future (not a host executor)

`budget_change.rs` adds `observe_change` and `wait_for_change`. Observe BEFORE
attempting admission; after Capacity, await the change and recheck admission.
The private revision and registration share the accounting mutex, so a release
before registration/first poll is already visible. One registered waiter per
source role, two fixed slots total, no dynamic waiter queue or FIFO/fairness.
Ready means change, NOT a reservation or promise that a retry fits. A same-role
duplicate returns WaiterBusy. Tokens are bound to the exact pool, not just nonce.

Release/close wake both registered roles outside the mutex; repeated close is
idempotent. Dropping a future removes only its own registration, not a buffer,
inference or writer. Overflow fails closed rather than wrapping. Trusted executor
wakers are cloned/dropped outside the lock; wake panics are contained at the lease
destructor boundary. Poisoned mutexes still require external supervision/deadlines;
notification alone cannot guarantee recovery or cancellation of a stuck executor.

Eight notification tests plus one decoder integration test cover release before
registration/poll, replacing wakers, close/cancel, old/new registration identity,
reentrant callbacks, counter exhaustion and100 concurrent schedules. No sleep or
input polling is used in those tests. Host/TS/pipe/worker supervision is NOT wired;
number of decoder instances, external chunks and completed futures remain host
responsibilities, not whole-pipeline RAM guarantees. Retry is still explicit.

## Isolated provider admission (no engine or worker supervisor)

`provider_admission.rs` optionally bounds simultaneous managed calls1..16 (prototype
cap, not a production setting). Host must share ONE gate for the actual engine;
unmanaged calls, another gate or the inherited STT are NOT globally protected.
There is no queue, executor, model, download, retry or PCM routing here.

Reservation precedes provider entry. The existing checked provider future is
awaited even on late cancellation, and a slot is returned only after it resolves.
Errors/invalid results also release after resolution. Pre-canceled/unpolled work
never enters. Close stops new admission, not existing calls; it is not a drain.

Dropping an entered managed future or a provider panic marks the gate uncertain
and keeps that call charged. Known other calls may complete, but cannot erase
the abandoned charge. No reset/reopen; constructing a new gate does NOT prove
the old worker stopped. `active` is charged calls, not physical thread count;
zero alone is not shutdown evidence if state is uncertain/poisoned. This is
fail-closed bookkeeping, NOT worker cancellation/recovery or process exit.

Nine fake-provider tests cover concurrency, inclusive cap, pre/late cancellation,
close, error/result refusal, future drop, panic and poison. Real engine ownership,
timeouts, resource/memory budgets and integration with legacy STT still need host
supervision and roadmap gates. Borrowed requests retain caller-owned PCM; this
module neither copies it nor sets a whole-process memory ceiling.

## In-memory component integration (synthetic only)

`tests/core_pipeline.rs` joins the existing raw decoder, exact shared pool,
OwnedMonoFrame, checked request and managed fake slow provider. Three tests keep
input+output at184 charged bytes, refuse the next copy until prior output drops,
observe/await capacity change, and retain canceled work until provider completion.
Original48k mono is explicitly refused by the16k request constructor; declaring
synthetic input16k is NOT resampling48k. No origin counters are replaced by arrival
time and no sample range is converted to a different rate.

These are100 unit +3 component-integration +8 resampling-spike tests, passing
debug/release/offline/locked/clippy/fmt locally. Manual polling drives only fake
futures, no model/worker/process/pipe/journal/file transport or real30min ASR.
Clippy flagged two unnecessary drops of a borrowed request; corrected and revalidated.
This does not qualify GUI, natural speech, timestamps or worker shutdown.
