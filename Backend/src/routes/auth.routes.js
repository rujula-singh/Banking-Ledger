import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

/** 
 * POST /api/auth/register 
 */
router.post('/register', authController.userRegisterController);

/**
 * POST /api/auth/login
 */
router.post('/login', authController.userLoginController);

/**
 * POST /api/auth/logout
 */
router.post('/logout', authController.userLogoutContoller);

/**
 * GET /api/auth/me
 */
router.get('/me', authMiddleware, authController.getUserProfile);

/**
 * GET /api/auth/sessions
 */
router.get('/sessions', authMiddleware, authController.getUserSessions);

/**
 * POST /api/auth/sessions/revoke-others
 */
router.post('/sessions/revoke-others', authMiddleware, authController.revokeOtherSessions);

export default router;