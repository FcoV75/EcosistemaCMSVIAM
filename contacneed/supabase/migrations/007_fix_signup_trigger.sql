-- Script 007: Corregir registro ("Database error updating user")
-- Ejecutar en Supabase SQL Editor si el registro falla al crear cuenta

-- Perfil mínimo al registrarse (sin columnas que puedan faltar)
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
    bloqueado
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    false,
    false,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    correo = EXCLUDED.correo,
    nombre = COALESCE(EXCLUDED.nombre, public.perfiles.nombre);

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

-- Al confirmar correo: crear perfil si no existía y marcar verificado
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at) THEN
    INSERT INTO public.perfiles (id, correo, nombre, verificado, es_pro, is_admin, bloqueado)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
      true,
      false,
      false,
      false
    )
    ON CONFLICT (id) DO UPDATE SET
      verificado = true,
      correo = EXCLUDED.correo;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RETURN NEW;
END;
$$;
