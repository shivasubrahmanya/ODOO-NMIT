const express = require('express');
const { query, transaction } = require('../config/database');
const { appCache } = require('../config/redis');
const { requireProjectAccess } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

// Validation schemas
const createProjectSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  description: Joi.string().max(2000),
  deadline: Joi.date().iso().greater('now').optional()
});

const updateProjectSchema = Joi.object({
  name: Joi.string().min(1).max(255),
  description: Joi.string().max(2000),
  status: Joi.string().valid('active', 'completed', 'archived'),
  deadline: Joi.date().iso().optional().allow(null)
});

const addMemberSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  role: Joi.string().valid('member', 'admin').default('member')
});

// GET /api/projects - Get all projects for the authenticated user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, search, page = 1, limit = 20 } = req.query;

    let whereClause = `WHERE (p.created_by = $1 OR pm.user_id = $1)`;
    let queryParams = [userId];
    let paramCount = 1;

    // Add status filter
    if (status && ['active', 'completed', 'archived'].includes(status)) {
      paramCount++;
      whereClause += ` AND p.status = $${paramCount}`;
      queryParams.push(status);
    }

    // Add search filter
    if (search) {
      paramCount++;
      whereClause += ` AND (p.name ILIKE $${paramCount} OR p.description ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const projectsQuery = `
      SELECT DISTINCT 
        p.id, p.name, p.description, p.status, p.deadline,
        p.created_at, p.updated_at,
        creator.username as creator_username,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name,
        COALESCE(pm.role, 'owner') as user_role,
        COUNT(DISTINCT t.id) as task_count,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT members.user_id) as member_count
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id
      LEFT JOIN project_members members ON p.id = members.project_id
      LEFT JOIN users creator ON p.created_by = creator.id
      LEFT JOIN tasks t ON p.id = t.project_id
      ${whereClause}
      GROUP BY p.id, p.name, p.description, p.status, p.deadline, 
               p.created_at, p.updated_at, creator.username, 
               creator.first_name, creator.last_name, pm.role
      ORDER BY p.updated_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);

    const result = await query(projectsQuery, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id
      ${whereClause}
    `;

    const countResult = await query(countQuery, queryParams.slice(0, -2)); // Remove limit and offset

    const projects = result.rows.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      deadline: project.deadline,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      creator: {
        username: project.creator_username,
        firstName: project.creator_first_name,
        lastName: project.creator_last_name
      },
      userRole: project.user_role,
      stats: {
        taskCount: parseInt(project.task_count),
        completedTasks: parseInt(project.completed_tasks),
        memberCount: parseInt(project.member_count),
        progress: project.task_count > 0 
          ? Math.round((project.completed_tasks / project.task_count) * 100) 
          : 0
      }
    }));

    res.json({
      projects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ message: 'Server error retrieving projects' });
  }
});

// GET /api/projects/:projectId - Get a specific project
router.get('/:projectId', requireProjectAccess(), async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Try to get from cache first
    const cachedProject = await appCache.getProjectData(projectId);
    if (cachedProject) {
      return res.json(cachedProject);
    }

    const projectQuery = `
      SELECT 
        p.*,
        creator.username as creator_username,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name,
        creator.avatar as creator_avatar,
        COUNT(DISTINCT t.id) as task_count,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'todo' THEN t.id END) as todo_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'in-progress' THEN t.id END) as inprogress_tasks,
        COUNT(DISTINCT pm.user_id) as member_count,
        COUNT(DISTINCT d.id) as discussion_count
      FROM projects p
      LEFT JOIN users creator ON p.created_by = creator.id
      LEFT JOIN tasks t ON p.id = t.project_id
      LEFT JOIN project_members pm ON p.id = pm.project_id
      LEFT JOIN discussions d ON p.id = d.project_id
      WHERE p.id = $1
      GROUP BY p.id, creator.username, creator.first_name, creator.last_name, creator.avatar
    `;

    const result = await query(projectQuery, [projectId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const project = result.rows[0];

    // Get project members
    const membersQuery = `
      SELECT 
        u.id, u.username, u.first_name, u.last_name, u.avatar,
        pm.role, pm.joined_at
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = $1
      ORDER BY pm.joined_at ASC
    `;

    const membersResult = await query(membersQuery, [projectId]);

    // Get recent activity
    const recentActivity = await appCache.getRecentActivities(projectId, 10);

    const projectData = {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      deadline: project.deadline,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      creator: {
        username: project.creator_username,
        firstName: project.creator_first_name,
        lastName: project.creator_last_name,
        avatar: project.creator_avatar
      },
      members: membersResult.rows.map(member => ({
        id: member.id,
        username: member.username,
        firstName: member.first_name,
        lastName: member.last_name,
        avatar: member.avatar,
        role: member.role,
        joinedAt: member.joined_at
      })),
      stats: {
        taskCount: parseInt(project.task_count),
        completedTasks: parseInt(project.completed_tasks),
        todoTasks: parseInt(project.todo_tasks),
        inProgressTasks: parseInt(project.inprogress_tasks),
        memberCount: parseInt(project.member_count),
        discussionCount: parseInt(project.discussion_count),
        progress: project.task_count > 0 
          ? Math.round((project.completed_tasks / project.task_count) * 100) 
          : 0
      },
      recentActivity,
      userRole: req.projectRole,
      isCreator: req.isProjectCreator
    };

    // Cache the project data
    await appCache.setProjectData(projectId, projectData, 15); // 15 minutes

    res.json(projectData);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ message: 'Server error retrieving project' });
  }
});

// POST /api/projects - Create a new project
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = createProjectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { name, description, deadline } = value;
    const createdBy = req.user.id;

    const result = await transaction(async (client) => {
      // Create the project
      const projectResult = await client.query(
        'INSERT INTO projects (name, description, deadline, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, description, deadline, createdBy]
      );

      const project = projectResult.rows[0];

      // Add the creator as a member with 'owner' role
      await client.query(
        'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
        [project.id, createdBy, 'owner']
      );

      return project;
    });

    // Log activity
    const activity = {
      type: 'project_created',
      user: {
        id: req.user.id,
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      action: 'created the project',
      timestamp: new Date()
    };
    await appCache.addRecentActivity(result.id, activity);

    res.status(201).json({
      id: result.id,
      name: result.name,
      description: result.description,
      status: result.status,
      deadline: result.deadline,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      creator: {
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      userRole: 'owner',
      isCreator: true
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ message: 'Server error creating project' });
  }
});

// PUT /api/projects/:projectId - Update a project
router.put('/:projectId', requireProjectAccess('admin'), async (req, res) => {
  try {
    // Validate request body
    const { error, value } = updateProjectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const projectId = req.params.projectId;
    const updates = {};
    const queryParams = [];
    let paramCount = 0;

    // Build dynamic update query
    for (const [key, val] of Object.entries(value)) {
      paramCount++;
      updates[key] = val;
      queryParams.push(val);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const setClause = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`).join(', ');
    queryParams.push(projectId);

    const updateQuery = `
      UPDATE projects 
      SET ${setClause}
      WHERE id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await query(updateQuery, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const updatedProject = result.rows[0];

    // Invalidate cache
    await appCache.invalidateProjectCache(projectId);

    // Log activity
    const activity = {
      type: 'project_updated',
      user: {
        id: req.user.id,
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      action: 'updated the project',
      changes: Object.keys(updates),
      timestamp: new Date()
    };
    await appCache.addRecentActivity(projectId, activity);

    res.json({
      id: updatedProject.id,
      name: updatedProject.name,
      description: updatedProject.description,
      status: updatedProject.status,
      deadline: updatedProject.deadline,
      createdAt: updatedProject.created_at,
      updatedAt: updatedProject.updated_at
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ message: 'Server error updating project' });
  }
});

// POST /api/projects/:projectId/members - Add a member to the project
router.post('/:projectId/members', requireProjectAccess('admin'), async (req, res) => {
  try {
    const { error, value } = addMemberSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { userId, role } = value;
    const projectId = req.params.projectId;

    // Check if user exists
    const userResult = await query(
      'SELECT id, username, first_name, last_name, avatar FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check if user is already a member
    const existingMember = await query(
      'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (existingMember.rows.length > 0) {
      return res.status(409).json({ message: 'User is already a member of this project' });
    }

    // Add the member
    await query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [projectId, userId, role]
    );

    // Invalidate project cache
    await appCache.invalidateProjectCache(projectId);

    // Log activity
    const activity = {
      type: 'member_added',
      user: {
        id: req.user.id,
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      action: `added ${user.first_name} ${user.last_name} to the project`,
      targetUser: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name
      },
      timestamp: new Date()
    };
    await appCache.addRecentActivity(projectId, activity);

    res.status(201).json({
      id: user.id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      avatar: user.avatar,
      role,
      joinedAt: new Date()
    });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ message: 'Server error adding member' });
  }
});

// DELETE /api/projects/:projectId/members/:userId - Remove a member from the project
router.delete('/:projectId/members/:userId', requireProjectAccess('admin'), async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.params.userId;

    // Prevent removing the project creator
    if (req.isProjectCreator && userId === req.user.id) {
      return res.status(400).json({ message: 'Project creator cannot be removed from the project' });
    }

    // Get user info before deletion
    const userResult = await query(
      `SELECT u.first_name, u.last_name, u.username 
       FROM users u 
       JOIN project_members pm ON u.id = pm.user_id 
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [projectId, userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Member not found in this project' });
    }

    const user = userResult.rows[0];

    // Remove the member
    const deleteResult = await query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Invalidate project cache
    await appCache.invalidateProjectCache(projectId);

    // Log activity
    const activity = {
      type: 'member_removed',
      user: {
        id: req.user.id,
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      action: `removed ${user.first_name} ${user.last_name} from the project`,
      targetUser: {
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name
      },
      timestamp: new Date()
    };
    await appCache.addRecentActivity(projectId, activity);

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ message: 'Server error removing member' });
  }
});

// DELETE /api/projects/:projectId - Delete a project
router.delete('/:projectId', requireProjectAccess('owner'), async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Only project creator can delete
    if (!req.isProjectCreator) {
      return res.status(403).json({ message: 'Only project creator can delete the project' });
    }

    const result = await query('DELETE FROM projects WHERE id = $1', [projectId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Clear all related cache
    await appCache.invalidateProjectCache(projectId);
    await appCache.cache.del(`activity:${projectId}`);
    await appCache.cache.del(`counters:${projectId}`);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ message: 'Server error deleting project' });
  }
});

module.exports = router;
