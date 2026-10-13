#include "capture_region.h"

#include <climits>
#include <cstdio>
#include <vector>

using Microsoft::WRL::ComPtr;

int main() {
    int failures = 0;
    const auto expect = [&](bool result, const char* label) {
        if (!result) { std::printf("FAIL: %s\n", label); ++failures; }
    };
    expect(validCaptureRegion({3, 5, 8, 6}, 20, 20), "odd origin is valid for BGRA");
    expect(validCaptureRegion({0, 0, 20, 20}, 20, 20), "whole monitor");
    expect(!validCaptureRegion({-1, 0, 8, 6}, 20, 20), "negative origin rejected");
    expect(!validCaptureRegion({0, 0, 9, 6}, 20, 20), "odd width rejected");
    expect(!validCaptureRegion({0, 0, 8, 1}, 20, 20), "subpixel/empty height rejected");
    expect(!validCaptureRegion({19, 0, 2, 2}, 20, 20), "outside monitor rejected");
    expect(!validCaptureRegion({INT_MAX, 0, 2, 2}, INT_MAX, 20), "overflow rejected");

    ComPtr<ID3D11Device> device;
    ComPtr<ID3D11DeviceContext> context;
    const HRESULT created = D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_WARP, nullptr, 0,
        nullptr, 0, D3D11_SDK_VERSION, &device, nullptr, &context);
    if (FAILED(created)) { std::printf("FAIL: D3D11 WARP unavailable (0x%lx)\n", created); return 1; }
    // Every pixel has a unique value, so a one-pixel offset/leaked border fails.
    std::vector<uint32_t> pixels(20 * 20);
    for (size_t i = 0; i < pixels.size(); ++i) pixels[i] = 0xff000000 | static_cast<uint32_t>(i);
    D3D11_TEXTURE2D_DESC desc{};
    desc.Width = desc.Height = 20;
    desc.MipLevels = desc.ArraySize = 1;
    desc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    desc.SampleDesc.Count = 1;
    desc.Usage = D3D11_USAGE_DEFAULT;
    D3D11_SUBRESOURCE_DATA data{pixels.data(), 20 * 4, 0};
    ComPtr<ID3D11Texture2D> source, cropped, readback;
    if (FAILED(device->CreateTexture2D(&desc, &data, &source))) return 1;
    const CaptureRegion region{3, 5, 8, 6};
    expect(copyCaptureRegion(device.Get(), context.Get(), source.Get(), region, 20, 20, cropped),
           "GPU crop");
    if (!cropped) return 1;
    cropped->GetDesc(&desc);
    expect(desc.Width == 8 && desc.Height == 6, "exact output dimensions");
    desc.Usage = D3D11_USAGE_STAGING;
    desc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
    if (FAILED(device->CreateTexture2D(&desc, nullptr, &readback))) return 1;
    context->CopyResource(readback.Get(), cropped.Get());
    D3D11_MAPPED_SUBRESOURCE mapped{};
    if (FAILED(context->Map(readback.Get(), 0, D3D11_MAP_READ, 0, &mapped))) return 1;
    bool exact = true;
    for (int y = 0; y < region.height; ++y) {
        const auto* row = reinterpret_cast<const uint32_t*>(
            static_cast<const BYTE*>(mapped.pData) + y * mapped.RowPitch);
        for (int x = 0; x < region.width; ++x) {
            exact = exact && row[x] == pixels[(y + region.y) * 20 + x + region.x];
        }
    }
    context->Unmap(readback.Get(), 0);
    expect(exact, "all cropped pixels match, with no outside pixels");
    expect(copyCaptureRegion(device.Get(), context.Get(), source.Get(), region, 20, 20, cropped),
           "reuses crop texture");
    expect(!copyCaptureRegion(device.Get(), context.Get(), source.Get(), region, 22, 20, cropped),
           "display size change rejected");
    expect(!copyCaptureRegion(device.Get(), context.Get(), source.Get(), {0, 0, 4, 4}, 20, 20, cropped),
           "unexpected destination size rejected");
    std::printf("Capture region: %s (%d failures)\n", failures ? "FAIL" : "PASS", failures);
    return failures ? 1 : 0;
}
