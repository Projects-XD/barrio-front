-- Datos de demostración para Castilla (Piura): vecinos, oficios, favores, chats, avisos y reportes.
-- Solo inserta; no cambia esquema ni código. Es segura de repetir: todo lleva ID fijo con
-- ON CONFLICT DO NOTHING o WHERE NOT EXISTS.
--
-- IDs fijos con prefijo a0000000-0000-4000-8000-, por rango (los ...0001-0003 son de 0010):
--   101-118 vecinos   201-226 favores   301-313 perfiles de oficio   401-406 conversaciones
--   501-5xx mensajes  601-6xx avisos    701-702 reportes de vulnerabilidad
--   801-804 reportes de usuarios        901-906 respuestas a favores
--
-- Cuentas: correo nombre.apellido@demo.com, contraseña Demo2026! (sirven para iniciar sesión).
-- Para quitarlo todo: DELETE FROM auth.users WHERE email LIKE '%@demo.com';
-- (borra en cascada perfiles, favores, chats y avisos de esos vecinos).

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.demo_id(n INT) RETURNS UUID
LANGUAGE sql IMMUTABLE AS $$
  SELECT ('a0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;

-- Los triggers de 0028 crearían un aviso por vecino y por cada favor u oficio de este script
-- (cientos de avisos para las cuentas reales). Se apagan mientras dura la carga; los avisos de
-- la demo se insertan a mano en la sección 6. Si algo falla, el ROLLBACK los deja como estaban.
ALTER TABLE public.favors DISABLE TRIGGER trg_notificar_nuevo_favor;
ALTER TABLE public.professional_profiles DISABLE TRIGGER trg_notificar_nuevo_oficio;

-- ==============================================================================
-- 1. VECINOS (auth.users + auth.identities + public.users)
-- ==============================================================================
CREATE TEMP TABLE demo_vecinos (n INT, full_name TEXT, email TEXT, is_admin BOOLEAN, emergency_role BOOLEAN) ON COMMIT DROP;
INSERT INTO demo_vecinos VALUES
  (101, 'Juan Pérez Chunga',            'juan.perez@demo.com',        true,  false),
  (102, 'María Flores Seminario',       'maria.flores@demo.com',      false, true),
  (103, 'Carlos Seminario Zapata',      'carlos.seminario@demo.com',  false, false),
  (104, 'Rosa Chiroque Ramírez',        'rosa.chiroque@demo.com',     false, true),
  (105, 'Luis Alberto Sosa Castro',     'luis.sosa@demo.com',         false, false),
  (106, 'Ana Lucía Zapata Vílchez',     'ana.zapata@demo.com',        false, false),
  (107, 'José Antonio Ruesta Palacios', 'jose.ruesta@demo.com',       false, false),
  (108, 'Carmen Rosa Purizaca Juárez',  'carmen.purizaca@demo.com',   true,  true),
  (109, 'Pedro Pablo Yarlequé Ato',     'pedro.yarleque@demo.com',    false, false),
  (110, 'Lucía Morales Távara',         'lucia.morales@demo.com',     false, false),
  (111, 'Miguel Ángel Castillo Jiménez','miguel.castillo@demo.com',   false, false),
  (112, 'Elena Sandoval Ipanaqué',      'elena.sandoval@demo.com',    false, false),
  (113, 'Jorge Luis Talledo Correa',    'jorge.talledo@demo.com',     false, false),
  (114, 'Sofía Valdiviezo Sánchez',     'sofia.valdiviezo@demo.com',  false, false),
  (115, 'Manuel Ancajima Silupú',       'manuel.ancajima@demo.com',   false, true),
  (116, 'Teresa Querevalú Nima',        'teresa.querevalu@demo.com',  false, false),
  (117, 'Ricardo Mogollón Arámbulo',    'ricardo.mogollon@demo.com',  false, false),
  (118, 'Gloria Ramos Farfán',          'gloria.ramos@demo.com',      false, false);

-- Sin location_lat/lng en la metadata: el trigger de 0026 no valida y no bloquea.
-- handle_new_user (0025) crea la fila de public.users; abajo se completan roles.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000', pg_temp.demo_id(v.n), 'authenticated', 'authenticated',
  v.email, crypt('Demo2026!', gen_salt('bf')), now() - interval '30 days',
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', v.full_name, 'zone_id', '03952125-81cf-4e1a-9244-d3fbe5f9bbf2'),
  now() - interval '30 days', now() - interval '30 days',
  '', '', '', ''
FROM demo_vecinos v
WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = pg_temp.demo_id(v.n) OR a.email = v.email);

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT
  pg_temp.demo_id(v.n), pg_temp.demo_id(v.n), pg_temp.demo_id(v.n)::text,
  jsonb_build_object('sub', pg_temp.demo_id(v.n)::text, 'email', v.email, 'email_verified', true),
  'email', now(), now() - interval '30 days', now() - interval '30 days'
