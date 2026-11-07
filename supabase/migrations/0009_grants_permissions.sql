-- Permisos del backend. Es aditiva y segura de repetir.
--
-- Las migraciones 0001-0008 crean tablas sin conceder permisos sobre ellas, y sin GRANT
-- service_role recibe 42501 aunque se salte RLS: GET /favors/:id fallaba por favor_interests.
--
-- DML en vez de ALL: el backend no necesita TRUNCATE, TRIGGER ni REFERENCES.
-- Solo service_role: anon y authenticated siguen sin cambios.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Las tablas que el rol que aplica esta migración cree en el futuro nacen con el mismo permiso.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;
