-- ==============================================================================
-- 0032: Auto-archivado (TTL) de reportes de vulnerabilidad.
-- Cada reporte vence 6 horas después de creado. El backend ya filtra los vencidos al
-- listar (expires_at > now()), así que el job de pg_cron solo deja el estado al día.
-- ==============================================================================

-- El DEFAULT cubre todos los inserts (backend, sync offline, seeds) sin trigger.
ALTER TABLE public.vulnerability_reports
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '6 hours');

-- Los reportes activos que ya existían reciben 6 horas desde hoy, para no archivar de golpe
-- los datos de la demo al aplicar la migración.
UPDATE public.vulnerability_reports
SET expires_at = now() + interval '6 hours'
WHERE status = 'activo';

-- GET /emergency/reports: activos y vigentes de la zona, los más recientes primero.
CREATE INDEX IF NOT EXISTS idx_vulnerability_reports_zone_activo_expires
  ON public.vulnerability_reports (zone_id, expires_at, created_at DESC)
  WHERE status = 'activo';

-- Marca como 'resuelto' los reportes activos vencidos. Devuelve cuántos archivó.
CREATE OR REPLACE FUNCTION public.fn_archivar_reportes_vencidos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.vulnerability_reports
  SET status = 'resuelto', resolved_at = now()
  WHERE status = 'activo' AND expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_archivar_reportes_vencidos() FROM PUBLIC, anon, authenticated;

-- Programar cada 10 minutos con pg_cron si está disponible (Supabase lo trae como extensión).
-- Si no se puede habilitar, la migración sigue: el backend igual oculta los vencidos.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'archivar_reportes_vencidos';
  PERFORM cron.schedule(
    'archivar_reportes_vencidos',
    '*/10 * * * *',
    'SELECT public.fn_archivar_reportes_vencidos()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron no disponible (%); el backend filtra los reportes vencidos.', SQLERRM;
END;
$$;
