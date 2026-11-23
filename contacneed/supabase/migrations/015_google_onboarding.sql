-- Script 015: Google OAuth + onboarding diferido de tipo de miembro
-- Ejecutar en Supabase SQL Editor tras el 014.

ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS es_estudiante boolean DEFAULT false;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS cedula_pendiente boolean DEFAULT false;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS onboarding_pospuestos integer DEFAULT 0;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS onboarding_pospuesto_hasta timestamptz;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS onboarding_completado_at timestamptz;

-- Trigger: al crear usuario (Google u email) rellena nombre/avatar de metadata OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_nombre text;
  meta_avatar text;
BEGIN
  meta_nombre := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'nombre'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''),
    split_part(COALESCE(NEW.email, 'usuario'), '@', 1)
  );
  meta_avatar := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'avatar_url'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'picture'), '')
  );

  INSERT INTO public.perfiles (
    id,
    correo,
    nombre,
    avatar_url,
    es_pro,
    is_admin,
    verificado,
    bloqueado,
    tipo_miembro
  )
  VALUES (
    NEW.id,
    NEW.email,
    meta_nombre,
    meta_avatar,
    false,
    false,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    false,
    NULL
  )
  ON CONFLICT (id) DO UPDATE SET
    correo = EXCLUDED.correo,
    nombre = COALESCE(NULLIF(btrim(public.perfiles.nombre), ''), EXCLUDED.nombre),
    avatar_url = COALESCE(public.perfiles.avatar_url, EXCLUDED.avatar_url),
    verificado = public.perfiles.verificado OR EXCLUDED.verificado;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
