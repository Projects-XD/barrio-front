-- 0035: "Voy a ayudar", "Ya no puedo ir" y "Necesito más ayuda". Requiere la 0034.
-- Las llama solo el backend (service_role), que pasa el id del usuario autenticado.
-- Errores: P0002 no existe/otra zona/cerrado · 42501 reporte propio o no eres voluntario · 54000 pediste hace poco.

CREATE OR REPLACE FUNCTION public.fn_atender_reporte(p_report_id UUID, p_user_id UUID)
RETURNS TABLE (report_id UUID, responders_count INTEGER) LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_name TEXT; v_rep UUID; v_total INTEGER;
BEGIN
  SELECT u.full_name INTO v_name FROM public.users u WHERE u.id = p_user_id;
  SELECT r.reporter_user_id INTO v_rep FROM public.vulnerability_reports r
   WHERE r.id = p_report_id AND r.status = 'activo' AND r.expires_at > now()
     AND r.zone_id = (SELECT u.zone_id FROM public.users u WHERE u.id = p_user_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Reporte no encontrado o ya cerrado' USING ERRCODE = 'P0002'; END IF;
  IF v_rep = p_user_id THEN RAISE EXCEPTION 'No puedes atender tu propio reporte' USING ERRCODE = '42501'; END IF;

  INSERT INTO public.report_responders (report_id, user_id) VALUES (p_report_id, p_user_id) ON CONFLICT DO NOTHING;
  IF FOUND THEN  -- solo avisa si se sumó ahora (repetir el toque no avisa de nuevo)
    SELECT count(*)::INTEGER INTO v_total FROM public.report_responders rr WHERE rr.report_id = p_report_id;
    INSERT INTO public.notifications (user_id, type, payload)
    SELECT x.uid, 'reporte_atendido',
           jsonb_build_object('report_id', p_report_id, 'attendant_name', v_name, 'responders_count', v_total)
           || CASE WHEN x.joined THEN '{"joined": true}'::jsonb ELSE '{}'::jsonb END
      FROM (SELECT v_rep AS uid, false AS joined WHERE v_rep IS NOT NULL            -- quien reportó
            UNION ALL
            SELECT rr.user_id, true FROM public.report_responders rr                -- voluntarios previos
             WHERE rr.report_id = p_report_id AND rr.user_id <> p_user_id) x;
  END IF;

  RETURN QUERY SELECT p_report_id, (SELECT count(*)::INTEGER FROM public.report_responders rr WHERE rr.report_id = p_report_id);
END $$;

CREATE OR REPLACE FUNCTION public.fn_soltar_reporte(p_report_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SET search_path = public AS $$
  WITH d AS (DELETE FROM public.report_responders rr WHERE rr.report_id = p_report_id AND rr.user_id = p_user_id RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM d);
$$;

-- Solo un voluntario del reporte; el UPDATE condicional limita a una vez cada 5 min sin carreras.
CREATE OR REPLACE FUNCTION public.fn_pedir_refuerzo(p_report_id UUID, p_user_id UUID)
RETURNS TABLE (report_id UUID, responders_count INTEGER) LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_rep UUID; v_zone UUID; v_desc TEXT; v_total INTEGER;
BEGIN
  SELECT r.reporter_user_id, r.zone_id, r.description INTO v_rep, v_zone, v_desc
    FROM public.vulnerability_reports r WHERE r.id = p_report_id AND r.status = 'activo' AND r.expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Reporte no encontrado o ya cerrado' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.report_responders rr WHERE rr.report_id = p_report_id AND rr.user_id = p_user_id) THEN
    RAISE EXCEPTION 'Solo quien está acudiendo puede pedir más ayuda' USING ERRCODE = '42501';
  END IF;

  UPDATE public.vulnerability_reports r SET help_requested_at = now()
   WHERE r.id = p_report_id AND (r.help_requested_at IS NULL OR r.help_requested_at <= now() - interval '5 minutes');
  IF NOT FOUND THEN RAISE EXCEPTION 'Ya pediste más ayuda hace poco' USING ERRCODE = '54000'; END IF;

  SELECT count(*)::INTEGER INTO v_total FROM public.report_responders rr WHERE rr.report_id = p_report_id;
  -- A la zona, menos quien reportó y quienes ya acuden.
  INSERT INTO public.notifications (user_id, type, payload)
  SELECT u.id, 'reporte_refuerzo',
         jsonb_build_object('report_id', p_report_id, 'description', left(v_desc, 140), 'urgent', true,
                            'responders_count', v_total,
                            'requester_name', (SELECT f.full_name FROM public.users f WHERE f.id = p_user_id))
    FROM public.users u
   WHERE u.zone_id = v_zone AND u.id IS DISTINCT FROM v_rep
     AND NOT EXISTS (SELECT 1 FROM public.report_responders rr WHERE rr.report_id = p_report_id AND rr.user_id = u.id);

  RETURN QUERY SELECT p_report_id, v_total;
END $$;

REVOKE ALL ON FUNCTION public.fn_atender_reporte(UUID, UUID), public.fn_soltar_reporte(UUID, UUID),
                       public.fn_pedir_refuerzo(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_atender_reporte(UUID, UUID), public.fn_soltar_reporte(UUID, UUID),
                          public.fn_pedir_refuerzo(UUID, UUID) TO service_role;
