const express = require('express');
const { query, transaction } = require('../config/database');
const { appCache } = require('../config/redis');
const { requireProjectAccess, requireTaskAccess } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

// Validation schemas
const createTaskSchema = Joi.object({
  title: Joi.string().required().min(1).max(255),
  description: Joi.string().max(2000),
  projectId: Joi.string().uuid().required(),
  assignedTo: Joi.string().uuid().optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
  deadline: Joi.date().iso().greater('now').optional()
});

const updateTaskSchema = Joi.object({
  title: Joi.string().min(1).max(255),
  description: Joi.string().max(2000),
  status: Joi.string().valid('todo', 'in-progress', 'done'),
  priority: Joi.string().valid('low', 'medium', 'high', 'critical'),
  assignedTo: Joi.string().uuid().allow(null),
  deadline: Joi.date().iso().optional().allow(null)
});

const commentSchema = Joi.object({
  content: Joi.string().required().min(1).max(2000)
});

// GET /api/tasks - Get tasks (with filters)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      projectId, 
      status, 
      priority, 
      assignedTo, 
      search, 
      page = 1, 
      limit = 50,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    let whereClause = `WHERE (
      t.assigned_to = $1 OR 
      t.created_by = $1 OR 
      pm.user_id = $1 OR 
      p.created_by = $1
    )`;
    let queryParams = [userId];
    let paramCount = 1;

    // Project filter
    if (projectId) {
      paramCount++;
      whereClause += ` AND t.project_id = $${paramCount}`;
      queryParams.push(projectId);
    }

    // Status filter
    if (status && ['todo', 'in-progress', 'done'].includes(status)) {
      paramCount++;
      whereClause += ` AND t.status = $${paramCount}`;
      queryParams.push(status);
    }

    // Priority filter
    if (priority && ['low', 'medium', 'high', 'critical'].includes(priority)) {
      paramCount++;
      whereClause += ` AND t.priority = $${paramCount}`;
      queryParams.push(priority);
    }

    // Assigned to filter
    if (assignedTo) {
      paramCount++;
      whereClause += ` AND t.assigned_to = $${paramCount}`;
      queryParams.push(assignedTo);
    }

    // Search filter
    if (search) {
      paramCount++;
      whereClause += ` AND (t.title ILIKE $${paramCount} OR t.description ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Validate sort parameters
    const validSortFields = ['created_at', 'updated_at', 'deadline', 'priority', 'status', 'title'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    // Calculate offset
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const tasksQuery = `
      SELECT DISTINCT 
        t.*,
        p.name as project_name,
        assignee.username as assignee_username,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name,
        assignee.avatar as assignee_avatar,
        creator.username as creator_username,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name,
        COUNT(DISTINCT tc.id) as comment_count
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN task_comments tc ON t.id = tc.task_id
      ${whereClause}
      GROUP BY t.id, p.name, assignee.username, assignee.first_name, assignee.last_name, 
               assignee.avatar, creator.username, creator.first_name, creator.last_name
      ORDER BY t.${sortField} ${order}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);

    const result = await query(tasksQuery, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT t.id) as total
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      ${whereClause}
    `;

    const countResult = await query(countQuery, queryParams.slice(0, -2));

    const tasks = result.rows.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      completedAt: task.completed_at,
      project: {
        id: task.project_id,
        name: task.project_name
      },
      assignee: task.assigned_to ? {
        id: task.assigned_to,
        username: task.assignee_username,
        firstName: task.assignee_first_name,
        lastName: task.assignee_last_name,
        avatar: task.assignee_avatar
      } : null,
      creator: {
        id: task.created_by,
        username: task.creator_username,
        firstName: task.creator_first_name,
        lastName: task.creator_last_name
      },
      commentCount: parseInt(task.comment_count),
      isOverdue: task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done'
    }));

    res.json({
      tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Server error retrieving tasks' });
  }
});

// GET /api/tasks/:taskId - Get a specific task
router.get('/:taskId', requireTaskAccess(), async (req, res) => {
  try {
    const taskId = req.params.taskId;

    const taskQuery = `
      SELECT 
        t.*,
        p.name as project_name,
        assignee.id as assignee_id,
        assignee.username as assignee_username,
        assignee.first_name as assignee_first_name,
        assignee.last_name as assignee_last_name,
        assignee.avatar as assignee_avatar,
        creator.username as creator_username,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name,
        creator.avatar as creator_avatar
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE t.id = $1
    `;

    const result = await query(taskQuery, [taskId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const task = result.rows[0];

    // Get task comments
    const commentsQuery = `
      SELECT 
        tc.*,
        u.username, u.first_name, u.last_name, u.avatar
      FROM task_comments tc
      JOIN users u ON tc.user_id = u.id
      WHERE tc.task_id = $1
      ORDER BY tc.created_at ASC
    `;

    const commentsResult = await query(commentsQuery, [taskId]);

    const taskData = {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      completedAt: task.completed_at,
      project: {
        id: task.project_id,
        name: task.project_name
      },
      assignee: task.assignee_id ? {
        id: task.assignee_id,
        username: task.assignee_username,
        firstName: task.assignee_first_name,
        lastName: task.assignee_last_name,
        avatar: task.assignee_avatar
      } : null,
      creator: {
        id: task.created_by,
        username: task.creator_username,
        firstName: task.creator_first_name,
        lastName: task.creator_last_name,
        avatar: task.creator_avatar
      },
      comments: commentsResult.rows.map(comment => ({
        id: comment.id,
        content: comment.content,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        author: {
          id: comment.user_id,
          username: comment.username,
          firstName: comment.first_name,
          lastName: comment.last_name,
          avatar: comment.avatar
        }
      })),
      isOverdue: task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done',
      canEdit: req.taskContext.isTaskCreator || req.taskContext.isProjectCreator || 
               req.taskContext.projectRole === 'admin' || req.taskContext.isTaskAssignee
    };

    res.json(taskData);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ message: 'Server error retrieving task' });
  }
});

// POST /api/tasks - Create a new task
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = createTaskSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { title, description, projectId, assignedTo, priority, deadline } = value;
    const createdBy = req.user.id;

    // Check project access
    const projectResult = await query(
      `SELECT p.id, pm.user_id 
       FROM projects p 
       LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
       WHERE p.id = $1 AND (p.created_by = $2 OR pm.user_id = $2)`,
      [projectId, req.user.id]
    );

    if (projectResult.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied to this project' });
    }

    // If assignee is specified, check if they're a project member
    if (assignedTo) {
      const assigneeResult = await query(
        `SELECT pm.user_id 
         FROM project_members pm 
         WHERE pm.project_id = $1 AND pm.user_id = $2
         UNION
         SELECT p.created_by as user_id 
         FROM projects p 
         WHERE p.id = $1 AND p.created_by = $2`,
        [projectId, assignedTo]
      );

      if (assigneeResult.rows.length === 0) {
        return res.status(400).json({ message: 'Assigned user is not a member of this project' });
      }
    }

    const result = await query(
      `INSERT INTO tasks (title, description, project_id, assigned_to, created_by, priority, deadline) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [title, description, projectId, assignedTo, createdBy, priority, deadline]
    );

    const task = result.rows[0];

    // Invalidate project cache
    await appCache.invalidateProjectCache(projectId);

    // Log activity
    const activity = {
      type: 'task_created',
      user: {
        id: req.user.id,
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      action: `created task "${task.title}"`,
      taskId: task.id,
      timestamp: new Date()
    };
    await appCache.addRecentActivity(projectId, activity);

    // Get assignee info for response
    let assigneeInfo = null;
    if (assignedTo) {
      const assigneeResult = await query(
        'SELECT username, first_name, last_name, avatar FROM users WHERE id = $1',
        [assignedTo]
      );
      if (assigneeResult.rows.length > 0) {
        const assignee = assigneeResult.rows[0];
        assigneeInfo = {
          id: assignedTo,
          username: assignee.username,
          firstName: assignee.first_name,
          lastName: assignee.last_name,
          avatar: assignee.avatar
        };
      }
    }

    res.status(201).json({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      assignee: assigneeInfo,
      creator: {
        id: req.user.id,
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      }
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error creating task' });
  }
});

