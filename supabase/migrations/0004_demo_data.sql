-- Datos para la demo de Castilla (Piura). No toca RLS.
-- Ejecutar en el editor SQL de Supabase. Todas las sentencias son seguras de repetir.

-- 1. Servicios de emergencia nacionales (Perú). zone_id NULL = visibles en todas las zonas.
--    Verificar los números antes de la presentación; por eso quedan con is_verified = false.
INSERT INTO public.support_services (zone_id, name, type, phone, address_summary, hours, is_verified)
SELECT NULL, v.name, v.type::service_type, v.phone, v.address_summary, v.hours, false
FROM (VALUES
  ('SAMU - Emergencias médicas', 'salud',    '106', 'Atención móvil de urgencias', '24 horas'),
  ('Bomberos',                   'bomberos', '116', 'Central de emergencias',      '24 horas'),
  ('Policía Nacional',           'policia',  '105', 'Central de emergencias',      '24 horas')
) AS v(name, type, phone, address_summary, hours)
WHERE NOT EXISTS (
  SELECT 1 FROM public.support_services s WHERE s.name = v.name AND s.zone_id IS NULL
);

-- 2. Borrar zonas de ejemplo que no pertenecen a Castilla, solo si nada las usa.
DELETE FROM public.zones z
WHERE z.name IN ('Centro', 'Los Alamos', 'La Plaza', 'Villa Norte', 'San Isidro')
  AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.zone_id = z.id)
  AND NOT EXISTS (SELECT 1 FROM public.professional_profiles p WHERE p.zone_id = z.id)
  AND NOT EXISTS (SELECT 1 FROM public.favors f WHERE f.zone_id = z.id)
  AND NOT EXISTS (SELECT 1 FROM public.vulnerability_reports r WHERE r.zone_id = z.id)
  AND NOT EXISTS (SELECT 1 FROM public.critical_resources c WHERE c.zone_id = z.id)
  AND NOT EXISTS (SELECT 1 FROM public.emergency_states e WHERE e.zone_id = z.id)
  AND NOT EXISTS (SELECT 1 FROM public.support_services s WHERE s.zone_id = z.id);

-- 3. Dar rol de emergencia a una cuenta de prueba. Cambia el correo antes de ejecutar.
UPDATE public.users
SET emergency_role = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'CAMBIA_ESTE_CORREO@ejemplo.com');
