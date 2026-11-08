-- Avisa en tiempo real a los vecinos de la zona cada vez que alguien publica una ayuda o un oficio.
--   1. Nuevo tipo de notificación: 'nueva_publicacion'.
--   2. Triggers que crean un aviso por cada vecino de la zona (menos el autor).
--   3. Los vecinos pueden leer sus propios avisos y la tabla emite cambios por Realtime.
-- Un fallo al notificar nunca bloquea la publicación: el trigger captura el error y sigue.
-- Es segura de repetir.

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'nueva_publicacion';

-- ------------------------------------------------------------------------------
-- 1. Nueva ayuda (pedido u ofrecimiento) aprobada
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notificar_nuevo_favor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_autor TEXT;
BEGIN
  IF NEW.moderation_status IS DISTINCT FROM 'aprobado' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_autor FROM public.users WHERE id = NEW.author_id;

  INSERT INTO public.notifications (user_id, type, payload)
  SELECT
    u.id,
    'nueva_publicacion'::public.notification_type,
    jsonb_build_object(
      'kind', 'favor',
      'favor_id', NEW.id,
      'favor_title', NEW.title,
      'intent', NEW.intent,
      'author_name', v_autor
    )
  FROM public.users u
  WHERE u.zone_id = NEW.zone_id
    AND u.id <> NEW.author_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo notificar el favor %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_nuevo_favor ON public.favors;
CREATE TRIGGER trg_notificar_nuevo_favor
  AFTER INSERT ON public.favors
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notificar_nuevo_favor();

-- ------------------------------------------------------------------------------
-- 2. Nuevo oficio visible
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_notificar_nuevo_oficio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_autor TEXT;
  v_oficio TEXT;
BEGIN
  IF NEW.is_visible IS DISTINCT FROM TRUE THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_autor FROM public.users WHERE id = NEW.user_id;
  SELECT name INTO v_oficio FROM public.oficios WHERE id = NEW.oficio_id;

  INSERT INTO public.notifications (user_id, type, payload)
  SELECT
    u.id,
    'nueva_publicacion'::public.notification_type,
    jsonb_build_object(
      'kind', 'oficio',
      'profile_id', NEW.id,
      'oficio_name', v_oficio,
      'author_name', v_autor
    )
  FROM public.users u
  WHERE u.zone_id = NEW.zone_id
    AND u.id <> NEW.user_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo notificar el oficio %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_nuevo_oficio ON public.professional_profiles;
CREATE TRIGGER trg_notificar_nuevo_oficio
  AFTER INSERT ON public.professional_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notificar_nuevo_oficio();

-- ------------------------------------------------------------------------------
-- 3. Lectura propia y Realtime
-- ------------------------------------------------------------------------------
-- Realtime respeta RLS: sin esta política el vecino no recibe sus avisos en vivo.
DROP POLICY IF EXISTS notifications_leer_propias ON public.notifications;
CREATE POLICY notifications_leer_propias ON public.notifications
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL; -- ya estaba en la publicación
  WHEN undefined_object THEN NULL; -- proyecto sin publicación supabase_realtime
END $$;
