// Client-side lightbox store backed by localStorage with a tiny pub/sub.
const KEY = "bi_lightbox_ids";
const EVENT = "bi:lightbox-changed";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getLightbox(): string[] {
  return read();
}

export function isInLightbox(id: string): boolean {
  return read().includes(id);
}

export function addToLightbox(id: string) {
  const cur = read();
  if (cur.includes(id)) return;
  write([id, ...cur]);
}

export function removeFromLightbox(id: string) {
  const cur = read();
  if (!cur.includes(id)) return;
  write(cur.filter((x) => x !== id));
}

export function toggleLightbox(id: string) {
  const cur = read();
  write(cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur]);
}

export function clearLightbox() {
  write([]);
}

export function subscribeLightbox(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) handler();
  });
  return () => {
    window.removeEventListener(EVENT, handler);
  };
}
