-- Script 013: Adjuntos en mensajes del chat (imagen, GIF, video, audio, documentos)
-- Ejecutar en Supabase SQL Editor DESPUÉS del 012

ALTER TABLE public.mensajes
  ADD COLUMN IF NOT EXISTS url_adjunto text,
  ADD COLUMN IF NOT EXISTS tipo_mime text,
  ADD COLUMN IF NOT EXISTS nombre_archivo text,
  ADD COLUMN IF NOT EXISTS tamanio_bytes integer;
