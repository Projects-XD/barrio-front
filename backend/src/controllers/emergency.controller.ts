import type { Request, Response, NextFunction } from 'express';
import { emergencyService } from '../services/emergency.service';
import { getSupabaseClient } from '../config/supabase';
import { AppError } from '../middlewares/errorHandler';

export class EmergencyController {
  /**
   * GET /api/emergency
   * Consulta el estado actual de emergencia de una zona.
   */
  public async getState(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zoneId = (req.query.zoneId || req.query.zone_id) as string;
      if (!zoneId) {
        throw new AppError('zoneId o zone_id es requerido', 400);
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

  /**
   * POST /api/emergency/activate
   * REGLA DE SEGURIDAD: Solo usuarios con emergency_role = true pueden activar la emergencia (403 si false).
   */
  public async activate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const supabase = getSupabaseClient(req);
      const state = await emergencyService.activateEmergency(supabase, req.user.id, req.body);

      res.status(201).json({
        success: true,
        message: 'Estado de emergencia activado exitosamente',
        data: state,
        code: 201,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/emergency/deactivate
   * REGLA DE SEGURIDAD: Solo usuarios con emergency_role = true pueden desactivar la emergencia (403 si false).
   */
  public async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const supabase = getSupabaseClient(req);
      const state = await emergencyService.deactivateEmergency(supabase, req.user.id, req.body);

      res.json({
        success: true,
        message: 'Estado de emergencia desactivado exitosamente',
        data: state,
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/emergency/reports
   * REGLA DE PRIVACIDAD: Redondeo matemático de lat y lng a 3 decimales antes de guardar.
   */
  public async createReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const supabase = getSupabaseClient(req);
      const report = await emergencyService.createReport(supabase, req.user.id, req.body);

      res.status(201).json({
        success: true,
        message: 'Reporte de vulnerabilidad registrado exitosamente',
        data: report,
        code: 201,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/emergency/reports
   * REGLA DE PRIVACIDAD: Si is_anonymous = true, el JSON de respuesta NO contiene reporter_user_id ni datos del usuario.
   */
  public async listReports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const supabase = getSupabaseClient(req);
      const reports = await emergencyService.listReports(supabase, req.user.id, {
        limit: Number(req.query.limit) || undefined,
        offset: Number(req.query.offset) || undefined,
      });

      res.json({
        success: true,
        data: reports,
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/emergency/reports/:id/resolve
   * Solo admin o emergency_role.
   */
  public async resolveReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }
      const id = String(req.params.id);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        throw new AppError('id debe ser un UUID válido', 400);
      }

      const supabase = getSupabaseClient(req);
      const report = await emergencyService.resolveReport(supabase, req.user.id, id);

      res.json({ success: true, data: report, code: 200 });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/emergency (Legacy toggle)
   */
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

  /**
   * GET /api/emergency/services
   */
  public async listServices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zoneId = (req.query.zoneId || req.query.zone_id) as string;
      if (!zoneId) {
        throw new AppError('zoneId o zone_id es requerido', 400);
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
