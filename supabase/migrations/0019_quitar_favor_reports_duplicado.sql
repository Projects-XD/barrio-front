-- Quita el reporte de favores duplicado de 0016.
-- El backend ya reporta favores (POST /favors/:id/report, tabla user_reports) y oculta el favor
-- al llegar a 3 puntos. Mantener esta segunda tabla y sus triggers duplicaba la regla.
-- Se conservan las validaciones de titulo y el limite diario de 0016. Es segura de repetir.

DROP TRIGGER IF EXISTS trg_ocultar_favor_reportado ON public.favor_reports;
DROP TRIGGER IF EXISTS trg_validar_reporte_favor ON public.favor_reports;
DROP FUNCTION IF EXISTS public.fn_ocultar_favor_reportado();
DROP FUNCTION IF EXISTS public.fn_validar_reporte_favor();
DROP TABLE IF EXISTS public.favor_reports;
