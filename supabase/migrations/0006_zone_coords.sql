-- Coordenadas aproximadas de los centros poblados de Castilla (Censo 2017 / Directorio INEI).
-- Sirven para asignar la zona según la ubicación real del vecino.
-- Idempotente: solo actualiza filas existentes por nombre.
UPDATE public.zones z SET center_lat = v.lat, center_lng = v.lng, updated_at = now()
FROM (VALUES
  ('Castilla',         -5.2016::numeric, -80.6225::numeric),
  ('La Obrilla',       -4.9847::numeric, -80.5758::numeric),
  ('San Rafael',       -4.9872::numeric, -80.5897::numeric),
  ('San Vicente',      -5.0230::numeric, -80.5944::numeric),
  ('El Papayo',        -5.0450::numeric, -80.6086::numeric),
  ('Terela',           -5.0794::numeric, -80.5941::numeric),
  ('Chapayra',         -5.1215::numeric, -80.6046::numeric),
  ('Río Seco',         -5.1383::numeric, -80.6141::numeric),
  ('Miraflores',       -5.1652::numeric, -80.6133::numeric),
  ('Las Mercedes',     -5.1475::numeric, -80.4622::numeric),
  ('Cruz de Caña',     -5.1466::numeric, -80.3927::numeric),
  ('Virgen de Fátima', -5.1467::numeric, -80.4144::numeric),
  ('Los Pulache',      -5.1572::numeric, -80.4922::numeric)
) AS v(name, lat, lng)
WHERE z.name = v.name;
