const express = require('express');
const { query } = require('../config/database');
const router = express.Router();

// GET /api/notifications - Get user notifications
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereClause = 'WHERE n.user_id = $1';
    const queryParams = [userId];
    
    if (unreadOnly === 'true') {
      whereClause += ' AND n.is_read = false';
    }

    const notificationsQuery = `
      SELECT n.*, 
             p.name as project_name,
             t.title as task_title
      FROM notifications n
      LEFT JOIN projects p ON n.related_id = p.id AND n.type IN ('project_invite', 'project_update')
      LEFT JOIN tasks t ON n.related_id = t.id AND n.type IN ('task_assigned', 'task_deadline', 'task_comment')
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    queryParams.push(parseInt(limit), offset);

    const result = await query(notificationsQuery, queryParams);

    // Get unread count
    const unreadCountResult = await query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    const notifications = result.rows.map(notification => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      relatedId: notification.related_id,
      isRead: notification.is_read,
      createdAt: notification.created_at,
      metadata: {
        projectName: notification.project_name,
        taskTitle: notification.task_title
      }
    }));

    res.json({
      notifications,
      unreadCount: parseInt(unreadCountResult.rows[0].unread_count),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: notifications.length
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error retrieving notifications' });
  }
});

// PUT /api/notifications/:notificationId/read - Mark notification as read
router.put('/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const result = await query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Server error updating notification' });
  }
});

// PUT /api/notifications/read-all - Mark all notifications as read
router.put('/read-all', async (req, res) => {
  try {
    const userId = req.user.id;

    await query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ message: 'Server error updating notifications' });
  }
});

// DELETE /api/notifications/:notificationId - Delete a notification
router.delete('/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const result = await query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Server error deleting notification' });
  }
});

module.exports = router;
