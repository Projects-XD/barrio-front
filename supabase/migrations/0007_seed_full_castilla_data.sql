-- ==============================================================================
-- Migration: 0007_seed_full_castilla_data.sql
-- Proyecto: Barrio (Comunidad Vecinal de Castilla - Piura)
-- Descripción: Script maestro e idempotente para poblar la base de datos con:
--   1. Políticas RLS completas para lectura/escritura segura
--   2. Las 16 zonas de Castilla (Piura) con coordenadas geográficas reales
--   3. Catálogo completo de oficios barriales
--   4. 12 vecinos de prueba en auth.users, public.users y user_phones
--   5. 10 perfiles profesionales con coordenadas y años de experiencia
--   6. +24 vistos buenos (vouches) con recálculo automático de validación
--   7. 10 favores comunitarios en todas las categorías + vecinos interesados
--   8. 9 servicios de emergencia verificados en Castilla y Piura
--   9. 6 reportes de vulnerabilidad (con coordenadas redondeadas a 3 decimales)
--  10. 10 pedidos y ofertas de recursos críticos
-- ==============================================================================

-- Asegurar que el enum favor_type incluya 'otros'
ALTER TYPE public.favor_type ADD VALUE IF NOT EXISTS 'otros';

-- ==============================================================================
-- 1. POLÍTICAS RLS (Row Level Security) IDEMPOTENTES
-- ==============================================================================

DO $$
BEGIN
  -- Zonas: lectura pública
  DROP POLICY IF EXISTS "zonas_lectura_publica" ON public.zones;
  CREATE POLICY "zonas_lectura_publica" ON public.zones FOR SELECT USING (true);

  -- Oficios: lectura pública
  DROP POLICY IF EXISTS "oficios_lectura_publica" ON public.oficios;
  CREATE POLICY "oficios_lectura_publica" ON public.oficios FOR SELECT USING (true);

  -- Usuarios: lectura para autenticados, escritura propia
  DROP POLICY IF EXISTS "users_lectura_autenticados" ON public.users;
  CREATE POLICY "users_lectura_autenticados" ON public.users FOR SELECT USING (true);
  DROP POLICY IF EXISTS "users_insertar_propio" ON public.users;
  CREATE POLICY "users_insertar_propio" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
  DROP POLICY IF EXISTS "users_actualizar_propio" ON public.users;
  CREATE POLICY "users_actualizar_propio" ON public.users FOR UPDATE USING (auth.uid() = id);

  -- Perfiles profesionales: lectura pública, escritura del propietario
  DROP POLICY IF EXISTS "perfiles_lectura_publica" ON public.professional_profiles;
  CREATE POLICY "perfiles_lectura_publica" ON public.professional_profiles FOR SELECT USING (true);
  DROP POLICY IF EXISTS "perfiles_escritura_propia" ON public.professional_profiles;
  CREATE POLICY "perfiles_escritura_propia" ON public.professional_profiles FOR ALL USING (auth.uid() = user_id);

  -- Vouches (vistos buenos): lectura pública, creación/borrado del votante
  DROP POLICY IF EXISTS "vouches_lectura_publica" ON public.vouches;
  CREATE POLICY "vouches_lectura_publica" ON public.vouches FOR SELECT USING (true);
  DROP POLICY IF EXISTS "vouches_escritura_propia" ON public.vouches;
  CREATE POLICY "vouches_escritura_propia" ON public.vouches FOR ALL USING (auth.uid() = voucher_user_id);

  -- Favores: lectura pública, escritura del autor
  DROP POLICY IF EXISTS "favors_lectura_publica" ON public.favors;
  CREATE POLICY "favors_lectura_publica" ON public.favors FOR SELECT USING (true);
  DROP POLICY IF EXISTS "favors_escritura_autor" ON public.favors;
  CREATE POLICY "favors_escritura_autor" ON public.favors FOR ALL USING (auth.uid() = author_id);

  -- Intereses en favores: lectura pública, escritura del vecino interesado
  DROP POLICY IF EXISTS "favor_interests_lectura_publica" ON public.favor_interests;
  CREATE POLICY "favor_interests_lectura_publica" ON public.favor_interests FOR SELECT USING (true);
  DROP POLICY IF EXISTS "favor_interests_escritura_propia" ON public.favor_interests;
  CREATE POLICY "favor_interests_escritura_propia" ON public.favor_interests FOR ALL USING (auth.uid() = user_id);

  -- Servicios de soporte: lectura pública
  DROP POLICY IF EXISTS "services_lectura_publica" ON public.support_services;
  CREATE POLICY "services_lectura_publica" ON public.support_services FOR SELECT USING (true);

  -- Reportes de vulnerabilidad: lectura y creación autenticada
  DROP POLICY IF EXISTS "reports_lectura_publica" ON public.vulnerability_reports;
  CREATE POLICY "reports_lectura_publica" ON public.vulnerability_reports FOR SELECT USING (true);
  DROP POLICY IF EXISTS "reports_insertar_autenticado" ON public.vulnerability_reports;
  CREATE POLICY "reports_insertar_autenticado" ON public.vulnerability_reports FOR INSERT WITH CHECK (true);

  -- Recursos críticos: lectura pública, escritura propia
  DROP POLICY IF EXISTS "resources_lectura_publica" ON public.critical_resources;
  CREATE POLICY "resources_lectura_publica" ON public.critical_resources FOR SELECT USING (true);
  DROP POLICY IF EXISTS "resources_escritura_propia" ON public.critical_resources;
  CREATE POLICY "resources_escritura_propia" ON public.critical_resources FOR ALL USING (auth.uid() = user_id);

  -- Estado de emergencia: lectura pública
  DROP POLICY IF EXISTS "emergency_lectura_publica" ON public.emergency_states;
  CREATE POLICY "emergency_lectura_publica" ON public.emergency_states FOR SELECT USING (true);
