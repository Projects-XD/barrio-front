import type { Request, Response, NextFunction } from 'express';
import { favorService } from '../services/favor.service';
import { getSupabaseClient } from '../config/supabase';
import { AppError } from '../middlewares/errorHandler';
import type { FavorType } from '../types/database.types';

export class FavorController {
  /**
   * GET /api/favors
   * Listar favores activos (status = abierta o en_curso) por zone_id.
   */
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zoneId = (req.query.zone_id || req.query.zoneId) as string;
      const type = req.query.type as FavorType | undefined;

      if (!zoneId) {
        throw new AppError('El parámetro zone_id es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const favors = await favorService.listActiveFavors(supabase, { zoneId, type });

      res.json({
        success: true,
        data: favors,
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/favors/:id
   * Obtiene el detalle de un favor e interesados.
   */
  public async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id ?? '');
      if (!id) {
        throw new AppError('ID de favor requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const favor = await favorService.getFavorById(supabase, id);

      res.json({
        success: true,
        data: favor,
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/favors
   * Crear favor. Valida obligatoriamente client_id para evitar duplicidad, title (max 120) y type.
   */
  public async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const supabase = getSupabaseClient(req);
      const newFavor = await favorService.createFavor(supabase, req.user.id, req.body);

      res.status(201).json({
        success: true,
        data: newFavor,
        code: 201,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/favors/:id/interest
   * Añade registro en favor_interests.
   */
  public async addInterest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const id = String(req.params.id ?? '');
      if (!id) {
        throw new AppError('ID de favor requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const interest = await favorService.addInterest(supabase, req.user.id, id, req.body);

      res.status(201).json({
        success: true,
        data: interest,
        code: 201,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/favors/:id
   * Actualiza los datos o el estado de un favor.
   */
  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const id = String(req.params.id ?? '');
      if (!id) {
        throw new AppError('ID de favor requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const updated = await favorService.updateFavor(supabase, req.user.id, id, req.body);

      res.json({
        success: true,
        data: updated,
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const favorController = new FavorController();
