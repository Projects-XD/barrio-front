import type { Request, Response, NextFunction } from 'express';
import { favorService } from '../services/favor.service';
import { getSupabaseClient } from '../config/supabase';
import { AppError } from '../middlewares/errorHandler';

export class FavorController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zoneId = req.query.zoneId as string;
      const type = req.query.type as string | undefined;
      const status = req.query.status as string | undefined;

      if (!zoneId) {
        throw new AppError('zoneId es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const favors = await favorService.listFavors(supabase, { zoneId, type, status });

      res.json({
        success: true,
        data: favors,
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }

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

  public async expressInterest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const id = String(req.params.id ?? '');
      if (!id) {
        throw new AppError('ID de favor requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const interest = await favorService.expressInterest(supabase, req.user.id, id, req.body);

      res.status(201).json({
        success: true,
        data: interest,
        code: 201,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const favorController = new FavorController();
