-- 0033, parte 2 de 5: Emergencias y alertas comunitarias. Ejecutar en orden. Es segura de repetir.

-- ------------------------------------------------------------------------------
-- 1. Emergencias de la zona
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notif_estado_emergencia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'activa' THEN
    PERFORM public.fn_notificar_zona(
      NEW.zone_id, NEW.activated_by_user_id, 'emergencia_activada'::public.notification_type,
      jsonb_build_object('kind', 'activada', 'reason', NEW.reason)
    );
  ELSIF NEW.status = 'inactiva' THEN
    PERFORM public.fn_notificar_zona(
      NEW.zone_id, NEW.activated_by_user_id, 'sistema'::public.notification_type,
      jsonb_build_object('kind', 'emergencia_finalizada', 'reason', NEW.reason)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo notificar el estado de emergencia %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_estado_emergencia ON public.emergency_states;
CREATE TRIGGER trg_notif_estado_emergencia
  AFTER INSERT ON public.emergency_states
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_estado_emergencia();

-- ------------------------------------------------------------------------------
-- 2. Alertas comunitarias (reportes de vulnerabilidad)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notif_alerta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.zone_id IS NOT NULL AND NEW.status = 'activo' THEN
      -- No incluye el nombre de quien reporta: los reportes pueden ser anónimos.
      PERFORM public.fn_notificar_zona(
        NEW.zone_id, NEW.reporter_user_id, 'emergencia_activada'::public.notification_type,
        jsonb_build_object('kind', 'reporte', 'report_id', NEW.id, 'description', left(NEW.description, 140))
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Solo si lo resolvió una persona (no el archivado automático por vencimiento).
    IF NEW.status = 'resuelto' AND OLD.status IS DISTINCT FROM 'resuelto'
       AND NEW.reporter_user_id IS NOT NULL
       AND NEW.resolved_by_user_id IS NOT NULL
       AND NEW.resolved_by_user_id <> NEW.reporter_user_id THEN
      PERFORM public.fn_notificar_usuario(
        NEW.reporter_user_id, 'reporte_actualizado'::public.notification_type,
        jsonb_build_object('kind', 'reporte', 'report_id', NEW.id, 'estado', 'resuelto')
      );
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo notificar la alerta %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_alerta ON public.vulnerability_reports;
CREATE TRIGGER trg_notif_alerta
  AFTER INSERT OR UPDATE ON public.vulnerability_reports
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_alerta();
