-- Script 006: Plan PRO ampliado (mapas, anuncios extra, informes)
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS pro_extra_ad_slots integer DEFAULT 0;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS pro_plan_type text;
ALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS ultimo_informe_pro timestamptz;

ALTER TABLE public.negocios ADD COLUMN IF NOT EXISTS maps_address text;
ALTER TABLE public.negocios ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.negocios ADD COLUMN IF NOT EXISTS lng double precision;

COMMENT ON COLUMN public.perfiles.pro_extra_ad_slots IS 'Anuncios PRO adicionales comprados (cada paquete = +5)';
COMMENT ON COLUMN public.perfiles.pro_plan_type IS 'monthly | annual';
COMMENT ON COLUMN public.negocios.maps_address IS 'Dirección legible para Google Maps (solo PRO)';
