-- ==============================================================================
-- Migration: 0001_initial_schema.sql
-- Proyecto: Barrio Backend
-- Descripción: Esquema inicial completo de base de datos PostgreSQL para Supabase.
-- Incluye: ENUMs, Tablas, Restricciones (PK, FK, CHECK, UNIQUE), Índices de Rendimiento,
-- Triggers de auditoría temporal (updated_at) y Lógica de negocio (Vouches).
-- ==============================================================================

-- 0. EXTENSIONES REQUERIDAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. CREACIÓN DE ENUMS
-- ==============================================================================

-- Estado de cuentas de usuario
CREATE TYPE user_status AS ENUM (
  'active',
  'suspended',
  'deleted'
);

-- Categorías de oficios comunitarios
CREATE TYPE oficio_category AS ENUM (
  'gasfiteria',
  'carpinteria',
  'electricidad',
  'cerrajeria',
  'clases',
  'paseador_mascotas',
  'otro'
);

-- Tipos de favores vecinales
CREATE TYPE favor_type AS ENUM (
  'herramienta',
  'ayuda_temporal',
  'donacion_materiales',
  'intercambio_habilidades',
  'movilidad_solidaria'
);

-- Ciclo de vida del favor
CREATE TYPE favor_status AS ENUM (
  'abierta',
  'en_curso',
  'cerrada',
  'cancelada'
);

-- Estado de sincronización offline-first
CREATE TYPE sync_status AS ENUM (
  'pendiente',
  'enviado',
  'error'
);

-- Estado de emergencia de una zona
CREATE TYPE emergency_status AS ENUM (
  'inactiva',
  'activa'
);

-- Tipos de servicios públicos y comunitarios de soporte
CREATE TYPE service_type AS ENUM (
  'salud',
  'bomberos',
  'policia',
  'grupo_apoyo',
  'refugio',
  'otro'
);

-- Tipos de recursos críticos durante contingencias
CREATE TYPE resource_type AS ENUM (
  'agua',
  'medicinas',
  'generador',
  'transporte',
  'alimentos',
  'otro'
);

-- Modalidad del recurso crítico
CREATE TYPE resource_kind AS ENUM (
  'pedido',
  'oferta'
);

-- Estado de los reportes de vulnerabilidad
CREATE TYPE report_status AS ENUM (
  'activo',
  'resuelto',
  'oculto'
);

-- Motivos de reportes y denuncias de usuarios
CREATE TYPE report_reason AS ENUM (
  'spam',
  'contenido_inapropiado',
  'datos_falsos',
  'acoso',
  'otro'
);

-- Tipos de notificaciones del sistema
CREATE TYPE notification_type AS ENUM (
  'visto_bueno_recibido',
  'interes_en_favor',
  'reporte_actualizado',
  'emergencia_activada',
  'sistema'
);

-- ==============================================================================
-- 2. FUNCIÓN DE UTILIDAD: ACTUALIZACIÓN AUTOMÁTICA DE updated_at
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ==============================================================================
-- 3. CREACIÓN DE TABLAS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Tabla: zones
-- Representa los cuadrantes, barrios o comunas geográficas de la aplicación.
-- ------------------------------------------------------------------------------
CREATE TABLE public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  center_lat NUMERIC(9,6) CHECK (center_lat IS NULL OR (center_lat >= -90.0 AND center_lat <= 90.0)),
  center_lng NUMERIC(9,6) CHECK (center_lng IS NULL OR (center_lng >= -180.0 AND center_lng <= 180.0)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Tabla: users
-- Extensión del perfil del usuario vinculado al esquema de autenticación de Supabase (auth.users).
-- ------------------------------------------------------------------------------
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  status user_status NOT NULL DEFAULT 'active',
  is_anonymous_by_default BOOLEAN NOT NULL DEFAULT false,
  emergency_role BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Tabla: user_phones
-- Teléfonos asociados al usuario con indicador de privacidad.
-- ------------------------------------------------------------------------------
CREATE TABLE public.user_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_phones_user_phone UNIQUE (user_id, phone)
);

