-- Círculo CMS-Plus Membresías: créditos de salud + círculo de cuidado
-- La membresía titular vive en ecosistema_entitlements (producto = cms_plus, plan = plata|oro|platino|diamante).

CREATE TABLE IF NOT EXISTS public.cms_plus_creditos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  periodo text NOT NULL,
  allotment integer NOT NULL DEFAULT 0 CHECK (allotment >= 0),
  usados integer NOT NULL DEFAULT 0 CHECK (usados >= 0),
  compartidos_enviados integer NOT NULL DEFAULT 0 CHECK (compartidos_enviados >= 0),
  nivel text NOT NULL DEFAULT 'plata',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, periodo)
);

CREATE TABLE IF NOT EXISTS public.cms_plus_creditos_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  periodo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('uso', 'compartir', 'recibir', 'bono_fidelidad', 'ajuste', 'renovacion')),
  cantidad integer NOT NULL,
  nota text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cms_plus_circulo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  beneficiario_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  email_invitado text,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'left', 'revoked', 'converted')),
  descuento_pct integer NOT NULL DEFAULT 20 CHECK (descuento_pct BETWEEN 0 AND 50),
  activado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cms_plus_creditos_user ON public.cms_plus_creditos (user_id, periodo);
CREATE INDEX IF NOT EXISTS idx_cms_plus_mov_user ON public.cms_plus_creditos_movimientos (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cms_plus_circulo_titular ON public.cms_plus_circulo (titular_id, status);
CREATE INDEX IF NOT EXISTS idx_cms_plus_circulo_benef ON public.cms_plus_circulo (beneficiario_id)
  WHERE beneficiario_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cms_plus_circulo_token ON public.cms_plus_circulo (token);

ALTER TABLE public.cms_plus_creditos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_plus_creditos_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_plus_circulo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cms_plus_creditos_select_own" ON public.cms_plus_creditos;
CREATE POLICY "cms_plus_creditos_select_own" ON public.cms_plus_creditos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cms_plus_mov_select_own" ON public.cms_plus_creditos_movimientos;
CREATE POLICY "cms_plus_mov_select_own" ON public.cms_plus_creditos_movimientos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cms_plus_circulo_select_own" ON public.cms_plus_circulo;
CREATE POLICY "cms_plus_circulo_select_own" ON public.cms_plus_circulo
  FOR SELECT TO authenticated
  USING (auth.uid() = titular_id OR auth.uid() = beneficiario_id);

DROP POLICY IF EXISTS "cms_plus_creditos_service" ON public.cms_plus_creditos;
CREATE POLICY "cms_plus_creditos_service" ON public.cms_plus_creditos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cms_plus_mov_service" ON public.cms_plus_creditos_movimientos;
CREATE POLICY "cms_plus_mov_service" ON public.cms_plus_creditos_movimientos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cms_plus_circulo_service" ON public.cms_plus_circulo;
CREATE POLICY "cms_plus_circulo_service" ON public.cms_plus_circulo
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ContacNeed PRO público también desde CMS-Plus
CREATE OR REPLACE VIEW public.perfiles_pro_publicos AS
SELECT
  p.id,
  p.nombre,
  p.descripcion_profesion,
  p.estado,
  p.verificado,
  p.avatar_url,
  true AS es_pro
FROM public.perfiles p
WHERE EXISTS (
  SELECT 1
  FROM public.ecosistema_entitlements e
  WHERE e.user_id = p.id
    AND e.producto IN ('contacneed_pro', 'cms_plus')
    AND e.status = 'active'
    AND (e.expires_at IS NULL OR e.expires_at > now())
)
OR (p.es_pro = true AND NOT EXISTS (
  SELECT 1 FROM public.ecosistema_entitlements e2
  WHERE e2.user_id = p.id
    AND e2.producto IN ('contacneed_pro', 'cms_plus')
    AND e2.status = 'cancelled'
));

GRANT SELECT ON public.perfiles_pro_publicos TO anon, authenticated;

COMMENT ON TABLE public.cms_plus_creditos IS 'Créditos de salud mensuales Círculo CMS-Plus';
COMMENT ON TABLE public.cms_plus_circulo IS 'Círculo de cuidado familiar/amigos (beneficiarios, no pirámide)';
