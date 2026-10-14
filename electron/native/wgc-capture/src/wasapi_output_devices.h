#pragma once

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
