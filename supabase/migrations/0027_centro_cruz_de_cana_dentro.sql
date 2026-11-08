-- Mueve el centro de Cruz de Caña (-5.1466, -80.3927) a un punto dentro del contorno de Castilla.
-- El centro anterior quedaba en el borde, fuera del polígono, y bloqueaba el registro de quien
-- eligiera esa zona sin GPS. Es segura de repetir.

UPDATE public.zones
SET center_lat = -5.1471, center_lng = -80.3927, updated_at = now()
WHERE name = 'Cruz de Caña';
