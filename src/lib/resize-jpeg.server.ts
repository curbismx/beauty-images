// Worker-compatible JPEG resize via @cf-wasm/photon.
// Returns JPEG bytes. If input's longest edge already <= maxEdge, just re-encodes.
export async function resizeJpeg(input: Uint8Array, maxEdge: number, quality = 82): Promise<Uint8Array> {
  const photon = await import("@cf-wasm/photon/edge-light");
  const img = photon.PhotonImage.new_from_byteslice(input);
  const w = img.get_width();
  const h = img.get_height();
  const longest = Math.max(w, h);
  let out: Uint8Array;
  if (longest <= maxEdge) {
    out = img.get_bytes_jpeg(quality);
  } else {
    const scale = maxEdge / longest;
    const nw = Math.max(1, Math.round(w * scale));
    const nh = Math.max(1, Math.round(h * scale));
    const resized = photon.resize(img, nw, nh, 5); // Lanczos3
    out = resized.get_bytes_jpeg(quality);
    resized.free();
  }
  img.free();
  return out;
}
