-- Ecosistema CMS VIAM: entitlements unificados (Nexus, Video Diamante, libros, consultas, ContacNeed PRO)
CREATE TABLE IF NOT EXISTS public.ecosistema_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  legacy_code text,
  producto text NOT NULL,
  plan text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  stripe_session_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eco_ent_user ON public.ecosistema_entitlements (user_id);
CREATE INDEX IF NOT EXISTS idx_eco_ent_legacy ON public.ecosistema_entitlements (legacy_code);
CREATE INDEX IF NOT EXISTS idx_eco_ent_producto ON public.ecosistema_entitlements (producto);
CREATE INDEX IF NOT EXISTS idx_eco_ent_status ON public.ecosistema_entitlements (status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eco_ent_legacy_producto
  ON public.ecosistema_entitlements (legacy_code, producto)
  WHERE legacy_code IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_eco_ent_user_producto
  ON public.ecosistema_entitlements (user_id, producto)
  WHERE user_id IS NOT NULL AND status = 'active';

ALTER TABLE public.ecosistema_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eco_ent_select_own" ON public.ecosistema_entitlements;
CREATE POLICY "eco_ent_select_own" ON public.ecosistema_entitlements
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "eco_ent_service_all" ON public.ecosistema_entitlements;
CREATE POLICY "eco_ent_service_all" ON public.ecosistema_entitlements
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.ecosistema_entitlements IS 'Permisos unificados del ecosistema CMS VIAM / ContacNeed / Nexus / Video Diamante';
