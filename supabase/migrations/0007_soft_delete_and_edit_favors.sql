-- Soft-delete y registro de edición de favores. Es aditiva y segura de repetir.
-- Aplicar antes de desplegar el backend: updateFavor y softDeleteFavor escriben estas columnas.
--
-- Sin índice en deleted_at: todo favor desactivado está en 'cancelada', así que el listado
-- ya los descarta con idx_favors_zone_status.

ALTER TABLE public.favors
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

ALTER TABLE public.favors DROP CONSTRAINT IF EXISTS chk_favors_deleted_cancelada;
ALTER TABLE public.favors
  ADD CONSTRAINT chk_favors_deleted_cancelada
  CHECK (deleted_at IS NULL OR status = 'cancelada');
