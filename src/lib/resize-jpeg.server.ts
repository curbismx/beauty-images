import { decode, encode } from "jpeg-js";

function resizeRgbaBilinear(source: Uint8Array, sw: number, sh: number, dw: number, dh: number) {
  const output = new Uint8Array(dw * dh * 4);
  const xScale = dw > 1 ? (sw - 1) / (dw - 1) : 0;
  const yScale = dh > 1 ? (sh - 1) / (dh - 1) : 0;

  for (let y = 0; y < dh; y += 1) {
    const sy = y * yScale;
    const y0 = Math.floor(sy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const wy = sy - y0;

    for (let x = 0; x < dw; x += 1) {
      const sx = x * xScale;
      const x0 = Math.floor(sx);
      const x1 = Math.min(sw - 1, x0 + 1);
      const wx = sx - x0;

      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const out = (y * dw + x) * 4;

      for (let c = 0; c < 4; c += 1) {
        const top = source[i00 + c] * (1 - wx) + source[i10 + c] * wx;
        const bottom = source[i01 + c] * (1 - wx) + source[i11 + c] * wx;
        output[out + c] = Math.round(top * (1 - wy) + bottom * wy);
      }
    }
  }

  return output;
}

// Worker-safe JPEG resize with no server-side WASM/native dependency.
// If maxEdge <= 0 or the source already fits, the original bytes are returned.
export async function resizeJpeg(input: Uint8Array, maxEdge: number, quality = 90): Promise<Uint8Array> {
  if (maxEdge <= 0) return input;

  const decoded = decode(input, {
    useTArray: true,
    formatAsRGBA: true,
    tolerantDecoding: true,
    maxMemoryUsageInMB: 512,
  });
  const longest = Math.max(decoded.width, decoded.height);
  if (longest <= maxEdge) return input;

  const scale = maxEdge / longest;
  const width = Math.max(1, Math.round(decoded.width * scale));
  const height = Math.max(1, Math.round(decoded.height * scale));
  const data = resizeRgbaBilinear(decoded.data, decoded.width, decoded.height, width, height);
  return new Uint8Array(encode({ data, width, height }, quality).data);
}
