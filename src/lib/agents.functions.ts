import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// Service-role client. The agents table is admin-only under RLS, so code
// validation MUST run server-side — a public/basket user cannot read it
// directly. This deliberately never returns split_pct (the private
// commission), only what the customer is allowed to see.
function serviceClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const CODE_RE = /^[A-Z0-9]{3,8}$/;

export function normaliseCode(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase();
}

export interface AgentCodeResult {
  valid: boolean;
  code: string;
  discountPct: number;
  agentName: string | null;
}

export const validateAgentCode = createServerFn({ method: "POST" })
  .inputValidator((data: { code: string }) => {
    const code = normaliseCode(data?.code);
    if (!CODE_RE.test(code)) throw new Error("Invalid code format");
    return { code };
  })
  .handler(async ({ data }): Promise<AgentCodeResult> => {
    const supabase = serviceClient();
    const { data: agent } = await supabase
      .from("agents")
      .select("name, code, discount_pct, active")
      .eq("code", data.code)
      .maybeSingle();

    if (!agent || agent.active !== true) {
      return { valid: false, code: data.code, discountPct: 0, agentName: null };
    }

    return {
      valid: true,
      code: agent.code,
      discountPct: Number(agent.discount_pct) || 0,
      agentName: agent.name ?? null,
    };
  });
