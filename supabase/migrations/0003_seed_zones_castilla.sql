-- Centros poblados del distrito de Castilla (Piura), según el Censo 2017 (INEI).
-- Idempotente: si la zona ya existe, no se duplica.

INSERT INTO public.zones (name, city) VALUES
  ('Castilla', 'Piura'),
  ('La Obrilla', 'Piura'),
  ('San Rafael', 'Piura'),
  ('San Vicente', 'Piura'),
  ('El Papayo', 'Piura'),
  ('Terela', 'Piura'),
  ('Chapayra', 'Piura'),
  ('Río Seco', 'Piura'),
  ('Miraflores', 'Piura'),
  ('Las Mercedes', 'Piura'),
  ('Loma El Mirador', 'Piura'),
  ('Cruz de Caña', 'Piura'),
  ('Virgen de Fátima', 'Piura'),
  ('Sector Chocán', 'Piura'),
  ('Mi Cautivo', 'Piura'),
  ('Los Pulache', 'Piura')
ON CONFLICT (name) DO NOTHING;
