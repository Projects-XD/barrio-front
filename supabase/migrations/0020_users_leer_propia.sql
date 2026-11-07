-- Cada usuario puede leer su propia fila de public.users.
-- Sin esta politica, la app recibe 403 al leer su zona y cae a user_metadata, que el propio
-- usuario puede editar. Con la politica, la zona sale de la base. Es segura de repetir.

DROP POLICY IF EXISTS users_leer_propia ON public.users;
CREATE POLICY users_leer_propia ON public.users
FOR SELECT TO authenticated
USING (id = auth.uid());
