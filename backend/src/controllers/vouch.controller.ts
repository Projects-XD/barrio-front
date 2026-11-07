import type { Request, Response, NextFunction } from 'express';
import { vouchService } from '../services/vouch.service';
import { getSupabaseClient } from '../config/supabase';
import { AppError } from '../middlewares/errorHandler';

export class VouchController {
  public async give(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const profileId = String(req.params.profileId ?? '');
      if (!profileId) {
        throw new AppError('profileId es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const result = await vouchService.giveVouch(supabase, req.user.id, profileId);

      res.status(201).json({
        success: true,
        data: result,
        code: 201,
      });
    } catch (error) {
      next(error);
    }
  }

  public async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const profileId = String(req.params.profileId ?? '');
      if (!profileId) {
        throw new AppError('profileId es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const result = await vouchService.removeVouch(supabase, req.user.id, profileId);

      res.json({
        success: true,
        data: result,
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  public async checkStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const profileId = String(req.params.profileId ?? '');
      if (!profileId) {
        throw new AppError('profileId es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const hasVouched = await vouchService.hasVouched(supabase, req.user.id, profileId);

      res.json({
        success: true,
        data: { hasVouched },
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const vouchController = new VouchController();
