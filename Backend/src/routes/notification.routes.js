import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import * as notificationController from '../controllers/notification.controller.js';

const router = express.Router();

/**
 * GET /api/notifications
 */
router.get('/', authMiddleware, notificationController.getNotificationsController);

/**
 * PATCH /api/notifications/:id/read
 */
router.patch('/:id/read', authMiddleware, notificationController.markAsReadController);

/**
 * POST /api/notifications/read-all
 */
router.post('/read-all', authMiddleware, notificationController.markAllAsReadController);

export default router;
