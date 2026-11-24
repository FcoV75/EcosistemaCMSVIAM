-- Informe PRO: permitir tipo de mensaje dedicado (antes solo general/servicio/amistad)
ALTER TABLE public.mensajes
  DROP CONSTRAINT IF EXISTS mensajes_tipo_check;

ALTER TABLE public.mensajes
  ADD CONSTRAINT mensajes_tipo_check
  CHECK (tipo IN ('general', 'servicio', 'amistad', 'informe_pro'));

-- Mi Proyecto: archivo lógico en lugar de borrado duro
ALTER TABLE public.proyectos
  DROP CONSTRAINT IF EXISTS proyectos_estatus_check;

ALTER TABLE public.proyectos
  ADD CONSTRAINT proyectos_estatus_check
  CHECK (estatus IN ('activo', 'concluido', 'archivado'));