FROM demo_vecinos v
JOIN auth.users a ON a.id = pg_temp.demo_id(v.n)
ON CONFLICT (provider_id, provider) DO NOTHING;

-- Solo toca las filas de los vecinos demo (IDs fijos).
INSERT INTO public.users (id, full_name, zone_id, status, is_admin, emergency_role, created_at, updated_at)
SELECT pg_temp.demo_id(v.n), v.full_name, '03952125-81cf-4e1a-9244-d3fbe5f9bbf2', 'active',
       v.is_admin, v.emergency_role, now() - interval '30 days', now()
FROM demo_vecinos v
JOIN auth.users a ON a.id = pg_temp.demo_id(v.n)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  zone_id = EXCLUDED.zone_id,
  is_admin = EXCLUDED.is_admin,
  emergency_role = EXCLUDED.emergency_role,
  updated_at = now();

-- ==============================================================================
-- 2. OFICIOS: perfiles profesionales, teléfonos y vistos buenos
-- ==============================================================================
-- Teléfonos ficticios (9xx 000 1xx): no marcar en la demo.
INSERT INTO public.user_phones (user_id, phone, is_public)
SELECT pg_temp.demo_id(n), phone, true
FROM (VALUES
  (103, '969 000 103'), (105, '969 000 105'), (106, '969 000 106'), (107, '969 000 107'),
  (109, '969 000 109'), (110, '969 000 110'), (111, '969 000 111'), (113, '969 000 113'),
  (114, '969 000 114'), (115, '969 000 115'), (117, '969 000 117'), (118, '969 000 118'),
  (104, '969 000 104')
) AS p(n, phone)
WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = pg_temp.demo_id(p.n))
ON CONFLICT (user_id, phone) DO NOTHING;

INSERT INTO public.professional_profiles (
  id, user_id, oficio_id, zone_id, description, years_experience, location_lat, location_lng,
  is_visible, created_at, updated_at
)
SELECT
  pg_temp.demo_id(p.id), pg_temp.demo_id(p.user_n),
  (SELECT o.id FROM public.oficios o WHERE o.category = p.category::oficio_category AND o.is_active ORDER BY o.created_at LIMIT 1),
  '03952125-81cf-4e1a-9244-d3fbe5f9bbf2', p.description, p.years, p.lat, p.lng,
  true, now() - (p.days || ' days')::interval, now() - (p.days || ' days')::interval
FROM (VALUES
  (301, 103, 'gasfiteria',   10, -5.193400, -80.610200, 25, 'Gasfitero con 10 años de experiencia en la Urb. Miraflores. Arreglo fugas, caños, inodoros, termas y cambio de tuberías. Atiendo emergencias también de noche. WhatsApp: 969 000 103.'),
  (302, 113, 'gasfiteria',    6, -5.214100, -80.603300, 18, 'Gasfitería en general en Chiclayito y alrededores. Instalación de tanques elevados, bombas de agua y desatoros. Presupuesto sin compromiso. Llamar al 969 000 113.'),
  (303, 105, 'electricidad', 15, -5.200300, -80.612100, 28, 'Electricista domiciliario en Urb. El Bosque. Revisión de tableros, cableado, pozos a tierra e instalación de luminarias. Certificado por SENATI. Tel. 969 000 105.'),
  (304, 111, 'electricidad',  4, -5.207200, -80.613500, 12, 'Técnico electricista joven, trabajo limpio y puntual en Talarita. Tomacorrientes, interruptores, ventiladores de techo y reparación de cortocircuitos. 969 000 111.'),
  (305, 107, 'carpinteria',  20, -5.196100, -80.617400, 27, 'Carpintero con taller en Urb. San Bernardo. Hago puertas, roperos, reposteros y muebles a medida en madera tornillo y melamina. También reparo muebles. 969 000 107.'),
  (306, 117, 'carpinteria',   8, -5.199800, -80.611300, 15, 'Carpintería y ebanistería en Urb. El Bosque. Restauro sillas, mesas y puertas antiguas de algarrobo. Trabajo a domicilio. 969 000 117.'),
  (307, 109, 'cerrajeria',   12, -5.190200, -80.603400, 22, 'Cerrajero en Cossío del Pomar. Apertura de puertas sin dañar, cambio de chapas, copias de llaves y cerraduras de seguridad. Atención 24 horas en Castilla. 969 000 109.'),
  (308, 106, 'clases',       30, -5.189800, -80.604100, 26, 'Profesora jubilada de primaria. Refuerzo escolar de matemáticas y comunicación para niños de 1.° a 6.° grado. Sábados en la mañana en Cossío del Pomar. 969 000 106.'),
  (309, 110, 'clases',        5, -5.193800, -80.609600, 10, 'Clases de inglés para secundaria y preparación para exámenes. Egresada de la UNP. Grupos pequeños o clases particulares en Urb. Miraflores. 969 000 110.'),
  (310, 104, 'clases',       12, -5.187300, -80.618200,  8, 'Enfermera técnica. Enseño primeros auxilios básicos a familias y juntas vecinales: qué hacer ante quemaduras, golpes de calor y desmayos. Coordinemos al 969 000 104.'),
  (311, 114, 'paseador_mascotas', 3, -5.205100, -80.600200, 6, 'Paseo y cuido perros y gatos en La Primavera y Urb. Los Almendros. Paseos de 30 o 60 minutos y cuidado por fines de semana. Amo a los animales. 969 000 114.'),
  (312, 115, 'otro',         18, -5.196400, -80.616800, 20, 'Albañil y maestro de obra. Tarrajeo, pisos, ampliaciones y techos aligerados en San Bernardo y toda Castilla. Trabajo con cuadrilla de confianza. 969 000 115.'),
  (313, 118, 'otro',         20, -5.181200, -80.612300, 14, 'Costurera en el AA.HH. Tacalá. Arreglos de ropa, bastas, cierres, uniformes escolares y polos para promociones. Entrega rápida. 969 000 118.')
) AS p(id, user_n, category, years, lat, lng, days, description)
WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = pg_temp.demo_id(p.user_n))
ON CONFLICT (id) DO NOTHING;

