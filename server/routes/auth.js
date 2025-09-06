const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { appCache } = require('../config/redis');
const { authMiddleware } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().required().min(3).max(50).alphanum(),
  email: Joi.string().required().email(),
  password: Joi.string().required().min(6).max(128),
  firstName: Joi.string().required().min(1).max(100),
  lastName: Joi.string().required().min(1).max(100)
});

const loginSchema = Joi.object({
  email: Joi.string().required().email(),
  password: Joi.string().required()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().required().min(6).max(128)
});

// Helper function to generate JWT tokens
const generateTokens = (userId) => {
  const payload = { userId };
  
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  });
  
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  });
  
  return { accessToken, refreshToken };
};

// POST /api/auth/register - Register a new user
router.post('/register', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { username, email, password, firstName, lastName } = value;

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ 
        message: 'User already exists with this email or username' 
      });
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, username, email, first_name, last_name, role, created_at`,
      [username, email, passwordHash, firstName, lastName]
    );

    const user = result.rows[0];

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Store refresh token
    await appCache.cache.set(`refresh_token:${user.id}`, refreshToken, 7 * 24 * 60 * 60); // 7 days

    // Cache user session
    await appCache.setUserSession(user.id, user, 24); // 24 hours

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        createdAt: user.created_at
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// POST /api/auth/login - User login
router.post('/login', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { email, password } = value;

    // Find user
    const result = await query(
      'SELECT id, username, email, password_hash, first_name, last_name, avatar, role, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id);

    // Store refresh token
    await appCache.cache.set(`refresh_token:${user.id}`, refreshToken, 7 * 24 * 60 * 60); // 7 days

    // Cache user session
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar: user.avatar,
      role: user.role,
      created_at: user.created_at
    };
    await appCache.setUserSession(user.id, userData, 24); // 24 hours

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        avatar: user.avatar,
        role: user.role,
        createdAt: user.created_at
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token is required' });
    }

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      
      // Check if refresh token exists in cache
      const storedToken = await appCache.cache.get(`refresh_token:${decoded.userId}`, false);
      if (!storedToken || storedToken !== refreshToken) {
        return res.status(401).json({ message: 'Invalid refresh token' });
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);

      // Store new refresh token and remove old one
      await appCache.cache.set(`refresh_token:${decoded.userId}`, newRefreshToken, 7 * 24 * 60 * 60);

      res.json({
        tokens: {
          accessToken,
          refreshToken: newRefreshToken
        }
      });
    } catch (jwtError) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ message: 'Server error refreshing token' });
  }
});

// POST /api/auth/logout - Logout user
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const token = req.header('Authorization').slice(7); // Remove 'Bearer '

    // Remove refresh token from cache
    await appCache.cache.del(`refresh_token:${userId}`);

    // Blacklist current access token
    await appCache.cache.set(`blacklist:${token}`, 'true', 24 * 60 * 60); // 24 hours

    // Remove user session
    await appCache.deleteUserSession(userId);

    // Set user offline
    await appCache.setUserOffline(userId);

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
});

// POST /api/auth/change-password - Change user password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { currentPassword, newPassword } = value;
    const userId = req.user.id;

    // Get current password hash
    const result = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, userId]
    );

    // Invalidate all user sessions and tokens
    await appCache.cache.del(`refresh_token:${userId}`);
    await appCache.deleteUserSession(userId);

    res.json({ message: 'Password changed successfully. Please login again.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error changing password' });
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get fresh user data from database
    const result = await query(
      'SELECT id, username, email, first_name, last_name, avatar, role, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];

    // Get user statistics
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT p.id) as projects_count,
        COUNT(DISTINCT pm.project_id) as member_projects_count,
        COUNT(DISTINCT t.id) as assigned_tasks_count,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as completed_tasks_count,
        COUNT(DISTINCT CASE WHEN t.deadline < CURRENT_TIMESTAMP AND t.status != 'done' THEN t.id END) as overdue_tasks_count
      FROM users u
      LEFT JOIN projects p ON u.id = p.created_by
      LEFT JOIN project_members pm ON u.id = pm.user_id
      LEFT JOIN tasks t ON u.id = t.assigned_to
      WHERE u.id = $1
    `;

    const statsResult = await query(statsQuery, [userId]);
    const stats = statsResult.rows[0];

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      avatar: user.avatar,
      role: user.role,
      createdAt: user.created_at,
      statistics: {
        ownedProjects: parseInt(stats.projects_count),
        memberProjects: parseInt(stats.member_projects_count),
        assignedTasks: parseInt(stats.assigned_tasks_count),
        completedTasks: parseInt(stats.completed_tasks_count),
        overdueTasks: parseInt(stats.overdue_tasks_count)
      }
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ message: 'Server error retrieving user info' });
  }
});

// POST /api/auth/verify-token - Verify if token is valid
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if token is blacklisted
      const isBlacklisted = await appCache.cache.exists(`blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({ valid: false, message: 'Token has been revoked' });
      }

      res.json({ valid: true, userId: decoded.userId });
    } catch (jwtError) {
      res.status(401).json({ valid: false, message: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ message: 'Server error verifying token' });
  }
});

module.exports = router;
