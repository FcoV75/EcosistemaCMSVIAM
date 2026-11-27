-- Justificantes / constancias médicas para pacientes (laboral, escolar, etc.)
-- + logo del establecimiento en ficha profesional

ALTER TABLE public.expediente_profesional
  ADD COLUMN IF NOT EXISTS logo_url text;

CREATE TABLE IF NOT EXISTS public.expediente_justificantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  paciente_id uuid REFERENCES public.expediente_pacientes(id) ON DELETE SET NULL,
  folio text NOT NULL,
  tipo text NOT NULL DEFAULT 'laboral'
    CHECK (tipo IN ('laboral', 'escolar', 'deportivo', 'otro')),
  destinatario text,
  paciente_nombre text NOT NULL,
  paciente_edad integer,
  paciente_sexo text,
  diagnostico text NOT NULL DEFAULT '',
  cie10 text,
  fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
  fecha_inicio_reposo date,
  fecha_fin_reposo date,
  dias_reposo integer NOT NULL DEFAULT 0,
  recomendaciones text NOT NULL DEFAULT '',
  observaciones text,
  lugar_emision text,
  author_label text NOT NULL DEFAULT '',
  sealed_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, folio)
);

CREATE INDEX IF NOT EXISTS idx_expediente_justificantes_owner
  ON public.expediente_justificantes (owner_id, deleted_at, sealed_at DESC);
CREATE INDEX IF NOT EXISTS idx_expediente_justificantes_paciente
  ON public.expediente_justificantes (paciente_id, sealed_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.expediente_justificantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expediente_justificantes_own ON public.expediente_justificantes;
CREATE POLICY expediente_justificantes_own ON public.expediente_justificantes
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
