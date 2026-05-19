import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Curbism — Apps Design Photography" },
      {
        name: "description",
        content:
          "Curbism Ltd — apps, design and photography. A small studio building considered digital products.",
      },
      { property: "og:title", content: "Curbism — Apps Design Photography" },
      {
        property: "og:description",
        content:
          "Curbism Ltd — apps, design and photography. A small studio building considered digital products.",
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

type App = {
  name: string;
  desc: string;
  url: string;
  icon: string;
};

const APPS: App[] = [
  {
    name: "Parently",
    desc: "Expert-led parenting advise",
    url: "www.ourparently.com",
    icon: "/icon-parently.png",
  },
  {
    name: "Moonwalk",
    desc: "Step counter, walk everywhere",
    url: "—",
    icon: "/icon-moonwalk.png",
  },
  {
    name: "Dodo",
    desc: "Legacy notes for the undead",
    url: "www.mydodo.net",
    icon: "/icon-dodo.png",
  },
  {
    name: "Nuron",
    desc: "Voice journal notes",
    url: "www.nuron.life",
    icon: "/icon-nuron.png",
  },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function Index() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [activeApp, setActiveApp] = useState<App | null>(null);
  const sectionAppsRef = useRef<HTMLElement | null>(null);
  const appInfoRef = useRef<HTMLDivElement | null>(null);
  const firstIconRef = useRef<HTMLImageElement | null>(null);
  const designSectionRef = useRef<HTMLElement | null>(null);
  const designStripLoRef = useRef<HTMLImageElement | null>(null);

  // Align app-info left edge with the first icon's left edge
  useEffect(() => {
    const align = () => {
      const section = sectionAppsRef.current;
      const info = appInfoRef.current;
      const firstIcon = firstIconRef.current;
      if (!section || !info || !firstIcon) return;
      const sectionRect = section.getBoundingClientRect();
      const iconRect = firstIcon.getBoundingClientRect();
      const leftOffset = Math.max(20, iconRect.left - sectionRect.left);
      info.style.left = leftOffset + "px";
    };
    align();
    window.addEventListener("resize", align);
    window.addEventListener("load", align);
    return () => {
      window.removeEventListener("resize", align);
      window.removeEventListener("load", align);
    };
  }, []);

  // Design strip translation distance
  useEffect(() => {
    const section = designSectionRef.current;
    const strip = designStripLoRef.current;
    if (!section || !strip) return;
    const update = () => {
      const sectionWidth = section.clientWidth;
      const stripWidth = strip.getBoundingClientRect().width;
      const distance = Math.max(0, stripWidth - sectionWidth);
      section.style.setProperty("--design-translate", `-${distance}px`);
    };
    if (strip.complete) update();
    else strip.addEventListener("load", update);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      strip.removeEventListener("load", update);
    };
  }, []);

  const goPrev = () =>
    setCurrent((c) => (c - 1 + HERO_IMAGES.length) % HERO_IMAGES.length);
  const goNext = () => setCurrent((c) => (c + 1) % HERO_IMAGES.length);

  const showApp = (app: App) => setActiveApp(app);
  const clearApp = () => setActiveApp(null);

  const info = activeApp;
  const hasActiveApp = activeApp !== null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <div className="curbism-root">
        {/* HERO */}
        <section className="hero">
          {HERO_IMAGES.map((src, i) => (
            <img
              key={src}
              className={`bg-img${i === current ? " active" : ""}`}
              src={src}
              alt=""
            />
          ))}

          <div
            className="hero-zone hero-zone--left"
            aria-label="Previous image"
            onMouseEnter={goPrev}
            onClick={goPrev}
          />
          <div
            className="hero-zone hero-zone--right"
            aria-label="Next image"
            onMouseEnter={goNext}
            onClick={goNext}
          />

          <div className="hero-logo">
            <img src="/beauty-logo.png" alt="Beauty Images" />
          </div>
          <div className="hero-counter">
            {pad(current + 1)} / {pad(HERO_IMAGES.length)}
          </div>
        </section>

        {/* APPS */}
        <section
          ref={sectionAppsRef}
          className={`section section--apps${hasActiveApp ? " has-active-app" : ""}`}
          onMouseLeave={clearApp}
        >
          <div className="apps-row">
            {APPS.map((app, i) => (
              <div
                key={app.name}
                className="app-slot"
                onMouseEnter={() => showApp(app)}
              >
                <img
                  ref={i === 0 ? firstIconRef : undefined}
                  className="app-icon"
                  src={app.icon}
                  alt={app.name}
                />
              </div>
            ))}
          </div>

          <div
            ref={appInfoRef}
            className={`app-info${hasActiveApp ? " visible" : ""}`}
          >
            <div className="info-name">{info?.name ?? ""}</div>
            <div className="info-desc">{info?.desc ?? ""}</div>
            {info?.url && info.url !== "—" ? (
              <a
                className="info-url-link"
                href={`https://${info.url.replace(/^https?:\/\//, "")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="info-url-text">{info.url}</span>
                <svg
                  className="info-url-arrow"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <line
                    x1="4"
                    y1="16"
                    x2="16"
                    y2="4"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <polyline
                    points="8,4 16,4 16,12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </a>
            ) : info?.url === "—" ? (
              <span className="info-url-link" style={{ cursor: "default" }}>
                <span className="info-url-text">{info.url}</span>
              </span>
            ) : null}
          </div>

          <span className="section-label">Apps</span>
        </section>

        

        {/* DESIGN */}
        <section
          ref={designSectionRef}
          className="section section--white section--design"
          onClick={() => navigate({ to: "/design" })}
        >
          <div className="design-area">
            <img
              ref={designStripLoRef}
              className="design-strip design-strip--lo"
              src="/design-bw.png"
              alt=""
            />
            <img
              className="design-strip design-strip--hi"
              src="/design-colour.png"
              alt=""
            />
          </div>
          <span className="section-label">Design</span>
        </section>

        {/* PHOTOGRAPHY */}
        <section className="section section--white">
          <span className="section-label">Photography</span>
        </section>

        <div className="line-thin" />

        <footer className="footer">
          <span>Curbism Ltd</span>
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
}
.curbism-root .hero .bg-img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover; opacity: 0;
  transition: opacity 0.5s ease; will-change: opacity;
}
.curbism-root .hero .bg-img.active { opacity: 1; }

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
  position: absolute; left: 36px; bottom: 36px; z-index: 3;
  color: rgba(255, 255, 255, 0.33);
  font-size: clamp(40px, 7.5vw, 96px);
  font-weight: 900; letter-spacing: -0.045em; line-height: 0.9; text-transform: uppercase;
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
.curbism-root .footer {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 40px; background: white;
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: #777;
}

@media (max-width: 768px) {
  .curbism-root .hero-logo  { top: 40px; left: 0; height: 40px; }
  .curbism-root .hero-title { left: 22px; bottom: 22px; }
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