END $$;

-- ==============================================================================
-- 2. ZONAS DE CASTILLA (PIURA) CON COORDENADAS REALES
-- ==============================================================================

INSERT INTO public.zones (name, city, center_lat, center_lng) VALUES
  ('Castilla',         'Piura', -5.201600, -80.622500),
  ('Miraflores',       'Piura', -5.165200, -80.613300),
  ('Río Seco',         'Piura', -5.138300, -80.614100),
  ('Las Mercedes',     'Piura', -5.147500, -80.462200),
  ('Chapayra',         'Piura', -5.121500, -80.604600),
  ('Terela',           'Piura', -5.079400, -80.594100),
  ('El Papayo',        'Piura', -5.045000, -80.608600),
  ('San Vicente',      'Piura', -5.023000, -80.594400),
  ('San Rafael',       'Piura', -4.987200, -80.589700),
  ('La Obrilla',       'Piura', -4.984700, -80.575800),
  ('Cruz de Caña',     'Piura', -5.146600, -80.392700),
  ('Virgen de Fátima', 'Piura', -5.146700, -80.414400),
  ('Los Pulache',      'Piura', -5.157200, -80.492200),
  ('Loma El Mirador',  'Piura', -5.182000, -80.605000),
  ('Sector Chocán',    'Piura', -5.191000, -80.618000),
  ('Mi Cautivo',       'Piura', -5.209000, -80.615000)
ON CONFLICT (name) DO UPDATE SET
  city = EXCLUDED.city,
  center_lat = COALESCE(EXCLUDED.center_lat, public.zones.center_lat),
  center_lng = COALESCE(EXCLUDED.center_lng, public.zones.center_lng),
  updated_at = now();

-- ==============================================================================
-- 3. CATÁLOGO DE OFICIOS BARRIALES
-- ==============================================================================

INSERT INTO public.oficios (id, category, name, is_active) VALUES
  ('11111111-1111-4111-8111-111111111101', 'gasfiteria',        'Gasfitería',           true),
  ('11111111-1111-4111-8111-111111111102', 'carpinteria',       'Carpintería',          true),
  ('11111111-1111-4111-8111-111111111103', 'electricidad',      'Electricidad',         true),
  ('11111111-1111-4111-8111-111111111104', 'cerrajeria',        'Cerrajería',           true),
  ('11111111-1111-4111-8111-111111111105', 'clases',            'Clases particulares',  true),
  ('11111111-1111-4111-8111-111111111106', 'paseador_mascotas', 'Paseador de mascotas', true),
  ('11111111-1111-4111-8111-111111111107', 'otro',              'Otros oficios',        true)
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  name = EXCLUDED.name,
  is_active = true,
  updated_at = now();

-- ==============================================================================
-- 4. POBLADO COMPLETO DE DATOS COMUNITARIOS (BLOQUE PL/pgSQL)
-- ==============================================================================