// PUT /api/tasks/:taskId - Update a task
router.put('/:taskId', requireTaskAccess(), async (req, res) => {
  try {
    // Validate request body
    const { error, value } = updateTaskSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const taskId = req.params.taskId;
    
    // Check if user can edit this task
    if (!req.taskContext.isTaskCreator && !req.taskContext.isProjectCreator && 
        req.taskContext.projectRole !== 'admin' && !req.taskContext.isTaskAssignee) {
      return res.status(403).json({ message: 'You do not have permission to edit this task' });
    }

    const updates = {};
    const queryParams = [];
    let paramCount = 0;

    // Build dynamic update query
    for (const [key, val] of Object.entries(value)) {
      // Handle status change to 'done'
      if (key === 'status' && val === 'done') {
        paramCount++;
        updates['completed_at'] = 'CURRENT_TIMESTAMP';
        queryParams.push('CURRENT_TIMESTAMP');
      } else if (key === 'status' && val !== 'done') {
        // Reset completed_at if status changed from 'done' to something else
        paramCount++;
        updates['completed_at'] = null;
        queryParams.push(null);
      }
      
      paramCount++;
      updates[key] = val;
      queryParams.push(val);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Handle assignee validation
    if ('assignedTo' in value && value.assignedTo) {
      const assigneeResult = await query(
        `SELECT pm.user_id 
         FROM project_members pm 
         WHERE pm.project_id = $1 AND pm.user_id = $2
         UNION
         SELECT p.created_by as user_id 
         FROM projects p 
         WHERE p.id = $1 AND p.created_by = $2`,
        [req.taskContext.projectId, value.assignedTo]
      );

      if (assigneeResult.rows.length === 0) {
        return res.status(400).json({ message: 'Assigned user is not a member of this project' });
      }
    }

    let setClause;
    if (updates.completed_at === 'CURRENT_TIMESTAMP') {
      setClause = Object.keys(updates).map((key, index) => {
        if (key === 'completed_at') {
          return `${key} = CURRENT_TIMESTAMP`;
        }
        return `${key} = $${index + 1}`;
      }).join(', ');
      // Remove the CURRENT_TIMESTAMP from queryParams since we handle it directly in SQL
      queryParams = queryParams.filter(param => param !== 'CURRENT_TIMESTAMP');
    } else {
      setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`).join(', ');
    }

    queryParams.push(taskId);

    const updateQuery = `
      UPDATE tasks 
      SET ${setClause}
      WHERE id = $${queryParams.length}
      RETURNING *
    `;

    const result = await query(updateQuery, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const updatedTask = result.rows[0];

    // Invalidate project cache
    await appCache.invalidateProjectCache(req.taskContext.projectId);

    // Log activity
    const activity = {
      type: 'task_updated',
      user: {
        id: req.user.id,
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      action: `updated task "${updatedTask.title}"`,
      taskId: updatedTask.id,
      changes: Object.keys(updates),
      timestamp: new Date()
    };
    await appCache.addRecentActivity(req.taskContext.projectId, activity);

    res.json({
      id: updatedTask.id,
      title: updatedTask.title,
      description: updatedTask.description,
      status: updatedTask.status,
      priority: updatedTask.priority,
      deadline: updatedTask.deadline,
      createdAt: updatedTask.created_at,
      updatedAt: updatedTask.updated_at,
      completedAt: updatedTask.completed_at
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error updating task' });
  }
});

// POST /api/tasks/:taskId/comments - Add a comment to a task
router.post('/:taskId/comments', requireTaskAccess(), async (req, res) => {
  try {
    const { error, value } = commentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { content } = value;
    const taskId = req.params.taskId;
    const userId = req.user.id;

    const result = await query(
      'INSERT INTO task_comments (task_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
      [taskId, userId, content]
    );

    const comment = result.rows[0];

    // Log activity
    const activity = {
      type: 'task_comment',
      user: {
        id: req.user.id,
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      action: 'added a comment to a task',
      taskId: taskId,
      timestamp: new Date()
    };
    await appCache.addRecentActivity(req.taskContext.projectId, activity);

    res.status(201).json({
      id: comment.id,
      content: comment.content,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      author: {
        id: req.user.id,
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        avatar: req.user.avatar
      }
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error adding comment' });
  }
});

// DELETE /api/tasks/:taskId - Delete a task
router.delete('/:taskId', requireTaskAccess(), async (req, res) => {
  try {
    const taskId = req.params.taskId;

    // Check if user can delete this task
    if (!req.taskContext.isTaskCreator && !req.taskContext.isProjectCreator && 
        req.taskContext.projectRole !== 'admin') {
      return res.status(403).json({ message: 'You do not have permission to delete this task' });
    }

    // Get task title for logging
    const taskResult = await query('SELECT title FROM tasks WHERE id = $1', [taskId]);
    const taskTitle = taskResult.rows[0]?.title || 'Unknown Task';

    const result = await query('DELETE FROM tasks WHERE id = $1', [taskId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Invalidate project cache
    await appCache.invalidateProjectCache(req.taskContext.projectId);

    // Log activity
    const activity = {
      type: 'task_deleted',
      user: {
        id: req.user.id,
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      action: `deleted task "${taskTitle}"`,
      timestamp: new Date()
    };
    await appCache.addRecentActivity(req.taskContext.projectId, activity);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Server error deleting task' });
  }
});

module.exports = router;
