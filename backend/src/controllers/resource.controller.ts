import type { Request, Response, NextFunction } from 'express';
import { resourceService } from '../services/resource.service';
import { getSupabaseClient } from '../config/supabase';
import { AppError } from '../middlewares/errorHandler';

export class ResourceController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zoneId = req.query.zoneId as string;
      const kind = req.query.kind as string | undefined;

      if (!zoneId) {
        throw new AppError('zoneId es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const resources = await resourceService.listResources(supabase, { zoneId, kind });

      res.json({
        success: true,
        data: resources,
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
      const resource = await resourceService.createResource(supabase, req.user.id, req.body);

      res.status(201).json({
        success: true,
        data: resource,
        code: 201,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const resourceController = new ResourceController();
