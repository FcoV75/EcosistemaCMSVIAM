-- Script 016: Grupos comunes + Mi Proyecto (PRO)
-- Ejecutar en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.proyectos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  tipo_obra text NOT NULL DEFAULT 'otro',
  estatus text NOT NULL DEFAULT 'activo' CHECK (estatus IN ('activo', 'concluido')),
  created_at timestamptz NOT NULL DEFAULT now(),
  concluido_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  tipo text NOT NULL CHECK (tipo IN ('comun', 'proyecto')),
  proyecto_id uuid REFERENCES public.proyectos(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  rol_etiqueta text,
  activo boolean NOT NULL DEFAULT true,
  mantenimiento boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grupos_proyecto_coherente CHECK (
    (tipo = 'comun' AND proyecto_id IS NULL)
    OR (tipo = 'proyecto' AND proyecto_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.grupo_miembros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  rol text NOT NULL DEFAULT 'miembro' CHECK (rol IN ('owner', 'admin', 'miembro')),
  estatus text NOT NULL DEFAULT 'activo' CHECK (estatus IN ('invitado', 'activo', 'salido')),
  invited_by uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grupo_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS public.grupo_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  cuerpo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyectos_owner ON public.proyectos (owner_id, estatus, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_grupos_owner ON public.grupos (owner_id, tipo, activo);
CREATE INDEX IF NOT EXISTS idx_grupos_proyecto ON public.grupos (proyecto_id, activo);
CREATE INDEX IF NOT EXISTS idx_grupo_miembros_user ON public.grupo_miembros (usuario_id, estatus);
CREATE INDEX IF NOT EXISTS idx_grupo_miembros_grupo ON public.grupo_miembros (grupo_id, estatus);
CREATE INDEX IF NOT EXISTS idx_grupo_mensajes_grupo ON public.grupo_mensajes (grupo_id, created_at DESC);

ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_mensajes ENABLE ROW LEVEL SECURITY;