DO $$
DECLARE
  v_castilla_id UUID;
  v_active_zone_id UUID;
  v_zone_id UUID;

  v_of_gasfiteria UUID;
  v_of_carpinteria UUID;
  v_of_electricidad UUID;
  v_of_cerrajeria UUID;
  v_of_clases UUID;
  v_of_mascotas UUID;
  v_of_otro UUID;

  -- IDs fijos para los 12 vecinos de Castilla
  u_lucia    UUID := '22222222-2222-4222-8222-222222222201';
  u_carlos   UUID := '22222222-2222-4222-8222-222222222202';
  u_jorge    UUID := '22222222-2222-4222-8222-222222222203';
  u_rosa     UUID := '22222222-2222-4222-8222-222222222204';
  u_pedro    UUID := '22222222-2222-4222-8222-222222222205';
  u_elena    UUID := '22222222-2222-4222-8222-222222222206';
  u_miguel   UUID := '22222222-2222-4222-8222-222222222207';
  u_carmen   UUID := '22222222-2222-4222-8222-222222222208';
  u_luis     UUID := '22222222-2222-4222-8222-222222222209';
  u_ana      UUID := '22222222-2222-4222-8222-222222222210';
  u_roberto  UUID := '22222222-2222-4222-8222-222222222211';
  u_maria    UUID := '22222222-2222-4222-8222-222222222212';

  -- IDs de perfiles profesionales
  p_lucia    UUID;
  p_carlos   UUID;
  p_jorge    UUID;
  p_rosa     UUID;
  p_pedro    UUID;
  p_elena    UUID;
  p_miguel   UUID;
  p_carmen   UUID;
  p_luis     UUID;
  p_ana      UUID;

  -- IDs de favores
  f_1 UUID := '44444444-4444-4444-8444-444444444401';
  f_2 UUID := '44444444-4444-4444-8444-444444444402';
  f_3 UUID := '44444444-4444-4444-8444-444444444403';
  f_4 UUID := '44444444-4444-4444-8444-444444444404';
  f_5 UUID := '44444444-4444-4444-8444-444444444405';
  f_6 UUID := '44444444-4444-4444-8444-444444444406';
  f_7 UUID := '44444444-4444-4444-8444-444444444407';
  f_8 UUID := '44444444-4444-4444-8444-444444444408';
  f_9 UUID := '44444444-4444-4444-8444-444444444409';
  f_10 UUID := '44444444-4444-4444-8444-444444444410';
