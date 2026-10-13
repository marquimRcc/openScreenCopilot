#include "sample_timing_sink.h"

#include <mfapi.h>
#include <mferror.h>

#include <atomic>
#include <iostream>
#include <vector>

using Microsoft::WRL::ComPtr;

HRESULT VideoSampleTimings::remember(IMFSample* sample) {
    if (!sample) return E_POINTER;
    LONGLONG time = 0, duration = 0;
    HRESULT hr = sample->GetSampleTime(&time);
    if (FAILED(hr)) return hr;
    hr = sample->GetSampleDuration(&duration);
    if (FAILED(hr)) return hr;
    if (duration <= 0) return E_INVALIDARG;
    std::scoped_lock lock(mutex_);
    // Far beyond normal transform delay; never accumulate a recording in RAM
    // for a broken MFT that accepts frames but emits nothing.
    if (durations_.size() >= 512 || durations_.contains(time)) return E_UNEXPECTED;
    durations_.emplace(time, duration);
    return S_OK;
}

HRESULT VideoSampleTimings::restore(IMFSample* sample) {
    if (!sample) return E_POINTER;
    LONGLONG time = 0;
    HRESULT hr = sample->GetSampleTime(&time);
    if (FAILED(hr)) return hr;
    std::scoped_lock lock(mutex_);
    const auto entry = durations_.find(time);
    if (entry == durations_.end()) {
        std::cerr << "ERROR: Encoded video sample has no matching input timestamp." << std::endl;
        return E_UNEXPECTED;
    }
    LONGLONG encodedDuration = 0;
    if (FAILED(sample->GetSampleDuration(&encodedDuration)) || encodedDuration != entry->second) {
        if (corrections_ == 0) {
            std::cerr << "INFO: Restoring video sample durations after the encoder: first PTS="
                      << time << ", encoded duration=" << encodedDuration
                      << ", capture duration=" << entry->second << " (100 ns)." << std::endl;
        }
        hr = sample->SetSampleDuration(entry->second);
        if (FAILED(hr)) return hr;
        ++corrections_;
    }
    durations_.erase(entry);
    return S_OK;
}

uint64_t VideoSampleTimings::corrections() const {
    std::scoped_lock lock(mutex_);
    return corrections_;
}

size_t VideoSampleTimings::pending() const {
    std::scoped_lock lock(mutex_);
    return durations_.size();
}

