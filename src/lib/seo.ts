// SEO constants + helpers for Beauty Images.
// Canonical domain — what crawlers should index, regardless of which
// hostname the request actually arrived on.
export const SITE_URL = "https://beautyimages.com";
export const SITE_NAME = "Beauty Images";
export const BRAND_TAGLINE =
  "A curated library of premium beauty photography for creative and editorial work. License high-quality images for commercial use — quick, direct, online.";

/** Absolute URL on the canonical domain. Pass any path that starts with "/". */
export function abs(path: string): string {
  return path.startsWith("http") ? path : `${SITE_URL}${path}`;
}

/** Standard noindex meta — for utility / private routes (basket, login, admin…). */
export const NOINDEX_META = [
  { name: "robots", content: "noindex,nofollow" },
] as const;

/** Curated collections — these are the SEO category-workhorse pages.
 *  Each slug runs the search backend with `query` and presents a
 *  hand-written intro + a results grid.
 *  Order here is the order shown on /collections. */
export interface Collection {
  slug: string;
  title: string;            // Plain title, used in <h1> and og:title
  metaTitle: string;        // Used as <title> (includes brand)
  description: string;      // Used as meta description + og:description + intro lede
  intro: string;            // Longer paragraph below the H1
  query: string;            // Keyword string passed to searchPublicImages
}

export const COLLECTIONS: Collection[] = [
  {
    slug: "skin",
    title: "Skin & Complexion Photography",
    metaTitle: "Skin & Complexion Photography — Beauty Images",
    description:
      "Rights-managed close-up photography of real skin and complexion for cosmetics advertising and editorial use.",
    intro:
      "A curated selection of close-up skin and complexion photography — natural texture, real pores, freckles and tone — shot with real people, never AI-generated. Every image is exclusive to Beauty Images and licensed on a worldwide rights-managed basis to advertising and editorial buyers.",
    query: "skin",
  },
  {
    slug: "make-up",
    title: "Make-up Photography",
    metaTitle: "Make-up Photography — Beauty Images",
    description:
      "Exclusive make-up photography for cosmetics campaigns and editorial pages — lips, eyes, foundation and colour close-ups.",
    intro:
      "Make-up photography from the Beauty Images library — lipstick, eye make-up, foundation, mascara and colour close-ups. All real photography, all rights-managed, all shot exclusively for Beauty Images and available to license worldwide.",
    query: "makeup",
  },
  {
    slug: "hair",
    title: "Hair Photography",
    metaTitle: "Hair Photography — Beauty Images",
    description:
      "Rights-managed hair photography for haircare advertising and editorial — colour, texture, movement and styling.",
    intro:
      "Hair photography from Beauty Images — colour, texture, movement, styling and haircare close-ups. Exclusive, rights-managed, and made with real people and real photographers — never AI.",
    query: "hair",
  },
  {
    slug: "fragrance",
    title: "Fragrance & Still Life",
    metaTitle: "Fragrance & Beauty Still Life Photography — Beauty Images",
    description:
      "Fragrance bottles, perfume still life and beauty product imagery — rights-managed and exclusive to Beauty Images.",
    intro:
      "Fragrance and beauty still-life photography for perfume campaigns, brand pages and editorial. Each image is exclusive to Beauty Images and licensed directly online on a rights-managed basis.",
    query: "fragrance perfume",
  },
  {
    slug: "mens-grooming",
    title: "Men's Grooming Photography",
    metaTitle: "Men's Grooming Photography — Beauty Images",
    description:
      "Real men's grooming photography for skincare, shaving, haircare and editorial — rights-managed, exclusive, never AI.",
    intro:
      "Men's grooming photography from Beauty Images — skincare, shaving, haircare and grooming portraits. Real men, real photography, exclusively licensed for advertising and editorial use.",
    query: "men grooming",
  },
  {
    slug: "fashion-beauty",
    title: "Fashion Beauty Photography",
    metaTitle: "Fashion Beauty Photography — Beauty Images",
    description:
      "Editorial fashion beauty photography — high-end portraiture for magazine beauty pages and advertising campaigns.",
    intro:
      "High-end fashion beauty photography for magazine pages, beauty brand campaigns and editorial work. Each image in this collection is exclusive to Beauty Images and licensed worldwide on a rights-managed basis.",
    query: "fashion beauty",
  },
  {
    slug: "editorial-portraits",
    title: "Editorial Beauty Portraits",
    metaTitle: "Editorial Beauty Portraits — Beauty Images",
    description:
      "Editorial beauty portrait photography for magazine pages and advertising — rights-managed, exclusive, all real photography.",
    intro:
      "Editorial beauty portraits — close-up portraiture of the kind used in cosmetics advertising and the beauty pages of major magazines. Exclusively shot for Beauty Images, with real people and real photography, never AI.",
    query: "portrait beauty",
  },
  {
    slug: "diverse-beauty",
    title: "Diverse Beauty & Real Skin",
    metaTitle: "Diverse Beauty & Real Skin Photography — Beauty Images",
    description:
      "Diverse beauty photography — real skin, real people, all ages, ethnicities and tones. Rights-managed, exclusive, no AI.",
    intro:
      "Diverse beauty photography — featuring real people of all ages, ethnicities, skin types and tones. Every image is shot with real photographers and real subjects, never AI-generated, and is licensed exclusively through Beauty Images.",
    query: "diverse beauty",
  },
];

export function getCollection(slug: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.slug === slug);
}

/** Organization JSON-LD for the root route. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: abs("/beauty-images-logo.png"),
    description:
      "Beauty Images is an exclusive, rights-managed photography library specialising in beauty imagery for the advertising and editorial industries. All images are shot with real people and real photography — never AI-generated.",
    foundingDate: "2003",
    sameAs: [],
  };
}

/** WebSite JSON-LD with SearchAction for the home page. */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

/** BreadcrumbList JSON-LD helper. Pass [["Home","/"], …]. */
export function breadcrumbJsonLd(items: Array<[string, string]>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: abs(path),
    })),
  };
}
