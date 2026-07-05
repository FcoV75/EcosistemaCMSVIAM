-- Fase 3D: PRO público desde entitlements + backfill legacy perfiles.es_pro

CREATE OR REPLACE VIEW public.perfiles_pro_publicos AS
SELECT
  p.id,
  p.nombre,
  p.descripcion_profesion,
  p.estado,
  p.verificado,
  p.avatar_url,
  true AS es_pro
FROM public.perfiles p
WHERE EXISTS (
  SELECT 1
  FROM public.ecosistema_entitlements e
  WHERE e.user_id = p.id
    AND e.producto = 'contacneed_pro'
    AND e.status = 'active'
    AND (e.expires_at IS NULL OR e.expires_at > now())
)
OR (p.es_pro = true AND NOT EXISTS (
  SELECT 1 FROM public.ecosistema_entitlements e2
  WHERE e2.user_id = p.id AND e2.producto = 'contacneed_pro' AND e2.status = 'cancelled'
));

GRANT SELECT ON public.perfiles_pro_publicos TO anon, authenticated;

-- Backfill: usuarios con es_pro en perfiles sin fila activa en entitlements
INSERT INTO public.ecosistema_entitlements (user_id, producto, plan, status, expires_at, metadata)
SELECT
  p.id,
  'contacneed_pro',
  CASE WHEN p.pro_plan_type = 'annual' THEN 'anual' ELSE 'mensual' END,
  'active',
  CASE
    WHEN p.pro_plan_type = 'annual' THEN now() + interval '365 days'
    ELSE now() + interval '30 days'
  END,
  jsonb_build_object('source', 'backfill_3d', 'legacy_es_pro', true)
FROM public.perfiles p
WHERE p.es_pro = true
  AND NOT EXISTS (
    SELECT 1 FROM public.ecosistema_entitlements e
    WHERE e.user_id = p.id AND e.producto = 'contacneed_pro' AND e.status = 'active'
  );
