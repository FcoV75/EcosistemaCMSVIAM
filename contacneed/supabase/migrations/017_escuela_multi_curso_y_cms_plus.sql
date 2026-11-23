-- Escuela: permitir varios cursos de recuperación por usuario
-- (el índice único user_id+producto bloqueaba el 2º curso).
-- CMS-Plus: status 'suspended' opcional vía metadata; no cambia el CHECK existente.

DROP INDEX IF EXISTS public.idx_eco_ent_user_producto;

CREATE UNIQUE INDEX IF NOT EXISTS idx_eco_ent_user_producto
  ON public.ecosistema_entitlements (user_id, producto)
  WHERE user_id IS NOT NULL
    AND status = 'active'
    AND producto <> 'escuela_principios';

CREATE UNIQUE INDEX IF NOT EXISTS idx_eco_ent_user_escuela_slug
  ON public.ecosistema_entitlements (user_id, ((metadata->>'curso_slug')))
  WHERE user_id IS NOT NULL
    AND status = 'active'
    AND producto = 'escuela_principios'
    AND metadata ? 'curso_slug';

COMMENT ON INDEX public.idx_eco_ent_user_escuela_slug IS
  'Un entitlement activo de escuela_principios por usuario y curso_slug';
