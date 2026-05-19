import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "./admin";

export const Route = createFileRoute("/admin/image/$id")({
  component: ImageEdit,
});

function ImageEdit() {
  const { id } = Route.useParams();
  return (
    <>
      <PageHeader title={`Image ${id}`} />
      <div className="bi-two-col">
        <div className="bi-preview">Preview</div>
        <div>
          <div className="bi-field">
            <label className="bi-label">Caption</label>
            <textarea className="bi-textarea" />
          </div>
          <div className="bi-field">
            <label className="bi-label">Keywords</label>
            <input className="bi-input" placeholder="comma, separated" />
          </div>
          <div className="bi-field">
            <label className="bi-checkbox">
              <input type="checkbox" /> Model release on file
            </label>
          </div>
          <div className="bi-field">
            <label className="bi-label">Model release PDF</label>
            <input className="bi-input" type="file" accept="application/pdf" />
          </div>
          <div className="bi-field">
            <label className="bi-label">Category</label>
            <input className="bi-input" />
          </div>
          <div className="bi-field">
            <label className="bi-label">Pricing tier</label>
            <select className="bi-select">
              <option value="">—</option>
            </select>
          </div>
          <div className="bi-field">
            <label className="bi-label">Availability</label>
            <select className="bi-select" defaultValue="available">
              <option value="available">Available</option>
              <option value="on_hold">On hold</option>
              <option value="licensed">Licensed</option>
            </select>
          </div>
          <div className="bi-field">
            <label className="bi-label">Admin notes</label>
            <textarea className="bi-textarea" />
          </div>
          <button className="bi-btn">Save</button>
        </div>
      </div>
    </>
  );
}
