import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "./admin";

export const Route = createFileRoute("/admin/sales")({
  component: Sales,
});

function Sales() {
  return (
    <>
      <PageHeader title="Sales & licenses" />
      <div className="bi-table-placeholder">No sales yet</div>
    </>
  );
}
