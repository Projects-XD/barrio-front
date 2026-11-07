import type { Request, Response, NextFunction } from 'express';
import { profileService } from '../services/profile.service';
import { getSupabaseClient } from '../config/supabase';
import { AppError } from '../middlewares/errorHandler';

export class ProfileController {
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zoneId = req.query.zoneId as string;
      const category = req.query.category as string | undefined;

      if (!zoneId) {
        throw new AppError('El parámetro zoneId es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const profiles = await profileService.listProfiles(supabase, { zoneId, category });

      res.json({
        success: true,
        data: profiles,
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
        throw new AppError('El ID del perfil es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const profile = await profileService.getProfileById(supabase, id);

      res.json({
        success: true,
        data: profile,
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
      const newProfile = await profileService.createProfile(supabase, req.user.id, req.body);

      res.status(201).json({
        success: true,
        data: newProfile,
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
        throw new AppError('El ID del perfil es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const updated = await profileService.updateProfile(supabase, req.user.id, id, req.body);

      res.json({
        success: true,
        data: updated,
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  public async listOficios(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const supabase = getSupabaseClient(req);
      const oficios = await profileService.listOficios(supabase);

      res.json({
        success: true,
        data: oficios,
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const profileController = new ProfileController();
