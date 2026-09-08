import express from 'express';
import { authMiddleware, authSystemUserMiddleware } from '../middleware/auth.middleware.js';
import * as transactionController from '../controllers/transaction.controller.js';

const router = express.Router();

/**
 * GET /api/transactions/
 * Search, filter by type, category, date, and paginate
 */
router.get('/', authMiddleware, transactionController.getTransactionsController);

/**
 * GET /api/transactions/:id
 * Get single transaction receipt
 */
router.get('/:id', authMiddleware, transactionController.getTransactionByIdController);

/**
 * POST /api/transactions/
 * Transfer funds between accounts
 */
router.post('/', authMiddleware, transactionController.createTransaction);

/**
 * POST /api/transactions/deposit
 * Deposit / add funds to an account
 */
router.post('/deposit', authMiddleware, transactionController.depositFunds);

/**
 * POST /api/transactions/system/initial-funds
 * Seed funds from system user
 */
router.post('/system/initial-funds', authSystemUserMiddleware, transactionController.createInitialFundsTransaction);

export default router;