-- Dos o más vistos buenos validan el perfil (trigger de 0001). Nadie se avala a sí mismo.
INSERT INTO public.vouches (profile_id, voucher_user_id)
SELECT pg_temp.demo_id(v.profile_n), pg_temp.demo_id(v.voucher_n)
FROM (VALUES
  (301, 110), (301, 112), (301, 116),
  (303, 101), (303, 108),
  (305, 110), (305, 102), (305, 113),
  (307, 116), (307, 106),
  (308, 112), (308, 116), (308, 104),
  (312, 107), (312, 113),
  (313, 114), (313, 108),
  (302, 115), (309, 103), (311, 118)
) AS v(profile_n, voucher_n)
WHERE EXISTS (SELECT 1 FROM public.professional_profiles p WHERE p.id = pg_temp.demo_id(v.profile_n))
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = pg_temp.demo_id(v.voucher_n))
ON CONFLICT (profile_id, voucher_user_id) DO NOTHING;

-- ==============================================================================
-- 3. FAVORES
-- ==============================================================================
-- Los urgentes y de emergencia aparecen aprobados por el admin Juan Pérez (101), salvo 224 y 225,
-- que quedan pendientes para mostrar la cola de moderación.
INSERT INTO public.favors (
  id, author_id, zone_id, type, intent, title, description, status, urgency,
  moderation_status, moderated_by, moderated_at, location_lat, location_lng,
  assigned_to_user_id, client_id, sync_status, closed_at, created_at, updated_at
)
SELECT
  pg_temp.demo_id(f.id), pg_temp.demo_id(f.author_n), '03952125-81cf-4e1a-9244-d3fbe5f9bbf2',
  f.type::favor_type, f.intent, f.title, f.description, f.status::favor_status, f.urgency,
  f.moderation,
  CASE WHEN f.urgency <> 'normal' AND f.moderation = 'aprobado' THEN pg_temp.demo_id(101) END,
  CASE WHEN f.urgency <> 'normal' AND f.moderation = 'aprobado' THEN now() - (f.hours || ' hours')::interval + interval '20 minutes' END,
  f.lat, f.lng,
  CASE WHEN f.assigned_n IS NOT NULL THEN pg_temp.demo_id(f.assigned_n) END,
  pg_temp.demo_id(f.id), 'enviado',
  CASE WHEN f.status = 'cerrada' THEN now() - (f.hours || ' hours')::interval + interval '1 day' END,
  now() - (f.hours || ' hours')::interval,
  now() - (f.hours || ' hours')::interval
