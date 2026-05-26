import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Layers, LayoutGrid, Rows3, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { searchPublicImages, getImageIdsByNumbers, type PublicSearchResult } from "@/lib/search.functions";
import { getLightbox, subscribeLightbox } from "@/lib/lightbox";
import { getBasket, subscribeBasket } from "@/lib/basket";
import { useViewMode, useMasonryCols } from "@/lib/view-mode";
import { useSession } from "@/lib/use-session";

function HeaderNav() {
  const { session, loading } = useSession();
  const [open, setOpen] = useState(false);
  const lbCount = useSyncExternalStore(subscribeLightbox, () => getLightbox().length, () => 0);
  const basketCount = useSyncExternalStore(subscribeBasket, () => getBasket().length, () => 0);

  const close = () => setOpen(false);
  const onSignOut = async () => {
    await supabase.auth.signOut();
    close();
  };

  if (loading) return null;

  return (
    <>
      {/* Desktop links */}
      <div className="hero-nav hero-nav--desktop">
        <Link to="/contact" className="hero-account">Contact</Link>
        {session ? (
          <Link to="/account" className="hero-account" aria-label="Account">
            <User size={18} strokeWidth={2} />
          </Link>
        ) : (
          <Link to="/login" className="hero-account">Log in</Link>
        )}
      </div>

      {/* Mobile toggle */}
      <button
        type="button"
        className={`hero-menu-toggle${open ? " is-open" : ""}`}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>+</span>
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="hero-mobile-menu" role="dialog" aria-modal="true">
          <button type="button" className="hero-mobile-backdrop" aria-label="Close menu" onClick={close} />
          <nav className="hero-mobile-panel">
            <div className="hmm-main">
              <Link to="/contact" className="hmm-link" onClick={close}>Contact</Link>
              <Link to="/lightbox" className="hmm-link" onClick={close}>
                Lightbox{lbCount > 0 && <span className="hmm-count">{lbCount}</span>}
              </Link>
              <Link to="/basket" className="hmm-link" onClick={close}>
                Basket{basketCount > 0 && <span className="hmm-count">{basketCount}</span>}
              </Link>
            </div>
            <div className="hmm-auth">
              {session ? (
                <>
                  <Link to="/account" className="hmm-link" onClick={close}>Account</Link>
                  <button type="button" className="hmm-link hmm-link--btn" onClick={onSignOut}>Log out</button>
                </>
              ) : (
                <Link to="/login" className="hmm-link" onClick={close}>Log in</Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

function renderResultCard(r: PublicSearchResult, onClick: () => void) {
  return (
    <Link
      key={r.id}
      to="/image/$id"
      params={{ id: r.id }}
      search={{ from: "search" }}
      className="search-result-card"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {r.signed_url ? (
        <img src={r.signed_url} alt={r.title ?? r.caption ?? ""} loading="lazy" />
      ) : (
        <div className="search-result-fallback" />
      )}
      <figcaption>
        <div className="src-num">#{String(r.image_number).padStart(8, "0")}</div>
        {r.title && <div className="src-title">{r.title}</div>}
      </figcaption>
    </Link>
  );
}


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

type SavedSearchState = {
  q?: string;
  y?: number;
  seed?: number;
  results?: PublicSearchResult[];
};

function readRestoreSearchState(): SavedSearchState | null {
  if (typeof window === "undefined") return null;
  try {
    if (!sessionStorage.getItem("bi_restore_search")) return null;
    const raw = sessionStorage.getItem("bi_search_state");
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedSearchState;
    return saved.q ? saved : null;
  } catch {
    return null;
  }
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function Index() {
  const [restoreState] = useState<SavedSearchState | null>(() => readRestoreSearchState());
  const [restoringSearch, setRestoringSearch] = useState(() => Boolean(restoreState?.q));
  const [current, setCurrent] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState(restoreState?.q ?? "");
  const [submittedQuery, setSubmittedQuery] = useState(restoreState?.q ?? "");
  const [results, setResults] = useState<PublicSearchResult[]>(restoreState?.results ?? []);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE_RESULTS = 100;
  const [viewMode, setViewMode] = useViewMode();
  const masonry = viewMode === "masonry";
  const cols = useMasonryCols();
  const runSearch = useServerFn(searchPublicImages);
  const justClosedSearchRef = useRef(false);
  const restoreConsumedRef = useRef(false);
  const searchSeedRef = useRef<number>(
    restoreState?.seed ?? Math.floor(Math.random() * 0xffffffff),
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const lbCount = useSyncExternalStore(
    subscribeLightbox,
    () => getLightbox().length,
    () => 0,
  );

  // Preload the search hero image so it can fade in smoothly on first focus.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const img = new Image();
    img.src = "/hero-search.jpg";
  }, []);

  const goPrev = () => {
    if (justClosedSearchRef.current) {
      justClosedSearchRef.current = false;
      return;
    }
    setCurrent((c) => (c - 1 + HERO_IMAGES.length) % HERO_IMAGES.length);
  };
  const goNext = () => {
    if (justClosedSearchRef.current) {
      justClosedSearchRef.current = false;
      return;
    }
    setCurrent((c) => (c + 1) % HERO_IMAGES.length);
  };

  const searchActive = searchFocused || searchValue.length > 0 || submittedQuery.length > 0;

  const submitSearch = async (qOverride?: string, restoreY?: number) => {
    const q = (qOverride ?? searchValue).trim();
    if (!q) return;
    setSubmittedQuery(q);
    setSearching(true);
    setPage(1);
    // New search -> new shuffle seed. Stored so it can be saved and reused,
    // keeping the result order identical when returning to this search.
    const seed = Math.floor(Math.random() * 0xffffffff);
    searchSeedRef.current = seed;
    try {
      const r = await runSearch({ data: { q, limit: 50000, seed } });
      setResults(r);
      if (typeof restoreY === "number") {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => window.scrollTo(0, restoreY));
        });
      } else if (typeof window !== "undefined" && window.innerWidth < 768) {
        // On mobile, snap results to the top of the viewport so the user
        // doesn't land partway down the page below the hero.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = resultsRef.current;
            if (el) {
              const top = el.getBoundingClientRect().top + window.scrollY;
              window.scrollTo(0, top);
            }
          });
        });
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Restore previous search immediately when arriving back from /image/:id.
  // The saved result rows avoid replaying the home -> search transition and network search.
  useEffect(() => {
    if (typeof window === "undefined" || !restoreState?.q || restoreConsumedRef.current) return;
    restoreConsumedRef.current = true;
    try {
      sessionStorage.removeItem("bi_restore_search");
    } catch {
      /* ignore */
    }
    const restoreScroll = () => {
      const targetY = typeof restoreState.y === "number" ? restoreState.y : 0;
      const start = Date.now();
      const tryScroll = () => {
        window.scrollTo(0, targetY);
        const reached = Math.abs(window.scrollY - targetY) < 2;
        if (!reached && Date.now() - start < 2500) {
          requestAnimationFrame(tryScroll);
        } else {
          setRestoringSearch(false);
        }
      };
      requestAnimationFrame(tryScroll);
    };
    if (restoreState.results?.length) {
      requestAnimationFrame(() => requestAnimationFrame(restoreScroll));
      return;
    }
    let alive = true;
    const q = restoreState.q.trim();
    if (typeof restoreState.seed === "number") {
      searchSeedRef.current = restoreState.seed;
    }
    setSearching(true);
    runSearch({ data: { q, limit: 50000, seed: searchSeedRef.current } })
      .then((r) => {
        if (!alive) return;
        setResults(r);
        restoreScroll();
      })
      .catch(() => {
        if (!alive) return;
        setResults([]);
        setRestoringSearch(false);
      })
      .finally(() => alive && setSearching(false));
    return () => {
      alive = false;
    };
  }, [restoreState, runSearch]);

  const saveSearchState = () => {
    try {
      // Do NOT persist `results` — signed URLs expire (1h) and large payloads
      // can blow the sessionStorage quota. On restore we re-run the search to
      // get fresh signed URLs.
      sessionStorage.setItem(
        "bi_search_state",
        JSON.stringify({
          q: submittedQuery || searchValue.trim(),
          y: window.scrollY,
          seed: searchSeedRef.current,
        }),
      );
      sessionStorage.setItem("bi_restore_search", "1");
    } catch {
      /* ignore */
    }
  };

  const goHome = (suppressNextHeroClick = false) => {
    if (suppressNextHeroClick) {
      justClosedSearchRef.current = true;
    }
    try {
      sessionStorage.removeItem("bi_search_state");
      sessionStorage.removeItem("bi_restore_search");
    } catch {
      /* ignore */
    }
    setSearchValue("");
    setSubmittedQuery("");
    setResults([]);
    setSearchFocused(false);
    setCurrent(0);
    window.scrollTo(0, 0);
  };

  // Click outside the search box (and outside search results) returns home.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onDown = (e: MouseEvent) => {
      if (!searchActive) return;
      const target = e.target as Node | null;
      if (!target) return;
      const inSearch = heroRef.current?.querySelector(".hero-search")?.contains(target);
      const inResults = resultsRef.current?.contains(target);
      const onSubmit = (target as Element).closest?.(".hero-search-submit");
      if (inSearch || inResults || onSubmit) return;
      const onHeroZone = Boolean((target as Element).closest?.(".hero-zone"));
      goHome(onHeroZone);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [searchActive]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <div className="curbism-root">
        {/* HERO */}
        <section
          ref={heroRef}
          className={`hero${searchActive ? " hero--search" : ""}${submittedQuery && searchValue.length > 0 ? " hero--results" : ""}${restoringSearch ? " hero--instant" : ""}`}
        >
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

          <div className="hero-zone hero-zone--left" aria-label="Previous image" onClick={goPrev} />
          <div className="hero-zone hero-zone--right" aria-label="Next image" onClick={goNext} />

          <HeaderNav />


          <button
            type="button"
            className="hero-logo"
            onClick={() => goHome()}
            aria-label="Beauty Images — home"
          >
            <img src="/beauty-logo.png" alt="Beauty Images" />
          </button>
          <h1 className="hero-title">
            Rights Managed Images / Real People / Real Photography / No AI
          </h1>

          <form
            className="hero-search"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
          >
            <input
              ref={searchInputRef}
              type="search"
              placeholder="SEARCH"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              aria-label="Search images"
            />
            <button
              type="submit"
              className="hero-search-submit"
              aria-label="Submit search"
              disabled={!searchValue.trim() || searching}
              onMouseDown={(e) => e.preventDefault()}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="square"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </form>

          <div className="hero-counter">
            {pad(current + 1)} / {pad(HERO_IMAGES.length)}
          </div>
        </section>

        <div className="home-stack">
          <div className={`home-fade${searchActive ? " home-fade--hidden" : ""}`}>
            <div className="appeared-in">
              <div className="appeared-in-label">PUBLISHED IN</div>
              <div className="appeared-in-marquee">
                <div className="appeared-in-track">
                  <img
                    src="/appeared-in.png"
                    alt="Published in Vogue, Thalgo, El País, Lexus, Apple"
                  />
                  <img src="/appeared-in.png" alt="" aria-hidden="true" />
                </div>
              </div>
            </div>

            <div className="intro-text">
              <h2>ADVERTISING DESIGN &amp; EDITORIAL IMAGES</h2>
              <p>
                PROVIDING IMAGES TO HIGH-END PUBLICATIONS AND ADVERTISING FOR OVER 20 YEARS. ALL OUR
                IMAGES ARE EXCLUSIVE TO BEAUTY IMAGES AND ARE SOLD ON A{" "}
                <span style={{ color: "#D75F68" }}>RIGHTS MANAGED</span> BASIS. ALL REAL PEOPLE.
                REAL PHOTOGRAPHY. WITH NO AI PRODUCTION AT ALL.
              </p>
              <button
                type="button"
                className="intro-cta"
                onClick={() => {
                  searchInputRef.current?.focus();
                  searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                SEARCH NOW
              </button>
            </div>

            <FeaturedMasonry />
          </div>

          {searchActive && (
            <div className="search-results" ref={resultsRef}>
              <div className="search-results-header">
                <div className="srh-text">
                  {submittedQuery ? (
                    <>
                      SEARCH RESULTS
                      <span className="srp-meta">
                        {" "}
                        / "{submittedQuery}"
                        {!searching && (
                          <>
                            {" "}
                            · {results.length} {results.length === 1 ? "IMAGE" : "IMAGES"}
                          </>
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      SEARCH RESULTS
                      <span className="srp-hint"> WILL APPEAR HERE</span>
                    </>
                  )}
                </div>
                <div className="srh-actions">
                  <button
                    type="button"
                    className="srh-iconbtn"
                    aria-label={masonry ? "Show as square grid" : "Show full images (masonry)"}
                    title={masonry ? "Square grid" : "Masonry"}
                    onClick={() => setViewMode(masonry ? "square" : "masonry")}
                  >
                    {masonry ? <LayoutGrid size={16} /> : <Rows3 size={16} />}
                  </button>
                  <Link to="/lightbox" className="srh-lightbox" aria-label="Open lightbox">
                    <Layers size={16} />
                    <span>LIGHTBOX</span>
                    {lbCount > 0 && <span className="srh-lb-count">{lbCount}</span>}
                  </Link>
                </div>
              </div>
              {searching && <div className="search-results-status">SEARCHING…</div>}
              {!searching && submittedQuery && results.length === 0 && (
                <div className="search-results-status">NO MATCHES — TRY ANOTHER TERM</div>
              )}
              {(() => {
                if (results.length === 0) return null;
                const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE_RESULTS));
                const safePage = Math.min(page, totalPages);
                const start = (safePage - 1) * PAGE_SIZE_RESULTS;
                const pageItems = results.slice(start, start + PAGE_SIZE_RESULTS);
                const goPage = (p: number) => {
                  const next = Math.max(1, Math.min(totalPages, p));
                  setPage(next);
                  requestAnimationFrame(() => {
                    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                };
                const ArrowSvg = (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="square"
                  >
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                );
                // Fixed-length pager: the SAME number of cells on every page,
                // so the layout never shifts as you move through results.
                // Page 1 and the last 3 pages are always shown; the middle is
                // a 5-page sliding window. Total cells stay constant at 11.
                const pagesToShow: Array<number | "..."> = (() => {
                  const total = totalPages;
                  const cur = safePage;
                  if (total <= 13) {
                    return Array.from({ length: total }, (_, i) => i + 1);
                  }
                  if (cur <= 7) {
                    return [1, 2, 3, 4, 5, 6, 7, "...", total - 2, total - 1, total];
                  }
                  if (cur >= total - 7) {
                    return [
                      1, "...",
                      total - 8, total - 7, total - 6, total - 5, total - 4,
                      total - 3, total - 2, total - 1, total,
                    ];
                  }
                  return [
                    1, "...",
                    cur - 2, cur - 1, cur, cur + 1, cur + 2,
                    "...", total - 2, total - 1, total,
                  ];
                })();
                const Pager = (
                  <div className="search-pager">
                    <button
                      type="button"
                      className="search-pager-btn search-pager-btn--prev"
                      disabled={safePage <= 1}
                      onClick={() => goPage(safePage - 1)}
                      aria-label="Previous page"
                    >
                      {ArrowSvg}
                    </button>
                    {pagesToShow.map((p, i) =>
                      p === "..." ? (
                        <span key={`e${i}`} className="search-pager-ellipsis">…</span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          className={`search-pager-num${p === safePage ? " is-active" : ""}`}
                          onClick={() => goPage(p)}
                          aria-current={p === safePage ? "page" : undefined}
                        >
                          {String(p).padStart(2, "0")}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      className="search-pager-btn"
                      disabled={safePage >= totalPages}
                      onClick={() => goPage(safePage + 1)}
                      aria-label="Next page"
                    >
                      {ArrowSvg}
                    </button>
                  </div>
                );
                return (
                  <>
                    {totalPages > 1 && Pager}
                    {!masonry && (
                      <div className="search-results-grid">
                        {pageItems.map((r) => renderResultCard(r, saveSearchState))}
                      </div>
                    )}
                    {masonry && (
                      <div className="search-results-masonry">
                        {Array.from({ length: cols }, (_, ci) => (
                          <div className="masonry-col" key={ci}>
                            {pageItems.filter((_, i) => i % cols === ci).map((r) => renderResultCard(r, saveSearchState))}
                          </div>
                        ))}
                      </div>
                    )}
                    {totalPages > 1 && Pager}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        <div className="line-thin" />

        <footer className="footer">
          <div className="footer-main">
            <div className="footer-brand">
              <img src="/beauty-images-logo.png" alt="Beauty Images" />
            </div>
            <p className="footer-copy">
              All images and content © The Beauty Images. All rights reserved.
            </p>
            <nav className="footer-links">
              <Link to="/privacy">Privacy Policy</Link>
              <span className="footer-dot">·</span>
              <Link to="/licence">Licence Agreement</Link>
            </nav>
          </div>
          <a
            className="footer-curbism"
            href="https://www.curbism.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>Designed by www.curbism.com</span>
          </a>
        </footer>
      </div>
    </>
  );
}

type FeaturedRow = { id: string; storage_path: string; filename: string };
const PAGE_SIZE = 15;

function FeaturedMasonry() {
  const [items, setItems] = useState<Array<{ id: string; url: string; alt: string; imageId?: string }>>([]);
  const [, setPage] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const doneRef = useRef(false);
  const pageRef = useRef(0);
  const resolveIds = useServerFn(getImageIdsByNumbers);

  const loadMore = async () => {
    if (loadingRef.current || doneRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const from = pageRef.current * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("featured_images")
      .select("id, storage_path, filename")
      .order("sort_order", { ascending: false })
      .order("filename", { ascending: true })
      .range(from, to);
    if (!error && data) {
      const rows = data as FeaturedRow[];
      // Derive the catalogue image number from each favourite's filename
      // (e.g. "01-A01370026.jpg" -> 1370026) and resolve it to an image id.
      const rowNumbers = rows.map((r) => {
        const m = r.filename.match(/^\d{2}-A(\d+)\.[a-z0-9]+$/i);
        return m ? parseInt(m[1], 10) : null;
      });
      const numbers = rowNumbers.filter((n): n is number => n != null);
      let idByNumber = new Map<number, string>();
      if (numbers.length > 0) {
        try {
          const resolved = await resolveIds({ data: { numbers } });
          idByNumber = new Map(resolved.map((x) => [x.image_number, x.id]));
        } catch {
          /* if resolution fails, favourites just stay non-clickable */
        }
      }
      const next = rows.map((r, i) => {
        const num = rowNumbers[i];
        return {
          id: r.id,
          url: supabase.storage.from("featured-images").getPublicUrl(r.storage_path, {
            transform: { height: 800, resize: "contain", quality: 75 },
          }).data.publicUrl,
          alt: r.filename,
          imageId: num != null ? idByNumber.get(num) : undefined,
        };
      });
      setItems((prev) => [...prev, ...next]);
      pageRef.current += 1;
      setPage(pageRef.current);
      if (rows.length < PAGE_SIZE) {
        doneRef.current = true;
        setDone(true);
      }
    }
    loadingRef.current = false;
    setLoading(false);
  };

  useEffect(() => {
    loadMore();
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "600px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (items.length === 0 && done) return null;

  return (
    <section className="featured-masonry">
      <MasonryColumns items={items} />
      {!done && <div ref={sentinelRef} className="featured-masonry-sentinel" aria-hidden="true" />}
      {loading && <div className="featured-masonry-loading">Loading…</div>}
    </section>
  );
}

function MasonryColumns({
  items,
}: {
  items: Array<{ id: string; url: string; alt: string; imageId?: string }>;
}) {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const update = () => setCols(window.innerWidth <= 768 ? 2 : 3);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const buckets: (typeof items)[] = Array.from({ length: cols }, () => []);
  items.forEach((it, i) => buckets[i % cols].push(it));
  return (
    <div className="featured-masonry-grid">
      {buckets.map((col, i) => (
        <div key={i} className="featured-masonry-col">
          {col.map((it) =>
            it.imageId ? (
              <Link
                key={it.id}
                to="/image/$id"
                params={{ id: it.imageId }}
                search={{ from: "home" }}
                className="featured-masonry-link"
              >
                <img src={it.url} alt={it.alt} loading="lazy" />
              </Link>
            ) : (
              <img key={it.id} src={it.url} alt={it.alt} loading="lazy" />
            ),
          )}
        </div>
      ))}
    </div>
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
  transition: aspect-ratio 2.5s ease, background-color 2.5s ease;
}
.curbism-root .hero--search {
  aspect-ratio: 1920 / 1080;
  background: white;
}
.curbism-root .hero--results {
  background: white;
}
.curbism-root .hero--instant,
.curbism-root .hero--instant .bg-img,
.curbism-root .hero--instant + .home-stack .home-fade,
.curbism-root .hero--instant + .home-stack .search-results {
  transition: none !important;
  animation: none !important;
}
.curbism-root .hero .bg-img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover; opacity: 0;
  transition: opacity 2.5s ease; will-change: opacity;
}
.curbism-root .hero .bg-img.active { opacity: 1; }
.curbism-root .hero .bg-img--search { z-index: 1; }

.curbism-root .hero--search .bg-img--search.active { opacity: 0.5; }
.curbism-root .hero--results .bg-img:not(.bg-img--search) { opacity: 0 !important; }
.curbism-root .hero--results .bg-img--search.active { opacity: 0.25 !important; }

/* SEARCH BOX */
.curbism-root .hero--search .hero-search {
  border: 1px solid rgba(0,0,0,0.45);
}
.curbism-root .hero-search {
  position: absolute;
  left: 36px;
  top: calc(140px + clamp(28px, 5vw, 64px) * 3 + 147px);
  width: calc(50% - 36px);
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
  height: 56px; z-index: 4;
  background: none; border: 0; padding: 0; margin: 0;
  cursor: pointer; appearance: none;
}
.curbism-root .hero-logo img { height: 100%; width: auto; display: block; pointer-events: none; }

.curbism-root .hero-title {
  position: absolute; left: 0; top: 155px; z-index: 3; max-width: 50%;
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

.curbism-root .hero-account {
  color: #D75F68; text-decoration: none;
  font-size: 12px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase;
  line-height: 1;
  display: inline-flex; align-items: center;
  transition: opacity 0.15s ease;
}
.curbism-root .hero-account:hover { opacity: 0.7; }

.curbism-root .hero-nav {
  position: absolute; top: 36px; right: 36px; z-index: 5;
  display: inline-flex; align-items: center; gap: 22px;
}
.curbism-root .hero-menu-toggle {
  display: none;
  position: fixed; top: 22px; right: 22px; z-index: 6;
  width: 40px; height: 40px; padding: 0;
  background: transparent; border: none; cursor: pointer;
  color: #D75F68; font-size: 36px; line-height: 1; font-weight: 300;
  font-family: inherit;
  transition: transform 0.2s ease;
}
.curbism-root .hero-menu-toggle.is-open { transform: rotate(45deg); z-index: 52; }
.curbism-root .hero-mobile-menu { position: fixed; inset: 0; z-index: 50; }
.curbism-root .hero-mobile-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.85); border: none; cursor: pointer; }
.curbism-root .hero-mobile-panel {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  padding: 100px 24px 40px;
}
.curbism-root .hmm-main {
  display: flex; flex-direction: column; align-items: center; gap: 28px;
}
.curbism-root .hmm-auth {
  display: flex; flex-direction: column; align-items: center; gap: 20px;
  margin-top: auto; padding-top: 40px;
  border-top: 1px solid rgba(255,255,255,0.15);
  width: 100%;
}
.curbism-root .hmm-link {
  background: transparent; border: none; padding: 0; font-family: inherit; cursor: pointer;
  color: #fff; text-decoration: none;
  font-size: 18px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 10px;
}
.curbism-root .hmm-link:hover { color: #D75F68; }
.curbism-root .hmm-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 22px; padding: 0 6px;
  background: #D75F68; color: #fff;
  font-size: 11px; font-weight: 800; letter-spacing: 0; border-radius: 11px;
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
.curbism-root .appeared-in-track img { height: 42px; width: auto; max-width: none; display: block; flex-shrink: 0; padding-right: 0; margin-right: 25px; }
@keyframes appeared-in-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.curbism-root .intro-text { background: white; padding: 32px 40px 80px; font-family: 'DIN Condensed', 'DIN Alternate', 'Barlow Condensed', 'Oswald', sans-serif; }
.curbism-root .intro-text h2 { font-size: clamp(28px, 4.2vw, 56px); font-weight: 900; text-transform: uppercase; letter-spacing: -0.035em; line-height: 1.15; color: #000; margin-bottom: 24px; }
.curbism-root .intro-text p { font-size: clamp(28px, 4.2vw, 56px); font-weight: 900; text-transform: uppercase; letter-spacing: -0.035em; line-height: 1.15; color: #111; }
.curbism-root .intro-cta { margin-top: 32px; display: inline-block; background: #D75F68; color: #fff; border: none; padding: 16px 28px; font-size: 14px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; cursor: pointer; border-radius: 0; transition: background 0.2s ease; }
.curbism-root .intro-cta:hover { background: #000; }
@media (max-width: 768px) {
  .curbism-root .appeared-in { padding: 24px 24px 12px; }
  .curbism-root .appeared-in-track img { height: 28px; width: auto; max-width: none; padding-right: 0; margin-right: 25px; }
  .curbism-root .intro-text { padding: 12px 24px 40px; max-width: 100%; }
  .curbism-root .intro-text h2 { font-size: clamp(24px, 6.5vw, 40px); }
  .curbism-root .intro-text p { font-size: clamp(24px, 6.5vw, 40px); }
}

.curbism-root .footer {
  display: flex; justify-content: space-between; align-items: flex-end;
  gap: 32px; padding: 48px 40px; background: #fff;
  border-top: 1px solid #ededed;
}
.curbism-root .footer-brand { display: block; margin-left: -40px; }
.curbism-root .footer-brand img { height: 28px; width: auto; display: block; }
.curbism-root .footer-copy, .curbism-root .footer-links { margin-left: 0; }
.curbism-root .footer-copy {
  margin: 14px 0 0; font-size: 11px; letter-spacing: 0.05em;
  color: #8a8a8a; line-height: 1.6;
}
.curbism-root .footer-links {
  margin-top: 16px; display: flex; align-items: center; gap: 12px;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
}
.curbism-root .footer-links a { color: #111; text-decoration: none; transition: color 0.15s ease; }
.curbism-root .footer-links a:hover { color: #D75F68; }
.curbism-root .footer-dot { color: #ccc; }
.curbism-root .footer-curbism {
  display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
  text-decoration: none; flex-shrink: 0;
}
.curbism-root .footer-curbism span {
  font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase; color: #aaa;
}
.curbism-root .footer-curbism img {
  height: 22px; width: auto; display: block; transition: opacity 0.15s ease;
}
.curbism-root .footer-curbism:hover img { opacity: 0.6; }

@media (max-width: 1024px) {
  .curbism-root .hero-logo  { top: 40px; left: 0; height: 40px; }
  .curbism-root .hero-title { left: 0; top: 100px; padding-left: 22px; max-width: 60%; font-size: clamp(20px, 5.5vw, 36px); line-height: 1.35; letter-spacing: -0.01em; }

  .curbism-root .hero--search .hero-title { display: none; }
  .curbism-root .hero-search { left: 22px; right: 22px; width: auto; top: auto; bottom: 56px; padding-left: 0; }
  .curbism-root .hero-search input { padding: 12px 14px; font-size: 16px; }
  .curbism-root .hero-counter { bottom: 22px; right: 22px; font-size: 10px; }
  .curbism-root .hero-nav { top: 22px; right: 22px; }
  .curbism-root .hero-nav--desktop { display: none; }
  .curbism-root .hero-menu-toggle { display: inline-flex; align-items: center; justify-content: center; }
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
  .curbism-root .footer { flex-direction: column; align-items: flex-start; gap: 26px; padding: 36px 24px; }
  .curbism-root .footer-brand { margin-left: -24px; }
  .curbism-root .footer-curbism { align-items: flex-start; }
}

/* FEATURED MASONRY */
.curbism-root .featured-masonry { background: white; padding: 0 0 60px; }
.curbism-root .featured-masonry-grid {
  display: flex;
  gap: 0;
  align-items: flex-start;
}
.curbism-root .featured-masonry-col {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.curbism-root .featured-masonry-link { display: block; }
.curbism-root .featured-masonry-col img {
  width: 100%;
  height: auto;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
}
.curbism-root .featured-masonry-sentinel { height: 1px; }
.curbism-root .featured-masonry-loading { padding: 24px 0; font-size: 11px; letter-spacing: 0.25em; text-transform: uppercase; color: #777; text-align: center; }
@media (max-width: 768px) {
  .curbism-root .featured-masonry { padding: 0 0 40px; }
}

.curbism-root .home-stack { position: relative; }
.curbism-root .home-fade { opacity: 1; transition: opacity 3.5s ease; }
.curbism-root .home-fade--hidden { opacity: 0; pointer-events: none; }
.curbism-root .home-stack:has(.search-results) .home-fade { position: absolute; inset: 0; width: 100%; }

/* SEARCH SUBMIT ARROW */
.curbism-root .hero-search { display: flex; align-items: stretch; }
.curbism-root .hero-search input { flex: 1 1 auto; }
.curbism-root .hero-search-submit {
  flex: 0 0 auto;
  background: rgba(255,255,255,0.3);
  border: none;
  border-left: 1px solid rgba(0,0,0,0.45);
  padding: 0 18px;
  cursor: pointer;
  color: #D75F68;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.25s ease, color 0.25s ease, opacity 0.2s ease;
}
.curbism-root .hero-search-submit:hover:not(:disabled) { background: #000; color: #fff; }
.curbism-root .hero-search-submit:disabled { cursor: not-allowed; }
.curbism-root .hero-search-submit svg { opacity: 1; }
.curbism-root .hero-search:focus-within .hero-search-submit { background: rgba(255,255,255,0.8); }
.curbism-root .hero-search:focus-within .hero-search-submit:hover:not(:disabled) { background: #000; color: #fff; }

/* SEARCH RESULTS */
.curbism-root .search-results {
  padding: 32px 40px 120px;
  animation: searchResultsIn 0.8s ease 0.6s both;
}
.curbism-root .search-results-header {
  font-family: 'DIN Condensed', 'DIN Alternate', 'Barlow Condensed', 'Oswald', sans-serif;
  font-size: clamp(28px, 4.2vw, 56px);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.035em;
  line-height: 1.15;
  color: #000;
  margin-bottom: 28px;
  display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap;
}
.curbism-root .search-results-header .srh-actions { display: inline-flex; align-items: center; gap: 10px; }
.curbism-root .search-results-header .srh-iconbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 38px; height: 38px;
  background: #fff; color: #111; border: 1px solid #111;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}
.curbism-root .search-results-header .srh-iconbtn:hover { background: #111; color: #fff; }
.curbism-root .search-results-header .srh-text { flex: 1; min-width: 0; }
.curbism-root .search-results-header .srh-lightbox {
  display: inline-flex; align-items: center; gap: 8px;
  height: 38px; padding: 0 14px; background: #fff; color: #111; border: 1px solid #111;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 11px; font-weight: 700; letter-spacing: 0.2em;
  text-decoration: none; text-transform: uppercase;
  transition: background 0.2s ease, color 0.2s ease;
}
.curbism-root .search-results-header .srh-lightbox:hover { background: #D75F68; color: #fff; border-color: #D75F68; }
.curbism-root .search-results-header .srh-lb-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px;
  background: #D75F68; color: #fff; font-size: 10px; letter-spacing: 0.05em;
}
.curbism-root .search-results-header .srh-lightbox:hover .srh-lb-count { background: #111; }
.curbism-root .search-results-header .srp-hint { color: #e0e0e0; font-weight: 900; }
.curbism-root .search-results-header .srp-meta { color: #999; font-weight: 900; }
.curbism-root .search-results-status {
  font-size: 11px; letter-spacing: 0.3em; color: #777; text-transform: uppercase;
  padding: 40px 0 200px;
}
.curbism-root .search-pager {
  display: flex; align-items: center; justify-content: flex-start; flex-wrap: nowrap; gap: 6px;
  padding: 18px 0; margin: 0 0 8px;
  border-top: 1px solid #eee; border-bottom: 1px solid #eee;
  font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
  overflow-x: auto;
}
.curbism-root .search-pager-btn {
  background: #000; color: #fff; border: none; padding: 0;
  width: 38px; height: 38px;
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; font-family: inherit; flex-shrink: 0;
}
.curbism-root .search-pager-btn--prev svg { transform: scaleX(-1); }
.curbism-root .search-pager-btn:disabled { opacity: 0.25; cursor: not-allowed; }
.curbism-root .search-pager-ellipsis {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 24px; height: 38px; color: #777; flex-shrink: 0;
}
.curbism-root .search-pager-num {
  background: transparent; color: #000; border: 1px solid #ddd;
  padding: 0 10px; min-width: 38px; height: 38px; font-size: 11px; letter-spacing: 0.15em;
  cursor: pointer; font-family: inherit; flex-shrink: 0;
}
.curbism-root .search-pager-num:hover { border-color: #000; }
.curbism-root .search-pager-num.is-active {
  background: #000; color: #fff; border-color: #000;
}
@media (max-width: 480px) {
  .curbism-root .search-pager { gap: 4px; }
  .curbism-root .search-pager-btn { width: 34px; height: 34px; }
  .curbism-root .search-pager-num { min-width: 32px; height: 34px; padding: 0 6px; font-size: 10px; letter-spacing: 0.08em; }
  .curbism-root .search-pager-ellipsis { min-width: 16px; height: 34px; }
}
.curbism-root .search-results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 24px;
}
.curbism-root .search-results-masonry {
  display: flex; align-items: flex-start; gap: 24px;
}
.curbism-root .masonry-col {
  flex: 1 1 0; min-width: 0;
  display: flex; flex-direction: column; gap: 24px;
}
.curbism-root .search-results-masonry .search-result-card { display: block; margin: 0; }
.curbism-root .search-results-masonry .search-result-card:hover { transform: none; }
.curbism-root .search-results-masonry .search-result-card img,
.curbism-root .search-results-masonry .search-result-fallback {
  width: 100%; height: auto; aspect-ratio: auto; object-fit: initial;
  display: block; background: #eee;
}
@media (max-width: 768px) {
  .curbism-root .search-results-masonry { gap: 14px; }
  .curbism-root .masonry-col { gap: 14px; }
}
.curbism-root .search-result-card {
  display: flex; flex-direction: column;
  background: #fafafa;
  cursor: pointer;
  transition: transform 0.25s ease;
}
.curbism-root .search-result-card:hover { transform: translateY(-2px); }
.curbism-root .search-result-card img,
.curbism-root .search-result-fallback {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
  background: #eee;
}
.curbism-root .search-result-card figcaption {
  padding: 10px 2px 0;
  display: flex; flex-direction: column; gap: 2px;
}
.curbism-root .search-result-card .src-num {
  font-size: 10px; letter-spacing: 0.25em; color: #999; text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}
.curbism-root .search-result-card .src-title {
  font-size: 12px; color: #111; letter-spacing: 0.04em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
@media (max-width: 768px) {
  .curbism-root .search-results { padding: 24px 22px 80px; }
  .curbism-root .search-results-header { flex-direction: column; align-items: flex-start; gap: 14px; font-size: 22px; }
  .curbism-root .search-results-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .curbism-root .search-result-card { min-width: 0; }
}
@keyframes searchResultsIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
