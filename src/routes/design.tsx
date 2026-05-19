import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/design")({
  head: () => ({
    meta: [
      { title: "Design — Curbism" },
      { name: "description", content: "Curbism design work." },
      { property: "og:title", content: "Design — Curbism" },
      { property: "og:description", content: "Curbism design work." },
    ],
  }),
  component: DesignPage,
});

type DesignItem = { src: string; label: string };

const DESIGN_ITEMS: DesignItem[] = [
  { src: "/design-01.png", label: "ING / WEBSITE" },
  { src: "/design-02.png", label: "TANGIFY / WEBSITE" },
  { src: "/design-03.png", label: "VFRD / WEBSITE / DECK" },
  { src: "/design-04.png", label: "DAGATECH / WEBSITE" },
  { src: "/design-05.png", label: "WONDER / APP / WEBSITE" },
  { src: "/design-06.png", label: "OOOLOO / APP / WEBSITE" },
  { src: "/design-07.png", label: "COMMUNITY / APP / WEBSITE" },
  { src: "/design-08.png", label: "DRAGONFLY / WEBSITE" },
  { src: "/design-09.png", label: "SIT BY ME / APP" },
  { src: "/design-10.png", label: "BAROD / APP" },
  { src: "/design-11.png", label: "SPELLCO / APP / WEBSITE" },
  { src: "/design-12.png", label: "FIND MY PONY / APP / WEBSITE" },
];

const pad = (n: number) => String(n).padStart(2, "0");

function DesignPage() {
  const [current, setCurrent] = useState(0);
  const goNext = () =>
    setCurrent((c) => (c + 1) % DESIGN_ITEMS.length);
  const goPrev = () =>
    setCurrent((c) => (c - 1 + DESIGN_ITEMS.length) % DESIGN_ITEMS.length);

  const item = DESIGN_ITEMS[current];

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
.design-root, .design-root * { box-sizing: border-box; margin: 0; padding: 0; }
.design-root {
  background: white;
  min-height: 100vh;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: black;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.design-root .logo {
  position: absolute; top: 70px; left: 0;
  width: 240px; z-index: 4;
}
.design-root .logo img { width: 100%; height: auto; display: block; }
.design-root .image-wrap {
  width: 100%;
  display: block;
}
.design-root .image-wrap img {
  width: 100%; height: auto; display: block;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
}
.design-root .caption-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 40px 0 40px;
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: #777;
  pointer-events: none;
}
.design-root .counter { font-variant-numeric: tabular-nums; }
.design-root .nav-zone {
  position: fixed; top: 0;
  width: 50%; height: 100%; z-index: 3;
}
.design-root .nav-zone--left {
  left: 0;
  cursor: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M20 8L12 16L20 24' fill='none' stroke='black' stroke-width='2.5'/%3E%3C/svg%3E") 16 16, pointer;
}
.design-root .nav-zone--right {
  right: 0;
  cursor: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M12 8L20 16L12 24' fill='none' stroke='black' stroke-width='2.5'/%3E%3C/svg%3E") 16 16, pointer;
}
@media (max-width: 768px) {
  .design-root .logo { top: 40px; left: 0; width: 170px; }
  .design-root .caption-row { font-size: 10px; padding: 10px 24px 0 24px; }
}
        `,
        }}
      />
      <div className="design-root">
        <Link to="/" className="logo" aria-label="Back to home">
          <img src="/curbism-logo-back.png" alt="Curbism — back to home" />
        </Link>
        <div className="image-wrap">
          <img src={item.src} alt={item.label} />
          <div className="caption-row">
            <span>{item.label}</span>
            <span className="counter">
              {pad(current + 1)} / {pad(DESIGN_ITEMS.length)}
            </span>
          </div>
        </div>
        <div
          className="nav-zone nav-zone--left"
          aria-label="Previous image"
          onClick={goPrev}
        />
        <div
          className="nav-zone nav-zone--right"
          aria-label="Next image"
          onClick={goNext}
        />
      </div>
    </>
  );
}
