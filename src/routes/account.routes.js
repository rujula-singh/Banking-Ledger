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

export default router;