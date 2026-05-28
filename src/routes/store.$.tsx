import { createFileRoute, redirect } from "@tanstack/react-router";

// Mirror of the /shop redirect for Squarespace's alternate /store/p/<id> URLs.
export const Route = createFileRoute("/store/$")({
  beforeLoad: () => {
    throw redirect({ to: "/", statusCode: 301 });
  },
  component: () => null,
});
