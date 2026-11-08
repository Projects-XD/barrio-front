-- Ban progresivo por reportes de vecinos.
-- users.status ya existe (enum user_status: active/suspended/deleted) y los triggers de alta escriben
-- 'active', así que se reutiliza: 'suspended' = suspensión temporal (con suspended_until) y se añade 'banned'.
--   5 reportes  -> suspended 24 h
--   10 reportes -> suspended 7 días
--   20 reportes -> banned (permanente)
-- Es segura de repetir.

ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'banned';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS report_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;

-- 1. Un vecino solo puede reportar a otro una vez (se quitan duplicados previos, queda el más antiguo).
DELETE FROM public.user_reports r
USING public.user_reports older
WHERE r.target_type = 'user'
  AND older.target_type = 'user'
  AND r.reporter_user_id = older.reporter_user_id
  AND r.target_id = older.target_id
  AND (older.created_at, older.id) < (r.created_at, r.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_reports_usuario_una_vez
  ON public.user_reports (reporter_user_id, target_id)
  WHERE target_type = 'user';

-- Contador inicial con los reportes que ya existen (no aplica bans retroactivos).
UPDATE public.users u
SET report_count = c.n
FROM (
  SELECT target_id, count(*)::int AS n
  FROM public.user_reports
  WHERE target_type = 'user'
  GROUP BY target_id
) c
WHERE c.target_id = u.id;

-- 2 y 3. Cada reporte nuevo suma 1 y, al cruzar un umbral exacto, aplica la sanción.
-- SECURITY DEFINER: el reportante no tiene permiso de UPDATE sobre la fila del reportado.
CREATE OR REPLACE FUNCTION public.fn_ban_progresivo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF NEW.target_type <> 'user' THEN
    RETURN NEW;
  END IF;

  UPDATE public.users
  SET report_count = report_count + 1
  WHERE id = NEW.target_id
  RETURNING report_count INTO v_count;

  IF v_count IS NULL THEN
    RETURN NEW; -- target_id no es un usuario
  END IF;

  -- Igualdad exacta: el 6.º reporte no alarga la suspensión del 5.º.
  IF v_count = 20 THEN
    UPDATE public.users SET status = 'banned', suspended_until = NULL WHERE id = NEW.target_id;
  ELSIF v_count = 10 THEN
    UPDATE public.users SET status = 'suspended', suspended_until = now() + interval '7 days'
    WHERE id = NEW.target_id AND status <> 'banned';
  ELSIF v_count = 5 THEN
    UPDATE public.users SET status = 'suspended', suspended_until = now() + interval '24 hours'
    WHERE id = NEW.target_id AND status <> 'banned';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ban_progresivo ON public.user_reports;
CREATE TRIGGER trg_ban_progresivo
AFTER INSERT ON public.user_reports
FOR EACH ROW EXECUTE FUNCTION public.fn_ban_progresivo();
