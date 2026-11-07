import type { Request, Response, NextFunction } from 'express';
import { conversationService } from '../services/conversation.service';
import { getSupabaseClient } from '../config/supabase';
import { AppError } from '../middlewares/errorHandler';
import type {
  ListConversationsQueryDTO,
  ListMessagesQueryDTO,
  ReportConversationUserDTO,
  SendMessageDTO,
  UpdateConversationDTO,
} from '../utils/validators';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError('Usuario no autenticado', 401);
  }
  return req.user.id;
}

export class ConversationController {
  /** GET /api/conversations?favor_id= */
  public async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const { favor_id } = req.query as unknown as ListConversationsQueryDTO;
      const data = await conversationService.listConversations(getSupabaseClient(req), userId, favor_id);
      res.json({ success: true, data, code: 200 });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/conversations/:id */
  public async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const data = await conversationService.getConversation(
        getSupabaseClient(req),
        userId,
        String(req.params.id ?? '')
      );
      res.json({ success: true, data, code: 200 });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/conversations/:id */
  public async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const data = await conversationService.updateConversation(
        getSupabaseClient(req),
        userId,
        String(req.params.id ?? ''),
        req.body as UpdateConversationDTO
      );
      res.json({ success: true, data, code: 200 });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/conversations/:id/messages */
  public async listMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const { limit } = req.query as unknown as ListMessagesQueryDTO;
      const data = await conversationService.listMessages(
        getSupabaseClient(req),
        userId,
        String(req.params.id ?? ''),
        limit
      );
      res.json({ success: true, data, code: 200 });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/conversations/:id/messages */
  public async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const data = await conversationService.sendMessage(
        getSupabaseClient(req),
        userId,
        String(req.params.id ?? ''),
        req.body as SendMessageDTO
      );
      res.status(201).json({ success: true, data, code: 201 });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/conversations/:id/block */
  public async block(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const data = await conversationService.blockOtherUser(
        getSupabaseClient(req),
        userId,
        String(req.params.id ?? '')
      );
      res.json({ success: true, data, code: 200 });
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /api/conversations/:id/block */
  public async unblock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const data = await conversationService.unblockOtherUser(
        getSupabaseClient(req),
        userId,
        String(req.params.id ?? '')
      );
      res.json({ success: true, data, code: 200 });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/conversations/:id/report */
  public async report(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const data = await conversationService.reportOtherUser(
        getSupabaseClient(req),
        userId,
        String(req.params.id ?? ''),
        req.body as ReportConversationUserDTO
      );
      res.status(201).json({ success: true, data, code: 201 });
    } catch (error) {
      next(error);
    }
  }
}

export const conversationController = new ConversationController();
