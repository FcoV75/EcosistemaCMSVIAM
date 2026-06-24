-- Ejecutar en Supabase SQL Editor (después del script 002)
-- Columnas faltantes para admin, estadísticas y confirmación de correo

ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS fecha_registro timestamptz DEFAULT now();
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS es_fundador boolean DEFAULT false;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS correo text;

UPDATE public.perfiles SET fecha_registro = now() WHERE fecha_registro IS NULL;
UPDATE public.perfiles SET es_fundador = false WHERE es_fundador IS NULL;

-- Marcar verificado cuando el usuario confirma su correo en Auth
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at) THEN
    UPDATE public.perfiles
    SET verificado = true
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_email_confirmed();

-- Usuarios ya confirmados antes de este script
UPDATE public.perfiles p
SET verificado = true
FROM auth.users u
WHERE p.id = u.id
  AND u.email_confirmed_at IS NOT NULL
  AND COALESCE(p.verificado, false) = false;
