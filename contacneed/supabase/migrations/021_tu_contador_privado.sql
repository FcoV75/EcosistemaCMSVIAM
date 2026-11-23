-- Script 021: Tu Contador Privado (control contable mensual para oficios / PyME)
-- Aislado por owner_id. Educativo: no sustituye contador ni firma ante el SAT.

CREATE TABLE IF NOT EXISTS public.contador_config (
  user_id uuid PRIMARY KEY REFERENCES public.perfiles(id) ON DELETE CASCADE,
  nombre_negocio text NOT NULL DEFAULT '',
  rfc text,
  regimen text NOT NULL DEFAULT 'resico'
    CHECK (regimen IN ('resico', 'actividad_empresarial', 'sueldos', 'otro', 'sin_definir')),
  actividad text,
  aviso_aceptado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contador_periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  anio integer NOT NULL CHECK (anio >= 2020 AND anio <= 2100),
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  estatus text NOT NULL DEFAULT 'abierto'
    CHECK (estatus IN ('abierto', 'cerrado')),
  notas text,
  cerrado_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, anio, mes)
);

CREATE TABLE IF NOT EXISTS public.contador_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id uuid NOT NULL REFERENCES public.contador_periodos(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  categoria text NOT NULL DEFAULT 'otros',
  concepto text NOT NULL,
  monto_centavos integer NOT NULL CHECK (monto_centavos > 0),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  comprobante_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contador_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id uuid NOT NULL REFERENCES public.contador_periodos(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  hecho boolean NOT NULL DEFAULT false,
  hecho_at timestamptz,
  UNIQUE (periodo_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_contador_periodos_owner
  ON public.contador_periodos (owner_id, anio DESC, mes DESC);
CREATE INDEX IF NOT EXISTS idx_contador_movimientos_periodo
  ON public.contador_movimientos (periodo_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_contador_movimientos_owner
  ON public.contador_movimientos (owner_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_contador_checklist_periodo
  ON public.contador_checklist (periodo_id);

ALTER TABLE public.contador_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contador_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contador_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contador_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contador_config_own ON public.contador_config;
CREATE POLICY contador_config_own ON public.contador_config
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS contador_periodos_own ON public.contador_periodos;
CREATE POLICY contador_periodos_own ON public.contador_periodos
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS contador_movimientos_own ON public.contador_movimientos;
CREATE POLICY contador_movimientos_own ON public.contador_movimientos
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS contador_checklist_own ON public.contador_checklist;
CREATE POLICY contador_checklist_own ON public.contador_checklist
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
