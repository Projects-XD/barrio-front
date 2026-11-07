import type { Request, Response, NextFunction } from 'express';
import { profileService } from '../services/profile.service';
import { getSupabaseClient } from '../config/supabase';
import { AppError } from '../middlewares/errorHandler';
import type { OficioCategory } from '../types/database.types';

export class ProfileController {
  /**
   * GET /api/profiles/me
   * Obtiene (y sincroniza si hace falta) el registro public.users del usuario actual y su perfil de oficio.
   */
  public async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const supabase = getSupabaseClient(req);
      const data = await profileService.getMyUserAndProfile(supabase, req.user.id, req.user);

      res.json({
        success: true,
        data,
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/profiles/me
   * Actualiza los datos del usuario autenticado (full_name, zone_id, etc.).
   */
  public async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const supabase = getSupabaseClient(req);
      const updatedUser = await profileService.updateMyUser(supabase, req.user.id, req.body, req.user);

      res.json({
        success: true,
        data: updatedUser,
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/profiles
   * Lista perfiles profesionales filtrados por zone_id y opcionalmente oficio_id.
   */
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zoneId = (req.query.zone_id || req.query.zoneId) as string;
      const oficioId = (req.query.oficio_id || req.query.oficioId) as string | undefined;
      const category = req.query.category as OficioCategory | undefined;

      if (!zoneId) {
        throw new AppError('El parámetro zone_id es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const profiles = await profileService.listProfiles(supabase, {
        zoneId,
        oficioId,
        category,
      });

      res.json({
        success: true,
        data: profiles,
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/profiles/:id
   * Obtiene el detalle de un perfil profesional por su identificador.
   */
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

  /**
   * POST /api/profiles
   * Crear o editar perfil profesional del usuario autenticado.
   */
  public async upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const supabase = getSupabaseClient(req);
      const profile = await profileService.upsertProfile(supabase, req.user.id, req.body, req.user);

      res.status(201).json({
        success: true,
        data: profile,
        code: 201,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/profiles/:id/vouch
   * Otorga un Visto Bueno validando en Node que las zonas coincidan exactamente (403 si no coinciden).
   */
  public async vouch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const profileId = String(req.params.id ?? req.params.profileId ?? '');
      if (!profileId) {
        throw new AppError('El ID del perfil profesional es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const result = await profileService.giveVouch(supabase, req.user.id, profileId, req.user);

      res.status(201).json({
        success: true,
        data: result,
        code: 201,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/profiles/:id/vouch
   * Retira un visto bueno otorgado.
   */
  public async removeVouch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const profileId = String(req.params.id ?? req.params.profileId ?? '');
      if (!profileId) {
        throw new AppError('El ID del perfil profesional es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const result = await profileService.removeVouch(supabase, req.user.id, profileId);

      res.json({
        success: true,
        data: result,
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/profiles/:id/vouch/status
   * Consulta si el usuario autenticado ya otorgó un visto bueno.
   */
  public async checkVouchStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const profileId = String(req.params.id ?? req.params.profileId ?? '');
      if (!profileId) {
        throw new AppError('El ID del perfil profesional es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const hasVouched = await profileService.hasVouched(supabase, req.user.id, profileId);

      res.json({
        success: true,
        data: { hasVouched },
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/profiles/oficios
   * Catálogo de oficios activos.
   */
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
