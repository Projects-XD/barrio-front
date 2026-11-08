-- Imágenes en el chat: hasta 2 por mensaje. En la BD solo se guarda la URL; el archivo vive en Storage.
-- Es segura de repetir.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_images_max_2;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_images_max_2 CHECK (cardinality(images) <= 2);

-- El texto ahora puede ir vacío si el mensaje trae al menos una imagen.
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_body_check;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_body_o_imagen;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_body_o_imagen CHECK (
    char_length(body) <= 1000
    AND (char_length(btrim(body)) >= 1 OR cardinality(images) >= 1)
  );

-- Bucket de imágenes del chat (lectura por URL; los nombres son UUID no adivinables).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-images', 'chat-images', true, 1048576, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS chat_images_lectura ON storage.objects;
CREATE POLICY chat_images_lectura ON storage.objects
FOR SELECT USING (bucket_id = 'chat-images');

DROP POLICY IF EXISTS chat_images_subir_propia_carpeta ON storage.objects;
CREATE POLICY chat_images_subir_propia_carpeta ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);