FROM (VALUES
  (201, 110, 'herramienta',             'pedir',   'Necesito préstamo de escalera para arreglar el techo',
        'Se me filtró el techo con la última garúa y necesito una escalera de unos 3 metros por una tarde. La devuelvo el mismo día. Estoy en la Urb. Miraflores, cerca al parque.',
        'abierta', 'normal', 'aprobado', -5.193600, -80.609900, NULL::int, 3),
  (202, 106, 'intercambio_habilidades', 'ofrecer', 'Ofrezco clases de matemáticas para primaria',
        'Soy profesora jubilada. Puedo reforzar a niños de 1.° a 6.° grado los sábados por la mañana en mi casa de Cossío del Pomar. No cobro, solo traigan su cuaderno.',
        'abierta', 'normal', 'aprobado', -5.189800, -80.604100, NULL, 26),
  (203, 116, 'donacion_materiales',     'ofrecer', 'Dono ropa de abrigo para niños y adultos',
        'Tengo dos bolsas de ropa en buen estado: casacas, chompas y buzos. Pueden pasar a recoger por Talarita, frente a la bodega Don Lucho.',
        'abierta', 'normal', 'aprobado', -5.206800, -80.612900, NULL, 50),
  (204, 112, 'ayuda_temporal',          'pedir',   'Necesito quien acompañe a mi mamá a su cita en el hospital',
        'Mi mamá tiene cita el jueves a las 8 a. m. en el Hospital Santa Rosa y yo trabajo. Busco un vecino de confianza que la acompañe en mototaxi; pago los pasajes.',
        'abierta', 'urgente', 'aprobado', -5.198700, -80.621000, NULL, 8),
  (205, 102, 'donacion_materiales',     'pedir',   'Familia afectada por lluvias necesita agua y víveres',
        'Se inundó la casa de la familia Nima en el AA.HH. Tacalá, calle 5. Necesitan agua embotellada, arroz, menestras y frazadas. Pueden dejarlo en el local comunal.',
        'en_curso', 'emergencia', 'aprobado', -5.180500, -80.611800, 108, 20),
  (206, 117, 'herramienta',             'ofrecer', 'Presto taladro y juego de brocas',
        'Tengo un taladro percutor con brocas para concreto y madera. Se lo presto a quien lo necesite por un día; solo pido que lo devuelvan limpio. Urb. El Bosque.',
        'abierta', 'normal', 'aprobado', -5.199800, -80.611300, NULL, 72),
  (207, 115, 'movilidad_solidaria',     'ofrecer', 'Llevo vecinos mayores al mercado de Castilla los sábados',
        'Salgo en mi mototaxi todos los sábados a las 7 a. m. desde San Bernardo hacia el mercado. Tengo espacio para 2 personas mayores, sin costo.',
        'abierta', 'normal', 'aprobado', -5.196400, -80.616800, NULL, 30),
  (208, 114, 'ayuda_temporal',          'pedir',   'Busco quien cuide a mi perrito el fin de semana',
        'Viajo a Sullana sábado y domingo. Mi perro Bobby es tranquilo, solo necesita comida y un paseo corto. Vivo en La Primavera.',
        'cerrada', 'normal', 'aprobado', -5.205100, -80.600200, 118, 120),
  (209, 118, 'intercambio_habilidades', 'ofrecer', 'Enseño a coser a mano y a máquina',
        'Soy costurera hace 20 años. Puedo enseñar arreglos básicos: bastas, cierres y botones. A cambio me vendría bien que alguien me enseñe a usar mejor el celular.',
        'abierta', 'normal', 'aprobado', -5.181200, -80.612300, NULL, 96),
  (210, 113, 'herramienta',             'pedir',   '¿Alguien tiene una carretilla que me preste?',
        'Estoy sacando desmonte de mi patio en Chiclayito. La necesito dos horas el domingo en la mañana.',
        'en_curso', 'normal', 'aprobado', -5.214100, -80.603300, 115, 40),
  (211, 110, 'ayuda_temporal',          'pedir',   'Necesito ayuda para subir un ropero al segundo piso',
        'Me entregaron un ropero y no puedo subirlo sola. Faltan dos personas más para cargarlo. Urb. Miraflores, manzana C.',
        'cerrada', 'normal', 'aprobado', -5.193800, -80.609600, 107, 150),
  (212, 105, 'intercambio_habilidades', 'ofrecer', 'Reviso gratis instalaciones eléctricas de casas antiguas',
        'Antes de la temporada de lluvias conviene revisar el tablero y los cables. Paso a ver sin costo y le digo qué necesita cambiar.',
        'abierta', 'normal', 'aprobado', -5.200300, -80.612100, NULL, 12),
  (213, 116, 'donacion_materiales',     'ofrecer', 'Regalo ladrillos y bolsas de cemento que me sobraron',
        'Me sobraron unos 80 ladrillos King Kong y 2 bolsas de cemento de la ampliación. Para quien los necesite para su vivienda.',
        'abierta', 'normal', 'aprobado', -5.207000, -80.613100, NULL, 60),
  (214, 112, 'ayuda_temporal',          'pedir',   'Busco quien pueda recoger a mi hijo del colegio los martes',
        'Salgo tarde del trabajo los martes. Necesito quien recoja a mi hijo a la 1 p. m. y lo traiga a Campo Polo. Es un niño tranquilo de 9 años.',
        'abierta', 'normal', 'aprobado', -5.198500, -80.620800, NULL, 4),
  (215, 104, 'ayuda_temporal',          'pedir',   'Adulta mayor sola necesita sus medicinas hoy',
        'Doña Juana, vecina de 82 años en El Indio, se quedó sin sus pastillas de la presión y no puede salir. Necesitamos alguien que vaya a la farmacia hoy mismo.',
        'abierta', 'emergencia', 'aprobado', -5.187300, -80.618200, NULL, 2),
  (216, 109, 'herramienta',             'ofrecer', 'Presto escalera de aluminio de 6 pasos',
        'La tengo en casa sin usar. Cossío del Pomar, calle Los Algarrobos. Pasen a recogerla cuando quieran.',
        'abierta', 'normal', 'aprobado', -5.190200, -80.603400, NULL, 100),
  (217, 103, 'intercambio_habilidades', 'ofrecer', 'Cambio arreglos de gasfitería por clases de inglés para mi hija',
        'Arreglo caños, inodoros y fugas. Busco quien le dé clases de inglés a mi hija que está en 3.° de secundaria.',
        'abierta', 'normal', 'aprobado', -5.193400, -80.610200, NULL, 54),
  (218, 111, 'movilidad_solidaria',     'pedir',   'Necesito movilidad para llevar a mi papá a terapia',
        'Mi papá usa silla de ruedas y tiene terapia en EsSalud los lunes y miércoles. Busco quien tenga auto y pueda llevarlo; comparto la gasolina.',
        'abierta', 'urgente', 'aprobado', -5.207200, -80.613500, NULL, 18),
  (219, 106, 'donacion_materiales',     'ofrecer', 'Dono útiles escolares y libros de primaria',
        'Cuadernos nuevos, colores y libros del Minedu de 3.° y 4.° grado. Para familias que los necesiten.',
        'cerrada', 'normal', 'aprobado', -5.189800, -80.604100, 112, 200),
  (220, 101, 'otros',                   'pedir',   'Minga para limpiar el parque de la Urb. Miraflores',
        'El sábado a las 7 a. m. nos juntamos para limpiar el parque y pintar las bancas. Traigan escoba o rastrillo; la municipalidad nos da las bolsas.',
        'abierta', 'normal', 'aprobado', -5.192900, -80.610800, NULL, 36),
  (221, 117, 'ayuda_temporal',          'ofrecer', 'Puedo ayudar con mudanzas los domingos',
        'Tengo una camioneta pequeña y tiempo libre los domingos. Para mudanzas cortas dentro de Castilla.',
        'abierta', 'normal', 'aprobado', -5.199600, -80.611000, NULL, 84),
  (222, 107, 'herramienta',             'pedir',   'Necesito una sierra circular por un día',
        'Estoy armando unas repisas para la casa y mi sierra se malogró. La cuido y la devuelvo el mismo día.',
        'en_curso', 'normal', 'aprobado', -5.196100, -80.617400, 117, 28),
  (223, 116, 'ayuda_temporal',          'pedir',   'Necesito quien me ayude a llenar el formulario del bono',
        'No entiendo bien la página web del bono y no tengo internet. Si alguien me puede ayudar con su celular se lo agradezco mucho.',
        'abierta', 'normal', 'aprobado', -5.206800, -80.612900, NULL, 6),
  (224, 113, 'ayuda_temporal',          'pedir',   'Se rompió la tubería y se está inundando mi casa',
        'Reventó la tubería principal en Chiclayito y no encuentro la llave de paso. Necesito ayuda urgente para cortar el agua.',
        'abierta', 'urgente', 'pendiente', -5.214300, -80.603000, NULL, 1),
  (225, 110, 'donacion_materiales',     'pedir',   'Necesito un colchón de una plaza para mi hijo',
        'El colchón de mi hijo se mojó con la lluvia y quedó inservible. Si alguien tiene uno en buen estado que ya no use, se lo agradecería.',
        'abierta', 'urgente', 'pendiente', -5.193700, -80.609800, NULL, 5),
  (226, 108, 'otros',                   'pedir',   'Olla común del AA.HH. Tacalá necesita voluntarios',
        'Cocinamos de lunes a viernes para 60 familias. Necesitamos manos para pelar y servir de 10 a. m. a 1 p. m. Cualquier día ayuda.',
        'abierta', 'normal', 'aprobado', -5.180800, -80.612600, NULL, 14)
) AS f(id, author_n, type, intent, title, description, status, urgency, moderation, lat, lng, assigned_n, hours)
WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = pg_temp.demo_id(f.author_n))
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 4. RESPUESTAS, CONVERSACIONES Y MENSAJES
-- ==============================================================================
CREATE TEMP TABLE demo_chats (n INT, favor_n INT, author_n INT, responder_n INT, hours INT, closed BOOLEAN, interest TEXT) ON COMMIT DROP;
INSERT INTO demo_chats VALUES
  (401, 201, 110, 109, 2,   false, 'Yo tengo una escalera de aluminio, se la presto.'),
  (402, 205, 102, 108, 19,  false, 'Desde la olla común podemos llevar arroz y agua.'),
  (403, 210, 113, 115, 38,  false, 'Tengo carretilla, el domingo se la llevo.'),
  (404, 204, 112, 104, 7,   false, 'Soy enfermera técnica, puedo acompañar a su mamá.'),
  (405, 208, 114, 118, 118, true,  'Yo le cuido a Bobby, tengo patio grande.'),
  (406, 202, 106, 116, 24,  false, 'Mi nieto necesita reforzar matemáticas, ¿hay cupo?');

