-- Reemplaza handle_new_user() (0002, ya tocada por 0024) como una sola instrucción DDL de nivel
-- superior -- no anidada dentro de un bloque DO -- para que quede fuera de toda duda: cualquier
-- usuario nuevo cae SIEMPRE en Castilla, sin leer el zone_id del sector que mandó el cliente en
-- la metadata de Auth. Es segura de repetir.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_full_name TEXT;
BEGIN
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(split_part(NEW.email, '@', 1)), ''),
    'Vecino'
  );

  -- REGLA: el zone_id del sector elegido al registrarse (raw_user_meta_data->>'zone_id') se
  -- ignora por completo. Todos los sectores de Castilla (0003) son el mismo distrito operativo.
  INSERT INTO public.users (
    id, full_name, avatar_url, zone_id, status,
    is_anonymous_by_default, emergency_role, created_at, updated_at
  ) VALUES (
    NEW.id,
    v_full_name,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), ''),
    '03952125-81cf-4e1a-9244-d3fbe5f9bbf2'::uuid,
    'active',
    false,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    zone_id = '03952125-81cf-4e1a-9244-d3fbe5f9bbf2'::uuid,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Aviso en public.handle_new_user() para el usuario %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- CREATE OR REPLACE FUNCTION conserva el OID de la función, así que el trigger existente ya
-- apunta a esta versión nueva sin necesidad de recrearlo. Se vuelve a crear de todos modos,
-- igual que en 0002/0018, para dejar esta migración autosuficiente si el trigger no existiera.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role, authenticated, anon;

-- Repara, por si algún registro se coló entre la aplicación de 0024 y 0025, a cualquier usuario
-- que no haya quedado en Castilla.
UPDATE public.users
SET zone_id = '03952125-81cf-4e1a-9244-d3fbe5f9bbf2'::uuid, updated_at = now()
WHERE zone_id IS DISTINCT FROM '03952125-81cf-4e1a-9244-d3fbe5f9bbf2'::uuid;
