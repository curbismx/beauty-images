import { createFileRoute, redirect } from "@tanstack/react-router";

// Old Squarespace product URLs (/shop/p/<id>) point at this domain, which now
// runs on Lovable and has no /shop section. 301-redirect anything under /shop/*
// to the homepage so old links — and any Google ranking still attached to them —
// land on the new site instead of hitting a 404.
export const Route = createFileRoute("/shop/$")({
  beforeLoad: () => {
    throw redirect({ to: "/", statusCode: 301 });
  },
  component: () => null,
});
