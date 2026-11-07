import type { Request, Response, NextFunction } from 'express';
import { resourceService } from '../services/resource.service';
import { getSupabaseClient } from '../config/supabase';
import { AppError } from '../middlewares/errorHandler';

export class ResourceController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const zoneId = (req.query.zoneId || req.query.zone_id) as string | undefined;
      const kind = req.query.kind as string | undefined;

      const supabase = getSupabaseClient(req);
      const resources = await resourceService.listResources(supabase, req.user.id, { zoneId, kind });

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
