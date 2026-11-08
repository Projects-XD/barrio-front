-- Notifica en la base de datos todo lo que le importa al vecino, sin depender de cada ruta del backend.
-- Se suma a lo que ya existía: interés en un favor (0014), mensajes (backend), reconocimiento al
-- cerrar un favor (backend) y publicaciones nuevas (0028).
--
--   Emergencias        activación y cierre en la zona          -> toda la zona
--   Alertas            reporte comunitario nuevo               -> toda la zona
--                      reporte resuelto por alguien            -> quien lo reportó
--   Favores            retirado por reportes                   -> su autor
--                      cerrado o cancelado                     -> los interesados
--                      asignado a un ayudante                  -> el ayudante
--   Oficios            visto bueno recibido                    -> el dueño del oficio
--                      oficio validado                         -> el dueño del oficio
--   Cuenta             suspensión, bloqueo y reactivación      -> la persona afectada
--   Denuncias          cambio de estado de una denuncia        -> quien la hizo
--
-- Los avisos que no encajan en un tipo propio usan 'sistema' y dicen qué son en payload->>'kind'.
-- Ningún trigger bloquea la operación original: si notificar falla, se registra un aviso y sigue.
-- Es segura de repetir.

-- ------------------------------------------------------------------------------
-- Funciones auxiliares (no se exponen por la API)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notificar_zona(
  p_zona UUID,
  p_excluir UUID,
  p_tipo public.notification_type,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.notifications (user_id, type, payload)
  SELECT u.id, p_tipo, p_payload
  FROM public.users u
  WHERE u.zone_id = p_zona
    AND u.status = 'active'
    AND (p_excluir IS NULL OR u.id <> p_excluir);
$$;

CREATE OR REPLACE FUNCTION public.fn_notificar_usuario(
  p_usuario UUID,
  p_tipo public.notification_type,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (p_usuario, p_tipo, p_payload);
$$;

-- Sin esto, cualquier vecino podría llamarlas con /rpc y enviar avisos a toda la zona.
REVOKE ALL ON FUNCTION public.fn_notificar_zona(UUID, UUID, public.notification_type, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_notificar_usuario(UUID, public.notification_type, JSONB) FROM PUBLIC, anon, authenticated;

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

-- ------------------------------------------------------------------------------
-- 3. Favores: retirado, cerrado o cancelado, y asignado
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notif_favor_cambio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Retirado por reportes de vecinos o por moderación: se avisa a su autor.
  IF NEW.moderation_status = 'rechazado' AND OLD.moderation_status IS DISTINCT FROM 'rechazado' THEN
    PERFORM public.fn_notificar_usuario(
      NEW.author_id, 'sistema'::public.notification_type,
      jsonb_build_object('kind', 'favor_oculto', 'favor_id', NEW.id, 'favor_title', NEW.title)
    );
  END IF;

  -- Cerrado o cancelado: se avisa a los interesados. Quien fue reconocido ya recibe su propio aviso.
  IF NEW.status IN ('cerrada', 'cancelada') AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, type, payload)
    SELECT
      fi.user_id,
      'sistema'::public.notification_type,
      jsonb_build_object('kind', 'favor_cerrado', 'estado', NEW.status, 'favor_id', NEW.id, 'favor_title', NEW.title)
    FROM public.favor_interests fi
    WHERE fi.favor_id = NEW.id
      AND fi.user_id <> NEW.author_id
      AND (NEW.assigned_to_user_id IS NULL OR fi.user_id <> NEW.assigned_to_user_id);
  END IF;

  -- Elegido para ayudar (si el favor se cierra a la vez, recibe el reconocimiento y no este aviso).
  IF NEW.assigned_to_user_id IS NOT NULL
     AND OLD.assigned_to_user_id IS DISTINCT FROM NEW.assigned_to_user_id
     AND NEW.assigned_to_user_id <> NEW.author_id
     AND NEW.status <> 'cerrada' THEN
    PERFORM public.fn_notificar_usuario(
      NEW.assigned_to_user_id, 'sistema'::public.notification_type,
      jsonb_build_object('kind', 'favor_asignado', 'favor_id', NEW.id, 'favor_title', NEW.title)
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo notificar el cambio del favor %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_favor_cambio ON public.favors;
CREATE TRIGGER trg_notif_favor_cambio
  AFTER UPDATE ON public.favors
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_favor_cambio();

-- ------------------------------------------------------------------------------
-- 4. Oficios: visto bueno recibido
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notif_visto_bueno()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dueno UUID;
  v_nombre TEXT;
BEGIN
  SELECT user_id INTO v_dueno FROM public.professional_profiles WHERE id = NEW.profile_id;
  SELECT full_name INTO v_nombre FROM public.users WHERE id = NEW.voucher_user_id;

  IF v_dueno IS NOT NULL AND v_dueno <> NEW.voucher_user_id THEN
    PERFORM public.fn_notificar_usuario(
      v_dueno, 'visto_bueno_recibido'::public.notification_type,
      jsonb_build_object('kind', 'oficio', 'profile_id', NEW.profile_id, 'voucher_name', v_nombre)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo notificar el visto bueno %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_visto_bueno ON public.vouches;
CREATE TRIGGER trg_notif_visto_bueno
  AFTER INSERT ON public.vouches
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_visto_bueno();

-- ------------------------------------------------------------------------------
-- 5. Oficios: validado por los vecinos
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notif_oficio_validado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_oficio TEXT;
BEGIN
  IF NEW.is_validated AND NOT OLD.is_validated THEN
    SELECT name INTO v_oficio FROM public.oficios WHERE id = NEW.oficio_id;
    PERFORM public.fn_notificar_usuario(
      NEW.user_id, 'sistema'::public.notification_type,
      jsonb_build_object('kind', 'oficio_validado', 'profile_id', NEW.id, 'oficio_name', v_oficio)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo notificar la validación del oficio %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_oficio_validado ON public.professional_profiles;
CREATE TRIGGER trg_notif_oficio_validado
  AFTER UPDATE OF is_validated ON public.professional_profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_oficio_validado();

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
