-- Script 012: Comentarios editables, multimedia y likes
-- Ejecutar en Supabase SQL Editor DESPUÉS del 011

ALTER TABLE public.comentarios
  ADD COLUMN IF NOT EXISTS url_multimedia text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.reacciones_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comentario_id uuid NOT NULL REFERENCES public.comentarios(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (comentario_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_reacciones_comentarios_comentario
  ON public.reacciones_comentarios (comentario_id);

ALTER TABLE public.reacciones_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reacciones_comentarios REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS reacciones_comentarios_select_public ON public.reacciones_comentarios;
CREATE POLICY reacciones_comentarios_select_public ON public.reacciones_comentarios
  FOR SELECT TO anon, authenticated
  USING (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reacciones_comentarios;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
