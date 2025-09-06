const jwt = require('jsonwebtoken');
const { appCache } = require('../config/redis');
const { query } = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ message: 'No token provided, access denied' });
    }

    // Extract token (format: "Bearer <token>")
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({ message: 'No token provided, access denied' });
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if token is blacklisted (optional)
      const isBlacklisted = await appCache.cache.exists(`blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({ message: 'Token has been revoked' });
      }

      // Try to get user data from cache first
      let userData = await appCache.getUserSession(decoded.userId);
      
      if (!userData) {
        // If not in cache, fetch from database
        const result = await query(
          'SELECT id, username, email, first_name, last_name, avatar, role, created_at FROM users WHERE id = $1',
          [decoded.userId]
        );

        if (result.rows.length === 0) {
          return res.status(401).json({ message: 'User not found' });
        }

        userData = result.rows[0];
        
        // Cache user data for future requests
        await appCache.setUserSession(decoded.userId, userData, 1); // 1 hour
      }

      // Add user data to request object
      req.user = {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        avatar: userData.avatar,
        role: userData.role,
        createdAt: userData.created_at
      };

      // Track user activity
      await appCache.setUserOnline(userData.id, req.ip);

      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token has expired' });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
      } else {
        throw jwtError;
      }
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ message: 'Server error during authentication' });
  }
};

// Middleware to check if user has specific role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

// Middleware to check if user has access to a specific project
const requireProjectAccess = (requiredRole = 'member') => {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.body.projectId;
      const userId = req.user.id;

      if (!projectId) {
        return res.status(400).json({ message: 'Project ID is required' });
      }

      // Check if user is a member of the project
      const result = await query(
        `SELECT pm.role, p.created_by 
         FROM project_members pm 
         JOIN projects p ON pm.project_id = p.id 
         WHERE pm.project_id = $1 AND pm.user_id = $2`,
        [projectId, userId]
      );

      // Check if user is project creator (always has access)
      const projectResult = await query(
        'SELECT created_by FROM projects WHERE id = $1',
        [projectId]
      );

      if (projectResult.rows.length === 0) {
        return res.status(404).json({ message: 'Project not found' });
      }

      const isProjectCreator = projectResult.rows[0].created_by === userId;
      
      if (!isProjectCreator && result.rows.length === 0) {
        return res.status(403).json({ message: 'Access denied to this project' });
      }

      // Check role requirements
      if (!isProjectCreator && requiredRole !== 'member') {
        const userProjectRole = result.rows[0].role;
        const roleHierarchy = { member: 1, admin: 2, owner: 3 };
        const requiredLevel = roleHierarchy[requiredRole];
        const userLevel = roleHierarchy[userProjectRole];

        if (userLevel < requiredLevel) {
          return res.status(403).json({ message: 'Insufficient project permissions' });
        }
      }

      // Add project role to request
      req.projectRole = isProjectCreator ? 'owner' : (result.rows[0]?.role || 'member');
      req.isProjectCreator = isProjectCreator;

      next();
    } catch (error) {
      console.error('Project access middleware error:', error);
      return res.status(500).json({ message: 'Server error checking project access' });
    }
  };
};

// Middleware to check if user can access a specific task
const requireTaskAccess = () => {
  return async (req, res, next) => {
    try {
      const taskId = req.params.taskId || req.body.taskId;
      const userId = req.user.id;

      if (!taskId) {
        return res.status(400).json({ message: 'Task ID is required' });
      }

      // Get task and check if user has access to the project
      const result = await query(
        `SELECT t.project_id, t.assigned_to, t.created_by,
                pm.role as project_role, p.created_by as project_creator
         FROM tasks t
         JOIN projects p ON t.project_id = p.id
         LEFT JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = $2
         WHERE t.id = $1`,
        [taskId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Task not found' });
      }

      const task = result.rows[0];
      
      // Check if user has access to the project
      const isProjectCreator = task.project_creator === userId;
      const isProjectMember = !!task.project_role;
      const isTaskAssignee = task.assigned_to === userId;
      const isTaskCreator = task.created_by === userId;

      if (!isProjectCreator && !isProjectMember && !isTaskAssignee && !isTaskCreator) {
        return res.status(403).json({ message: 'Access denied to this task' });
      }

      // Add task context to request
      req.taskContext = {
        projectId: task.project_id,
        isTaskAssignee,
        isTaskCreator,
        isProjectCreator,
        projectRole: task.project_role
      };

      next();
    } catch (error) {
      console.error('Task access middleware error:', error);
      return res.status(500).json({ message: 'Server error checking task access' });
    }
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return next();
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Try to get user data from cache
      let userData = await appCache.getUserSession(decoded.userId);
      
      if (!userData) {
        const result = await query(
          'SELECT id, username, email, first_name, last_name, avatar, role FROM users WHERE id = $1',
          [decoded.userId]
        );

        if (result.rows.length > 0) {
          userData = result.rows[0];
          await appCache.setUserSession(decoded.userId, userData, 1);
        }
      }

      if (userData) {
        req.user = {
          id: userData.id,
          username: userData.username,
          email: userData.email,
          firstName: userData.first_name,
          lastName: userData.last_name,
          avatar: userData.avatar,
          role: userData.role
        };
      }
    } catch (jwtError) {
      // Ignore JWT errors for optional auth
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};

module.exports = {
  authMiddleware,
  requireRole,
  requireProjectAccess,
  requireTaskAccess,
  optionalAuth
};