-- Respuesta al favor (lo que haría fn_respond_to_favor).
INSERT INTO public.favor_interests (id, favor_id, user_id, message, created_at, updated_at)
SELECT pg_temp.demo_id(c.n + 500), pg_temp.demo_id(c.favor_n), pg_temp.demo_id(c.responder_n), c.interest,
       now() - (c.hours || ' hours')::interval, now() - (c.hours || ' hours')::interval
FROM demo_chats c
WHERE EXISTS (SELECT 1 FROM public.favors f WHERE f.id = pg_temp.demo_id(c.favor_n))
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = pg_temp.demo_id(c.responder_n))
ON CONFLICT (favor_id, user_id) DO NOTHING;

INSERT INTO public.conversations (id, favor_id, author_id, responder_id, closed_at, last_message_at, created_at, updated_at)
SELECT pg_temp.demo_id(c.n), pg_temp.demo_id(c.favor_n), pg_temp.demo_id(c.author_n), pg_temp.demo_id(c.responder_n),
       CASE WHEN c.closed THEN now() - interval '90 hours' END,
       now() - (c.hours || ' hours')::interval + interval '50 minutes',
       now() - (c.hours || ' hours')::interval, now() - (c.hours || ' hours')::interval
FROM demo_chats c
WHERE EXISTS (SELECT 1 FROM public.favors f WHERE f.id = pg_temp.demo_id(c.favor_n))
  AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = pg_temp.demo_id(c.responder_n))
