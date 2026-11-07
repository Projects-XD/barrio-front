-- Urgencia de favores y moderación por administradores de zona. Es aditiva y segura de repetir.
-- Aplicar antes de desplegar el backend: createFavor y executeCreateFavor escriben estas columnas.
--
-- Estrategia híbrida: un favor pendiente sigue visible y se trata como normal hasta aprobarse.
-- Se modera el privilegio de urgencia, no la publicación.
--
-- TEXT con CHECK en vez de enum: 0005 ya mostró los problemas de ALTER TYPE ... ADD VALUE.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.favors
  ADD COLUMN IF NOT EXISTS urgency TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'aprobado',
  ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

ALTER TABLE public.favors DROP CONSTRAINT IF EXISTS chk_favors_urgency;
ALTER TABLE public.favors
  ADD CONSTRAINT chk_favors_urgency
  CHECK (urgency IN ('normal', 'urgente', 'emergencia'));

ALTER TABLE public.favors DROP CONSTRAINT IF EXISTS chk_favors_moderation_status;
ALTER TABLE public.favors
  ADD CONSTRAINT chk_favors_moderation_status
  CHECK (moderation_status IN ('pendiente', 'aprobado', 'rechazado'));

-- Un favor normal nunca entra a la cola de moderación.
ALTER TABLE public.favors DROP CONSTRAINT IF EXISTS chk_favors_normal_aprobado;
ALTER TABLE public.favors
  ADD CONSTRAINT chk_favors_normal_aprobado
  CHECK (urgency <> 'normal' OR moderation_status = 'aprobado');

CREATE INDEX IF NOT EXISTS idx_favors_moderation_queue
  ON public.favors(zone_id, created_at)
  WHERE moderation_status = 'pendiente';

-- Auditoría en la misma transacción que el cambio: no depende de que el backend la recuerde.
-- Sin moderated_by, el cambio lo causó el autor al editar un favor ya aprobado.
CREATE OR REPLACE FUNCTION public.fn_audit_favor_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (
    COALESCE(NEW.moderated_by, NEW.author_id),
    'favor.moderation.' || NEW.moderation_status,
    'favor',
    NEW.id,
    jsonb_build_object(
      'from', OLD.moderation_status,
      'to', NEW.moderation_status,
      'urgency', NEW.urgency,
      'reason', NEW.moderation_reason
    )
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_favor_moderation ON public.favors;
CREATE TRIGGER trg_audit_favor_moderation
  AFTER UPDATE OF moderation_status ON public.favors
  FOR EACH ROW
  WHEN (OLD.moderation_status IS DISTINCT FROM NEW.moderation_status)
  EXECUTE FUNCTION public.fn_audit_favor_moderation();
