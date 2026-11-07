import type { Request, Response, NextFunction } from 'express';
import { emergencyService } from '../services/emergency.service';
import { getSupabaseClient } from '../config/supabase';
import { AppError } from '../middlewares/errorHandler';

export class EmergencyController {
  public async getState(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zoneId = req.query.zoneId as string;
      if (!zoneId) {
        throw new AppError('zoneId es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const state = await emergencyService.getEmergencyState(supabase, zoneId);

      res.json({
        success: true,
        data: state ?? { zoneId, status: 'inactiva', reason: null, activated_at: null },
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  public async setState(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const supabase = getSupabaseClient(req);
      const state = await emergencyService.setEmergencyState(supabase, req.user.id, req.body);

      res.status(201).json({
        success: true,
        data: state,
        code: 201,
      });
    } catch (error) {
      next(error);
    }
  }

  public async listServices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zoneId = req.query.zoneId as string;
      if (!zoneId) {
        throw new AppError('zoneId es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const services = await emergencyService.listSupportServices(supabase, zoneId);

      res.json({
        success: true,
        data: services,
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const emergencyController = new EmergencyController();
