import type { Request, Response, NextFunction } from 'express';
import { healthService } from '../services/health.service';

export class HealthController {
  public async check(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = await healthService.getHealth();
      const statusCode = health.status === 'ok' ? 200 : 503;
      res.status(statusCode).json({
        success: health.status === 'ok',
        data: health,
        code: statusCode,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const healthController = new HealthController();
