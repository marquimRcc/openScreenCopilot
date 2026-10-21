#include "wgc_source_state.h"

#include <chrono>
#include <cstdlib>
#include <functional>
#include <iostream>
#include <memory>
#include <thread>

namespace {

void checkCondition(bool condition, const char* expr, const char* file, int line) {
    if (!condition) {
        std::cerr << "CHECK FAILED: " << expr << " at " << file << ":" << line << std::endl;
        std::exit(1);
    }
}

#define REQUIRE(expr) checkCondition((expr), #expr, __FILE__, __LINE__)

void testLifetimeAndWeakPtrExpiration() {
    std::shared_ptr<WgcSourceClosedState> ownerState = std::make_shared<WgcSourceClosedState>();
    std::weak_ptr<WgcSourceClosedState> weakObserver = ownerState;
    REQUIRE(!weakObserver.expired());
    REQUIRE(!ownerState->closed.load(std::memory_order_acquire));

    // Callback captures shared_ptr by value, independent of owner's reference
    std::function<void()> callback = [capturedState = ownerState]() {
        if (capturedState) {
            capturedState->markClosed(WgcSourceCloseReason::WinRtClosedEvent);
        }
    };

    // Release the owner's reference (simulating WgcSession destruction)
    ownerState.reset();
    REQUIRE(!weakObserver.expired());

    // Execute callback on a synthetic finite worker thread (simulating an async callback)
    std::thread worker([cb = callback]() {
        std::this_thread::sleep_for(std::chrono::milliseconds(5));
        cb();
    });
    worker.join();

    REQUIRE(weakObserver.lock()->closed.load(std::memory_order_acquire));
    REQUIRE(weakObserver.lock()->getReason() == WgcSourceCloseReason::WinRtClosedEvent);

    // Releasing the remaining callback reference must cleanly expire the weak_ptr
    callback = nullptr;
    REQUIRE(weakObserver.expired());
}

void testCrossSessionIsolationLateCallback() {
    auto session1State = std::make_shared<WgcSourceClosedState>();
    std::function<void()> session1Callback = [state = session1State]() {
        if (state) {
            state->markClosed(WgcSourceCloseReason::WinRtClosedEvent);
        }
    };

    // Session 2 is created with fresh independent state
    auto session2State = std::make_shared<WgcSourceClosedState>();
    REQUIRE(!session1State->closed.load());
    REQUIRE(!session2State->closed.load());

    // Late callback from Session 1 fires (e.g. from WinRT thread pool)
    session1Callback();

    // Session 1 state reflects closure; Session 2 remains unaffected
    REQUIRE(session1State->closed.load() == true);
    REQUIRE(session1State->getReason() == WgcSourceCloseReason::WinRtClosedEvent);
    REQUIRE(session2State->closed.load() == false);
    REQUIRE(session2State->getReason() == WgcSourceCloseReason::None);
}

void testAtomicCloseReasonLatch() {
    WgcSourceClosedState state;
    REQUIRE(!state.closed.load());
    REQUIRE(state.getReason() == WgcSourceCloseReason::None);

    // First latch sets reason
    state.markClosed(WgcSourceCloseReason::ProcessSignaled);
    REQUIRE(state.closed.load());
    REQUIRE(state.getReason() == WgcSourceCloseReason::ProcessSignaled);

    // Subsequent calls cannot overwrite the first reason
    state.markClosed(WgcSourceCloseReason::WindowHandleInvalid);
    REQUIRE(state.closed.load());
    REQUIRE(state.getReason() == WgcSourceCloseReason::ProcessSignaled);
}

void testSourceLivenessEvaluation() {
    WgcSourceCloseReason reason = WgcSourceCloseReason::None;
    bool warnWait = false;
    bool warnQuery = false;

    constexpr uint32_t kWaitObject0 = 0x00000000;
    constexpr uint32_t kWaitTimeout = 0x00000102;
    constexpr uint32_t kWaitFailed = 0xFFFFFFFF;
    const uint32_t origPid = 1234;
    const uint32_t origTid = 5678;

    // 1. WinRT closed event takes precedence over everything
    reason = WgcSourceCloseReason::None;
    bool alive = evaluateSourceLiveness(
        true, true, true, kWaitTimeout, true, origPid, origTid, origPid, origTid, &reason);
    REQUIRE(!alive);
    REQUIRE(reason == WgcSourceCloseReason::WinRtClosedEvent);

    // 2. Display source: never closed by window/process liveness
    reason = WgcSourceCloseReason::None;
    alive = evaluateSourceLiveness(
        false, false, false, kWaitTimeout, false, 0, 0, 0, 0, &reason);
    REQUIRE(alive);
    REQUIRE(reason == WgcSourceCloseReason::None);

    // 3. Original process dead (WaitForSingleObject returned WAIT_OBJECT_0)
    reason = WgcSourceCloseReason::None;
    alive = evaluateSourceLiveness(
        false, true, true, kWaitObject0, true, origPid, origTid, origPid, origTid, &reason);
    REQUIRE(!alive);
    REQUIRE(reason == WgcSourceCloseReason::ProcessSignaled);

    // 4. WAIT_FAILED with window valid: must NOT be treated as death; one-time warning flag set
    reason = WgcSourceCloseReason::None;
    warnWait = false;
    alive = evaluateSourceLiveness(
        false, true, true, kWaitFailed, true, origPid, origTid, origPid, origTid, &reason, &warnWait);
    REQUIRE(alive);
    REQUIRE(warnWait);
    REQUIRE(reason == WgcSourceCloseReason::None);

    // 5. Query returns 0 PID/TID with window valid: must NOT be treated as death; warning flag set
    reason = WgcSourceCloseReason::None;
    warnQuery = false;
    alive = evaluateSourceLiveness(
        false, true, true, kWaitTimeout, true, 0, origTid, origPid, origTid, &reason, nullptr, &warnQuery);
    REQUIRE(alive);
    REQUIRE(warnQuery);
    REQUIRE(reason == WgcSourceCloseReason::None);

    warnQuery = false;
    alive = evaluateSourceLiveness(
        false, true, true, kWaitTimeout, true, origPid, 0, origPid, origTid, &reason, nullptr, &warnQuery);
    REQUIRE(alive);
    REQUIRE(warnQuery);
    REQUIRE(reason == WgcSourceCloseReason::None);

    // 6. Owner PID mismatch (HWND recycled by another process)
    reason = WgcSourceCloseReason::None;
    alive = evaluateSourceLiveness(
        false, true, true, kWaitTimeout, true, 9999, origTid, origPid, origTid, &reason);
    REQUIRE(!alive);
    REQUIRE(reason == WgcSourceCloseReason::WindowOwnerMismatch);

    // 7. Owner TID mismatch (HWND recycled by another thread)
    reason = WgcSourceCloseReason::None;
    alive = evaluateSourceLiveness(
        false, true, true, kWaitTimeout, true, origPid, 8888, origPid, origTid, &reason);
    REQUIRE(!alive);
    REQUIRE(reason == WgcSourceCloseReason::WindowOwnerMismatch);

    // 8. Window invalid (IsWindow returned false)
    reason = WgcSourceCloseReason::None;
    alive = evaluateSourceLiveness(
        false, true, true, kWaitTimeout, false, origPid, origTid, origPid, origTid, &reason);
    REQUIRE(!alive);
    REQUIRE(reason == WgcSourceCloseReason::WindowHandleInvalid);

    // 9. Healthy window and process
    reason = WgcSourceCloseReason::None;
    warnWait = false;
    warnQuery = false;
    alive = evaluateSourceLiveness(
        false, true, true, kWaitTimeout, true, origPid, origTid, origPid, origTid, &reason, &warnWait, &warnQuery);
    REQUIRE(alive);
    REQUIRE(reason == WgcSourceCloseReason::None);
    REQUIRE(!warnWait);
    REQUIRE(!warnQuery);

    // 10. Degraded mode without process handle (OpenProcess failed at startup)
    // Healthy state:
    reason = WgcSourceCloseReason::None;
    alive = evaluateSourceLiveness(
        false, true, false, kWaitTimeout, true, origPid, origTid, origPid, origTid, &reason);
    REQUIRE(alive);
    REQUIRE(reason == WgcSourceCloseReason::None);
    // When window destroyed in degraded mode:
    reason = WgcSourceCloseReason::None;
    alive = evaluateSourceLiveness(
        false, true, false, kWaitTimeout, false, origPid, origTid, origPid, origTid, &reason);
    REQUIRE(!alive);
    REQUIRE(reason == WgcSourceCloseReason::WindowHandleInvalid);
}

void testPullFrameDecisions() {
    // Stop requested or encode failure
    REQUIRE(evaluatePullFrameDecision(true, false, false, true, true) ==
            WgcPullFrameDecision::StopDueToControlOrFailure);
    REQUIRE(evaluatePullFrameDecision(false, true, false, true, true) ==
            WgcPullFrameDecision::StopDueToControlOrFailure);

    // Source closed takes precedence over frame arrival or static repetition
    REQUIRE(evaluatePullFrameDecision(false, false, true, true, true) ==
            WgcPullFrameDecision::StopDueToSourceClosed);
    REQUIRE(evaluatePullFrameDecision(false, false, true, false, true) ==
            WgcPullFrameDecision::StopDueToSourceClosed);
    REQUIRE(evaluatePullFrameDecision(false, false, true, false, false) ==
            WgcPullFrameDecision::StopDueToSourceClosed);

    // Process new frame
    REQUIRE(evaluatePullFrameDecision(false, false, false, true, false) ==
            WgcPullFrameDecision::ProcessNewFrame);
    REQUIRE(evaluatePullFrameDecision(false, false, false, true, true) ==
            WgcPullFrameDecision::ProcessNewFrame);

    // Null sample / no frame yet arrived
    REQUIRE(evaluatePullFrameDecision(false, false, false, false, false) ==
            WgcPullFrameDecision::WaitForInitialFrame);

    // Static scene: no new WGC frame arrived, but last texture exists
    REQUIRE(evaluatePullFrameDecision(false, false, false, false, true) ==
            WgcPullFrameDecision::RepeatStaticFrame);
}

void testPauseDecisionLogic() {
    REQUIRE(!shouldBreakPauseForSourceClose(true, false));
    REQUIRE(shouldBreakPauseForSourceClose(true, true));
    REQUIRE(!shouldBreakPauseForSourceClose(false, true));

    // Bounded thread test verifying pause break on source closure
    WgcSourceClosedState closedState;
    std::atomic<bool> pauseBroken = false;
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(500);

    std::thread pauseThread([&]() {
        while (std::chrono::steady_clock::now() < deadline) {
            if (shouldBreakPauseForSourceClose(true, closedState.closed.load(std::memory_order_acquire))) {
                pauseBroken.store(true, std::memory_order_release);
                break;
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(2));
        }
    });

    std::this_thread::sleep_for(std::chrono::milliseconds(10));
    closedState.markClosed(WgcSourceCloseReason::ProcessSignaled);

    pauseThread.join();
    REQUIRE(pauseBroken.load());
    REQUIRE(closedState.getReason() == WgcSourceCloseReason::ProcessSignaled);
}

void testLegacyWaitPredicateLogic() {
    // Idle wait: no events, no texture
    REQUIRE(!evaluateLegacyWaitPredicate(false, false, false, false, false));

    // Idle wait during pause: texture exists but paused
    REQUIRE(!evaluateLegacyWaitPredicate(false, false, false, true, true));

    // Normal frame arrival when not paused
    REQUIRE(evaluateLegacyWaitPredicate(false, false, false, false, true));

    // Source closed while waiting (active or paused)
    REQUIRE(evaluateLegacyWaitPredicate(false, false, true, false, false));
    REQUIRE(evaluateLegacyWaitPredicate(false, false, true, true, false));

    // Stop requested or encode failure
    REQUIRE(evaluateLegacyWaitPredicate(true, false, false, false, false));
    REQUIRE(evaluateLegacyWaitPredicate(false, true, false, false, false));
}

void testStartupWaitDecisionLogic() {
    // Startup waiting for first submitted sample
    REQUIRE(shouldContinueStartupWait(false, false, false));

    // First sample submitted: startup wait successfully finishes
    REQUIRE(!shouldContinueStartupWait(true, false, false));

    // Source closed before first sample submitted: startup wait aborts
    REQUIRE(!shouldContinueStartupWait(false, false, true));

    // Stop requested before first sample submitted: startup wait aborts
    REQUIRE(!shouldContinueStartupWait(false, true, false));

    // Multiple flags set
    REQUIRE(!shouldContinueStartupWait(true, false, true));
}

} // namespace

int main() {
    std::cout << "[test] Running WGC source close state tests..." << std::endl;
    testLifetimeAndWeakPtrExpiration();
    testCrossSessionIsolationLateCallback();
    testAtomicCloseReasonLatch();
    testSourceLivenessEvaluation();
    testPullFrameDecisions();
    testPauseDecisionLogic();
    testLegacyWaitPredicateLogic();
    testStartupWaitDecisionLogic();
    std::cout << "[test] All WGC source close state tests passed." << std::endl;
    return 0;
}
