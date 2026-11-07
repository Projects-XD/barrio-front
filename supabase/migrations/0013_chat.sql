-- Chat entre vecinos: una conversación por favor y vecino que responde.
-- Se abre apenas alguien responde al favor (favor_interests). El acceso pasa siempre por el
-- backend (service role); RLS queda activo sin políticas, igual que el resto de las tablas.

-- ------------------------------------------------------------------------------
-- Tabla: conversations
-- Chat uno a uno entre el autor de un favor y quien respondió.
-- ------------------------------------------------------------------------------
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  favor_id UUID NOT NULL REFERENCES public.favors(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_muted BOOLEAN NOT NULL DEFAULT false,
  responder_muted BOOLEAN NOT NULL DEFAULT false,
  closed_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_conversations_favor_responder UNIQUE (favor_id, responder_id),
  CONSTRAINT chk_conversations_distinct_users CHECK (author_id <> responder_id)
);

-- ------------------------------------------------------------------------------
-- Tabla: messages
-- Mensajes de una conversación. Solo se agregan; no se editan.
-- ------------------------------------------------------------------------------
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Tabla: user_blocks
-- Un vecino bloquea a otro: no puede responder a sus favores ni escribirle.
-- ------------------------------------------------------------------------------
CREATE TABLE public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_blocks_pair UNIQUE (blocker_id, blocked_id),
  CONSTRAINT chk_user_blocks_distinct_users CHECK (blocker_id <> blocked_id)
);

-- ------------------------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------------------------
CREATE INDEX idx_conversations_author ON public.conversations(author_id, last_message_at DESC);
CREATE INDEX idx_conversations_responder ON public.conversations(responder_id, last_message_at DESC);
CREATE INDEX idx_conversations_favor_id ON public.conversations(favor_id);

-- Paginación y polling: mensajes de una conversación en orden cronológico.
CREATE INDEX idx_messages_conversation_created ON public.messages(conversation_id, created_at, id);
CREATE INDEX idx_messages_unread ON public.messages(conversation_id) WHERE read_at IS NULL;

CREATE INDEX idx_user_blocks_blocked ON public.user_blocks(blocked_id);

-- ------------------------------------------------------------------------------
-- Triggers updated_at y RLS
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.conversations;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
