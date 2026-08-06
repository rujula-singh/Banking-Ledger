import express from 'express';
import { authMiddleware,authSystemUserMiddleware } from '../middleware/auth.middleware.js';
import * as transactionController from '../controllers/transaction.controller.js';

const router = express.Router();


/**
 * -POST /api/transactions/
 * -Create a new transaction
 */

router.post("/",authMiddleware,transactionController.createTransaction)

/**
 * -POST /api/transactions/system/initial-funds
 * -Create initial funds transaction from system user
 */

router.post("/system/initial-funds",authSystemUserMiddleware,transactionController.createInitialFundsTransaction);

export default router;