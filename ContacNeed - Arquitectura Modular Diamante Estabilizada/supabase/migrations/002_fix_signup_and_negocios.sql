-- Ejecutar en Supabase SQL Editor (después del script 001)
-- Corrige registro, foto de perfil y tienda PRO

-- Columnas que usa el formulario de registro y perfil
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS habilidad_empirica text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS municipio text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS tipo_miembro text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS direccion text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS cp text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS celular text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS comunidad text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS sexo text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS fecha_nacimiento date;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS cedula text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS bloqueado boolean DEFAULT false;

-- Tienda PRO
CREATE TABLE IF NOT EXISTS public.negocios (
  id uuid PRIMARY KEY REFERENCES public.perfiles(id) ON DELETE CASCADE,
  banner_url text,
  items jsonb DEFAULT '[]'::jsonb
);

-- Trigger correcto al crear usuario en Auth (usa correo, NO email)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (
    id,
    correo,
    nombre,
    es_pro,
    is_admin,
    verificado,
    es_fundador,
    bloqueado
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    false,
    false,
    false,
    false,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    correo = EXCLUDED.correo;
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

-- Perfiles huérfanos: usuarios en Auth sin fila en perfiles
INSERT INTO public.perfiles (id, correo, nombre, es_pro, is_admin, verificado, bloqueado)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'nombre', split_part(u.email, '@', 1)),
  false,
  false,
  false,
  false
FROM auth.users u
LEFT JOIN public.perfiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
