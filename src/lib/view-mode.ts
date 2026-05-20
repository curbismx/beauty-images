import { useEffect, useState } from "react";

export type ViewMode = "square" | "masonry";
const KEY = "bi-view-mode";

function read(): ViewMode {
  if (typeof window === "undefined") return "square";
  const v = window.localStorage.getItem(KEY);
  return v === "masonry" ? "masonry" : "square";
}

const listeners = new Set<() => void>();

export function useViewMode(): [ViewMode, (v: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>("square");

  useEffect(() => {
    setMode(read());
    const fn = () => setMode(read());
    listeners.add(fn);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) fn();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(fn);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const set = (v: ViewMode) => {
    try {
      window.localStorage.setItem(KEY, v);
    } catch {}
    setMode(v);
    listeners.forEach((l) => l());
  };

  return [mode, set];
}

export function useMasonryCols(): number {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      if (w <= 768) setCols(2);
      else if (w <= 900) setCols(3);
      else setCols(4);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  return cols;
}
