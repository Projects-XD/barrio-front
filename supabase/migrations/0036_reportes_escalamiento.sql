-- 0036: Escalamiento: a los 15 min sin NINGÚN voluntario, se re-avisa a la zona. Requiere la 0034.
-- Usa pg_cron; si no está disponible, la migración sigue pero el escalamiento no corre.

CREATE INDEX IF NOT EXISTS idx_vulnerability_reports_por_escalar
  ON public.vulnerability_reports (created_at) WHERE status = 'activo' AND escalated_at IS NULL;

CREATE OR REPLACE FUNCTION public.fn_escalar_reportes_sin_atender()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r RECORD; n INTEGER := 0;
BEGIN
  FOR r IN
    UPDATE public.vulnerability_reports v SET escalated_at = now()
     WHERE v.status = 'activo' AND v.expires_at > now() AND v.escalated_at IS NULL
       AND v.created_at < now() - interval '15 minutes'
       AND NOT EXISTS (SELECT 1 FROM public.report_responders rr WHERE rr.report_id = v.id)
    RETURNING v.id, v.zone_id, v.description
  LOOP
    n := n + 1;
    INSERT INTO public.notifications (user_id, type, payload)
    SELECT u.id, 'reporte_escalado',
           jsonb_build_object('report_id', r.id, 'description', left(r.description, 140), 'urgent', true)
      FROM public.users u WHERE u.zone_id = r.zone_id;
  END LOOP;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.fn_escalar_reportes_sin_atender() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'escalar_reportes_sin_atender';
  PERFORM cron.schedule('escalar_reportes_sin_atender', '*/2 * * * *', 'SELECT public.fn_escalar_reportes_sin_atender()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron no disponible (%); el escalamiento automático no correrá.', SQLERRM;
END $$;
