#pragma once

#include <Windows.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>

#include <string>
#include <vector>

struct WasapiOutputDevice {
    std::wstring id;
    std::wstring name;
    bool isDefault = false;
};

// Caller owns a COM apartment. Enumeration does not activate an audio stream.
// A failed snapshot is never returned as an empty successful list.
bool enumerateWasapiOutputDevices(std::vector<WasapiOutputDevice>& devices);

// Resolve once, and refuse wrong-flow/inactive/missing explicit devices. No stream.
bool resolveWasapiOutputDevice(const std::wstring& requestedId,
    Microsoft::WRL::ComPtr<IMMDevice>& device, WasapiOutputDevice& info);
