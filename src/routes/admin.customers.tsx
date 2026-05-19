import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "./admin";

export const Route = createFileRoute("/admin/customers")({
  component: Customers,
});

function Customers() {
  return (
    <>
      <PageHeader title="Customers" />
      <div className="bi-table-placeholder">No customers yet</div>
    </>
  );
}
