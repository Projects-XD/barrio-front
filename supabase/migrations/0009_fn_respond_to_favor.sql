-- Responder a un favor: registra el interés, abre (o reutiliza) la conversación con el autor
-- y deja la notificación para el autor, todo en una sola transacción.
-- Si el vecino ya había respondido, el UNIQUE de favor_interests lanza 23505 y no queda nada a medias.
CREATE OR REPLACE FUNCTION public.fn_respond_to_favor(
  p_favor_id UUID,
  p_user_id UUID,
  p_message TEXT
)
RETURNS TABLE (interest_id UUID, conversation_id UUID)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_author_id UUID;
  v_title TEXT;
  v_name TEXT;
  v_interest_id UUID;
  v_conversation_id UUID;
BEGIN
  SELECT f.author_id, f.title INTO v_author_id, v_title
    FROM public.favors f WHERE f.id = p_favor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Favor no encontrado' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.favor_interests (favor_id, user_id, message)
  VALUES (p_favor_id, p_user_id, p_message)
  RETURNING id INTO v_interest_id;

  INSERT INTO public.conversations (favor_id, author_id, responder_id)
  VALUES (p_favor_id, v_author_id, p_user_id)
  ON CONFLICT ON CONSTRAINT uq_conversations_favor_responder
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_conversation_id;

  SELECT u.full_name INTO v_name FROM public.users u WHERE u.id = p_user_id;

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    v_author_id,
    'interes_en_favor',
    jsonb_build_object(
      'favor_id', p_favor_id,
      'favor_title', v_title,
      'conversation_id', v_conversation_id,
      'responder_id', p_user_id,
      'responder_name', v_name
    )
  );

  RETURN QUERY SELECT v_interest_id, v_conversation_id;
END;
$$;

-- p_user_id lo decide el backend: ningún cliente puede llamarla directamente haciéndose pasar por otro vecino.
REVOKE ALL ON FUNCTION public.fn_respond_to_favor(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_respond_to_favor(UUID, UUID, TEXT) TO service_role;
