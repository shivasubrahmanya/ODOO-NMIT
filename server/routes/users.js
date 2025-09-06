const express = require('express');
const { query } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// GET /api/users/search - Search users by username or email
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ message: 'Query must be at least 2 characters long' });
    }

    const searchQuery = `
      SELECT id, username, first_name, last_name, avatar, email
      FROM users 
      WHERE (username ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1)
      AND id != $2
      LIMIT $3
    `;

    const result = await query(searchQuery, [`%${q}%`, req.user.id, parseInt(limit)]);

    const users = result.rows.map(user => ({
      id: user.id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      avatar: user.avatar,
      email: user.email,
      displayName: `${user.first_name} ${user.last_name} (@${user.username})`
    }));

    res.json({ users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error searching users' });
  }
});

// GET /api/users/:userId - Get user profile
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const userQuery = `
      SELECT 
        u.id, u.username, u.first_name, u.last_name, u.avatar, u.created_at,
        COUNT(DISTINCT p.id) as owned_projects,
        COUNT(DISTINCT pm.project_id) as member_projects,
        COUNT(DISTINCT t.id) as assigned_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as completed_tasks
      FROM users u
      LEFT JOIN projects p ON u.id = p.created_by
      LEFT JOIN project_members pm ON u.id = pm.user_id
      LEFT JOIN tasks t ON u.id = t.assigned_to
      WHERE u.id = $1
      GROUP BY u.id, u.username, u.first_name, u.last_name, u.avatar, u.created_at
    `;

    const result = await query(userQuery, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      avatar: user.avatar,
      createdAt: user.created_at,
      statistics: {
        ownedProjects: parseInt(user.owned_projects),
        memberProjects: parseInt(user.member_projects),
        assignedTasks: parseInt(user.assigned_tasks),
        completedTasks: parseInt(user.completed_tasks)
      },
      isOwnProfile: userId === req.user.id
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Server error retrieving user profile' });
  }
});

module.exports = router;
