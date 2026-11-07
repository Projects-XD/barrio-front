-- Agrega el tipo de notificación "nuevo_mensaje" para el chat entre vecinos.
-- ADD VALUE no puede ejecutarse dentro de una transacción en algunas versiones de PostgreSQL;
-- si el editor SQL falla, ejecútalo sin envolverlo en BEGIN/COMMIT.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'nuevo_mensaje';
