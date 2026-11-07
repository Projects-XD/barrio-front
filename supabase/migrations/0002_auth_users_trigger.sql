-- ==============================================================================
-- Migration: 0002_auth_users_trigger.sql
-- Proyecto: Barrio Backend / Supabase
-- Descripción: Sincronización automática de usuarios desde auth.users hacia public.users
--              mediante trigger reactivo en la base de datos PostgreSQL.
-- ==============================================================================

-- 1. Función PL/pgSQL que maneja la inserción de nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_full_name TEXT;
  v_zone_id UUID;
  v_raw_zone TEXT;
BEGIN
  -- Extraer nombre completo de raw_user_meta_data con fallback al alias del email o 'Vecino'
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(split_part(NEW.email, '@', 1)), ''),
    'Vecino'
  );

  -- Extraer zone_id de raw_user_meta_data
  -- REGLA: Si zone_id no viene o no es un UUID válido, se asigna NULL para no bloquear el registro
  v_raw_zone := NULLIF(TRIM(NEW.raw_user_meta_data->>'zone_id'), '');
  
  IF v_raw_zone IS NOT NULL THEN
    BEGIN
      v_zone_id := v_raw_zone::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_zone_id := NULL;
    END;
  ELSE
    v_zone_id := NULL;
  END IF;

  -- Insertar en public.users con ON CONFLICT DO UPDATE para idempotencia
  INSERT INTO public.users (
    id,
    full_name,
    avatar_url,
    zone_id,
    status,
    is_anonymous_by_default,
    emergency_role,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_full_name,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), ''),
    v_zone_id,
    'active',
    false,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    zone_id = COALESCE(EXCLUDED.zone_id, public.users.zone_id),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- En caso de advertencia o excepción imprevista, loguear sin bloquear la creación de auth.users
  RAISE WARNING 'Aviso en public.handle_new_user() para el usuario %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 2. Eliminar trigger previo si existe y volver a crearlo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Habilitar permisos de ejecución para roles de servicio y autenticados
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role, authenticated, anon;
