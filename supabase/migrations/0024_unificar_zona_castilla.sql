-- Todos los "sectores" sembrados en 0003 (Miraflores, Chapayra, Cruz de Caña, etc.) son en
-- realidad centros poblados DENTRO del mismo distrito de Castilla, no zonas operativas propias.
-- Al guardarse cada uno con su propio UUID, un vecino que elegía un sector distinto a "Castilla"
-- quedaba aislado de todo el contenido (favores, oficios, alertas), que vive bajo la zona Castilla:
-- su mapa y sus listas salían vacíos aunque la app funcionara bien.
-- Esta migración unifica todo bajo la zona Castilla; los sectores siguen existiendo en
-- public.zones solo como referencia visual/geográfica para el mapa de registro.
-- Es segura de repetir.

DO $$
DECLARE
  v_castilla_id UUID := '03952125-81cf-4e1a-9244-d3fbe5f9bbf2';
BEGIN
  -- 1. La función que sincroniza auth.users -> public.users ya no confía en el zone_id que
  --    manda el cliente al registrarse: todo vecino nuevo queda en Castilla sin excepción.
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, auth, pg_temp
  AS $fn$
  DECLARE
    v_full_name TEXT;
  BEGIN
    v_full_name := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(split_part(NEW.email, '@', 1)), ''),
      'Vecino'
    );

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
  $fn$;

  -- 2. Repara a los vecinos ya registrados en un sector distinto (o sin zona) para que vean
  --    el mismo barrio que todos los demás.
  UPDATE public.users
  SET zone_id = v_castilla_id, updated_at = now()
  WHERE zone_id IS DISTINCT FROM v_castilla_id;

  -- 3. Repara cualquier contenido ya publicado bajo un sector distinto a Castilla, para que no
  --    desaparezca del mapa/listas de nadie. Las filas sin zona (NULL) se dejan como están.
  UPDATE public.professional_profiles
  SET zone_id = v_castilla_id, updated_at = now()
  WHERE zone_id IS NOT NULL AND zone_id <> v_castilla_id;

  UPDATE public.favors
  SET zone_id = v_castilla_id, updated_at = now()
  WHERE zone_id IS NOT NULL AND zone_id <> v_castilla_id;

  UPDATE public.emergency_states
  SET zone_id = v_castilla_id, updated_at = now()
  WHERE zone_id <> v_castilla_id;

  UPDATE public.support_services
  SET zone_id = v_castilla_id, updated_at = now()
  WHERE zone_id IS NOT NULL AND zone_id <> v_castilla_id;

  UPDATE public.vulnerability_reports
  SET zone_id = v_castilla_id, updated_at = now()
  WHERE zone_id IS NOT NULL AND zone_id <> v_castilla_id;

  UPDATE public.critical_resources
  SET zone_id = v_castilla_id, updated_at = now()
  WHERE zone_id IS NOT NULL AND zone_id <> v_castilla_id;
END $$;
