-- Deja en una migración lo que antes se ejecutaba a mano en el SQL editor:
--   1. Bucket de fotos de perfil y sus políticas.
--   2. Realtime de favores y la política de lectura por zona.
--   3. Escritura del cliente en public.users limitada a avatar_url.
-- Es segura de repetir.

-- ------------------------------------------------------------------------------
-- 1. Fotos de perfil
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS avatars_lectura_publica ON storage.objects;
CREATE POLICY avatars_lectura_publica ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_subir_propia_carpeta ON storage.objects;
CREATE POLICY avatars_subir_propia_carpeta ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatars_actualizar_propia_carpeta ON storage.objects;
CREATE POLICY avatars_actualizar_propia_carpeta ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------------------------
-- 2. Realtime de favores (solo los aprobados de la zona del vecino, o los propios)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.favors;
EXCEPTION
  WHEN duplicate_object THEN NULL; -- ya estaba en la publicación
  WHEN undefined_object THEN NULL; -- proyecto sin publicación supabase_realtime
END $$;

DROP POLICY IF EXISTS favors_leer_mi_zona ON public.favors;
CREATE POLICY favors_leer_mi_zona ON public.favors
FOR SELECT TO authenticated
USING (
  zone_id = (SELECT zone_id FROM public.users WHERE id = auth.uid())
  AND (moderation_status = 'aprobado' OR author_id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- 3. public.users: el cliente solo puede cambiar su avatar
-- ------------------------------------------------------------------------------
-- Una política de UPDATE por fila no limita las columnas: sin esto, un usuario podría cambiarse
-- is_admin, zone_id o emergency_role con la clave pública. El backend usa service_role y no se ve afectado.
DROP POLICY IF EXISTS users_actualizar_su_avatar ON public.users;
CREATE POLICY users_actualizar_su_avatar ON public.users
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

REVOKE UPDATE ON public.users FROM anon, authenticated;
GRANT UPDATE (avatar_url) ON public.users TO authenticated;
