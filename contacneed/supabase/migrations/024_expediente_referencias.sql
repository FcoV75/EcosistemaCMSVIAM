-- Extiende justificantes al formato de constancia narrativa +
-- Referencia / contrarreferencia / interconsulta entre especialidades

ALTER TABLE public.expediente_profesional
  ADD COLUMN IF NOT EXISTS titulo_abreviado text;

ALTER TABLE public.expediente_justificantes
  ADD COLUMN IF NOT EXISTS motivo_atencion text,
  ADD COLUMN IF NOT EXISTS ectoscopia text,
  ADD COLUMN IF NOT EXISTS plan_tratamiento text,
  ADD COLUMN IF NOT EXISTS ocupacion text,
  ADD COLUMN IF NOT EXISTS estado_civil text,
  ADD COLUMN IF NOT EXISTS alergias text;

CREATE TABLE IF NOT EXISTS public.expediente_referencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  paciente_id uuid REFERENCES public.expediente_pacientes(id) ON DELETE SET NULL,
  folio text NOT NULL,
  tipo text NOT NULL DEFAULT 'referencia'
    CHECK (tipo IN ('referencia', 'contrarreferencia', 'interconsulta')),
  urgencia text NOT NULL DEFAULT 'ordinaria'
    CHECK (urgencia IN ('ordinaria', 'urgente', 'emergencia')),
  destinatario text,
  establecimiento_destino text,
  especialidad_destino text,
  medico_destino text,
  paciente_nombre text NOT NULL,
  paciente_edad integer,
  paciente_sexo text,
  motivo text NOT NULL DEFAULT '',
  resumen_clinico text NOT NULL DEFAULT '',
  diagnostico text NOT NULL DEFAULT '',
  cie10 text,
  tratamiento_otorgado text NOT NULL DEFAULT '',
  estudios_realizados text,
  pregunta_interconsulta text,
  respuesta_consultor text,
  recomendaciones text NOT NULL DEFAULT '',
  fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
  lugar_emision text,
  author_label text NOT NULL DEFAULT '',
  sealed_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, folio)
);

CREATE INDEX IF NOT EXISTS idx_expediente_referencias_owner
  ON public.expediente_referencias (owner_id, deleted_at, sealed_at DESC);
CREATE INDEX IF NOT EXISTS idx_expediente_referencias_paciente
  ON public.expediente_referencias (paciente_id, sealed_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expediente_referencias_tipo
  ON public.expediente_referencias (owner_id, tipo, sealed_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.expediente_referencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expediente_referencias_own ON public.expediente_referencias;
CREATE POLICY expediente_referencias_own ON public.expediente_referencias
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
