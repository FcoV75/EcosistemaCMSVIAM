-- Script 017: Profesionalismo Grupos + Mi Proyecto
-- Fechas, presupuesto por grupo, finanzas, imprevistos.
-- Ejecutar en Supabase SQL Editor (después del 016).

ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS fecha_inicio date,
  ADD COLUMN IF NOT EXISTS fecha_probable_termino date;

ALTER TABLE public.grupos
  ADD COLUMN IF NOT EXISTS presupuesto_asignado numeric(14, 2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.proyecto_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
  categoria text NOT NULL,
  monto numeric(14, 2) NOT NULL CHECK (monto >= 0),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  concepto text NOT NULL,
  referencia text,
  notas text,
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE SET NULL,
  creado_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proyecto_imprevistos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descripcion text,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  impacto text NOT NULL DEFAULT 'otro' CHECK (impacto IN ('tiempo', 'dinero', 'ambos', 'otro')),
  monto numeric(14, 2),
  movimiento_id uuid REFERENCES public.proyecto_movimientos(id) ON DELETE SET NULL,
  creado_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proy_mov_proyecto
  ON public.proyecto_movimientos (proyecto_id, tipo, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_proy_mov_grupo
  ON public.proyecto_movimientos (grupo_id, tipo);
CREATE INDEX IF NOT EXISTS idx_proy_imprevistos
  ON public.proyecto_imprevistos (proyecto_id, fecha DESC);

ALTER TABLE public.proyecto_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyecto_imprevistos ENABLE ROW LEVEL SECURITY;
