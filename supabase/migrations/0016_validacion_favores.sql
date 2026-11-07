-- Validación anti-bromas para favores, sin admin:
--   1. Título válido (largo mínimo, sin letras repetidas, sin duplicados recientes).
--   2. Límite de publicaciones por día según reputación (favores cerrados).
--   3. Reportes de vecinos: al juntar reportes suficientes, el favor se oculta.

-- ------------------------------------------------------------------------------
-- Reputación: favores cerrados (cumplidos) del autor. Con 3 o más, es vecino de confianza.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_reputacion_favor(p_user_id UUID)
RETURNS INTEGER LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::INTEGER FROM public.favors
  WHERE author_id = p_user_id AND status = 'cerrada';
$$;

-- ------------------------------------------------------------------------------
-- Validación al publicar.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_validar_favor()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_reputacion INTEGER;
  v_limite INTEGER;
  v_publicados INTEGER;
BEGIN
  IF char_length(btrim(NEW.title)) < 5 THEN
    RAISE EXCEPTION 'El título debe tener al menos 5 caracteres.' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.title ~* '(.)\1{4,}' THEN
    RAISE EXCEPTION 'El título tiene letras repetidas. Escribe algo más claro.' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.favors
    WHERE author_id = NEW.author_id
      AND lower(btrim(title)) = lower(btrim(NEW.title))
      AND created_at > now() - interval '24 hours'
  ) THEN
    RAISE EXCEPTION 'Ya publicaste un favor con ese título hoy.' USING ERRCODE = 'P0001';
  END IF;

  v_reputacion := public.fn_reputacion_favor(NEW.author_id);
  v_limite := CASE WHEN v_reputacion >= 3 THEN 15 ELSE 3 END;

  SELECT COUNT(*) INTO v_publicados FROM public.favors
  WHERE author_id = NEW.author_id AND created_at > now() - interval '24 hours';

  IF v_publicados >= v_limite THEN
    RAISE EXCEPTION 'Llegaste al límite de % favores por día.', v_limite USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_favor ON public.favors;
CREATE TRIGGER trg_validar_favor
BEFORE INSERT ON public.favors
FOR EACH ROW EXECUTE FUNCTION public.fn_validar_favor();

-- ------------------------------------------------------------------------------
-- Reportes de favores.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.favor_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  favor_id UUID NOT NULL REFERENCES public.favors(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_favor_reports_favor_reporter UNIQUE (favor_id, reporter_id)
);

ALTER TABLE public.favor_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS favor_reports_insert_propio ON public.favor_reports;
CREATE POLICY favor_reports_insert_propio ON public.favor_reports
FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid());

-- No se puede reportar el propio favor.
CREATE OR REPLACE FUNCTION public.fn_validar_reporte_favor()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.favors WHERE id = NEW.favor_id AND author_id = NEW.reporter_id) THEN
    RAISE EXCEPTION 'No puedes reportar tu propio favor.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_reporte_favor ON public.favor_reports;
CREATE TRIGGER trg_validar_reporte_favor
BEFORE INSERT ON public.favor_reports
FOR EACH ROW EXECUTE FUNCTION public.fn_validar_reporte_favor();

-- Umbral: 3 puntos de reporte. Un reporte de un vecino de confianza vale 2.
CREATE OR REPLACE FUNCTION public.fn_ocultar_favor_reportado()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_puntos INTEGER;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN public.fn_reputacion_favor(reporter_id) >= 3 THEN 2 ELSE 1 END), 0)
    INTO v_puntos
  FROM public.favor_reports
  WHERE favor_id = NEW.favor_id;

  IF v_puntos >= 3 THEN
    UPDATE public.favors
    SET moderation_status = 'rechazado',
        moderation_reason = 'Ocultado por reportes de vecinos'
    WHERE id = NEW.favor_id AND moderation_status <> 'rechazado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ocultar_favor_reportado ON public.favor_reports;
CREATE TRIGGER trg_ocultar_favor_reportado
AFTER INSERT ON public.favor_reports
FOR EACH ROW EXECUTE FUNCTION public.fn_ocultar_favor_reportado();
