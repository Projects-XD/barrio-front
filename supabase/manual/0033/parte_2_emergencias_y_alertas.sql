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
-- Los avisos de reportes (nuevo, voluntarios, refuerzo, escalado, resuelto) los maneja la 0034
-- (reportes_emergencia_base y siguientes). No se define aquí para no avisar dos veces.
