-- Fase 3D+: gamificación, calificaciones, referidos y puntos ecosistema

ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS codigo_referido text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS puntos_ecosistema integer NOT NULL DEFAULT 0;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS referido_por uuid REFERENCES public.perfiles(id) ON DELETE SET NULL;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS calificacion_promedio numeric(3,2);
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS total_calificaciones integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_perfiles_codigo_referido
  ON public.perfiles (codigo_referido)
  WHERE codigo_referido IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.calificaciones_perfil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calificador_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  calificado_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  estrellas integer NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
  conducta text NOT NULL DEFAULT 'neutral' CHECK (conducta IN ('eficiente', 'ineficiente', 'neutral')),
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (calificador_id, calificado_id)
);

CREATE TABLE IF NOT EXISTS public.puntos_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  puntos integer NOT NULL,
  motivo text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.eventos_referido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referidor_id uuid NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  referido_id uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  producto text NOT NULL DEFAULT 'contacneed',
  codigo_usado text,
  puntos_otorgados integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calificaciones_calificado ON public.calificaciones_perfil (calificado_id);
CREATE INDEX IF NOT EXISTS idx_puntos_usuario ON public.puntos_historial (usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referidos_referidor ON public.eventos_referido (referidor_id, created_at DESC);

ALTER TABLE public.calificaciones_perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puntos_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_referido ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calif_insert_auth" ON public.calificaciones_perfil;
CREATE POLICY "calif_insert_auth" ON public.calificaciones_perfil
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = calificador_id);

DROP POLICY IF EXISTS "calif_select_all" ON public.calificaciones_perfil;
CREATE POLICY "calif_select_all" ON public.calificaciones_perfil
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "puntos_select_own" ON public.puntos_historial;
CREATE POLICY "puntos_select_own" ON public.puntos_historial
  FOR SELECT TO authenticated USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "referidos_select_own" ON public.eventos_referido;
CREATE POLICY "referidos_select_own" ON public.eventos_referido
  FOR SELECT TO authenticated USING (auth.uid() = referidor_id);

CREATE OR REPLACE VIEW public.ranking_perfiles_engagement AS
SELECT
  p.id,
  p.nombre,
  p.estado,
  p.habilidad_empirica,
  p.calificacion_promedio,
  p.puntos_ecosistema,
  COALESCE(likes.total_likes, 0)::integer AS total_likes,
  COALESCE(coms.total_comentarios, 0)::integer AS total_comentarios,
  (COALESCE(likes.total_likes, 0) * 2 + COALESCE(coms.total_comentarios, 0))::integer AS puntaje_engagement
FROM public.perfiles p
LEFT JOIN (
  SELECT pub.usuario_id, COUNT(*) AS total_likes
  FROM public.publicaciones pub
  JOIN public.reacciones r ON r.publicacion_id = pub.id AND r.tipo = 'like'
  GROUP BY pub.usuario_id
) likes ON likes.usuario_id = p.id
LEFT JOIN (
  SELECT pub.usuario_id, COUNT(*) AS total_comentarios
  FROM public.publicaciones pub
  JOIN public.comentarios c ON c.publicacion_id = pub.id
  GROUP BY pub.usuario_id
) coms ON coms.usuario_id = p.id
WHERE COALESCE(p.bloqueado, false) IS NOT TRUE;

GRANT SELECT ON public.ranking_perfiles_engagement TO anon, authenticated;

UPDATE public.perfiles
SET codigo_referido = 'CN-' || UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 8))
WHERE codigo_referido IS NULL OR codigo_referido = '';