ON CONFLICT DO NOTHING;

-- minutos: tiempo desde que se abrió la conversación. El último mensaje de algunas queda sin leer.
INSERT INTO public.messages (id, conversation_id, sender_id, body, read_at, created_at)
SELECT pg_temp.demo_id(m.id), pg_temp.demo_id(m.conv_n), pg_temp.demo_id(m.sender_n), m.body,
       CASE WHEN m.leido THEN now() - (c.hours || ' hours')::interval + ((m.minutos + 5) || ' minutes')::interval END,
       now() - (c.hours || ' hours')::interval + (m.minutos || ' minutes')::interval
FROM (VALUES
  (501, 401, 109, 'Buenas, vecina. Tengo una escalera de aluminio de 6 pasos, ¿le sirve?', 0,  true),
  (502, 401, 110, '¡Sí, me salva! ¿Paso a recogerla hoy en la tarde?',                     10, true),
  (503, 401, 109, 'Claro, estoy en Cossío del Pomar, calle Los Algarrobos. Desde las 4.',   25, true),
  (504, 401, 109, 'Ya la dejé lista en la puerta. Cualquier cosa me avisa.',                50, false),
  (505, 402, 108, 'María, desde la olla común podemos llevar 20 kilos de arroz y agua.',     0,  true),
  (506, 402, 102, 'Gracias, Carmen. La familia está en el local comunal de Tacalá.',         15, true),
  (507, 402, 108, 'Vamos a las 3 p. m. con dos vecinos más. También llevamos frazadas.',     50, true),
  (508, 403, 115, 'Jorge, tengo carretilla. ¿A qué hora la necesita el domingo?',            0,  true),
  (509, 403, 113, 'A las 7 a. m. si se puede, para avanzar antes del calor.',                20, true),
  (510, 403, 115, 'Listo, a las 7 estoy por su casa con la carretilla.',                     50, false),
  (511, 404, 104, 'Elena, soy enfermera técnica y el jueves estoy libre. Puedo acompañarla.', 0, true),
  (512, 404, 112, '¡Qué alivio! Mi mamá se llama Victoria, la paso a dejar a su casa.',      50, false),
  (513, 405, 118, 'Sofía, yo le cuido a Bobby. Tengo patio grande y otro perrito.',          0,  true),
  (514, 405, 114, 'Perfecto, se lo dejo el viernes con su comida y su correa.',              30, true),
  (515, 405, 114, 'Ya regresé. Bobby está feliz, muchas gracias Gloria.',                    50, true),
  (516, 406, 116, 'Profesora, mi nieto está en 4.° grado y le cuesta la división. ¿Hay cupo?', 0, true),
  (517, 406, 106, 'Sí, señora Teresa. Tráigalo el sábado a las 9 con su cuaderno.',          50, false)
) AS m(id, conv_n, sender_n, body, minutos, leido)
JOIN demo_chats c ON c.n = m.conv_n
WHERE EXISTS (SELECT 1 FROM public.conversations cv WHERE cv.id = pg_temp.demo_id(m.conv_n))
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 5. EMERGENCIAS Y REPORTES
-- ==============================================================================
INSERT INTO public.vulnerability_reports (
  id, reporter_user_id, zone_id, approx_lat, approx_lng, description, needs, status, is_anonymous, created_at, updated_at
)
SELECT pg_temp.demo_id(r.id), pg_temp.demo_id(r.reporter_n), '03952125-81cf-4e1a-9244-d3fbe5f9bbf2',
       r.lat, r.lng, r.description, r.needs, 'activo', r.anonimo,
       now() - (r.hours || ' hours')::interval, now() - (r.hours || ' hours')::interval
