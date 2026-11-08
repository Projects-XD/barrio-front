-- 0034: Base de los reportes de emergencia: voluntarios, tipos de aviso y aviso al crear un reporte.
-- Segura de repetir.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'reporte_emergencia';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'reporte_atendido';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'reporte_escalado';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'reporte_refuerzo';

-- Vecinos que acuden a un reporte. Solo el backend (service_role) la usa: RLS sin políticas.
CREATE TABLE IF NOT EXISTS public.report_responders (
  report_id UUID NOT NULL REFERENCES public.vulnerability_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, user_id)
);
ALTER TABLE public.report_responders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.vulnerability_reports
  ADD COLUMN IF NOT EXISTS help_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

-- Aviso a la zona al crear un reporte (urgente para comité/admin). Si falla, no bloquea el reporte.
CREATE OR REPLACE FUNCTION public.fn_notificar_nuevo_reporte()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status = 'activo' AND NEW.zone_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, payload)
    SELECT u.id, 'reporte_emergencia',
           jsonb_build_object('report_id', NEW.id, 'description', left(NEW.description, 140),
                              'needs', to_jsonb(NEW.needs), 'urgent', (u.emergency_role OR u.is_admin))
      FROM public.users u
     WHERE u.zone_id = NEW.zone_id AND u.id IS DISTINCT FROM NEW.reporter_user_id;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo notificar el reporte %: %', NEW.id, SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notificar_nuevo_reporte ON public.vulnerability_reports;
CREATE TRIGGER trg_notificar_nuevo_reporte
  AFTER INSERT ON public.vulnerability_reports
  FOR EACH ROW EXECUTE FUNCTION public.fn_notificar_nuevo_reporte();

-- Antes la 0033_notificar_todo avisaba a la zona con un trigger genérico (ya no lo define).
-- Este flujo lo reemplaza: se quita en bases donde ya corrió, para no avisar dos veces.
-- Si nunca existió, no pasa nada.
DROP TRIGGER IF EXISTS trg_notif_alerta ON public.vulnerability_reports;
DROP FUNCTION IF EXISTS public.fn_notif_alerta();
