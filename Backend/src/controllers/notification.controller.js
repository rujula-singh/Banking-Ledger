import notificationModel from '../models/notification.model.js';

/**
 * Get user notifications from PostgreSQL
 */
export async function getNotificationsController(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const notifications = await notificationModel.getNotificationsByUser(userId, 30);
    const unreadCount = await notificationModel.getUnreadCount(userId);

    res.status(200).json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Mark a single notification as read
 */
export async function markAsReadController(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;

    await notificationModel.markAsRead(id, userId);

    res.status(200).json({ success: true, message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsReadController(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    await notificationModel.markAllAsRead(userId);

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
