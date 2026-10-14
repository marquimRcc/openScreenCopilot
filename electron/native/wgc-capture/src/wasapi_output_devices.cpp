#include "wasapi_output_devices.h"

#include <Windows.h>
#include <mmdeviceapi.h>
#include <Functiondiscoverykeys_devpkey.h>
#include <propvarutil.h>
#include <wrl/client.h>
#include <utility>

bool enumerateWasapiOutputDevices(std::vector<WasapiOutputDevice>& devices) {
    using Microsoft::WRL::ComPtr;
    devices.clear();
    ComPtr<IMMDeviceEnumerator> enumerator;
    if (FAILED(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                                IID_PPV_ARGS(&enumerator)))) {
        return false;
    }

    std::wstring defaultId;
    ComPtr<IMMDevice> defaultDevice;
    const HRESULT defaultHr = enumerator->GetDefaultAudioEndpoint(eRender, eConsole, &defaultDevice);
    if (SUCCEEDED(defaultHr)) {
        LPWSTR id = nullptr;
        const HRESULT idHr = defaultDevice->GetId(&id);
        if (SUCCEEDED(idHr) && id) defaultId = id;
        CoTaskMemFree(id);
        if (FAILED(idHr) || defaultId.empty()) return false;
    } else if (defaultHr != HRESULT_FROM_WIN32(ERROR_NOT_FOUND)) {
        return false;
    }

    ComPtr<IMMDeviceCollection> collection;
    if (FAILED(enumerator->EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE, &collection))) return false;
    UINT count = 0;
    if (FAILED(collection->GetCount(&count)) || count > 256) return false;
    std::vector<WasapiOutputDevice> snapshot;
    for (UINT i = 0; i < count; ++i) {
        ComPtr<IMMDevice> device;
        if (FAILED(collection->Item(i, &device))) return false;
        LPWSTR rawId = nullptr;
        const HRESULT idHr = device->GetId(&rawId);
        std::wstring id;
        if (SUCCEEDED(idHr) && rawId) id = rawId;
        CoTaskMemFree(rawId);
        if (FAILED(idHr) || id.empty()) return false;

        ComPtr<IPropertyStore> properties;
        if (FAILED(device->OpenPropertyStore(STGM_READ, &properties))) return false;
        PROPVARIANT value;
        PropVariantInit(&value);
        const HRESULT nameHr = properties->GetValue(PKEY_Device_FriendlyName, &value);
        std::wstring name;
        if (SUCCEEDED(nameHr) && value.vt == VT_LPWSTR && value.pwszVal) name = value.pwszVal;
        PropVariantClear(&value);
        if (FAILED(nameHr) || name.empty()) return false;
        snapshot.push_back({ id, name, id == defaultId });
    }
    devices = std::move(snapshot);
    return true;
}
