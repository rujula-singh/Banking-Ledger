import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import * as accountController from '../controllers/account.controller.js';

const router = express.Router();

/**
 * -POST/api/accounts/
 * -create a new account
 * -protected route
 */

router.post("/",authMiddleware,accountController.createAccountController);

/**
 * - GET /api/accounts/
 * - get all accounts of the logged-in user
 * - protected route
 */
router.get("/",authMiddleware,accountController.getUserAccountController);

/**
 * GET /api/accounts/balance/
 */
router.get("/balance/:accountId",authMiddleware,accountController.getAccountBalanceController);

/**
 * GET /api/accounts/statement/:accountId
 * Supports query params: ?month=9&year=2026&format=json|csv
 */
router.get("/statement/:accountId",authMiddleware,accountController.getAccountStatementController);

export default router;