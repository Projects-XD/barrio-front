-- Índices para las consultas frecuentes del backend. Solo agrega índices: no altera tablas ni datos.
-- Cada uno sigue la forma de su consulta: primero columnas de igualdad, luego las del ORDER BY.

-- GET /favors (mapa, inicio, perfil y pestaña Favores, con polling cada 10 s).
-- Filtra por zona y ordena por created_at DESC, id. No lleva status: con status IN (abierta, en_curso)
-- un índice (zone_id, status, created_at) no entrega las filas ordenadas y obliga a un Sort.
CREATE INDEX IF NOT EXISTS idx_favors_zone_feed
  ON public.favors (zone_id, created_at DESC, id)
  WHERE deleted_at IS NULL;

-- GET /notifications: el único índice previo es parcial (solo no leídas), la lista completa no lo usa.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC, id);

-- Límite de mensajes por minuto en cada envío: sender_id no tenía ningún índice.
CREATE INDEX IF NOT EXISTS idx_messages_sender_created
  ON public.messages (sender_id, created_at DESC);

-- GET /emergency (polling cada 30 s): último estado de la zona.
CREATE INDEX IF NOT EXISTS idx_emergency_states_zone_activated
  ON public.emergency_states (zone_id, activated_at DESC);

-- GET /profiles: perfiles visibles de la zona, validados primero.
CREATE INDEX IF NOT EXISTS idx_professional_profiles_zone_ranking
  ON public.professional_profiles (zone_id, is_visible, is_validated DESC, validated_count DESC);

-- GET /emergency/reports: reportes activos de la zona, los más recientes primero.
CREATE INDEX IF NOT EXISTS idx_vulnerability_reports_zone_status_created
  ON public.vulnerability_reports (zone_id, status, created_at DESC);

-- GET /resources: recursos abiertos de la zona, los más recientes primero.
CREATE INDEX IF NOT EXISTS idx_critical_resources_zone_status_created
  ON public.critical_resources (zone_id, status, created_at DESC);
