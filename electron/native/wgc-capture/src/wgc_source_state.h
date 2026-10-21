#pragma once

#include <atomic>
#include <cstdint>
#include <memory>

// Reason recorded when capture source closure is detected.
enum class WgcSourceCloseReason : int {
    None = 0,
    WinRtClosedEvent = 1,
    ProcessSignaled = 2,
    WindowHandleInvalid = 3,
    WindowOwnerMismatch = 4
};

inline const char* wgcSourceCloseReasonToString(WgcSourceCloseReason reason) {
    switch (reason) {
        case WgcSourceCloseReason::WinRtClosedEvent:
            return "winrt-closed-event";
        case WgcSourceCloseReason::ProcessSignaled:
            return "process-signaled";
        case WgcSourceCloseReason::WindowHandleInvalid:
            return "window-handle-invalid";
        case WgcSourceCloseReason::WindowOwnerMismatch:
            return "window-owner-mismatch";
        default:
            return "none";
    }
}

// Independent shared state for tracking WGC capture item closure.
// Captured by value (via std::shared_ptr) in the WinRT item.Closed event delegate,
// ensuring the state outlives WgcSession if the delegate runs late on a worker thread.
//
// The close latch is atomic: once marked closed, the initial reason is preserved
// via compare_exchange_strong and closed is stored with release semantics.
struct WgcSourceClosedState {
    std::atomic<bool> closed{false};
    std::atomic<int> reason{static_cast<int>(WgcSourceCloseReason::None)};

    void markClosed(WgcSourceCloseReason r) {
        int expected = static_cast<int>(WgcSourceCloseReason::None);
        reason.compare_exchange_strong(expected, static_cast<int>(r), std::memory_order_acq_rel);
        closed.store(true, std::memory_order_release);
    }

    WgcSourceCloseReason getReason() const {
        return static_cast<WgcSourceCloseReason>(reason.load(std::memory_order_acquire));
    }
};

// Pure decision function for evaluating source liveness.
//
// Architectural Limitations and Safety Guarantees:
// 1. Process Handle Liveness: If a process handle was opened with SYNCHRONIZE,
//    WaitForSingleObject returning WAIT_OBJECT_0 unequivocally proves process death.
//    The kernel guarantees the process object remains signaled once terminated.
// 2. WAIT_FAILED or Query Failures: WAIT_FAILED or GetWindowThreadProcessId returning 0
//    while IsWindow is true indicates an OS API query anomaly, NOT death. We deliberately
//    do NOT invent closure in this case and report a one-time warning instead.
// 3. HWND Recycling Limitation: If a target application destroys its window and immediately
//    creates a new window assigned the exact same HWND by USER32 on the same thread and
//    process between two consecutive polls, this is an inherent Win32 limitation. The 50ms
//    polling interval reduces this window of vulnerability, but cannot formally guarantee
//    detection of intra-thread HWND reuse.
// 4. No Heuristics: Dropped/stalled frames, window minimization (IsIconic), and window
//    invisibility (!IsWindowVisible) are NEVER treated as source closure.
// 5. Display Sources: Display capture does not track HWND/process liveness and returns alive.
inline bool evaluateSourceLiveness(
    bool winrtClosed,
    bool isWindowSource,
    bool hasProcessHandle,
    uint32_t processWaitResult,
    bool isWindowValid,
    uint32_t currentPid,
    uint32_t currentTid,
    uint32_t originalPid,
    uint32_t originalTid,
    WgcSourceCloseReason* outReason = nullptr,
    bool* outWarningWaitFailed = nullptr,
    bool* outWarningQueryFailed = nullptr) {

    if (winrtClosed) {
        if (outReason) *outReason = WgcSourceCloseReason::WinRtClosedEvent;
        return false;
    }

    // Display capture does not track HWND/process liveness.
    if (!isWindowSource) {
        if (outReason) *outReason = WgcSourceCloseReason::None;
        return true;
    }

    // Win32 constants: WAIT_OBJECT_0 = 0x0, WAIT_FAILED = 0xFFFFFFFF
    constexpr uint32_t kWaitObject0 = 0x00000000;
    constexpr uint32_t kWaitFailed = 0xFFFFFFFF;

    // 1. Process termination check via synchronized process handle
    if (hasProcessHandle) {
        if (processWaitResult == kWaitObject0) {
            if (outReason) *outReason = WgcSourceCloseReason::ProcessSignaled;
            return false;
        }
        if (processWaitResult == kWaitFailed) {
            if (outWarningWaitFailed) *outWarningWaitFailed = true;
        }
    }

    // 2. Window validity check
    if (!isWindowValid) {
        if (outReason) *outReason = WgcSourceCloseReason::WindowHandleInvalid;
        return false;
    }

    // 3. Window owner identity check
    if (currentPid == 0 || currentTid == 0) {
        if (outWarningQueryFailed) *outWarningQueryFailed = true;
        if (outReason) *outReason = WgcSourceCloseReason::None;
        return true; // Unknown query state while window is valid; do NOT invent closure
    }

    if (currentPid != originalPid || currentTid != originalTid) {
        if (outReason) *outReason = WgcSourceCloseReason::WindowOwnerMismatch;
        return false;
    }

    if (outReason) *outReason = WgcSourceCloseReason::None;
    return true;
}

enum class WgcPullFrameDecision {
    ProcessNewFrame,
    RepeatStaticFrame,
    WaitForInitialFrame,
    StopDueToSourceClosed,
    StopDueToControlOrFailure
};

inline WgcPullFrameDecision evaluatePullFrameDecision(
    bool stopRequested,
    bool encodeFailed,
    bool sourceClosed,
    bool gotFrame,
    bool hasLatestTexture) {
    if (stopRequested || encodeFailed) {
        return WgcPullFrameDecision::StopDueToControlOrFailure;
    }
    if (sourceClosed) {
        return WgcPullFrameDecision::StopDueToSourceClosed;
    }
    if (gotFrame) {
        return WgcPullFrameDecision::ProcessNewFrame;
    }
    if (!hasLatestTexture) {
        return WgcPullFrameDecision::WaitForInitialFrame;
    }
    return WgcPullFrameDecision::RepeatStaticFrame;
}

inline bool evaluateLegacyWaitPredicate(
    bool stopRequested,
    bool encodeFailed,
    bool sourceClosed,
    bool isPaused,
    bool hasLatestTexture) {
    return stopRequested || encodeFailed || sourceClosed || (!isPaused && hasLatestTexture);
}

inline bool shouldBreakPauseForSourceClose(bool isPaused, bool sourceClosed) {
    return isPaused && sourceClosed;
}

inline bool shouldContinueStartupWait(
    bool firstVideoSampleSubmitted,
    bool stopRequested,
    bool sourceClosed) {
    return !firstVideoSampleSubmitted && !stopRequested && !sourceClosed;
}
