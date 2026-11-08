-- 0033, parte 5 de 5: Cuenta y denuncias. Ejecutar en orden. Es segura de repetir.

-- ------------------------------------------------------------------------------
-- 6. Cuenta: suspensión, bloqueo y reactivación
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notif_estado_cuenta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'suspended' THEN
      PERFORM public.fn_notificar_usuario(
        NEW.id, 'sistema'::public.notification_type,
        jsonb_build_object('kind', 'cuenta_suspendida', 'hasta', NEW.suspended_until)
      );
    ELSIF NEW.status = 'banned' THEN
      PERFORM public.fn_notificar_usuario(
        NEW.id, 'sistema'::public.notification_type,
        jsonb_build_object('kind', 'cuenta_baneada')
      );
    ELSIF NEW.status = 'active' AND OLD.status IN ('suspended', 'banned') THEN
      PERFORM public.fn_notificar_usuario(
        NEW.id, 'sistema'::public.notification_type,
        jsonb_build_object('kind', 'cuenta_reactivada')
      );
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo notificar el estado de la cuenta %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_estado_cuenta ON public.users;
CREATE TRIGGER trg_notif_estado_cuenta
  AFTER UPDATE OF status ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_estado_cuenta();

-- ------------------------------------------------------------------------------
-- 7. Denuncias: cambio de estado, para quien la hizo
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notif_denuncia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.fn_notificar_usuario(
      NEW.reporter_user_id, 'reporte_actualizado'::public.notification_type,
      jsonb_build_object('kind', 'denuncia', 'estado', NEW.status)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo notificar la denuncia %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_denuncia ON public.user_reports;
CREATE TRIGGER trg_notif_denuncia
  AFTER UPDATE OF status ON public.user_reports
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_denuncia();