-- ------------------------------------------------------------------------------
-- Tabla: oficios
-- Catálogo de oficios y servicios disponibles en el barrio.
-- ------------------------------------------------------------------------------
CREATE TABLE public.oficios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category oficio_category NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Tabla: professional_profiles
-- Perfil profesional publicado por un vecino con un oficio determinado.
-- Restricciones:
-- - Un usuario sólo puede tener un perfil profesional por oficio (UQ user_id + oficio_id).
-- - Descripción limitada a un máximo de 500 caracteres.
-- ------------------------------------------------------------------------------
CREATE TABLE public.professional_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  oficio_id UUID NOT NULL REFERENCES public.oficios(id) ON DELETE RESTRICT,
  zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  years_experience INTEGER CHECK (years_experience IS NULL OR years_experience >= 0),
  location_lat NUMERIC(9,6) CHECK (location_lat IS NULL OR (location_lat >= -90.0 AND location_lat <= 90.0)),
  location_lng NUMERIC(9,6) CHECK (location_lng IS NULL OR (location_lng >= -180.0 AND location_lng <= 180.0)),
  is_visible BOOLEAN NOT NULL DEFAULT true,
  validated_count INTEGER NOT NULL DEFAULT 0 CHECK (validated_count >= 0),
  is_validated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_professional_profiles_user_oficio UNIQUE (user_id, oficio_id)
);

-- ------------------------------------------------------------------------------
-- Función auxiliar para constraint de validación cruzada:
-- Impide que el emisor del visto bueno sea el propio dueño del perfil profesional.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_is_voucher_not_profile_owner(p_profile_id UUID, p_voucher_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.professional_profiles
    WHERE id = p_profile_id
      AND user_id = p_voucher_user_id
  );
$$;

-- ------------------------------------------------------------------------------
-- Tabla: vouches
-- Vistos buenos / validaciones de confianza que los vecinos otorgan a un perfil profesional.
-- Restricciones:
-- - Un vecino solo puede dar un visto bueno por perfil (UQ profile_id + voucher_user_id).
-- - CHECK: El emisor no puede ser el propietario del perfil.
-- ------------------------------------------------------------------------------
CREATE TABLE public.vouches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.professional_profiles(id) ON DELETE CASCADE,
  voucher_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_vouches_profile_voucher UNIQUE (profile_id, voucher_user_id),
  CONSTRAINT chk_vouches_not_self_vouch CHECK (public.fn_is_voucher_not_profile_owner(profile_id, voucher_user_id))
);

-- ------------------------------------------------------------------------------
-- Tabla: favors
-- Solicitudes u ofertas de ayuda vecinal (favores).
-- Restricciones:
-- - Título limitado a un máximo de 120 caracteres.
-- - client_id único por autor para garantizar idempotencia en sincronización offline.
-- ------------------------------------------------------------------------------
CREATE TABLE public.favors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  type favor_type NOT NULL,
  title VARCHAR(120) NOT NULL CHECK (char_length(title) <= 120),
  description TEXT,
  status favor_status NOT NULL DEFAULT 'abierta',
  location_lat NUMERIC(9,6) CHECK (location_lat IS NULL OR (location_lat >= -90.0 AND location_lat <= 90.0)),
  location_lng NUMERIC(9,6) CHECK (location_lng IS NULL OR (location_lng >= -180.0 AND location_lng <= 180.0)),
  assigned_to_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  client_id UUID NOT NULL,
  sync_status sync_status NOT NULL DEFAULT 'enviado',
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_favors_author_client_id UNIQUE (author_id, client_id)
);

-- ------------------------------------------------------------------------------
-- Tabla: favor_interests
-- Vecinos interesados en colaborar en un favor.
-- ------------------------------------------------------------------------------
CREATE TABLE public.favor_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  favor_id UUID NOT NULL REFERENCES public.favors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_favor_interests_favor_user UNIQUE (favor_id, user_id)
);

