-- 0033, parte 1 de 5: Funciones auxiliares. Ejecutar en orden. Es segura de repetir.

CREATE OR REPLACE FUNCTION public.fn_notificar_zona(
  p_zona UUID,
  p_excluir UUID,
  p_tipo public.notification_type,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, payload)
  SELECT u.id, p_tipo, p_payload
  FROM public.users u
  WHERE u.zone_id = p_zona
    AND u.status = 'active'
    AND (p_excluir IS NULL OR u.id <> p_excluir);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_notificar_usuario(
  p_usuario UUID,
  p_tipo public.notification_type,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (p_usuario, p_tipo, p_payload);
END;
$$;

-- Sin esto, cualquier vecino podría llamarlas con /rpc y enviar avisos a toda la zona.
REVOKE ALL ON FUNCTION public.fn_notificar_zona(UUID, UUID, public.notification_type, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_notificar_usuario(UUID, public.notification_type, JSONB) FROM PUBLIC, anon, authenticated;
