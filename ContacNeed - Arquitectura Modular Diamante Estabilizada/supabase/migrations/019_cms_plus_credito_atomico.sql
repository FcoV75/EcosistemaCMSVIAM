-- Descuento atómico de créditos CMS-Plus (evita cobros triples por carreras).
CREATE OR REPLACE FUNCTION public.cms_plus_consumir_credito(
  p_user_id uuid,
  p_periodo text,
  p_cantidad integer DEFAULT 1
)
RETURNS public.cms_plus_creditos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_out public.cms_plus_creditos;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad < 1 THEN
    RAISE EXCEPTION 'cantidad_invalida';
  END IF;

  UPDATE public.cms_plus_creditos
  SET
    usados = usados + p_cantidad,
    updated_at = now()
  WHERE user_id = p_user_id
    AND periodo = p_periodo
    AND (allotment - usados) >= p_cantidad
  RETURNING * INTO row_out;

  IF row_out.id IS NULL THEN
    RAISE EXCEPTION 'creditos_insuficientes';
  END IF;

  RETURN row_out;
END;
$$;

REVOKE ALL ON FUNCTION public.cms_plus_consumir_credito(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cms_plus_consumir_credito(uuid, text, integer) TO service_role;