-- ------------------------------------------------------------------------------
-- Tabla: favor_events
-- Registro cronológico de transiciones de estado de un favor.
-- ------------------------------------------------------------------------------
CREATE TABLE public.favor_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  favor_id UUID NOT NULL REFERENCES public.favors(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  from_status favor_status,
  to_status favor_status NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Tabla: emergency_states
-- Declaraciones de estado de emergencia para una zona comunitaria.
-- ------------------------------------------------------------------------------
CREATE TABLE public.emergency_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  status emergency_status NOT NULL DEFAULT 'activa',
  activated_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Tabla: support_services
-- Directorio de entidades de auxilio y servicios de soporte barrial.
-- ------------------------------------------------------------------------------
CREATE TABLE public.support_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type service_type NOT NULL,
  phone TEXT,
  address_summary TEXT,
  location_lat NUMERIC(9,6) CHECK (location_lat IS NULL OR (location_lat >= -90.0 AND location_lat <= 90.0)),
  location_lng NUMERIC(9,6) CHECK (location_lng IS NULL OR (location_lng >= -180.0 AND location_lng <= 180.0)),
  hours TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Tabla: vulnerability_reports
-- Alertas comunitarias de personas o familias en estado vulnerable.
-- ------------------------------------------------------------------------------
CREATE TABLE public.vulnerability_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  approx_lat NUMERIC(9,6) CHECK (approx_lat IS NULL OR (approx_lat >= -90.0 AND approx_lat <= 90.0)),
  approx_lng NUMERIC(9,6) CHECK (approx_lng IS NULL OR (approx_lng >= -180.0 AND approx_lng <= 180.0)),
  description TEXT NOT NULL,
  needs TEXT[] NOT NULL DEFAULT '{}',
  status report_status NOT NULL DEFAULT 'activo',
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  resolved_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Tabla: critical_resources
-- Inventario de recursos críticos ofrecidos o solicitados en emergencias.
-- ------------------------------------------------------------------------------
CREATE TABLE public.critical_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  kind resource_kind NOT NULL,
  resource resource_type NOT NULL,
  quantity NUMERIC(10,2) CHECK (quantity IS NULL OR quantity >= 0),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto', 'cubierto', 'cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Tabla: notifications
-- Buzón de notificaciones push / in-app recibidas por los usuarios.
-- ------------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Tabla: user_reports
-- Denuncias y reportes de moderación sobre contenidos o usuarios.
-- ------------------------------------------------------------------------------
CREATE TABLE public.user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason report_reason NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Tabla: push_tokens
-- Tokens de dispositivos móviles para notificaciones remotas (Expo / FCM / APNs).
-- ------------------------------------------------------------------------------
CREATE TABLE public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Tabla: sync_operations
-- Cola de sincronización idempotente para operaciones offline-first de clientes móviles.
-- ------------------------------------------------------------------------------
CREATE TABLE public.sync_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  operation TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status sync_status NOT NULL DEFAULT 'pendiente',
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_sync_operations_user_client UNIQUE (user_id, client_id)
);

-- ------------------------------------------------------------------------------
-- Tabla: audit_logs
-- Registro de auditoría para trazabilidad de acciones operativas y de seguridad.
-- PK de tipo BIGSERIAL según especificación arquitectónica.
-- ------------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- Tabla: app_settings
-- Parámetros de configuración global clave-valor en formato JSONB.
-- ------------------------------------------------------------------------------
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 4. ÍNDICES DE RENDIMIENTO (Foreign Keys y Filtros Comunes)
-- ==============================================================================

CREATE INDEX idx_users_zone_id ON public.users(zone_id);
CREATE INDEX idx_users_status ON public.users(status);

CREATE INDEX idx_user_phones_user_id ON public.user_phones(user_id);

CREATE INDEX idx_oficios_category ON public.oficios(category);
CREATE INDEX idx_oficios_is_active ON public.oficios(is_active);

CREATE INDEX idx_professional_profiles_user_id ON public.professional_profiles(user_id);
CREATE INDEX idx_professional_profiles_oficio_id ON public.professional_profiles(oficio_id);
CREATE INDEX idx_professional_profiles_zone_id ON public.professional_profiles(zone_id);
CREATE INDEX idx_professional_profiles_visibility ON public.professional_profiles(is_visible, is_validated);

CREATE INDEX idx_vouches_profile_id ON public.vouches(profile_id);
CREATE INDEX idx_vouches_voucher_user_id ON public.vouches(voucher_user_id);

CREATE INDEX idx_favors_author_id ON public.favors(author_id);
CREATE INDEX idx_favors_zone_status ON public.favors(zone_id, status);
CREATE INDEX idx_favors_assigned_to ON public.favors(assigned_to_user_id);
CREATE INDEX idx_favors_sync_status ON public.favors(sync_status);

CREATE INDEX idx_favor_interests_favor_id ON public.favor_interests(favor_id);
CREATE INDEX idx_favor_interests_user_id ON public.favor_interests(user_id);

CREATE INDEX idx_favor_events_favor_id ON public.favor_events(favor_id);
CREATE INDEX idx_favor_events_actor ON public.favor_events(actor_user_id);

CREATE INDEX idx_emergency_states_zone_status ON public.emergency_states(zone_id, status);

CREATE INDEX idx_support_services_zone_type ON public.support_services(zone_id, type);

CREATE INDEX idx_vulnerability_reports_zone_status ON public.vulnerability_reports(zone_id, status);
CREATE INDEX idx_vulnerability_reports_reporter ON public.vulnerability_reports(reporter_user_id);

CREATE INDEX idx_critical_resources_zone_status ON public.critical_resources(zone_id, status);
CREATE INDEX idx_critical_resources_user ON public.critical_resources(user_id);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE read_at IS NULL;

CREATE INDEX idx_user_reports_reporter ON public.user_reports(reporter_user_id);
CREATE INDEX idx_user_reports_target ON public.user_reports(target_type, target_id);
CREATE INDEX idx_user_reports_status ON public.user_reports(status);

