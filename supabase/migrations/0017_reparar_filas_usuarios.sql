-- Repara cuentas que existen en auth.users pero no tienen fila en public.users.
-- Sin esa fila, el backend no reconoce la zona y las listas (oficios, favores, chats) salen vacías.
-- Es segura de repetir.

-- 1. Vuelve a crear el trigger de sincronización (por si no quedó activo en el proyecto).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Crea las filas que faltan con la zona que eligió el vecino al registrarse.
INSERT INTO public.users (id, full_name, zone_id, status, is_anonymous_by_default, emergency_role, created_at, updated_at)
SELECT
  a.id,
  COALESCE(NULLIF(btrim(a.raw_user_meta_data->>'full_name'), ''), split_part(a.email, '@', 1), 'Vecino'),
  NULLIF(a.raw_user_meta_data->>'zone_id', '')::uuid,
  'active',
  false,
  false,
  now(),
  now()
FROM auth.users a
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = a.id)
ON CONFLICT (id) DO NOTHING;

-- 3. Cuentas que sí tienen fila pero sin zona: toman la zona de su registro.
UPDATE public.users u
SET zone_id = NULLIF(a.raw_user_meta_data->>'zone_id', '')::uuid
FROM auth.users a
WHERE a.id = u.id
  AND u.zone_id IS NULL
  AND NULLIF(a.raw_user_meta_data->>'zone_id', '') IS NOT NULL;
