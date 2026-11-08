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

-- La 0033_notificar_todo avisa a la zona al crear/resolver un reporte con un trigger genérico.
-- Este flujo lo reemplaza (con urgencia por rol, voluntarios y aviso a quien acude): se quita
-- para que nadie reciba el mismo aviso dos veces. Si la 0033 aún no corrió, no pasa nada.
DROP TRIGGER IF EXISTS trg_notif_alerta ON public.vulnerability_reports;
