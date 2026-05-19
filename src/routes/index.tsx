import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BEAUTYIMAGES" },
      {
        name: "description",
        content: "BEAUTYIMAGES — photography.",
      },
      { property: "og:title", content: "BEAUTYIMAGES" },
      {
        property: "og:description",
        content: "BEAUTYIMAGES — photography.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/hero-1.jpg" },
      { name: "twitter:image", content: "/hero-1.jpg" },
    ],
  }),
  component: Index,
});

const HERO_IMAGES = [
  "/hero-1.jpg",
  "/hero-3.jpg",
  "/hero-5.jpg",
  "/hero-6.jpg",
  "/hero-4.jpg",
  "/hero-06.jpg",
  "/hero-07.jpg",
  "/hero-08.jpg",
  "/hero-a02540012.jpg",
  "/hero-10.jpg",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function Index() {
  const [current, setCurrent] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const goPrev = () =>
    setCurrent((c) => (c - 1 + HERO_IMAGES.length) % HERO_IMAGES.length);
  const goNext = () => setCurrent((c) => (c + 1) % HERO_IMAGES.length);

  const searchActive = searchFocused || searchValue.length > 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <div className="curbism-root">

        {/* HERO */}
        <section className={`hero${searchActive ? " hero--search" : ""}`}>
          {HERO_IMAGES.map((src, i) => (
            <img
              key={src}
              className={`bg-img${i === current && !searchActive ? " active" : ""}`}
              src={src}
              alt=""
            />
          ))}
          <img
            className={`bg-img bg-img--search${searchActive ? " active" : ""}`}
            src="/hero-search.jpg"
            alt=""
          />

          <div
            className="hero-zone hero-zone--left"
            aria-label="Previous image"
            onClick={goPrev}
          />
          <div
            className="hero-zone hero-zone--right"
            aria-label="Next image"
            onClick={goNext}
          />

          <div className="hero-logo">
            <img src="/beauty-logo.png" alt="Beauty Images" />
          </div>
          <h1 className="hero-title">
            Rights Managed Images / Real People / Real Photography / No AI
          </h1>

          <div className="hero-search">
            <input
              type="search"
              placeholder="SEARCH"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              aria-label="Search images"
            />
          </div>

          <div className="hero-counter">
            {pad(current + 1)} / {pad(HERO_IMAGES.length)}
          </div>
        </section>

        <div className="appeared-in">
          <div className="appeared-in-label">PUBLISHED IN</div>
          <div className="appeared-in-marquee">
            <div className="appeared-in-track">
              <img src="/appeared-in.png" alt="Published in Vogue, Thalgo, El País, Lexus, Apple" />
              <img src="/appeared-in.png" alt="" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="intro-text">
          <h2>ADVERTISING DESIGN &amp; EDITORIAL IMAGES</h2>
          <p>
            BEAUTY IMAGES IS A COLLECTIVE OF PHOTOGRAPHERS PROVIDING IMAGES FOR HIGH-END PUBLICATIONS FOR OVER 20 YEARS. ALL OUR IMAGES ARE EXCLUSIVE TO BEAUTY IMAGES AND ARE SOLD ON A RIGHTS MANAGED BASIS.
          </p>
        </div>

        <FeaturedMasonry />

        <div className="line-thin" />

        <footer className="footer">
          <span>BEAUTYIMAGES</span>
          <span>UK · 2026</span>
        </footer>
      </div>
    </>
  );
}