FROM (VALUES
  (701, 102, -5.180600, -80.611900, 'Familia de 5 personas con la vivienda inundada en el AA.HH. Tacalá, calle 5. Hay dos niños pequeños y una abuela con movilidad reducida.',
        ARRAY['agua', 'alimentos', 'frazadas', 'refugio'], false, 20),
  (702, 104, -5.187300, -80.618200, 'Adulta mayor de 82 años que vive sola en El Indio. Es hipertensa y se quedó sin medicinas; no puede salir de casa.',
        ARRAY['medicinas', 'acompañamiento'], true, 3)
) AS r(id, reporter_n, lat, lng, description, needs, anonimo, hours)
WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = pg_temp.demo_id(r.reporter_n))
ON CONFLICT (id) DO NOTHING;

-- Mismo formato que el backend: target_type 'favor' o 'user'.
INSERT INTO public.user_reports (id, reporter_user_id, target_type, target_id, reason, details, status, created_at, updated_at)
SELECT pg_temp.demo_id(r.id), pg_temp.demo_id(r.reporter_n), r.target_type, pg_temp.demo_id(r.target_n),
       r.reason::report_reason, r.details, r.status,
       now() - (r.hours || ' hours')::interval, now() - (r.hours || ' hours')::interval
FROM (VALUES
  (801, 112, 'favor', 213, 'datos_falsos',          'Fui a recoger los ladrillos y me dijeron que ya no había nada.',      'pendiente', 10),
  (802, 103, 'favor', 213, 'spam',                  'Publicó lo mismo varias veces en el grupo del barrio.',               'pendiente', 9),
  (803, 116, 'user',  117, 'acoso',                 '[conversación de prueba] Me escribió varias veces de noche insistiendo.', 'pendiente', 30),
  (804, 110, 'favor', 221, 'contenido_inapropiado', 'Cobra la mudanza aunque dice que es ayuda solidaria.',                 'revisado',  70)
) AS r(id, reporter_n, target_type, target_n, reason, details, status, hours)
WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = pg_temp.demo_id(r.reporter_n))
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 6. AVISOS (campanita)
-- ==============================================================================
-- Payloads con las mismas claves que escriben el backend y los triggers (src/utils/notificaciones.ts).
INSERT INTO public.notifications (id, user_id, type, payload, read_at, created_at, updated_at)
SELECT pg_temp.demo_id(n.id), pg_temp.demo_id(n.user_n), n.type::notification_type, n.payload,
       CASE WHEN n.leido THEN now() - ((n.hours - 1) || ' hours')::interval END,
       now() - (n.hours || ' hours')::interval, now() - (n.hours || ' hours')::interval
FROM (VALUES
  (601, 110, 'interes_en_favor', jsonb_build_object('favor_id', pg_temp.demo_id(201), 'favor_title', 'Necesito préstamo de escalera para arreglar el techo', 'conversation_id', pg_temp.demo_id(401), 'responder_id', pg_temp.demo_id(109), 'responder_name', 'Pedro Pablo Yarlequé Ato'), true, 2),
  (602, 110, 'nuevo_mensaje',    jsonb_build_object('favor_id', pg_temp.demo_id(201), 'favor_title', 'Necesito préstamo de escalera para arreglar el techo', 'conversation_id', pg_temp.demo_id(401), 'sender_id', pg_temp.demo_id(109), 'sender_name', 'Pedro Pablo Yarlequé Ato'), false, 1),
  (603, 102, 'interes_en_favor', jsonb_build_object('favor_id', pg_temp.demo_id(205), 'favor_title', 'Familia afectada por lluvias necesita agua y víveres', 'conversation_id', pg_temp.demo_id(402), 'responder_id', pg_temp.demo_id(108), 'responder_name', 'Carmen Rosa Purizaca Juárez'), true, 19),
  (604, 113, 'nuevo_mensaje',    jsonb_build_object('favor_id', pg_temp.demo_id(210), 'favor_title', '¿Alguien tiene una carretilla que me preste?', 'conversation_id', pg_temp.demo_id(403), 'sender_id', pg_temp.demo_id(115), 'sender_name', 'Manuel Ancajima Silupú'), false, 37),
  (605, 112, 'interes_en_favor', jsonb_build_object('favor_id', pg_temp.demo_id(204), 'favor_title', 'Necesito quien acompañe a mi mamá a su cita en el hospital', 'conversation_id', pg_temp.demo_id(404), 'responder_id', pg_temp.demo_id(104), 'responder_name', 'Rosa Chiroque Ramírez'), false, 7),
  (606, 118, 'visto_bueno_recibido', jsonb_build_object('favor_id', pg_temp.demo_id(208), 'favor_title', 'Busco quien cuide a mi perrito el fin de semana', 'recognized_by', pg_temp.demo_id(114)), false, 95),
  (607, 107, 'visto_bueno_recibido', jsonb_build_object('favor_id', pg_temp.demo_id(211), 'favor_title', 'Necesito ayuda para subir un ropero al segundo piso', 'recognized_by', pg_temp.demo_id(110)), true, 125),
  (608, 106, 'interes_en_favor', jsonb_build_object('favor_id', pg_temp.demo_id(202), 'favor_title', 'Ofrezco clases de matemáticas para primaria', 'conversation_id', pg_temp.demo_id(406), 'responder_id', pg_temp.demo_id(116), 'responder_name', 'Teresa Querevalú Nima'), false, 24),
  (609, 101, 'sistema',          jsonb_build_object('message', 'Tienes 2 ayudas urgentes pendientes de revisión.'), false, 1),
  (610, 102, 'reporte_actualizado', jsonb_build_object('report_id', pg_temp.demo_id(701)), true, 15),
  (611, 110, 'nueva_publicacion', jsonb_build_object('kind', 'favor', 'favor_id', pg_temp.demo_id(215), 'favor_title', 'Adulta mayor sola necesita sus medicinas hoy', 'intent', 'pedir', 'author_name', 'Rosa Chiroque Ramírez'), false, 2),
  (612, 112, 'nueva_publicacion', jsonb_build_object('kind', 'oficio', 'profile_id', pg_temp.demo_id(310), 'oficio_name', 'Clases', 'author_name', 'Rosa Chiroque Ramírez'), true, 190)
) AS n(id, user_n, type, payload, leido, hours)
WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = pg_temp.demo_id(n.user_n))
ON CONFLICT (id) DO NOTHING;

