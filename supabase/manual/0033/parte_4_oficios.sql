-- 0033, parte 4 de 5: Oficios. Ejecutar en orden. Es segura de repetir.

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