const PAGE_CSS = `
.curbism-root, .curbism-root * { box-sizing: border-box; margin: 0; padding: 0; }
.curbism-root { background: white; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: black; }

/* HERO */
.curbism-root .hero {
  position: relative; width: 100%;
  aspect-ratio: 1200 / 1600;
  overflow: hidden; background: black;
  transition: aspect-ratio 0.6s ease;
}
.curbism-root .hero--search {
  aspect-ratio: 1920 / 1080;
}
.curbism-root .hero .bg-img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover; opacity: 0;
  transition: opacity 0.5s ease; will-change: opacity;
}
.curbism-root .hero .bg-img.active { opacity: 1; }
.curbism-root .hero .bg-img--search { z-index: 1; }

/* SEARCH BOX */
.curbism-root .hero-search {
  position: absolute;
  left: 0;
  top: calc(140px + clamp(28px, 5vw, 64px) * 3 + 147px);
  padding-left: 36px;
  width: 50%;
  z-index: 4;
}
.curbism-root .hero-search input {
  width: 100%;
  background: rgba(255, 255, 255, 0.3);
  border: none;
  padding: 16px 20px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #000;
  outline: none;
  -webkit-appearance: none;
  transition: background 0.25s ease;
}
.curbism-root .hero-search input::placeholder {
  color: #000;
  opacity: 0.7;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  font-size: 14px;
}
.curbism-root .hero-search input:focus {
  background: rgba(255, 255, 255, 0.8);
}



.curbism-root .hero-zone {
  position: absolute; top: 0;
  width: 50%; height: 100%; z-index: 2;
}
.curbism-root .hero-zone--left {
  left: 0;
  cursor: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M20 8L12 16L20 24' fill='none' stroke='white' stroke-width='2.5'/%3E%3C/svg%3E") 16 16, w-resize;
}
.curbism-root .hero-zone--right {
  right: 0;
  cursor: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M12 8L20 16L12 24' fill='none' stroke='white' stroke-width='2.5'/%3E%3C/svg%3E") 16 16, e-resize;
}

.curbism-root .hero-logo {
  position: absolute; top: 70px; left: 0;
  height: 56px; z-index: 3; pointer-events: none;
}
.curbism-root .hero-logo img { height: 100%; width: auto; display: block; }

.curbism-root .hero-title {
  position: absolute; left: 0; top: 140px; z-index: 3; max-width: 50%;
  padding-left: 36px;
  color: rgba(255, 255, 255, 0.45);
  font-size: clamp(28px, 5vw, 64px);
  font-weight: 900; letter-spacing: -0.04em; line-height: 0.95; text-transform: uppercase;
  pointer-events: none;
}
.curbism-root .hero-counter {
  position: absolute; bottom: 36px; right: 36px; z-index: 3;
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px; letter-spacing: 0.25em;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

.curbism-root .line-thick { width: 100%; height: 4px; background: black; }
.curbism-root .line-thin  { width: 100%; height: 1px; background: black; }

/* SECTIONS */
.curbism-root .section {
  position: relative; width: 100%;
  min-height: 416px;
  display: flex; align-items: center; justify-content: center;
}
.curbism-root .section--white { background: white; }
.curbism-root .section--black { background: black; }

.curbism-root .section-label {
  position: absolute; bottom: 22px; left: 40px;
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: #777;
  z-index: 3; transition: opacity 0.3s ease;
}
.curbism-root .section--black .section-label { color: rgba(255, 255, 255, 0.55); }

/* APPS */
.curbism-root .section--apps { background: black; min-height: 400px; height: 400px; }
.curbism-root .apps-row {
  display: flex; width: 100%;
  justify-content: space-around;
  align-items: center;
  padding: 0 24px;
  margin-top: -80px;
}
.curbism-root .app-slot {
  position: relative;
  width: 220px; max-width: 24%;
  display: flex; flex-direction: column; align-items: center;
}
.curbism-root .app-icon { width: 96px; height: 96px; display: block; }

.curbism-root .app-info {
  position: absolute;
  bottom: 60px;
  left: 40px;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.25s ease;
  pointer-events: none;
  max-width: 560px;
}
.curbism-root .app-info.visible { opacity: 1; pointer-events: auto; }
.curbism-root .app-info .info-name,
.curbism-root .app-info .info-desc,
.curbism-root .app-info .info-url-link {
  font-size: 22px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  line-height: 1.25;
}
.curbism-root .app-info .info-name { color: #b8b8b8; }
.curbism-root .app-info .info-desc { color: #999; margin-top: 8px; max-width: 560px; }

.curbism-root .info-url-link {
  color: #D75F68;
  text-decoration: none;
  margin-top: 24px;
  letter-spacing: 0.04em;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.curbism-root .info-url-link:hover { text-decoration: underline; text-underline-offset: 4px; }
.curbism-root .info-url-arrow { width: 20px; height: 20px; flex-shrink: 0; }

.curbism-root .section--apps.has-active-app .section-label { opacity: 0; }

/* DESIGN */
.curbism-root .section--design { overflow: hidden; }
/* DESIGN */
.curbism-root .section--design {
  overflow: hidden;
  min-height: 0;
  padding: 0;
  display: block;
  background: white;
  cursor: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M12 8L20 16L12 24' fill='none' stroke='white' stroke-width='2.5'/%3E%3C/svg%3E") 16 16, pointer;
}
.curbism-root .design-area {
  position: relative;
  width: 100%;
  height: auto;
  overflow: hidden;
  line-height: 0;
}
.curbism-root .design-strip {
  display: block;
  height: 400px;
  width: auto;
  max-width: none;
  transform: translateX(0);
  transition: transform 0.6s ease;
}
.curbism-root .design-strip--hi {
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.6s ease;
}
.curbism-root .section--design:hover .design-strip--hi {
  opacity: 1;
}
.curbism-root .section--design:hover .design-strip {
  transform: translateX(var(--design-translate, 0));
  transition: transform 8s linear;
}
.curbism-root .section--design .section-label {
  position: static;
  display: block;
  padding: 22px 40px;
  background: white;
}

/* FOOTER */
.curbism-root .appeared-in { background: white; padding: 40px 40px 20px; display: block; overflow: hidden; }
.curbism-root .appeared-in-label { font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: #777; margin-bottom: 16px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
.curbism-root .appeared-in-marquee { width: 100%; overflow: hidden; }
.curbism-root .appeared-in-track { display: flex; width: max-content; animation: appeared-in-scroll 40s linear infinite; }
.curbism-root .appeared-in-track img { height: auto; width: auto; max-width: none; display: block; flex-shrink: 0; padding-right: 80px; }
@keyframes appeared-in-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.curbism-root .intro-text { background: white; padding: 32px 40px 80px; font-family: 'DIN Condensed', 'DIN Alternate', 'Barlow Condensed', 'Oswald', sans-serif; }
.curbism-root .intro-text h2 { font-size: clamp(28px, 4.2vw, 56px); font-weight: 900; text-transform: uppercase; letter-spacing: -0.035em; line-height: 1.15; color: #000; margin-bottom: 24px; }
.curbism-root .intro-text p { font-size: clamp(28px, 4.2vw, 56px); font-weight: 900; text-transform: uppercase; letter-spacing: -0.035em; line-height: 1.15; color: #111; }
@media (max-width: 768px) {
  .curbism-root .appeared-in { padding: 24px 24px 12px; }
  .curbism-root .appeared-in img { width: 90%; max-width: 90%; }
  .curbism-root .intro-text { padding: 12px 24px 40px; max-width: 100%; }
  .curbism-root .intro-text h2 { font-size: 16px; }
  .curbism-root .intro-text p { font-size: 14px; }
}

.curbism-root .footer {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 40px; background: white;
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: #777;
}

@media (max-width: 768px) {
  .curbism-root .hero-logo  { top: 40px; left: 0; height: 40px; }
  .curbism-root .hero-title { left: 0; top: 100px; padding-left: 22px; max-width: 60%; font-size: clamp(20px, 5.5vw, 36px); }
  .curbism-root .hero-search { padding-left: 22px; width: 80%; top: calc(100px + clamp(20px, 5.5vw, 36px) * 3 + 18px); }
  .curbism-root .hero-search input { padding: 12px 14px; font-size: 14px; }
  .curbism-root .hero-counter { bottom: 22px; right: 22px; font-size: 10px; }
  .curbism-root .section { min-height: 380px; }
  .curbism-root .section--apps { min-height: 460px; }
  .curbism-root .section-label { bottom: 16px; left: 24px; font-size: 10px; }
  .curbism-root .apps-row { padding: 0 12px; margin-top: -60px; }
  .curbism-root .app-slot { width: auto; max-width: 25%; }
  .curbism-root .app-icon { width: 56px; height: 56px; }
  .curbism-root .app-info { bottom: 40px; max-width: 90%; }
  .curbism-root .app-info .info-name,
  .curbism-root .app-info .info-desc,
  .curbism-root .app-info .info-url-link { font-size: 14px; }
  .curbism-root .info-url-arrow { width: 14px; height: 14px; }
  .curbism-root .section--apps { min-height: 240px; height: 240px; }
  .curbism-root .apps-row { margin-top: 0; }
  .curbism-root .design-strip { height: 240px; }
  .curbism-root .footer { padding: 16px 24px; font-size: 10px; }
}
`;
