import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middlewares/errorHandler';

const router = Router();

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

    res.json({ success: true, data: data ?? [], code: 200 });
  } catch (error) {
    next(error);
  }
});

export default router;
