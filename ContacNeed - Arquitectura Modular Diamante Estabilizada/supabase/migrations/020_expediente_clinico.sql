-- Script 020: Expediente clínico normativo (NOM-004 / NOM-024)
-- Aislado por profesional (owner_id). Conservación mínima 5 años (soft delete).

CREATE TABLE IF NOT EXISTS public.expediente_profesional (
  user_id uuid PRIMARY KEY REFERENCES public.perfiles(id) ON DELETE CASCADE,
  institucion text NOT NULL DEFAULT '',
  tipo_establecimiento text NOT NULL DEFAULT '',
  telefono_institucional text NOT NULL DEFAULT '',
  domicilio_establecimiento text NOT NULL DEFAULT '',
  nombre_profesional text NOT NULL DEFAULT '',
  cedula_profesional text NOT NULL DEFAULT '',
  especialidad text NOT NULL DEFAULT '',
  profesion_rama text NOT NULL DEFAULT 'medicina'
    CHECK (profesion_rama IN (
      'medicina', 'enfermeria', 'psicologia', 'nutricion',
      'fisioterapia', 'odontologia', 'optometria', 'terapia', 'otro_paramedico'
    )),
  aviso_privacidad_aceptado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expediente_pacientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  numero_expediente text NOT NULL,
  estatus text NOT NULL DEFAULT 'activo'
    CHECK (estatus IN ('activo', 'alta', 'archivado')),
  es_miembro boolean NOT NULL DEFAULT false,
  miembro_user_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  miembro_email text,
  miembro_codigo_cms text,
  nombre_completo text NOT NULL,
  fecha_nacimiento date NOT NULL,
  sexo text NOT NULL CHECK (sexo IN ('Femenino', 'Masculino', 'Intersexual')),
  curp text,
  grupo_sanguineo text NOT NULL DEFAULT 'No referido',
  telefono text NOT NULL DEFAULT '',
  domicilio text NOT NULL DEFAULT '',
  ocupacion text,
  contacto_emergencia text,
  alergias text NOT NULL DEFAULT 'Negadas',
  ahf text NOT NULL DEFAULT '',
  app text NOT NULL DEFAULT '',
  apnp text NOT NULL DEFAULT '',
  ago text,
  padecimiento_actual text NOT NULL DEFAULT '',
  interrogatorio_sistemas text NOT NULL DEFAULT '',
  vitals jsonb NOT NULL DEFAULT '{}'::jsonb,
  exploracion_fisica text NOT NULL DEFAULT '',
  laboratorios text,
  diagnostico text NOT NULL DEFAULT '',
  plan_terapeutico text NOT NULL DEFAULT '',
  pronostico text NOT NULL DEFAULT '',
  created_by_label text NOT NULL DEFAULT '',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, numero_expediente)
);

CREATE TABLE IF NOT EXISTS public.expediente_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.expediente_pacientes(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  tipo_nota text NOT NULL DEFAULT 'Nota de Evolución'
    CHECK (tipo_nota IN (
      'Nota de Evolución',
      'Nota de Interconsulta',
      'Nota de Referencia / Traslado',
      'Nota de Alta / Egreso',
      'Nota de Audio / Dictado'
    )),
  diagnostico text NOT NULL DEFAULT '',
  evolucion text NOT NULL DEFAULT '',
  laboratorios text,
  tratamiento text NOT NULL DEFAULT '',
  pronostico text NOT NULL DEFAULT '',
  vitals jsonb NOT NULL DEFAULT '{}'::jsonb,
  audio_url text,
  audio_duracion_seg integer,
  author_label text NOT NULL DEFAULT '',
  sealed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expediente_pacientes_owner
  ON public.expediente_pacientes (owner_id, deleted_at, estatus, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expediente_pacientes_miembro
  ON public.expediente_pacientes (owner_id, es_miembro) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expediente_pacientes_nombre
  ON public.expediente_pacientes (owner_id, nombre_completo);
CREATE INDEX IF NOT EXISTS idx_expediente_notas_paciente
  ON public.expediente_notas (paciente_id, sealed_at DESC);
CREATE INDEX IF NOT EXISTS idx_expediente_notas_owner
  ON public.expediente_notas (owner_id, sealed_at DESC);

ALTER TABLE public.expediente_profesional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expediente_pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expediente_notas ENABLE ROW LEVEL SECURITY;

-- Acceso vía service role (server functions ContacNeed). Políticas defensivas por si hay cliente directo.
DROP POLICY IF EXISTS expediente_profesional_own ON public.expediente_profesional;
CREATE POLICY expediente_profesional_own ON public.expediente_profesional
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS expediente_pacientes_own ON public.expediente_pacientes;
CREATE POLICY expediente_pacientes_own ON public.expediente_pacientes
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS expediente_notas_own ON public.expediente_notas;
CREATE POLICY expediente_notas_own ON public.expediente_notas
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
