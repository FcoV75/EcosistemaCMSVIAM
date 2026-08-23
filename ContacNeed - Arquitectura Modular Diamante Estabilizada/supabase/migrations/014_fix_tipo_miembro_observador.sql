-- Script 014: Permitir tipo_miembro Observador (y variantes de mayúsculas)
-- El check perfiles_tipo_miembro_check en producción rechazaba "Observador"
-- y bloqueaba el registro de usuarios solo-observadores.
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE public.perfiles
  DROP CONSTRAINT IF EXISTS perfiles_tipo_miembro_check;

-- Acepta NULL y los 4 tipos (sin importar mayúsculas)
ALTER TABLE public.perfiles
  ADD CONSTRAINT perfiles_tipo_miembro_check
  CHECK (
    tipo_miembro IS NULL
    OR lower(btrim(tipo_miembro)) IN (
      'observador',
      'oficio',
      'profesion',
      'especialidad'
    )
  );

-- Normaliza filas existentes a Title Case canónico
UPDATE public.perfiles
SET tipo_miembro = CASE lower(btrim(tipo_miembro))
  WHEN 'observador' THEN 'Observador'
  WHEN 'oficio' THEN 'Oficio'
  WHEN 'profesion' THEN 'Profesion'
  WHEN 'especialidad' THEN 'Especialidad'
  ELSE tipo_miembro
END
WHERE tipo_miembro IS NOT NULL;
