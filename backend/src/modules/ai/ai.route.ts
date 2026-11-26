import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAnyPermission } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validate.middleware';
import { sendError, sendSuccess } from '../../utils/response';
import { aiService } from './ai.service';

const forecastQuerySchema = z.object({
  branchId: z.string().min(1),
  productId: z.string().min(1),
  horizonDays: z.coerce.number().int().refine((v) => v === 7 || v === 14 || v === 30, {
    message: 'Chu kỳ dự báo phải là 7, 14 hoặc 30 ngày',
  }).default(14),
});

const suggestionsQuerySchema = z.object({
  minSavingPct: z.coerce.number().min(0).max(100).default(0),
});

const acceptSuggestionsSchema = z.object({
  items: z
    .array(
      z.object({
        sourceBranchId: z.string().min(1),
        destBranchId: z.string().min(1),
        productId: z.string().min(1),
        qty: z.coerce.number().int().positive(),
        confidencePct: z.coerce.number().optional(),
      })
    )
    .min(1),
});

const router = Router();

router.use(authenticate);

router.get(
  '/forecast',
  requireAnyPermission('ALERT_MANAGE', 'STOCK_READ', 'TRANSFER_TRACK'),
  validateRequest({ query: forecastQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = forecastQuerySchema.parse(req.query);
      const data = await aiService.getDemandForecast({
        branchId: BigInt(q.branchId),
        productId: BigInt(q.productId),
        horizonDays: q.horizonDays as 7 | 14 | 30,
      });
      sendSuccess(res, data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        sendError(res, 'FORECAST_ERROR', err.message, 400);
        return;
      }
      next(err);
    }
  }
);

router.get(
  '/transfer-suggestions',
  requireAnyPermission('ALERT_MANAGE', 'TRANSFER_TRACK'),
  validateRequest({ query: suggestionsQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = suggestionsQuerySchema.parse(req.query);
      const data = await aiService.getTransferSuggestions(q.minSavingPct);
      sendSuccess(res, data);
    } catch (err: unknown) {
      next(err);
    }
  }
);

router.post(
  '/transfer-suggestions/accept',
  requireAnyPermission('ALERT_MANAGE', 'TRANSFER_TRACK', 'TICKET_CREATE'),
  validateRequest({ body: acceptSuggestionsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = acceptSuggestionsSchema.parse(req.body);
      const result = await aiService.acceptTransferSuggestions(
        input.items,
        req.user!.id,
        req.ip || null
      );
      sendSuccess(
        res,
        result,
        `Đã khởi tạo ${result.count} phiếu điều chuyển từ đề xuất AI`,
        201
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        sendError(res, 'ACCEPT_AI_FAILED', err.message, 400);
        return;
      }
      next(err);
    }
  }
);

export const aiRouter = router;
