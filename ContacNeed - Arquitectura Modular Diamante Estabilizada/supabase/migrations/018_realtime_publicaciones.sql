-- Publicaciones en Realtime para refrescar la pizarra al publicar/editar.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.publicaciones;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
    WHEN undefined_table THEN NULL;
  END;
END $$;
