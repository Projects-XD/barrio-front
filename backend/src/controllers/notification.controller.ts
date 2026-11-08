import type { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { getSupabaseClient } from '../config/supabase';
import { AppError } from '../middlewares/errorHandler';
import type { ListNotificationsQueryDTO } from '../utils/validators';

export class NotificationController {
  /**
   * GET /api/notifications
   */
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      // validate() ya aplicó los valores por defecto de limit y offset.
      const query = req.query as unknown as ListNotificationsQueryDTO;
      const supabase = getSupabaseClient(req);
      const notifications = await notificationService.listNotifications(supabase, req.user.id, query);

      res.json({ success: true, data: notifications, code: 200 });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/notifications/unread-count
   */
  public async unreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const supabase = getSupabaseClient(req);
      const count = await notificationService.countUnread(supabase, req.user.id);

      res.json({ success: true, data: { count }, code: 200 });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   */
  public async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const id = String(req.params.id ?? '');
      const supabase = getSupabaseClient(req);
      const notification = await notificationService.markAsRead(supabase, req.user.id, id);

      res.json({ success: true, data: notification, code: 200 });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/notifications/:id
   */
  public async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const id = String(req.params.id ?? '');
      await notificationService.deleteNotification(getSupabaseClient(req), req.user.id, id);

      res.json({ success: true, data: { id }, code: 200 });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/notifications/read
   */
  public async removeRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const deleted = await notificationService.deleteRead(getSupabaseClient(req), req.user.id);

      res.json({ success: true, data: { deleted }, code: 200 });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
