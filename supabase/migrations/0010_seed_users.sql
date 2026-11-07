-- Perfiles fijos para la demo. Es segura de repetir.
--
-- public.users.id tiene FK a auth.users y las cuentas de Auth no se pueden crear aquí sin guardar
-- sus contraseñas en el repo. Por eso el JOIN: en una base limpia esta migración inserta 0 filas y no
-- falla; las cuentas y sus perfiles los crea después `npm run seed` (backend/scripts/seed-auth.ts).
-- Si las cuentas ya existen, deja sus perfiles listos.
--
-- Los IDs deben coincidir con los de backend/scripts/seed-auth.ts.
--   ...0001 samirloroamaya24@gmail.com
--   ...0002 edson@gmail.com
--   ...0003 admin@gmail.com

INSERT INTO public.users (id, full_name, zone_id, is_admin)
SELECT
  seed.id,
  seed.full_name,
  (SELECT z.id FROM public.zones z WHERE z.name = 'Castilla'),
  seed.is_admin
FROM (
  VALUES
    ('a0000000-0000-4000-8000-000000000001'::uuid, 'Wilmer', false),
    ('a0000000-0000-4000-8000-000000000002'::uuid, 'Edson', false),
    ('a0000000-0000-4000-8000-000000000003'::uuid, 'Admin', true)
) AS seed(id, full_name, is_admin)
JOIN auth.users account ON account.id = seed.id
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  zone_id = EXCLUDED.zone_id,
  is_admin = public.users.is_admin OR EXCLUDED.is_admin, -- nunca le quita el rol a nadie
  updated_at = now();
