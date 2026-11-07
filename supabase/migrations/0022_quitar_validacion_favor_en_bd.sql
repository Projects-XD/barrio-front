-- Quita la validación de favores de 0016 en la base de datos.
-- El backend ya valida título, letras repetidas, duplicados y límite diario en FavorService.createFavor,
-- y la sincronización offline ahora usa ese mismo método. Dejar el trigger duplicaba la regla y
-- además la contradecía: limitaba a 3 favores por día mientras el backend usa 5 (o 15 con reputación).
-- Es segura de repetir.

DROP TRIGGER IF EXISTS trg_validar_favor ON public.favors;
DROP FUNCTION IF EXISTS public.fn_validar_favor();
DROP FUNCTION IF EXISTS public.fn_reputacion_favor(UUID);
