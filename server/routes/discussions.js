const express = require('express');
const { query, transaction } = require('../config/database');
const { appCache } = require('../config/redis');
const { requireProjectAccess } = require('../middleware/auth');
const Joi = require('joi');
const router = express.Router();

// Validation schemas
const createDiscussionSchema = Joi.object({
  title: Joi.string().required().min(1).max(255),
  projectId: Joi.string().uuid().required()
});

const createMessageSchema = Joi.object({
  content: Joi.string().required().min(1).max(5000),
  parentMessageId: Joi.string().uuid().optional()
});

// GET /api/discussions/project/:projectId - Get discussions for a project
router.get('/project/:projectId', requireProjectAccess(), async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const { page = 1, limit = 20 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const discussionsQuery = `
      SELECT 
        d.id, d.title, d.created_at, d.updated_at, d.is_locked,
        creator.username as creator_username,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name,
        creator.avatar as creator_avatar,
        COUNT(DISTINCT dm.id) as message_count,
        MAX(dm.created_at) as last_message_at
      FROM discussions d
      LEFT JOIN users creator ON d.created_by = creator.id
      LEFT JOIN discussion_messages dm ON d.id = dm.discussion_id
      WHERE d.project_id = $1
      GROUP BY d.id, d.title, d.created_at, d.updated_at, d.is_locked,
               creator.username, creator.first_name, creator.last_name, creator.avatar
      ORDER BY COALESCE(MAX(dm.created_at), d.created_at) DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(discussionsQuery, [projectId, limit, offset]);

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) as total FROM discussions WHERE project_id = $1',
      [projectId]
    );

    const discussions = result.rows.map(discussion => ({
      id: discussion.id,
      title: discussion.title,
      createdAt: discussion.created_at,
      updatedAt: discussion.updated_at,
      isLocked: discussion.is_locked,
      creator: {
        username: discussion.creator_username,
        firstName: discussion.creator_first_name,
        lastName: discussion.creator_last_name,
        avatar: discussion.creator_avatar
      },
      messageCount: parseInt(discussion.message_count),
      lastMessageAt: discussion.last_message_at
    }));

    res.json({
      discussions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get discussions error:', error);
    res.status(500).json({ message: 'Server error retrieving discussions' });
  }
});

// GET /api/discussions/:discussionId - Get a specific discussion with messages
router.get('/:discussionId', async (req, res) => {
  try {
    const discussionId = req.params.discussionId;

    // Get discussion info
    const discussionResult = await query(`
      SELECT 
        d.*, p.id as project_id,
        creator.username as creator_username,
        creator.first_name as creator_first_name,
        creator.last_name as creator_last_name,
        creator.avatar as creator_avatar
      FROM discussions d
      JOIN projects p ON d.project_id = p.id
      JOIN users creator ON d.created_by = creator.id
      WHERE d.id = $1
    `, [discussionId]);

    if (discussionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Discussion not found' });
    }

    const discussion = discussionResult.rows[0];

    // Check if user has access to the project
    const accessResult = await query(
      `SELECT pm.user_id FROM project_members pm WHERE pm.project_id = $1 AND pm.user_id = $2
       UNION
       SELECT p.created_by as user_id FROM projects p WHERE p.id = $1 AND p.created_by = $2`,
      [discussion.project_id, req.user.id]
    );

    if (accessResult.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied to this discussion' });
    }

    // Get messages with threading
    const messagesQuery = `
      SELECT 
        dm.*,
        author.username as author_username,
        author.first_name as author_first_name,
        author.last_name as author_last_name,
        author.avatar as author_avatar,
        COUNT(reactions.id) as reaction_count
      FROM discussion_messages dm
      LEFT JOIN users author ON dm.user_id = author.id
      LEFT JOIN message_reactions reactions ON dm.id = reactions.message_id
      WHERE dm.discussion_id = $1
      GROUP BY dm.id, author.username, author.first_name, author.last_name, author.avatar
      ORDER BY dm.created_at ASC
    `;

    const messagesResult = await query(messagesQuery, [discussionId]);

    // Build message tree
    const messages = messagesResult.rows.map(message => ({
      id: message.id,
      content: message.content,
      parentMessageId: message.parent_message_id,
      createdAt: message.created_at,
      updatedAt: message.updated_at,
      editedAt: message.edited_at,
      author: {
        id: message.user_id,
        username: message.author_username,
        firstName: message.author_first_name,
        lastName: message.author_last_name,
        avatar: message.author_avatar
      },
      reactionCount: parseInt(message.reaction_count),
      replies: []
    }));

    // Organize messages into threads
    const messageMap = new Map();
    const rootMessages = [];

    // First pass: create map
    messages.forEach(message => {
      messageMap.set(message.id, message);
    });

    // Second pass: organize into threads
    messages.forEach(message => {
      if (message.parentMessageId) {
        const parent = messageMap.get(message.parentMessageId);
        if (parent) {
          parent.replies.push(message);
        }
      } else {
        rootMessages.push(message);
      }
    });

    res.json({
      id: discussion.id,
      title: discussion.title,
      projectId: discussion.project_id,
      createdAt: discussion.created_at,
      updatedAt: discussion.updated_at,
      isLocked: discussion.is_locked,
      creator: {
        id: discussion.created_by,
        username: discussion.creator_username,
        firstName: discussion.creator_first_name,
        lastName: discussion.creator_last_name,
        avatar: discussion.creator_avatar
      },
      messages: rootMessages
    });
  } catch (error) {
    console.error('Get discussion error:', error);
    res.status(500).json({ message: 'Server error retrieving discussion' });
  }
});

// POST /api/discussions - Create a new discussion
router.post('/', async (req, res) => {
  try {
    const { error, value } = createDiscussionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { title, projectId } = value;
    const createdBy = req.user.id;

    // Check project access
    const accessResult = await query(
      `SELECT pm.user_id FROM project_members pm WHERE pm.project_id = $1 AND pm.user_id = $2
       UNION
       SELECT p.created_by as user_id FROM projects p WHERE p.id = $1 AND p.created_by = $2`,
      [projectId, createdBy]
    );

    if (accessResult.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied to this project' });
    }

    const result = await query(
      'INSERT INTO discussions (title, project_id, created_by) VALUES ($1, $2, $3) RETURNING *',
      [title, projectId, createdBy]
    );

    const discussion = result.rows[0];

    // Log activity
    const activity = {
      type: 'discussion_created',
      user: {
        id: req.user.id,
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      action: `started a new discussion "${title}"`,
      discussionId: discussion.id,
      timestamp: new Date()
    };
    await appCache.addRecentActivity(projectId, activity);

    res.status(201).json({
      id: discussion.id,
      title: discussion.title,
      projectId: discussion.project_id,
      createdAt: discussion.created_at,
      updatedAt: discussion.updated_at,
      isLocked: discussion.is_locked,
      creator: {
        id: req.user.id,
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      }
    });
  } catch (error) {
    console.error('Create discussion error:', error);
    res.status(500).json({ message: 'Server error creating discussion' });
  }
});

// POST /api/discussions/:discussionId/messages - Add a message to a discussion
router.post('/:discussionId/messages', async (req, res) => {
  try {
    const { error, value } = createMessageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const { content, parentMessageId } = value;
    const discussionId = req.params.discussionId;
    const userId = req.user.id;

    // Check if discussion exists and user has access
    const discussionResult = await query(`
      SELECT d.project_id, d.is_locked
      FROM discussions d
      WHERE d.id = $1
    `, [discussionId]);

    if (discussionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Discussion not found' });
    }

    const discussion = discussionResult.rows[0];

    if (discussion.is_locked) {
      return res.status(403).json({ message: 'Discussion is locked' });
    }

    // Check project access
    const accessResult = await query(
      `SELECT pm.user_id FROM project_members pm WHERE pm.project_id = $1 AND pm.user_id = $2
       UNION
       SELECT p.created_by as user_id FROM projects p WHERE p.id = $1 AND p.created_by = $2`,
      [discussion.project_id, userId]
    );

    if (accessResult.rows.length === 0) {
      return res.status(403).json({ message: 'Access denied to this discussion' });
    }

    // Validate parent message if provided
    if (parentMessageId) {
      const parentResult = await query(
        'SELECT id FROM discussion_messages WHERE id = $1 AND discussion_id = $2',
        [parentMessageId, discussionId]
      );

      if (parentResult.rows.length === 0) {
        return res.status(400).json({ message: 'Parent message not found in this discussion' });
      }
    }

    const result = await query(
      'INSERT INTO discussion_messages (discussion_id, user_id, content, parent_message_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [discussionId, userId, content, parentMessageId]
    );

    const message = result.rows[0];

    // Log activity
    const activity = {
      type: 'discussion_message',
      user: {
        id: req.user.id,
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName
      },
      action: 'posted a message in a discussion',
      discussionId: discussionId,
      timestamp: new Date()
    };
    await appCache.addRecentActivity(discussion.project_id, activity);

    res.status(201).json({
      id: message.id,
      content: message.content,
      parentMessageId: message.parent_message_id,
      createdAt: message.created_at,
      updatedAt: message.updated_at,
      author: {
        id: req.user.id,
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        avatar: req.user.avatar
      },
      replies: []
    });
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({ message: 'Server error adding message' });
  }
});

module.exports = router;