CREATE INDEX idx_push_tokens_user_id ON public.push_tokens(user_id);

CREATE INDEX idx_sync_operations_user_status ON public.sync_operations(user_id, status);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- ==============================================================================
-- 5. TRIGGERS DE AUDITORÍA TEMPORAL (updated_at)
-- ==============================================================================

DO $$
DECLARE
  t TEXT;
  tables_with_updated_at TEXT[] := ARRAY[
    'zones',
    'users',
    'user_phones',
    'oficios',
    'professional_profiles',
    'vouches',
    'favors',
    'favor_interests',
    'favor_events',
    'emergency_states',
    'support_services',
    'vulnerability_reports',
    'critical_resources',
    'notifications',
    'user_reports',
    'push_tokens',
    'sync_operations',
    'audit_logs',
    'app_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables_with_updated_at LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;
      CREATE TRIGGER trg_set_updated_at
        BEFORE UPDATE ON public.%I
        FOR EACH ROW
        EXECUTE FUNCTION public.fn_set_updated_at();
    ', t, t);
  END LOOP;
END;
$$;

-- ==============================================================================
-- 6. LÓGICA Y TRIGGERS (Requisito Crítico: Vouches & Perfiles Profesionales)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Trigger 1: Validación Preventiva de Auto-Vouch (BEFORE INSERT/UPDATE)
-- Proporciona un mensaje de error explícito y legible al intentar validarse a sí mismo.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_check_vouch_not_self()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner_user_id UUID;
BEGIN
  SELECT user_id INTO v_owner_user_id
  FROM public.professional_profiles
  WHERE id = NEW.profile_id;

  IF v_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Perfil profesional % no encontrado.', NEW.profile_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.voucher_user_id = v_owner_user_id THEN
    RAISE EXCEPTION 'Restricción violada: Un usuario no puede otorgarse visto bueno (vouch) a su propio perfil profesional.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_vouch_not_self ON public.vouches;
CREATE TRIGGER trg_check_vouch_not_self
  BEFORE INSERT OR UPDATE OF profile_id, voucher_user_id ON public.vouches
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_check_vouch_not_self();

-- ------------------------------------------------------------------------------
-- Trigger 2: Recalcular validated_count e is_validated (AFTER INSERT/DELETE/UPDATE)
-- Requisito Crítico:
-- - Al hacer INSERT o DELETE en `vouches`, recalcula `validated_count` en `professional_profiles`.
-- - Si `validated_count` >= 2, actualiza `is_validated` a TRUE en el perfil (y a FALSE si disminuye).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_recalculate_profile_vouches()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_profile_id UUID;
  v_count INTEGER;
BEGIN
  -- Determinar el profile_id afectado según la acción
  IF (TG_OP = 'DELETE') THEN
    v_target_profile_id := OLD.profile_id;
  ELSE
    v_target_profile_id := NEW.profile_id;
  END IF;

  -- 1. Recalcular el total de vistos buenos para el perfil
  SELECT COUNT(*)::INTEGER
  INTO v_count
  FROM public.vouches
  WHERE profile_id = v_target_profile_id;

  -- 2. Actualizar validated_count y la bandera is_validated
  UPDATE public.professional_profiles
  SET
    validated_count = v_count,
    is_validated = (v_count >= 2),
    updated_at = now()
  WHERE id = v_target_profile_id;

  -- 3. Manejo de caso borde: Si se modificó el profile_id en un UPDATE, recalcular también el anterior
  IF (TG_OP = 'UPDATE' AND OLD.profile_id IS DISTINCT FROM NEW.profile_id) THEN
    SELECT COUNT(*)::INTEGER
    INTO v_count
    FROM public.vouches
    WHERE profile_id = OLD.profile_id;

    UPDATE public.professional_profiles
    SET
      validated_count = v_count,
      is_validated = (v_count >= 2),
      updated_at = now()
    WHERE id = OLD.profile_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_vouches_recalculate_profile ON public.vouches;
CREATE TRIGGER trg_vouches_recalculate_profile
  AFTER INSERT OR DELETE OR UPDATE OF profile_id ON public.vouches
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_recalculate_profile_vouches();

-- ==============================================================================
-- 7. SEGURIDAD Y CONTROL DE ACCESO (Row Level Security - RLS)
-- ==============================================================================
-- Habilitación de RLS en todas las tablas del esquema público conforme a las
-- mejores prácticas de arquitectura en Supabase.
-- ==============================================================================

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oficios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favor_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favor_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vulnerability_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.critical_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
