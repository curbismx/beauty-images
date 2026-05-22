// Initialize @cf-wasm/photon for the Cloudflare Worker runtime.
// The `workerd` entry imports the wasm as a default URL import which the
// Cloudflare Vite plugin emits as a separate asset that the runtime cannot
// resolve ("No such module assets/photon_rs_bg-*.wasm"). The `edge-light`
// entry uses `?module` which gets bundled as a WebAssembly.Module and works.
export * from "@cf-wasm/photon/edge-light";
