import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import * as insightController from '../controllers/insight.controller.js';

const router = express.Router();

/**
 * GET /api/insights/spending
 * Monthly category breakdown and MoM comparisons
 */
router.get('/spending', authMiddleware, insightController.getSpendingInsights);

/**
 * GET /api/insights/cashflow
 * Monthly income vs expense summary
 */
router.get('/cashflow', authMiddleware, insightController.getCashflowInsights);

export default router;
