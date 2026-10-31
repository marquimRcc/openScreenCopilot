#pragma once

#include <d3d11.h>
#include <wrl/client.h>
#include <cstdint>

// Physical pixels relative to ONE monitor, never absolute desktop DIPs.
struct CaptureRegion {
    int x = 0;
    int y = 0;
    int width = 0;
    int height = 0;
};

inline bool validCaptureRegion(const CaptureRegion& region, int sourceWidth, int sourceHeight) {
    return region.x >= 0 && region.y >= 0 && region.width >= 2 && region.height >= 2 &&
           region.width % 2 == 0 && region.height % 2 == 0 &&
           static_cast<int64_t>(region.x) + region.width <= sourceWidth &&
           static_cast<int64_t>(region.y) + region.height <= sourceHeight;
}

// GPU copy only. The destination never contains pixels outside the selection.
// Refuses a changed source size instead of silently clipping/moving the region.
bool copyCaptureRegion(ID3D11Device* device, ID3D11DeviceContext* context,
                       ID3D11Texture2D* source, const CaptureRegion& region,
                       int sourceWidth, int sourceHeight,
                       Microsoft::WRL::ComPtr<ID3D11Texture2D>& destination);
