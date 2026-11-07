-- Campo propio para distinguir "pido ayuda" de "ofrezco ayuda".
-- Antes la app lo adivinaba con una expresion regular sobre el titulo. Es segura de repetir.

ALTER TABLE public.favors
  ADD COLUMN IF NOT EXISTS intent TEXT NOT NULL DEFAULT 'pedir';

ALTER TABLE public.favors DROP CONSTRAINT IF EXISTS chk_favors_intent;
ALTER TABLE public.favors
  ADD CONSTRAINT chk_favors_intent CHECK (intent IN ('pedir', 'ofrecer'));

-- Relleno de favores existentes con la misma regla que usaba la app.
UPDATE public.favors
SET intent = 'ofrecer'
WHERE intent = 'pedir'
  AND (title || ' ' || COALESCE(description, '')) ~* '^(ofrezco|ofrece|tengo\s+para\s+prestar|presto|dono|regalo|puedo\s+ayudar|puedo\s+ense.ar)';
