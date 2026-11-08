-- 0033, parte 3 de 5: Favores. Ejecutar en orden. Es segura de repetir.

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