namespace {

class TimingStreamSink final : public IMFStreamSink {
public:
    TimingStreamSink(IMFStreamSink* inner, IMFMediaSink* parent,
                     std::shared_ptr<VideoSampleTimings> timings)
        : inner_(inner), parent_(parent), timings_(std::move(timings)) {}
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** out) override {
        if (!out) return E_POINTER;
        *out = nullptr;
        if (iid == __uuidof(IUnknown) || iid == __uuidof(IMFStreamSink))
            *out = static_cast<IMFStreamSink*>(this);
        else if (iid == __uuidof(IMFMediaEventGenerator))
            *out = static_cast<IMFMediaEventGenerator*>(this);
        else return E_NOINTERFACE;
        AddRef();
        return S_OK;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
    ULONG STDMETHODCALLTYPE Release() override {
        const ULONG count = --refs_;
        if (!count) delete this;
        return count;
    }
    HRESULT STDMETHODCALLTYPE GetEvent(DWORD flags, IMFMediaEvent** event) override {
        return inner_->GetEvent(flags, event);
    }
    HRESULT STDMETHODCALLTYPE BeginGetEvent(IMFAsyncCallback* callback, IUnknown* state) override {
        return inner_->BeginGetEvent(callback, state);
    }
    HRESULT STDMETHODCALLTYPE EndGetEvent(IMFAsyncResult* result, IMFMediaEvent** event) override {
        return inner_->EndGetEvent(result, event);
    }
    HRESULT STDMETHODCALLTYPE QueueEvent(MediaEventType type, REFGUID extended, HRESULT status,
                                         const PROPVARIANT* value) override {
        return inner_->QueueEvent(type, extended, status, value);
    }
    HRESULT STDMETHODCALLTYPE GetMediaSink(IMFMediaSink** sink) override {
        if (!sink) return E_POINTER;
        return parent_.CopyTo(sink);
    }
    HRESULT STDMETHODCALLTYPE GetIdentifier(DWORD* id) override { return inner_->GetIdentifier(id); }
    HRESULT STDMETHODCALLTYPE GetMediaTypeHandler(IMFMediaTypeHandler** handler) override {
        return inner_->GetMediaTypeHandler(handler);
    }
    HRESULT STDMETHODCALLTYPE ProcessSample(IMFSample* sample) override {
        const HRESULT hr = timings_->restore(sample);
        return FAILED(hr) ? hr : inner_->ProcessSample(sample);
    }
    HRESULT STDMETHODCALLTYPE PlaceMarker(MFSTREAMSINK_MARKER_TYPE type, const PROPVARIANT* value,
                                          const PROPVARIANT* context) override {
        return inner_->PlaceMarker(type, value, context);
    }
    HRESULT STDMETHODCALLTYPE Flush() override { return inner_->Flush(); }
private:
    std::atomic<ULONG> refs_{1};
    ComPtr<IMFStreamSink> inner_;
    ComPtr<IMFMediaSink> parent_;
    std::shared_ptr<VideoSampleTimings> timings_;
};

class TimingMediaSink final : public IMFFinalizableMediaSink {
public:
    explicit TimingMediaSink(IMFMediaSink* inner) : inner_(inner) { inner_.As(&finalizable_); }
    HRESULT initialize(const std::shared_ptr<VideoSampleTimings>& timings) {
        DWORD count = 0;
        HRESULT hr = inner_->GetStreamSinkCount(&count);
        if (FAILED(hr)) return hr;
        for (DWORD index = 0; index < count; ++index) {
            ComPtr<IMFStreamSink> stream;
            hr = inner_->GetStreamSinkByIndex(index, &stream);
            if (FAILED(hr)) return hr;
            ComPtr<IMFMediaTypeHandler> handler;
            hr = stream->GetMediaTypeHandler(&handler);
            if (FAILED(hr)) return hr;
            GUID major{};
            hr = handler->GetMajorType(&major);
            if (FAILED(hr)) return hr;
            if (major == MFMediaType_Video) {
                ComPtr<IMFStreamSink> wrapped;
                wrapped.Attach(new TimingStreamSink(stream.Get(), this, timings));
                streams_.push_back(std::move(wrapped));
            } else streams_.push_back(std::move(stream));
        }
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** out) override {
        if (!out) return E_POINTER;
        *out = nullptr;
        if (iid == __uuidof(IUnknown) || iid == __uuidof(IMFMediaSink))
            *out = static_cast<IMFMediaSink*>(this);
        else if (iid == __uuidof(IMFFinalizableMediaSink) && finalizable_)
            *out = static_cast<IMFFinalizableMediaSink*>(this);
        else return E_NOINTERFACE;
        AddRef();
        return S_OK;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
    ULONG STDMETHODCALLTYPE Release() override {
        const ULONG count = --refs_;
        if (!count) delete this;
        return count;
    }
    HRESULT STDMETHODCALLTYPE GetCharacteristics(DWORD* flags) override {
        return inner_->GetCharacteristics(flags);
    }
    HRESULT STDMETHODCALLTYPE AddStreamSink(DWORD, IMFMediaType*, IMFStreamSink**) override {
        return MF_E_STREAMSINKS_FIXED;
    }
    HRESULT STDMETHODCALLTYPE RemoveStreamSink(DWORD) override { return MF_E_STREAMSINKS_FIXED; }
    HRESULT STDMETHODCALLTYPE GetStreamSinkCount(DWORD* count) override {
        if (!count) return E_POINTER;
        *count = static_cast<DWORD>(streams_.size());
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE GetStreamSinkByIndex(DWORD index, IMFStreamSink** sink) override {
        if (!sink) return E_POINTER;
        *sink = nullptr;
        if (index >= streams_.size()) return MF_E_INVALIDINDEX;
        return streams_[index].CopyTo(sink);
    }
    HRESULT STDMETHODCALLTYPE GetStreamSinkById(DWORD id, IMFStreamSink** sink) override {
        if (!sink) return E_POINTER;
        *sink = nullptr;
        for (const auto& stream : streams_) {
            DWORD candidate = 0;
            if (SUCCEEDED(stream->GetIdentifier(&candidate)) && candidate == id) return stream.CopyTo(sink);
        }
        return MF_E_INVALIDSTREAMNUMBER;
    }
    HRESULT STDMETHODCALLTYPE SetPresentationClock(IMFPresentationClock* clock) override {
        return inner_->SetPresentationClock(clock);
    }
    HRESULT STDMETHODCALLTYPE GetPresentationClock(IMFPresentationClock** clock) override {
        return inner_->GetPresentationClock(clock);
    }
    HRESULT STDMETHODCALLTYPE Shutdown() override {
        const HRESULT hr = inner_->Shutdown();
        // Break the deliberate media-sink/stream-sink parent reference cycle.
        streams_.clear();
        return hr;
    }
    HRESULT STDMETHODCALLTYPE BeginFinalize(IMFAsyncCallback* callback, IUnknown* state) override {
        return finalizable_ ? finalizable_->BeginFinalize(callback, state) : E_NOINTERFACE;
    }
    HRESULT STDMETHODCALLTYPE EndFinalize(IMFAsyncResult* result) override {
        return finalizable_ ? finalizable_->EndFinalize(result) : E_NOINTERFACE;
    }
private:
    std::atomic<ULONG> refs_{1};
    ComPtr<IMFMediaSink> inner_;
    ComPtr<IMFFinalizableMediaSink> finalizable_;
    std::vector<ComPtr<IMFStreamSink>> streams_;
};

} // namespace

HRESULT createVideoTimingSink(IMFMediaSink* inner, const std::shared_ptr<VideoSampleTimings>& timings,
                             ComPtr<IMFMediaSink>& output) {
    if (!inner || !timings) return E_POINTER;
    ComPtr<TimingMediaSink> proxy;
    proxy.Attach(new TimingMediaSink(inner));
    const HRESULT hr = proxy->initialize(timings);
    if (FAILED(hr)) {
        proxy->Shutdown();
        return hr;
    }
    return proxy.As(&output);
}
