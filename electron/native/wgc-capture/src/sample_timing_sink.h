#pragma once

#include <mfidl.h>
#include <wrl/client.h>

#include <cstdint>
#include <map>
#include <memory>
#include <mutex>

// Bounded metadata only. MFT output can arrive asynchronously, so never use
// MFEncoder's writer mutex here.
class VideoSampleTimings {
public:
    HRESULT remember(IMFSample* sample);
    HRESULT restore(IMFSample* sample);
    uint64_t corrections() const;
    size_t pending() const;
private:
    mutable std::mutex mutex_;
    std::map<LONGLONG, LONGLONG> durations_;
    uint64_t corrections_ = 0;
};

// Restore source durations AFTER the MFT and BEFORE the fragmented MP4 sink.
HRESULT createVideoTimingSink(
    IMFMediaSink* inner, const std::shared_ptr<VideoSampleTimings>& timings,
    Microsoft::WRL::ComPtr<IMFMediaSink>& output);
