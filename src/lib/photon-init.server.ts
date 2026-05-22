// Initialize @cf-wasm/photon with inline wasm bytes so the Cloudflare Worker
// bundler embeds the wasm into the JS — avoids the "No such module
// assets/photon_rs_bg-*.wasm" runtime failure with the default workerd entry.
import wasmBytes from "@cf-wasm/photon/dist/lib/photon_rs_bg.wasm.inline.js";
import { initPhoton } from "@cf-wasm/photon/dist/photon.js";
import * as photonExports from "@cf-wasm/photon/dist/lib/photon_rs.js";

let initialized = false;

export async function getPhoton(): Promise<typeof photonExports> {
  if (!initialized) {
    await initPhoton(wasmBytes as unknown as BufferSource);
    initialized = true;
  }
  return photonExports;
}
