import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middlewares/errorHandler';

const router = Router();

const DEFAULT_CASTILLA_ZONES = [
  { name: 'Castilla', city: 'Piura', center_lat: -5.2016, center_lng: -80.6225 },
  { name: 'Miraflores', city: 'Piura', center_lat: -5.1652, center_lng: -80.6133 },
  { name: 'Río Seco', city: 'Piura', center_lat: -5.1383, center_lng: -80.6141 },
  { name: 'Las Mercedes', city: 'Piura', center_lat: -5.1475, center_lng: -80.4622 },
  { name: 'Chapayra', city: 'Piura', center_lat: -5.1215, center_lng: -80.6046 },
  { name: 'Terela', city: 'Piura', center_lat: -5.0794, center_lng: -80.5941 },
  { name: 'El Papayo', city: 'Piura', center_lat: -5.045, center_lng: -80.6086 },
  { name: 'San Vicente', city: 'Piura', center_lat: -5.023, center_lng: -80.5944 },
  { name: 'San Rafael', city: 'Piura', center_lat: -4.9872, center_lng: -80.5897 },
  { name: 'La Obrilla', city: 'Piura', center_lat: -4.9847, center_lng: -80.5758 },
  { name: 'Cruz de Caña', city: 'Piura', center_lat: -5.1466, center_lng: -80.3927 },
  { name: 'Virgen de Fátima', city: 'Piura', center_lat: -5.1467, center_lng: -80.4144 },
  { name: 'Los Pulache', city: 'Piura', center_lat: -5.1572, center_lng: -80.4922 },
  { name: 'Loma El Mirador', city: 'Piura', center_lat: -5.182, center_lng: -80.605 },
  { name: 'Sector Chocán', city: 'Piura', center_lat: -5.191, center_lng: -80.618 },
  { name: 'Mi Cautivo', city: 'Piura', center_lat: -5.209, center_lng: -80.615 },
];

/**
 * @openapi
 * /zones:
 *   get:
 *     summary: Listar zonas (centros poblados) disponibles para el registro
 *     tags:
 *       - Zonas
 *     responses:
 *       200:
 *         description: Lista pública de zonas con id y nombre
 */
// Pública: el registro la necesita antes de que exista sesión.
router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('zones')
      .select('id, name, city, center_lat, center_lng')
      .order('name');

    if (error) {
      throw new AppError(`Error al consultar zonas: ${error.message}`, 400);
    }

    if (data && data.length > 0) {
      res.json({ success: true, data, code: 200 });
      return;
    }

    // Inicializar zonas de Castilla si la base de datos está vacía
    const { data: seeded } = await supabaseAdmin
      .from('zones')
      .upsert(DEFAULT_CASTILLA_ZONES, { onConflict: 'name' })
      .select('id, name, city, center_lat, center_lng')
      .order('name');

    res.json({ success: true, data: seeded ?? [], code: 200 });
  } catch (error) {
    next(error);
  }
});

export default router;