BEGIN
  -- 4.1 Obtener la zona Castilla y la zona del usuario real más reciente (si existe)
  SELECT id INTO v_castilla_id FROM public.zones WHERE name = 'Castilla' LIMIT 1;

  -- Asignar Castilla a cualquier usuario existente que no tenga zona aún
  UPDATE public.users
  SET zone_id = v_castilla_id, emergency_role = true, updated_at = now()
  WHERE zone_id IS NULL;

  -- Detectar la zona del usuario real registrado más recientemente para poblarla también
  SELECT zone_id INTO v_active_zone_id
  FROM public.users
  WHERE id NOT IN (u_lucia, u_carlos, u_jorge, u_rosa, u_pedro, u_elena, u_miguel, u_carmen, u_luis, u_ana, u_roberto, u_maria)
    AND zone_id IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  v_zone_id := COALESCE(v_active_zone_id, v_castilla_id);

  -- 4.2 Obtener los IDs reales de cada categoría de oficio
  SELECT id INTO v_of_gasfiteria   FROM public.oficios WHERE category = 'gasfiteria'   LIMIT 1;
  SELECT id INTO v_of_carpinteria  FROM public.oficios WHERE category = 'carpinteria'  LIMIT 1;
  SELECT id INTO v_of_electricidad FROM public.oficios WHERE category = 'electricidad' LIMIT 1;
  SELECT id INTO v_of_cerrajeria   FROM public.oficios WHERE category = 'cerrajeria'   LIMIT 1;
  SELECT id INTO v_of_clases       FROM public.oficios WHERE category = 'clases'       LIMIT 1;
  SELECT id INTO v_of_mascotas     FROM public.oficios WHERE category = 'paseador_mascotas' LIMIT 1;
  SELECT id INTO v_of_otro         FROM public.oficios WHERE category = 'otro'         LIMIT 1;

  -- 4.3 Crear los 12 usuarios demo en auth.users (necesario por la FK de public.users -> auth.users)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES
    (u_lucia,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lucia.ramirez@barrio.pe',    crypt('Vecino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Lucía Ramírez',      'zone_id', v_zone_id), now(), now()),
    (u_carlos,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carlos.mendoza@barrio.pe',   crypt('Vecino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Carlos Mendoza',     'zone_id', v_zone_id), now(), now()),
    (u_jorge,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jorge.ipanaque@barrio.pe',   crypt('Vecino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Jorge Ipanaqué',     'zone_id', v_zone_id), now(), now()),
    (u_rosa,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rosa.chunga@barrio.pe',      crypt('Vecino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Rosa Chunga',        'zone_id', v_zone_id), now(), now()),
    (u_pedro,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pedro.valladolid@barrio.pe', crypt('Vecino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Pedro Valladolid',   'zone_id', v_zone_id), now(), now()),
    (u_elena,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'elena.tavara@barrio.pe',     crypt('Vecino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Elena Távara',       'zone_id', v_zone_id), now(), now()),
    (u_miguel,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'miguel.palacios@barrio.pe',  crypt('Vecino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Miguel Palacios',    'zone_id', v_zone_id), now(), now()),
    (u_carmen,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carmen.cordova@barrio.pe',   crypt('Vecino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Carmen Córdova',     'zone_id', v_zone_id), now(), now()),
    (u_luis,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'luis.bereche@barrio.pe',     crypt('Vecino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Luis Bereche',       'zone_id', v_zone_id), now(), now()),
    (u_ana,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana.zeta@barrio.pe',         crypt('Vecino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Ana Zeta',           'zone_id', v_zone_id), now(), now()),
    (u_roberto, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'roberto.panta@barrio.pe',    crypt('Vecino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'Roberto Panta',      'zone_id', v_zone_id), now(), now()),
    (u_maria,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maria.seminario@barrio.pe',  crypt('Vecino123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', 'María Seminario',    'zone_id', v_zone_id), now(), now())
  ON CONFLICT (id) DO UPDATE SET
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = now();

  -- 4.4 Asegurar los 12 vecinos en public.users
  INSERT INTO public.users (id, full_name, zone_id, status, emergency_role) VALUES
    (u_lucia,   'Lucía Ramírez',    v_zone_id, 'active', true),
    (u_carlos,  'Carlos Mendoza',   v_zone_id, 'active', false),
    (u_jorge,   'Jorge Ipanaqué',   v_zone_id, 'active', false),
    (u_rosa,    'Rosa Chunga',      v_zone_id, 'active', true),
    (u_pedro,   'Pedro Valladolid', v_zone_id, 'active', false),
    (u_elena,   'Elena Távara',     v_zone_id, 'active', false),
    (u_miguel,  'Miguel Palacios',  v_zone_id, 'active', false),
    (u_carmen,  'Carmen Córdova',   v_zone_id, 'active', false),
    (u_luis,    'Luis Bereche',     v_zone_id, 'active', false),
    (u_ana,     'Ana Zeta',         v_zone_id, 'active', false),
    (u_roberto, 'Roberto Panta',    v_zone_id, 'active', true),
    (u_maria,   'María Seminario',  v_zone_id, 'active', false)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    zone_id = EXCLUDED.zone_id,
    status = 'active',
    updated_at = now();

  -- 4.5 Teléfonos vecinales de contacto
  INSERT INTO public.user_phones (user_id, phone, is_public) VALUES
    (u_lucia,   '+51969112233', true),
    (u_carlos,  '+51969223344', true),
    (u_jorge,   '+51969334455', true),
    (u_rosa,    '+51969445566', true),
    (u_pedro,   '+51969556677', true),
    (u_elena,   '+51969667788', true),
    (u_miguel,  '+51969778899', true),
    (u_carmen,  '+51969889900', true),
    (u_luis,    '+51969990011', true),
    (u_ana,     '+51968112244', true)
  ON CONFLICT (user_id, phone) DO NOTHING;

  -- ============================================================================
  -- 5. PERFILES PROFESIONALES (OFICIOS DEL BARRIO)
  -- ============================================================================

  INSERT INTO public.professional_profiles (
    user_id, oficio_id, zone_id, description, years_experience, location_lat, location_lng, is_visible
  ) VALUES
    (
      u_lucia, v_of_gasfiteria, v_zone_id,
      'Reparación de cañerías, llaves, fugas de agua, tanques elevados y bombas periféricas. Atiendo emergencias de fin de semana en todo Castilla.',
      12, -5.2008, -80.6215, true
    ),
    (
      u_carlos, v_of_electricidad, v_zone_id,
      'Instalaciones eléctricas domiciliarias, cambio de llaves térmicas, detección de cortocircuitos, pozos a tierra y luminarias LED.',
      9, -5.2031, -80.6242, true
    ),
    (
      u_jorge, v_of_carpinteria, v_zone_id,
      'Fabricación y reparación de puertas de madera, reposteros de cocina, closets a medida, barnizado y mantenimiento de techos.',
      15, -5.1992, -80.6201, true
    ),
    (
      u_rosa, v_of_clases, v_zone_id,
      'Docente titulada ofrece nivelación escolar en matemáticas, comunicación e inglés para primaria y secundaria. Clases pacientes a domicilio.',
      7, -5.2045, -80.6238, true
    ),
    (
      u_pedro, v_of_cerrajeria, v_zone_id,
      'Apertura de puertas sin daño, cambio de combinación de chapas, instalación de cerrojos de seguridad y mantenimiento de portones.',
      11, -5.2019, -80.6198, true
    ),
    (
      u_elena, v_of_mascotas, v_zone_id,
      'Paseos diarios por parques seguros de Castilla, cuidado por horas y acompañamiento al veterinario. Trato cariñoso y responsable.',
      4, -5.1985, -80.6251, true
    ),
    (
      u_miguel, v_of_otro, v_zone_id,
      'Maestro de obra en albañilería, tarrajeo, enchapado de mayólicas, impermeabilización de techos para lluvias y pintura de fachadas.',
      14, -5.2060, -80.6265, true
    ),
    (
      u_carmen, v_of_gasfiteria, v_zone_id,
      'Instalación de lavaderos, inodoros, duchas eléctricas, limpieza y desinfección de cisternas y tanques de agua.',
      6, -5.1975, -80.6210, true
    ),
    (
      u_luis, v_of_electricidad, v_zone_id,
      'Reparación de electrodomésticos del hogar (ventiladores, licuadoras, bombas de agua) e instalación de intercomunicadores.',
      5, -5.2052, -80.6185, true
    ),
    (
      u_ana, v_of_otro, v_zone_id,
      'Costura, confección de uniformes escolares, entalles, cambio de cierres y tapicería de sillas y muebles de sala.',
      10, -5.2002, -80.6230, true
    )
  ON CONFLICT (user_id, oficio_id) DO UPDATE SET
    zone_id = EXCLUDED.zone_id,
    description = EXCLUDED.description,
    years_experience = EXCLUDED.years_experience,
    location_lat = EXCLUDED.location_lat,
    location_lng = EXCLUDED.location_lng,
    is_visible = true,
    updated_at = now();

  -- Recuperar IDs de perfiles profesionales
  SELECT id INTO p_lucia  FROM public.professional_profiles WHERE user_id = u_lucia  AND oficio_id = v_of_gasfiteria;
  SELECT id INTO p_carlos FROM public.professional_profiles WHERE user_id = u_carlos AND oficio_id = v_of_electricidad;
  SELECT id INTO p_jorge  FROM public.professional_profiles WHERE user_id = u_jorge  AND oficio_id = v_of_carpinteria;
  SELECT id INTO p_rosa   FROM public.professional_profiles WHERE user_id = u_rosa   AND oficio_id = v_of_clases;
  SELECT id INTO p_pedro  FROM public.professional_profiles WHERE user_id = u_pedro  AND oficio_id = v_of_cerrajeria;
  SELECT id INTO p_elena  FROM public.professional_profiles WHERE user_id = u_elena  AND oficio_id = v_of_mascotas;
  SELECT id INTO p_miguel FROM public.professional_profiles WHERE user_id = u_miguel AND oficio_id = v_of_otro;
  SELECT id INTO p_carmen FROM public.professional_profiles WHERE user_id = u_carmen AND oficio_id = v_of_gasfiteria;
  SELECT id INTO p_luis   FROM public.professional_profiles WHERE user_id = u_luis   AND oficio_id = v_of_electricidad;
  SELECT id INTO p_ana    FROM public.professional_profiles WHERE user_id = u_ana    AND oficio_id = v_of_otro;

  -- ============================================================================
  -- 6. VISTOS BUENOS (VOUCHES VECINALES)
  -- ============================================================================

  INSERT INTO public.vouches (profile_id, voucher_user_id) VALUES
    -- Lucía Ramírez: 4 avales (Validada)
    (p_lucia, u_carlos),
    (p_lucia, u_jorge),
    (p_lucia, u_rosa),
    (p_lucia, u_roberto),
    -- Carlos Mendoza: 3 avales (Validado)
    (p_carlos, u_lucia),
    (p_carlos, u_pedro),
    (p_carlos, u_maria),
    -- Jorge Ipanaqué: 3 avales (Validado)
    (p_jorge, u_lucia),
    (p_jorge, u_carlos),
    (p_jorge, u_elena),
    -- Rosa Chunga: 2 avales (Validada)
    (p_rosa, u_carmen),
    (p_rosa, u_ana),
    -- Pedro Valladolid: 3 avales (Validado)
    (p_pedro, u_jorge),
    (p_pedro, u_miguel),
    (p_pedro, u_roberto),
    -- Elena Távara: 2 avales (Validada)
    (p_elena, u_rosa),
    (p_elena, u_maria),
    -- Miguel Palacios: 1 aval (Pendiente: 1 de 2 avales)
    (p_miguel, u_carlos),
    -- Carmen Córdova: 2 avales (Validada)
    (p_carmen, u_lucia),
    (p_carmen, u_elena),
    -- Luis Bereche: 1 aval (Pendiente: 1 de 2 avales)
    (p_luis, u_pedro),
    -- Ana Zeta: 3 avales (Validada)
    (p_ana, u_rosa),
    (p_ana, u_carmen),
    (p_ana, u_maria)
  ON CONFLICT (profile_id, voucher_user_id) DO NOTHING;

  -- Recalcular explícitamente validated_count e is_validated en todos los perfiles
  UPDATE public.professional_profiles pp
  SET
    validated_count = sub.cnt,
    is_validated = (sub.cnt >= 2),
    updated_at = now()
  FROM (
    SELECT p.id, COUNT(v.id)::INTEGER AS cnt
    FROM public.professional_profiles p
    LEFT JOIN public.vouches v ON v.profile_id = p.id
    GROUP BY p.id
  ) sub
  WHERE pp.id = sub.id;

  -- ============================================================================
  -- 7. MURO DE FAVORES COMUNITARIOS + VECINOS INTERESADOS
  -- ============================================================================

  INSERT INTO public.favors (
    id, author_id, zone_id, type, title, description, status, client_id, sync_status, location_lat, location_lng, created_at
  ) VALUES
    (
      f_1, u_rosa, v_zone_id, 'herramienta',
      'Necesito prestada una escalera de tijera este sábado por la mañana',
      'Voy a limpiar la canaleta del techo antes de las lluvias. La devuelvo el mismo sábado antes del mediodía.',
      'abierta', '55555555-5555-4555-8555-555555555501', 'enviado', -5.2045, -80.6238, now() - interval '2 hours'
    ),
    (
      f_2, u_roberto, v_zone_id, 'ayuda_temporal',
      'Apoyo entre dos vecinos para subir un ropero de madera al segundo piso',
      'Nos toma unos 15 minutos hoy a partir de las 5:30 pm. Estoy a media cuadra del parque principal.',
      'abierta', '55555555-5555-4555-8555-555555555502', 'enviado', -5.2012, -80.6220, now() - interval '4 hours'
    ),
    (
      f_3, u_miguel, v_zone_id, 'donacion_materiales',
      'Regalo 4 bolsas de cemento abiertas hoy y ladrillos sobrantes en buen estado',
      'Me quedaron de una reparación de jardín. Si a algún vecino le sirven para resanar su vereda o pared, puede recogerlos hoy.',
      'abierta', '55555555-5555-4555-8555-555555555503', 'enviado', -5.2060, -80.6265, now() - interval '6 hours'
    ),
    (
      f_4, u_carlos, v_zone_id, 'intercambio_habilidades',
      'Reviso tu instalación eléctrica a cambio de ayuda para podar el árbol de mi entrada',
      'Tengo escalera y herramientas eléctricas, solo necesito una mano con las ramas altas este domingo.',
      'abierta', '55555555-5555-4555-8555-555555555504', 'enviado', -5.2031, -80.6242, now() - interval '9 hours'
    ),
    (
      f_5, u_maria, v_zone_id, 'movilidad_solidaria',
      'Voy en auto hacia el Hospital Cayetano Heredia mañana a las 7:15 am (3 asientos libres)',
      'Si algún vecino adulto mayor o con cita médica temprana necesita ir hacia Av. Independencia, lo llevo con gusto.',
      'abierta', '55555555-5555-4555-8555-555555555505', 'enviado', -5.2020, -80.6210, now() - interval '12 hours'
    ),
    (
      f_6, u_elena, v_zone_id, 'otros',
      'Busco vecino que me oriente para configurar la app del banco y citas médicas para mi abuelita',
      'Solo toma media hora en la tarde. Invito un café pasado y chifles piuranos.',
      'abierta', '55555555-5555-4555-8555-555555555506', 'enviado', -5.1985, -80.6251, now() - interval '16 hours'
    ),
    (
      f_7, u_ana, v_zone_id, 'herramienta',
      '¿Alguien tendrá un taladro percutor por una hora para colocar dos repisas?',
      'Ya tengo las brocas y los tarugos listos. Vivo frente a la plazuela.',
      'en_curso', '55555555-5555-4555-8555-555555555507', 'enviado', -5.2002, -80.6230, now() - interval '1 day'
    ),
    (
      f_8, u_carmen, v_zone_id, 'donacion_materiales',
      'Comparto libros escolares de 4to y 5to de primaria en excelente estado',
      'Son de matemática, ciencias y comunicación. Están forrados y sin rayaduras.',
      'abierta', '55555555-5555-4555-8555-555555555508', 'enviado', -5.1975, -80.6210, now() - interval '1 day 4 hours'
    ),
    (
      f_9, u_jorge, v_zone_id, 'intercambio_habilidades',
      'Enseño a reparar muebles de madera básicos a cambio de clases de Excel para mi taller',
      'Puedo los martes o jueves por la tarde.',
      'abierta', '55555555-5555-4555-8555-555555555509', 'enviado', -5.1992, -80.6201, now() - interval '2 days'
    ),
    (
      f_10, u_pedro, v_zone_id, 'ayuda_temporal',
      'Necesito apoyo para alimentar a mi perrito este domingo por viaje familiar',
      'Es muy tranquilo y sociable, solo hay que dejarle su comida y agua fresca por la mañana.',
      'abierta', '55555555-5555-4555-8555-555555555510', 'enviado', -5.2019, -80.6198, now() - interval '2 days 6 hours'
    )
  ON CONFLICT (id) DO UPDATE SET
    zone_id = EXCLUDED.zone_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    updated_at = now();

  -- Vecinos interesados en ayudar en los favores
  INSERT INTO public.favor_interests (favor_id, user_id, message) VALUES
    (f_1, u_jorge,   'Hola vecina Rosa, yo tengo una escalera de aluminio de 6 pasos. Pasa por mi taller cuando gustes.'),
    (f_1, u_carlos,  'Vecina, también cuento con escalera tijera aislada por si la necesitas el sábado temprano.'),
    (f_1, u_pedro,   'Yo te la puedo llevar a tu casa el viernes por la noche para que avances temprano.'),
    (f_2, u_miguel,  'Cuenta conmigo vecino Roberto, a las 5:30 pm me acerco para ayudarte a subirlo.'),
    (f_2, u_luis,    'Yo salgo del trabajo a las 5:15 pm, paso a darles una mano.'),
    (f_3, u_roberto, '¡Muchas gracias vecino Miguel! Justo necesito resanar el sardinel frente a mi puerta.'),
    (f_3, u_carmen,  'Hola vecino, me servirían unos 15 ladrillos para levantar una base para mi tanque de agua.'),
    (f_4, u_jorge,   'Yo tengo serrucho de poda y te ayudo el domingo temprano.'),
    (f_5, u_ana,     'Qué gran gesto vecina María, mi mamá tiene control en oftalmología a las 8:00 am.'),
    (f_6, u_luis,    'Hola Elena, yo paso hoy a las 4:00 pm y les dejo todo configurado paso a paso.'),
    (f_7, u_carlos,  'Ya te llevo mi taladro Bosch en 10 minutos vecina Ana.'),
    (f_8, u_maria,   'Hola Carmen, a mi sobrino que pasa a 4to de primaria le serían de muchísima ayuda.'),
    (f_10, u_elena,  '¡Yo me encargo vecino Pedro! Le doy su paseo y comida con mucho cariño.')
  ON CONFLICT (favor_id, user_id) DO UPDATE SET
    message = EXCLUDED.message,
    updated_at = now();

  -- ============================================================================
  -- 8. SERVICIOS DE APOYO Y EMERGENCIA (CASTILLA Y PIURA)
  -- ============================================================================

  DELETE FROM public.support_services WHERE zone_id = v_zone_id OR zone_id IS NULL;

  INSERT INTO public.support_services (
    zone_id, name, type, phone, address_summary, location_lat, location_lng, hours, is_verified
  ) VALUES
    (v_zone_id, 'Compañía de Bomberos Castilla N° 151',         'bomberos',    '116',        'Av. Progreso cdra. 12, Castilla',                  -5.2035, -80.6212, '24 horas',          true),
    (v_zone_id, 'SAMU Piura - Urgencias Médicas Móviles',       'salud',       '106',        'Atención prehospitalaria en todo Castilla',        -5.1980, -80.6240, '24 horas',          true),
    (v_zone_id, 'Comisaría PNP Castilla',                       'policia',     '073342502',  'Av. Ramón Castilla 350, Castilla',                 -5.2005, -80.6258, '24 horas',          true),
    (v_zone_id, 'Hospital Regional José Cayetano Heredia',      'salud',       '073342425',  'Av. Independencia s/n, Urb. Miraflores - Castilla',-5.1782, -80.6195, 'Emergencias 24h',   true),
    (v_zone_id, 'Centro de Salud Materno Infantil de Castilla', 'salud',       '073342811',  'Calle Ayacucho 410, Cercado de Castilla',          -5.2018, -80.6232, '24 horas',          true),
    (v_zone_id, 'Serenazgo Municipalidad Distrital de Castilla','policia',     '073345210',  'Base Central de Seguridad Ciudadana, Castilla',    -5.2022, -80.6205, '24 horas',          true),
    (v_zone_id, 'Comisaría PNP El Indio',                       'policia',     '073347120',  'A.H. El Indio, Av. Principal - Castilla',          -5.2140, -80.6180, '24 horas',          true),
    (v_zone_id, 'Brigada Comunitaria de Defensa Civil Castilla','grupo_apoyo', '969412880',  'Local Comunal Central, Plaza Luis Montero',        -5.2010, -80.6228, '07:00 a 22:00',     true),
    (v_zone_id, 'Refugio Temporal Coliseo Deportivo Castilla',  'refugio',     '968310450',  'Av. Corpac con Av. Progreso (Zona Alta segura)',   -5.1950, -80.6175, 'Activo en alertas', true);

  -- ============================================================================
  -- 9. REPORTES DE VULNERABILIDAD (COORDENADAS REDONDEADAS A 3 DECIMALES)
  -- ============================================================================

  DELETE FROM public.vulnerability_reports WHERE zone_id = v_zone_id;

  INSERT INTO public.vulnerability_reports (
    reporter_user_id, zone_id, approx_lat, approx_lng, description, needs, status, is_anonymous, created_at
  ) VALUES
    (
      u_lucia, v_zone_id, -5.202, -80.623,
      'Pareja de adultos mayores en primer piso con aniego en la entrada. Necesitan agua potable embotellada y apoyo para proteger sus muebles.',
      ARRAY['agua', 'otro'], 'activo', false, now() - interval '1 hour'
    ),
    (
      NULL, v_zone_id, -5.205, -80.621,
      'Vecina diabética de 74 años requiere insulina refrigerada y agua limpia tras corte eléctrico en la manzana.',
      ARRAY['medicinas', 'generador', 'agua'], 'activo', true, now() - interval '3 hours'
    ),
    (
      u_rosa, v_zone_id, -5.199, -80.624,
      'Familia con tres niños pequeños sin suministro de agua desde ayer por rotura de matriz en la cuadra.',
      ARRAY['agua', 'alimentos'], 'activo', false, now() - interval '5 hours'
    ),
    (
      u_roberto, v_zone_id, -5.203, -80.619,
      'Vecino con movilidad reducida en silla de ruedas necesita traslado seguro hacia el Centro de Salud para curación.',
      ARRAY['transporte', 'medicinas'], 'activo', false, now() - interval '8 hours'
    ),
    (
      NULL, v_zone_id, -5.207, -80.625,
      'Vivienda con techo de calamina afectado por lluvias necesita plásticos cobertores y alimentos no perecibles.',
      ARRAY['alimentos', 'otro'], 'activo', true, now() - interval '14 hours'
    );

  -- ============================================================================
  -- 10. RECURSOS CRÍTICOS (PEDIDOS Y OFERTAS EN EMERGENCIA)
  -- ============================================================================

  DELETE FROM public.critical_resources WHERE zone_id = v_zone_id;

  INSERT INTO public.critical_resources (
    user_id, zone_id, kind, resource, quantity, notes, status, created_at
  ) VALUES
    (u_carlos,  v_zone_id, 'oferta', 'generador',  1,  'Tengo grupo electrógeno portátil disponible para cargar celulares y refrigerar medicinas urgentes de 6pm a 10pm.', 'abierto', now() - interval '45 minutes'),
    (u_lucia,   v_zone_id, 'oferta', 'agua',       60, 'Mi cisterna tiene reserva limpia. Los vecinos de la cuadra pueden venir con baldes entre las 4pm y 7pm.',             'abierto', now() - interval '2 hours'),
    (u_maria,   v_zone_id, 'oferta', 'transporte', 3,  'Camioneta alta disponible para traslados de emergencia hacia el Hospital Cayetano Heredia.',                         'abierto', now() - interval '3 hours'),
    (u_rosa,    v_zone_id, 'pedido', 'agua',       20, 'Se necesitan 2 bidones de agua potable para adultos mayores de la tercera cuadra.',                                  'abierto', now() - interval '3 hours 30 minutes'),
    (u_carmen,  v_zone_id, 'oferta', 'medicinas',  1,  'Botiquín comunitario con sales de rehidratación oral, paracetamol, gasas estériles y alcohol.',                      'abierto', now() - interval '5 hours'),
    (u_pedro,   v_zone_id, 'pedido', 'medicinas',  2,  'Buscamos inhalador salbutamol y suero fisiológico para niño con crisis de asma.',                                    'abierto', now() - interval '6 hours'),
    (u_jorge,   v_zone_id, 'oferta', 'otro',       2,  'Presto motobomba de 2 pulgadas con manguera para evacuar agua estancada en patios o cocheras.',                      'abierto', now() - interval '8 hours'),
    (u_ana,     v_zone_id, 'oferta', 'alimentos',  15, 'Olla solidaria vecinal: 15 raciones de almuerzo caliente para familias afectadas de la zona.',                       'abierto', now() - interval '10 hours');

  -- ============================================================================
  -- 11. ESTADO INICIAL DE EMERGENCIA DE LA ZONA
  -- ============================================================================

  IF NOT EXISTS (SELECT 1 FROM public.emergency_states WHERE zone_id = v_zone_id) THEN
    INSERT INTO public.emergency_states (zone_id, status, activated_by_user_id, reason, activated_at, deactivated_at)
    VALUES (v_zone_id, 'inactiva', u_lucia, 'Monitoreo preventivo vecinal activo en Castilla', now(), now());
  END IF;

END $$;
