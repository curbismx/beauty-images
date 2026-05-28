CREATE TABLE IF NOT EXISTS public.agents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  email        text,
  website      text,
  bank_details text,
  discount_pct numeric NOT NULL DEFAULT 10,
  split_pct    numeric NOT NULL DEFAULT 50,
  code         text NOT NULL UNIQUE,
  active       boolean NOT NULL DEFAULT true,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agents_code_format    CHECK (code ~ '^[A-Z0-9]{3,8}$'),
  CONSTRAINT agents_discount_range CHECK (discount_pct >= 0 AND discount_pct <= 100),
  CONSTRAINT agents_split_range    CHECK (split_pct >= 0 AND split_pct <= 100)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;

CREATE INDEX IF NOT EXISTS agents_code_idx ON public.agents (code);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage agents" ON public.agents;
CREATE POLICY "Admins manage agents"
  ON public.agents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS agent_id        uuid REFERENCES public.agents(id);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS agent_code      text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_amount numeric;

CREATE INDEX IF NOT EXISTS sales_agent_id_idx ON public.sales (agent_id);