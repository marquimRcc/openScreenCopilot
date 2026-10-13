#include "capture_region.h"

bool copyCaptureRegion(ID3D11Device* device, ID3D11DeviceContext* context,
                       ID3D11Texture2D* source, const CaptureRegion& region,
                       int sourceWidth, int sourceHeight,
                       Microsoft::WRL::ComPtr<ID3D11Texture2D>& destination) {
    if (!device || !context || !source || !validCaptureRegion(region, sourceWidth, sourceHeight)) {
        return false;
    }
    D3D11_TEXTURE2D_DESC desc{};
    source->GetDesc(&desc);
    if (desc.Width != static_cast<UINT>(sourceWidth) ||
        desc.Height != static_cast<UINT>(sourceHeight) ||
        desc.Format != DXGI_FORMAT_B8G8R8A8_UNORM || desc.SampleDesc.Count != 1 ||
        desc.MipLevels != 1 || desc.ArraySize != 1) {
        return false;
    }
    if (!destination) {
        desc.Width = static_cast<UINT>(region.width);
        desc.Height = static_cast<UINT>(region.height);
        desc.Usage = D3D11_USAGE_DEFAULT;
        desc.BindFlags = 0;
        desc.CPUAccessFlags = 0;
        desc.MiscFlags = 0;
        if (FAILED(device->CreateTexture2D(&desc, nullptr, &destination))) return false;
    } else {
        D3D11_TEXTURE2D_DESC existing{};
        destination->GetDesc(&existing);
        if (existing.Width != static_cast<UINT>(region.width) ||
            existing.Height != static_cast<UINT>(region.height) ||
            existing.Format != desc.Format) return false;
    }
    const D3D11_BOX box{
        static_cast<UINT>(region.x), static_cast<UINT>(region.y), 0,
        static_cast<UINT>(region.x + region.width), static_cast<UINT>(region.y + region.height), 1};
    context->CopySubresourceRegion(destination.Get(), 0, 0, 0, 0, source, 0, &box);
    return true;
}
