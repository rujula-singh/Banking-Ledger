import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import * as budgetController from '../controllers/budget.controller.js';

const router = express.Router();

/**
 * GET /api/budgets
 * Get budgets with calculated spend
 */
router.get('/', authMiddleware, budgetController.getBudgetsController);

/**
 * POST /api/budgets
 * Create or update a budget
 */
router.post('/', authMiddleware, budgetController.setBudgetController);

/**
 * DELETE /api/budgets/:id
 * Delete a budget
 */
router.delete('/:id', authMiddleware, budgetController.deleteBudgetController);

export default router;
