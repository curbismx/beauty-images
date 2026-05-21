import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "./admin";
import { getImage, updateImage, listImages } from "@/lib/images.functions";

export const Route = createFileRoute("/admin/image/$id")({
  component: ImageEdit,
});

function ImageEdit() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchImage = useServerFn(getImage);
  const fetchList = useServerFn(listImages);
  const save = useServerFn(updateImage);

  const imageQ = useQuery({
    queryKey: ["image", id],
    queryFn: () => fetchImage({ data: { id } }),
  });

  // Use the "ready" filter for next/prev navigation (after keywording, before publish)
  const listQ = useQuery({
    queryKey: ["library-images", "all", ""],
    queryFn: () => fetchList({ data: { filter: "all", search: "", limit: 500 } }),
  });

  const [form, setForm] = useState({
    title: "",
    caption: "",
    keywordsText: "",
    category: "",
    availability: "available" as "available" | "on_hold" | "licensed",
    pricing_tier: "",
    model_release: false,
    admin_notes: "",
    featured: false,
    public: false,
  });

  useEffect(() => {
    if (!imageQ.data) return;
    const d = imageQ.data;
    setForm({
      title: d.title ?? "",
      caption: d.caption ?? "",
      keywordsText: (d.keywords ?? []).join(", "),
      category: d.category ?? "",
      availability: (d.availability as "available" | "on_hold" | "licensed") ?? "available",
      pricing_tier: d.pricing_tier ?? "",
      model_release: d.model_release,
      admin_notes: d.admin_notes ?? "",
      featured: d.featured,
      public: d.public,
    });
  }, [imageQ.data]);

  const saveMutation = useMutation({
    mutationFn: (patch: { publish?: boolean }) =>
      save({
        data: {
          id,
          title: form.title.trim() || null,
          caption: form.caption.trim() || null,
          keywords: form.keywordsText
            .split(",")
            .map((k) => k.trim().toLowerCase())
            .filter(Boolean),
          category: form.category.trim() || null,
          availability: form.availability,
          pricing_tier: form.pricing_tier.trim() || null,
          model_release: form.model_release,
          admin_notes: form.admin_notes.trim() || null,
          featured: form.featured,
          public: patch.publish ?? form.public,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["image", id] });
      qc.invalidateQueries({ queryKey: ["library-images"] });
      qc.invalidateQueries({ queryKey: ["image-stats"] });
      qc.invalidateQueries({ queryKey: ["recent-images"] });
    },
  });

  const list = listQ.data ?? [];
  const idx = list.findIndex((r) => r.id === id);
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;

  if (imageQ.isLoading) {
    return (
      <>
        <PageHeader title="Image" />
        <div className="bi-placeholder">Loading…</div>
      </>
    );
  }
  if (!imageQ.data) {
    return (
      <>
        <PageHeader title="Image" />
        <div className="bi-placeholder">Not found</div>
      </>
    );
  }
  const d = imageQ.data;

  const handleSaveAndNext = async () => {
    await saveMutation.mutateAsync({});
    if (next) navigate({ to: "/admin/image/$id", params: { id: next.id } });
  };

  return (
    <>
      <PageHeader title={`#${String(d.image_number).padStart(8, "0")} — ${d.filename}`} />


      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 8 }}>
        <Link to="/admin/library" className="bi-btn">← Library</Link>
        <div style={{ display: "flex", gap: 8 }}>
          {prev ? (
            <Link to="/admin/image/$id" params={{ id: prev.id }} className="bi-btn">
              ← #{String(prev.image_number).padStart(8, "0")}
            </Link>
          ) : (
            <button className="bi-btn" disabled>← Prev</button>
          )}
          {next ? (
            <Link to="/admin/image/$id" params={{ id: next.id }} className="bi-btn">
              #{String(next.image_number).padStart(8, "0")} →
            </Link>
          ) : (
            <button className="bi-btn" disabled>Next →</button>
          )}
        </div>
      </div>

      <div className="bi-two-col">
        <div>
          <div className="bi-preview" style={{ padding: 0, overflow: "hidden", aspectRatio: "1 / 1", background: "#f4f4f4" }}>
            {d.signed_url ? (
              <img src={d.signed_url} alt={d.filename} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <div style={{ padding: 24 }}>No preview</div>
            )}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {d.keyworded_at ? `Keyworded ${new Date(d.keyworded_at).toLocaleString()}` : "Not yet keyworded"}
          </div>
        </div>

        <div>
          <div className="bi-field">
            <label className="bi-label">Title</label>
            <input
              className="bi-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="bi-field">
            <label className="bi-label">Caption / description</label>
            <textarea
              className="bi-textarea"
              rows={3}
              value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
            />
          </div>
          <div className="bi-field">
            <label className="bi-label">
              Keywords ({form.keywordsText.split(",").map((k) => k.trim()).filter(Boolean).length})
            </label>
            <textarea
              className="bi-textarea"
              rows={4}
              placeholder="comma, separated, keywords"
              value={form.keywordsText}
              onChange={(e) => setForm({ ...form, keywordsText: e.target.value })}
            />
          </div>
          <div className="bi-field">
            <label className="bi-label">Category</label>
            <input
              className="bi-input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
          <div className="bi-field">
            <label className="bi-label">Pricing tier</label>
            <input
              className="bi-input"
              value={form.pricing_tier}
              onChange={(e) => setForm({ ...form, pricing_tier: e.target.value })}
            />
          </div>
          <div className="bi-field">
            <label className="bi-label">Availability</label>
            <select
              className="bi-select"
              value={form.availability}
              onChange={(e) => setForm({ ...form, availability: e.target.value as typeof form.availability })}
            >
              <option value="available">Available</option>
              <option value="on_hold">On hold</option>
              <option value="licensed">Licensed</option>
            </select>
          </div>
          <div className="bi-field">
            <label className="bi-checkbox">
              <input
                type="checkbox"
                checked={form.model_release}
                onChange={(e) => setForm({ ...form, model_release: e.target.checked })}
              />{" "}
              Model release on file
            </label>
          </div>
          <div className="bi-field">
            <label className="bi-checkbox">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />{" "}
              Featured
            </label>
          </div>
          <div className="bi-field">
            <label className="bi-checkbox">
              <input
                type="checkbox"
                checked={form.public}
                onChange={(e) => setForm({ ...form, public: e.target.checked })}
              />{" "}
              Published to site
            </label>
          </div>
          <div className="bi-field">
            <label className="bi-label">Admin notes</label>
            <textarea
              className="bi-textarea"
              rows={2}
              value={form.admin_notes}
              onChange={(e) => setForm({ ...form, admin_notes: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            <button
              className="bi-btn"
              onClick={() => saveMutation.mutate({})}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
            <button
              className="bi-btn"
              onClick={handleSaveAndNext}
              disabled={saveMutation.isPending || !next}
            >
              Save & next
            </button>
            {!form.public ? (
              <button
                className="bi-btn bi-btn--accent"
                onClick={() => {
                  setForm({ ...form, public: true });
                  saveMutation.mutate({ publish: true });
                }}
                disabled={saveMutation.isPending}
              >
                Publish to site
              </button>
            ) : (
              <button
                className="bi-btn"
                onClick={() => {
                  setForm({ ...form, public: false });
                  saveMutation.mutate({ publish: false });
                }}
                disabled={saveMutation.isPending}
              >
                Unpublish
              </button>
            )}
          </div>

          {saveMutation.isError && (
            <div style={{ marginTop: 12, padding: 10, border: "1px solid #D75F68", color: "#D75F68", fontSize: 12 }}>
              {(saveMutation.error as Error).message}
            </div>
          )}
          {saveMutation.isSuccess && (
            <div style={{ marginTop: 12, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Saved
            </div>
          )}
        </div>
      </div>
    </>
  );
}
