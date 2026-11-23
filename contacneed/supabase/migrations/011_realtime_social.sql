-- Script 011: Realtime social (likes, comentarios, compartidos, solicitudes) + notificaciones
-- Ejecutar en Supabase SQL Editor DESPUÉS del 010

CREATE TABLE IF NOT EXISTS public.compartidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacion_id uuid NOT NULL REFERENCES public.publicaciones(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  canal text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compartidos_post ON public.compartidos (publicacion_id);

CREATE TABLE IF NOT EXISTS public.notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'general',
  titulo text NOT NULL,
  cuerpo text,
  enlace text,
  leida boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_user
  ON public.notificaciones (usuario_id, leida, created_at DESC);

ALTER TABLE public.reacciones REPLICA IDENTITY FULL;
ALTER TABLE public.comentarios REPLICA IDENTITY FULL;
ALTER TABLE public.solicitudes_contacto REPLICA IDENTITY FULL;
ALTER TABLE public.compartidos REPLICA IDENTITY FULL;
ALTER TABLE public.notificaciones REPLICA IDENTITY FULL;

ALTER TABLE public.reacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_contacto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compartidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reacciones_select_public ON public.reacciones;
CREATE POLICY reacciones_select_public ON public.reacciones
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS comentarios_select_public ON public.comentarios;
CREATE POLICY comentarios_select_public ON public.comentarios
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS compartidos_select_public ON public.compartidos;
CREATE POLICY compartidos_select_public ON public.compartidos
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS solicitudes_select_parties ON public.solicitudes_contacto;
CREATE POLICY solicitudes_select_parties ON public.solicitudes_contacto
  FOR SELECT TO authenticated
  USING (auth.uid() = destinatario_id OR auth.uid() = solicitante_id);

DROP POLICY IF EXISTS notificaciones_select_own ON public.notificaciones;
CREATE POLICY notificaciones_select_own ON public.notificaciones
  FOR SELECT TO authenticated
  USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS notificaciones_update_own ON public.notificaciones;
CREATE POLICY notificaciones_update_own ON public.notificaciones
  FOR UPDATE TO authenticated
  USING (auth.uid() = usuario_id);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reacciones;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.comentarios;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.compartidos;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitudes_contacto;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
