-- Ejecutar en Supabase SQL Editor (después del script 003)
-- Me gusta persistentes, mensajes privados y solicitudes de contacto

CREATE TABLE IF NOT EXISTS public.reacciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacion_id uuid NOT NULL REFERENCES public.publicaciones(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('like', 'dislike')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (publicacion_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS public.mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remitente_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  destinatario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  asunto text,
  cuerpo text NOT NULL,
  tipo text NOT NULL DEFAULT 'general' CHECK (tipo IN ('general', 'servicio', 'amistad')),
  leido boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.solicitudes_contacto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  destinatario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'amistad' CHECK (tipo IN ('amistad', 'servicio')),
  mensaje text,
  estatus text NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente', 'aceptada', 'rechazada')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (solicitante_id, destinatario_id, tipo)
);

CREATE TABLE IF NOT EXISTS public.contactos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_a uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  usuario_b uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (usuario_a, usuario_b)
);

ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS ultima_conexion timestamptz;

CREATE INDEX IF NOT EXISTS idx_reacciones_post ON public.reacciones (publicacion_id);
CREATE INDEX IF NOT EXISTS idx_reacciones_user ON public.reacciones (usuario_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_dest ON public.mensajes (destinatario_id, leido, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensajes_remit ON public.mensajes (remitente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_dest ON public.solicitudes_contacto (destinatario_id, estatus);
CREATE INDEX IF NOT EXISTS idx_perfiles_ultima ON public.perfiles (ultima_conexion DESC);