-- Avisos para las cuentas reales de Castilla (no demo), para que su campanita muestre algo en la demo.
-- Sin ID fijo: el WHERE NOT EXISTS evita duplicarlos al repetir.
INSERT INTO public.notifications (user_id, type, payload, read_at, created_at, updated_at)
SELECT u.id, 'nueva_publicacion'::notification_type, a.payload,
       CASE WHEN a.leido THEN now() - interval '1 hour' END,
       now() - (a.hours || ' hours')::interval, now() - (a.hours || ' hours')::interval
FROM public.users u
CROSS JOIN (VALUES
  (pg_temp.demo_id(215)::text, jsonb_build_object('kind', 'favor', 'favor_id', pg_temp.demo_id(215), 'favor_title', 'Adulta mayor sola necesita sus medicinas hoy', 'intent', 'pedir', 'author_name', 'Rosa Chiroque Ramírez'), false, 2),
  (pg_temp.demo_id(212)::text, jsonb_build_object('kind', 'favor', 'favor_id', pg_temp.demo_id(212), 'favor_title', 'Reviso gratis instalaciones eléctricas de casas antiguas', 'intent', 'ofrecer', 'author_name', 'Luis Alberto Sosa Castro'), false, 12),
  (pg_temp.demo_id(301)::text, jsonb_build_object('kind', 'oficio', 'profile_id', pg_temp.demo_id(301), 'oficio_name', 'Gasfitería', 'author_name', 'Carlos Seminario Zapata'), true, 48)
) AS a(ref_id, payload, leido, hours)
WHERE u.zone_id = '03952125-81cf-4e1a-9244-d3fbe5f9bbf2'
  AND u.id::text NOT LIKE 'a0000000-0000-4000-8000-0000000001%'
  AND EXISTS (SELECT 1 FROM public.favors f WHERE f.id::text = a.ref_id
              UNION ALL SELECT 1 FROM public.professional_profiles p WHERE p.id::text = a.ref_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications x
    WHERE x.user_id = u.id AND x.type = 'nueva_publicacion'
      AND COALESCE(x.payload->>'favor_id', x.payload->>'profile_id') = a.ref_id
  );

ALTER TABLE public.favors ENABLE TRIGGER trg_notificar_nuevo_favor;
ALTER TABLE public.professional_profiles ENABLE TRIGGER trg_notificar_nuevo_oficio;

COMMIT;

-- ==============================================================================
-- Comprobación (ejecutar aparte). Esperado: 18 | 13 | 26 | 6 | 17 | 2 | 4 | 12+
-- ==============================================================================
-- SELECT
--   (SELECT count(*) FROM public.users WHERE id::text LIKE 'a0000000-0000-4000-8000-0000000001%') AS vecinos,
--   (SELECT count(*) FROM public.professional_profiles WHERE id::text LIKE 'a0000000-0000-4000-8000-0000000003%') AS oficios,
--   (SELECT count(*) FROM public.favors WHERE id::text LIKE 'a0000000-0000-4000-8000-0000000002%') AS favores,
--   (SELECT count(*) FROM public.conversations WHERE id::text LIKE 'a0000000-0000-4000-8000-0000000004%') AS chats,
--   (SELECT count(*) FROM public.messages WHERE id::text LIKE 'a0000000-0000-4000-8000-0000000005%') AS mensajes,
--   (SELECT count(*) FROM public.vulnerability_reports WHERE id::text LIKE 'a0000000-0000-4000-8000-0000000007%') AS vulnerabilidad,
--   (SELECT count(*) FROM public.user_reports WHERE id::text LIKE 'a0000000-0000-4000-8000-0000000008%') AS reportes,
--   (SELECT count(*) FROM public.notifications WHERE id::text LIKE 'a0000000-0000-4000-8000-0000000006%') AS avisos;
