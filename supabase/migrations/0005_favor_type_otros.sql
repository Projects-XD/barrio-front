-- Agrega el tipo de favor "otros" (opción libre para lo que no encaja en las demás categorías).
-- ADD VALUE no puede ejecutarse dentro de una transacción en algunas versiones de PostgreSQL;
-- si el editor SQL falla, ejecútalo sin envolverlo en BEGIN/COMMIT.
ALTER TYPE public.favor_type ADD VALUE IF NOT EXISTS 'otros';
