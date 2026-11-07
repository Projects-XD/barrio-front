-- Catálogo de oficios: una fila activa por cada categoría del enum oficio_category.
-- Sin estas filas, guardar un perfil profesional falla con "Ese oficio no está disponible en el catálogo".
-- Segura de repetir: oficios no tiene UNIQUE, así que se usa WHERE NOT EXISTS en vez de ON CONFLICT.

INSERT INTO public.oficios (category, name)
SELECT seed.category, seed.name
FROM (
  VALUES
    ('gasfiteria'::oficio_category, 'Gasfitería'),
    ('carpinteria'::oficio_category, 'Carpintería'),
    ('electricidad'::oficio_category, 'Electricidad'),
    ('cerrajeria'::oficio_category, 'Cerrajería'),
    ('clases'::oficio_category, 'Clases'),
    ('paseador_mascotas'::oficio_category, 'Paseador de mascotas'),
    ('otro'::oficio_category, 'Otro')
) AS seed(category, name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.oficios o
  WHERE o.category = seed.category AND o.is_active
);
