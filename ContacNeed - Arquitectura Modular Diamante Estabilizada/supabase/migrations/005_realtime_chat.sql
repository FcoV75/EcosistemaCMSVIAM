-- Script 005: Chat en tiempo real (Supabase Realtime + RLS)
-- Ejecutar DESPUÉS del script 004

ALTER TABLE public.mensajes REPLICA IDENTITY FULL;

ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mensajes_select_participants ON public.mensajes;
CREATE POLICY mensajes_select_participants ON public.mensajes
  FOR SELECT TO authenticated
  USING (auth.uid() = remitente_id OR auth.uid() = destinatario_id);

DROP POLICY IF EXISTS mensajes_insert_sender ON public.mensajes;
CREATE POLICY mensajes_insert_sender ON public.mensajes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = remitente_id);

DROP POLICY IF EXISTS mensajes_update_recipient ON public.mensajes;
CREATE POLICY mensajes_update_recipient ON public.mensajes
  FOR UPDATE TO authenticated
  USING (auth.uid() = destinatario_id);

-- Activar Realtime en la tabla mensajes (ignora error si ya está agregada)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
