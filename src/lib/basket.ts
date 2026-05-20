// Client-side basket store: items = { id, tier }.
const KEY = "bi_basket_items";
const EVENT = "bi:basket-changed";

export type BasketItem = { id: string; tier: string };

function read(): BasketItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter((x) => x && typeof x.id === "string" && typeof x.tier === "string")
      : [];
  } catch {
    return [];
  }
}

function write(items: BasketItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function getBasket(): BasketItem[] {
  return read();
}

export function isInBasket(id: string, tier: string): boolean {
  return read().some((x) => x.id === id && x.tier === tier);
}

export function addToBasket(id: string, tier: string) {
  const cur = read();
  if (cur.some((x) => x.id === id && x.tier === tier)) return;
  write([{ id, tier }, ...cur]);
}

export function removeFromBasket(id: string, tier: string) {
  write(read().filter((x) => !(x.id === id && x.tier === tier)));
}

export function clearBasket() {
  write([]);
}

export function subscribeBasket(cb: () => void): () => void {
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
