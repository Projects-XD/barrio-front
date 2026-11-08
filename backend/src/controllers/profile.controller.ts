import type { Request, Response, NextFunction } from 'express';
import { profileService } from '../services/profile.service';
import { aiService } from '../services/ai.service';
import { getSupabaseClient } from '../config/supabase';
import { AppError } from '../middlewares/errorHandler';
import type { OficioCategory } from '../types/database.types';
import type { SaveMyLocationDTO, SuggestDescriptionDTO } from '../utils/validators';

export class ProfileController {
  /** PATCH /api/v1/profiles/me/location */
  public async saveMyLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }
      const saved = await profileService.saveUserLocation(req.user.id, req.body as SaveMyLocationDTO);
      res.json({ success: true, data: saved, code: 200 });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/profiles/suggest-description */
  public async suggestDescription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }
      const description = await aiService.suggestDescription(req.user.id, req.body as SuggestDescriptionDTO);
      res.json({ success: true, data: { description }, code: 200 });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/profiles
   * Lista perfiles profesionales de la zona real del usuario (resuelta en el backend;
   * cualquier zoneId que mande el cliente se ignora), opcionalmente por oficio_id o category.
   */
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const oficioId = (req.query.oficio_id || req.query.oficioId) as string | undefined;
      const category = req.query.category as OficioCategory | undefined;

      const supabase = getSupabaseClient(req);
      const profiles = await profileService.listProfiles(supabase, req.user.id, {
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
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const id = String(req.params.id ?? '');
      if (!id) {
        throw new AppError('El ID del perfil es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const profile = await profileService.getProfileById(supabase, req.user.id, id);

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
      const profile = await profileService.upsertProfile(supabase, req.user.id, req.body);

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
      const result = await profileService.giveVouch(supabase, req.user.id, profileId);

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
   * POST /api/profiles/:id/contact
   * Inicia o recupera una conversación directa con un oficio comunitario.
   */
  public async contact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const profileId = String(req.params.id ?? req.params.profileId ?? '');
      if (!profileId) {
        throw new AppError('El ID del perfil profesional es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const data = await profileService.contactProfile(
        supabase,
        req.user.id,
        profileId,
        req.body?.initial_message
      );

      res.status(200).json({
        success: true,
        data,
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

  /**
   * DELETE /api/profiles/:id
   * Elimina un perfil profesional propio.
   */
  public async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const id = String(req.params.id ?? '');
      if (!id) {
        throw new AppError('El ID del perfil es requerido', 400);
      }

      const supabase = getSupabaseClient(req);
      const result = await profileService.deleteProfile(supabase, req.user.id, id);

      res.json({
        success: true,
        data: result,
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const profileController = new ProfileController();
