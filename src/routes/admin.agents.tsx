import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "./admin";

export const Route = createFileRoute("/admin/agents")({
  component: AgentsPage,
});

type Agent = {
  id: string;
  name: string;
  email: string | null;
  website: string | null;
  bank_details: string | null;
  discount_pct: number;
  split_pct: number;
  code: string;
  active: boolean;
  notes: string | null;
  created_at: string;
};

type SaleRow = {
  id: string;
  created_at: string;
  amount: number | null;
  currency: string;
  download_tier: string | null;
  image_id: string | null;
  image_number?: number | null;
  title?: string | null;
};

const CODE_RE = /^[A-Z0-9]{3,8}$/;

const emptyForm = {
  name: "",
  email: "",
  website: "",
  bank_details: "",
  discount_pct: "10",
  split_pct: "50",
  code: "",
};

function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Agent | null>(null);

  const [form, setForm] = useState({ ...emptyForm });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadAgents() {
    setLoading(true);
    const { data } = await supabase
      .from("agents")
      .select("*")
      .order("created_at", { ascending: false });
    setAgents((data as Agent[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAgents();
  }, []);

  async function addAgent() {
    setFormError(null);
    const code = form.code.trim().toUpperCase();
    const discount = Number(form.discount_pct);
    const split = Number(form.split_pct);

    if (!form.name.trim()) return setFormError("Name is required");
    if (!CODE_RE.test(code))
      return setFormError("Code must be 3–8 capital letters or numbers (e.g. WHSK)");
    if (!(discount >= 0 && discount <= 100)) return setFormError("Discount % must be 0–100");
    if (!(split >= 0 && split <= 100)) return setFormError("Split % must be 0–100");

    setSaving(true);
    const { error } = await supabase.from("agents").insert({
      name: form.name.trim(),
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      bank_details: form.bank_details.trim() || null,
      discount_pct: discount,
      split_pct: split,
      code,
    });
    setSaving(false);

    if (error) {
      const dup = /duplicate|unique/i.test(error.message);
      return setFormError(dup ? `Code ${code} is already in use` : error.message);
    }
    setForm({ ...emptyForm });
    loadAgents();
  }

  async function toggleActive(a: Agent) {
    await supabase.from("agents").update({ active: !a.active }).eq("id", a.id);
    loadAgents();
  }

  if (selected) {
    return <AgentDetail agent={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <>
      <style>{agentsCss}</style>
      <PageHeader title="Agents" />

      <div className="bi-section">
        <h2 className="bi-section-title">Add an agent</h2>
        <div className="ag-form">
          <div className="bi-field">
            <label className="bi-label">Name</label>
            <input
              className="bi-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="bi-field">
            <label className="bi-label">Email</label>
            <input
              className="bi-input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="bi-field">
            <label className="bi-label">Website</label>
            <input
              className="bi-input"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>
          <div className="bi-field">
            <label className="bi-label">Discount % (customer sees this)</label>
            <input
              className="bi-input"
              type="number"
              min={0}
              max={100}
              value={form.discount_pct}
              onChange={(e) => setForm({ ...form, discount_pct: e.target.value })}
            />
          </div>
          <div className="bi-field">
            <label className="bi-label">Split % (your reminder — never shown to anyone)</label>
            <input
              className="bi-input"
              type="number"
              min={0}
              max={100}
              value={form.split_pct}
              onChange={(e) => setForm({ ...form, split_pct: e.target.value })}
            />
          </div>
          <div className="bi-field">
            <label className="bi-label">Code (you create — e.g. WHSK)</label>
            <input
              className="bi-input ag-code-input"
              value={form.code}
              maxLength={8}
              placeholder="WHSK"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="bi-field ag-form-full">
            <label className="bi-label">Bank details</label>
            <textarea
              className="bi-textarea"
              value={form.bank_details}
              placeholder="Account name, sort code & account number, or IBAN"
              onChange={(e) => setForm({ ...form, bank_details: e.target.value })}
            />
          </div>
        </div>

        {formError && <div className="ag-error">{formError}</div>}

        <button className="bi-btn bi-btn--accent" onClick={addAgent} disabled={saving}>
          {saving ? "Saving…" : "Add agent"}
        </button>
      </div>

      <div className="bi-section">
        <h2 className="bi-section-title">Your agents</h2>
        {loading ? (
          <div className="bi-placeholder">Loading…</div>
        ) : agents.length === 0 ? (
          <div className="bi-placeholder">No agents yet</div>
        ) : (
          <table className="ag-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Discount</th>
                <th>Status</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className={a.active ? "" : "ag-row--off"}>
                  <td>{a.name}</td>
                  <td>
                    <span className="ag-code-pill">{a.code}</span>
                  </td>
                  <td>{a.discount_pct}%</td>
                  <td>{a.active ? "Active" : "Inactive"}</td>
                  <td>
                    <button className="ag-link" onClick={() => setSelected(a)}>
                      View sales →
                    </button>
                  </td>
                  <td>
                    <button className="ag-link ag-link--muted" onClick={() => toggleActive(a)}>
                      {a.active ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function AgentDetail({ agent, onBack }: { agent: Agent; onBack: () => void }) {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: rows } = await supabase
        .from("sales")
        .select("id, created_at, amount, currency, download_tier, image_id")
        .eq("agent_id", agent.id)
        .order("created_at", { ascending: false });
      const list = (rows as SaleRow[] | null) ?? [];

      const imageIds = Array.from(
        new Set(list.map((r) => r.image_id).filter(Boolean)),
      ) as string[];
      const imgMap = new Map<string, { image_number: number | null; title: string | null }>();
      if (imageIds.length) {
        const { data: imgs } = await supabase
          .from("images")
          .select("id, image_number, title")
          .in("id", imageIds);
        for (const im of imgs ?? []) imgMap.set(im.id, im as any);
      }
      const merged = list.map((r) => ({
        ...r,
        image_number: r.image_id ? imgMap.get(r.image_id)?.image_number ?? null : null,
        title: r.image_id ? imgMap.get(r.image_id)?.title ?? null : null,
      }));
      if (alive) {
        setSales(merged);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [agent.id]);

  const currency = sales[0]?.currency || "GBP";
  const sym = currency === "USD" ? "$" : "£";
  const total = sales.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const owed = (total * (Number(agent.split_pct) || 0)) / 100;
  const fmt = (n: number) => `${sym}${n.toFixed(2)}`;
  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <>
      <style>{agentsCss}</style>

      <div className="no-print">
        <button className="bi-btn" onClick={onBack}>
          ← Back to agents
        </button>
      </div>

      {/* PRIVATE reminder — screen only, never on the printed statement */}
      <div className="ag-reminder no-print">
        <div>
          <span className="ag-reminder-label">Your split for {agent.name}</span>
          <span className="ag-reminder-val">{agent.split_pct}%</span>
        </div>
        <div>
          <span className="ag-reminder-label">You owe (of {fmt(total)} received)</span>
          <span className="ag-reminder-val">{fmt(owed)}</span>
        </div>
        <p className="ag-reminder-note">
          This box is just for you. It is not on the PDF and is never shown to the agent or customer.
        </p>
      </div>

      {/* The printable statement */}
      <div className="ag-statement">
        <div className="ag-stmt-head">
          <div>
            <div className="ag-stmt-brand">BEAUTYIMAGES</div>
            <div className="ag-stmt-sub">Sales statement</div>
          </div>
          <div className="ag-stmt-meta">
            <div>{fmtDate(new Date().toISOString())}</div>
            <div>Code: {agent.code}</div>
          </div>
        </div>

        <div className="ag-stmt-agent">
          <div className="ag-stmt-agent-name">{agent.name}</div>
          {agent.email && <div>{agent.email}</div>}
          {agent.website && <div>{agent.website}</div>}
        </div>

        {loading ? (
          <div className="bi-placeholder no-print">Loading…</div>
        ) : sales.length === 0 ? (
          <div className="ag-stmt-empty">No sales have come through this code yet.</div>
        ) : (
          <>
            <table className="ag-table ag-stmt-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Image</th>
                  <th>Title</th>
                  <th>Licence</th>
                  <th className="ag-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.created_at)}</td>
                    <td>
                      {r.image_number != null
                        ? `#${String(r.image_number).padStart(8, "0")}`
                        : "—"}
                    </td>
                    <td>{r.title || "—"}</td>
                    <td>{(r.download_tier || "—").toUpperCase()}</td>
                    <td className="ag-num">{fmt(Number(r.amount) || 0)}</td>
                  </tr>
                ))}
                <tr className="ag-stmt-total">
                  <td colSpan={4}>TOTAL ({sales.length} {sales.length === 1 ? "sale" : "sales"})</td>
                  <td className="ag-num">{fmt(total)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="no-print" style={{ marginTop: 24 }}>
        <button className="bi-btn bi-btn--accent" onClick={() => window.print()}>
          Save as PDF
        </button>
      </div>
    </>
  );
}

const agentsCss = `
.ag-form { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
.ag-form-full { grid-column: 1 / -1; }
.ag-code-input { text-transform: uppercase; letter-spacing: 0.2em; font-weight: 800; }
.ag-error { color: #D75F68; font-size: 12px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; margin: 4px 0 16px; }

.ag-table { width: 100%; border-collapse: collapse; }
.ag-table th { text-align: left; font-size: 11px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #888; padding: 10px 12px; border-bottom: 2px solid #000; }
.ag-table td { font-size: 14px; padding: 14px 12px; border-bottom: 1px solid #ddd; vertical-align: middle; }
.ag-row--off td { color: #aaa; }
.ag-code-pill { display: inline-block; background: #000; color: #fff; font-weight: 800; letter-spacing: 0.18em; padding: 4px 10px; font-size: 13px; }
.ag-link { background: none; border: 0; color: #D75F68; font-weight: 800; font-size: 13px; letter-spacing: 0.02em; text-transform: uppercase; cursor: pointer; font-family: inherit; padding: 0; }
.ag-link:hover { text-decoration: underline; }
.ag-link--muted { color: #888; }
.ag-num { text-align: right; font-variant-numeric: tabular-nums; }

.ag-reminder { border: 2px solid #D75F68; background: #fff5f6; padding: 20px 24px; margin: 24px 0 32px; display: flex; gap: 48px; flex-wrap: wrap; }
.ag-reminder-label { display: block; font-size: 11px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #9e2630; margin-bottom: 6px; }
.ag-reminder-val { font-size: 28px; font-weight: 900; color: #000; }
.ag-reminder-note { flex-basis: 100%; margin: 4px 0 0; font-size: 11px; color: #9e2630; letter-spacing: 0.02em; }

.ag-statement { border: 1px solid #000; padding: 40px; }
.ag-stmt-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #000; padding-bottom: 20px; margin-bottom: 24px; }
.ag-stmt-brand { font-size: 20px; font-weight: 900; letter-spacing: 0.02em; }
.ag-stmt-sub { font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #888; margin-top: 4px; }
.ag-stmt-meta { text-align: right; font-size: 12px; font-weight: 700; letter-spacing: 0.02em; color: #444; }
.ag-stmt-agent { margin-bottom: 28px; font-size: 13px; color: #444; line-height: 1.5; }
.ag-stmt-agent-name { font-size: 16px; font-weight: 900; color: #000; letter-spacing: 0.02em; }
.ag-stmt-empty { padding: 40px 0; font-size: 13px; color: #888; }
.ag-stmt-table td { border-bottom: 1px solid #eee; }
.ag-stmt-total td { border-top: 2px solid #000; border-bottom: 0; font-weight: 900; font-size: 15px; padding-top: 16px; }

@media print {
  .bi-sidebar, .no-print { display: none !important; }
  .bi-shell { display: block !important; }
  .bi-main { padding: 0 !important; }
  .ag-statement { border: 0; padding: 0; }
  body { background: #fff; }
}

@media (max-width: 768px) {
  .ag-form { grid-template-columns: 1fr; }
  .ag-reminder { gap: 24px; }
  .ag-statement { padding: 20px; }
  .ag-table th:nth-child(3), .ag-table td:nth-child(3) { display: none; }
}
`;
