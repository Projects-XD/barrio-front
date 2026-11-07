import type { Request, Response, NextFunction } from 'express';
import { syncService } from '../services/sync.service';
import { getSupabaseClient } from '../config/supabase';
import { AppError } from '../middlewares/errorHandler';
import type { SyncOperationDTO } from '../utils/validators';

export class SyncController {
  /**
   * POST /api/sync
   * Procesa un array de operaciones offline secuencialmente con idempotencia estricta.
   */
  public async sync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado para sincronización', 401);
      }

      // Soporta tanto array directo `[...]` como objeto envolvente `{ operations: [...] }`
      const operations: SyncOperationDTO[] = Array.isArray(req.body)
        ? req.body
        : req.body?.operations;

      if (!Array.isArray(operations)) {
        throw new AppError(
          'El payload de sincronización debe ser un JSON Array estructurado: [{ client_id, operation, payload }, ...]',
          400
        );
      }

      const supabase = getSupabaseClient(req);
      const results = await syncService.processSyncBatch(supabase, req.user.id, operations);

      res.status(200).json({
        success: true,
        message: 'Lote de sincronización offline procesado exitosamente',
        data: {
          total: operations.length,
          processed: results.length,
          results,
        },
        code: 200,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const syncController = new SyncController();
