-- 0036: Quién necesita ayuda y dónde está. Requiere la 0033.
-- Son datos sensibles: el backend solo los entrega a quien reportó, a los voluntarios del reporte y al comité/admin.
-- Segura de repetir.

ALTER TABLE public.vulnerability_reports
  ADD COLUMN IF NOT EXISTS affected_name TEXT CHECK (char_length(affected_name) <= 100),
  ADD COLUMN IF NOT EXISTS location_detail TEXT CHECK (char_length(location_detail) <= 200);
