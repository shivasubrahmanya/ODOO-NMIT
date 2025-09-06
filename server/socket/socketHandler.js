const { appCache } = require('../config/redis');
const { query } = require('../config/database');

const initializeSocket = (io) => {
  // Store connected users
  const connectedUsers = new Map();

  io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected with socket ${socket.id}`);

    // Add user to connected users
    connectedUsers.set(socket.userId, {
      socketId: socket.id,
      connectedAt: new Date()
    });

    // Update user online status
    appCache.setUserOnline(socket.userId, socket.id);

    // Join user to their personal room
    socket.join(`user:${socket.userId}`);

    // Handle joining project rooms
    socket.on('join-project', async (projectId) => {
      try {
        // Verify user has access to the project
        const accessResult = await query(
          `SELECT pm.user_id FROM project_members pm WHERE pm.project_id = $1 AND pm.user_id = $2
           UNION
           SELECT p.created_by as user_id FROM projects p WHERE p.id = $1 AND p.created_by = $2`,
          [projectId, socket.userId]
        );

        if (accessResult.rows.length > 0) {
          socket.join(`project:${projectId}`);
          socket.emit('project-joined', { projectId });
          
          // Notify other project members that user is online
          socket.to(`project:${projectId}`).emit('user-online', {
            userId: socket.userId,
            socketId: socket.id
          });
        } else {
          socket.emit('error', { message: 'Access denied to project' });
        }
      } catch (error) {
        console.error('Error joining project room:', error);
        socket.emit('error', { message: 'Failed to join project' });
      }
    });

    // Handle leaving project rooms
    socket.on('leave-project', (projectId) => {
      socket.leave(`project:${projectId}`);
      socket.emit('project-left', { projectId });
      
      // Notify other project members
      socket.to(`project:${projectId}`).emit('user-offline', {
        userId: socket.userId
      });
    });

    // Handle task status updates
    socket.on('task-updated', async (data) => {
      try {
        const { taskId, projectId, changes } = data;

        // Verify user has access to the task
        const taskResult = await query(
          `SELECT t.project_id FROM tasks t
           JOIN projects p ON t.project_id = p.id
           LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
           WHERE t.id = $1 AND (
             t.assigned_to = $2 OR 
             t.created_by = $2 OR 
             p.created_by = $2 OR 
             pm.user_id = $2
           )`,
          [taskId, socket.userId]
        );

        if (taskResult.rows.length > 0) {
          // Broadcast task update to project members
          socket.to(`project:${projectId}`).emit('task-status-changed', {
            taskId,
            projectId,
            changes,
            updatedBy: socket.userId,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Error handling task update:', error);
        socket.emit('error', { message: 'Failed to broadcast task update' });
      }
    });

    // Handle new task creation
    socket.on('task-created', async (data) => {
      try {
        const { task, projectId } = data;

        // Verify user has access to the project
        const projectResult = await query(
          `SELECT pm.user_id FROM project_members pm WHERE pm.project_id = $1 AND pm.user_id = $2
           UNION
           SELECT p.created_by as user_id FROM projects p WHERE p.id = $1 AND p.created_by = $2`,
          [projectId, socket.userId]
        );

        if (projectResult.rows.length > 0) {
          // Broadcast new task to project members
          socket.to(`project:${projectId}`).emit('new-task', {
            task,
            projectId,
            createdBy: socket.userId,
            timestamp: new Date()
          });

          // If task is assigned to someone, send them a notification
          if (task.assignedTo && task.assignedTo !== socket.userId) {
            socket.to(`user:${task.assignedTo}`).emit('task-assigned', {
              task,
              projectId,
              assignedBy: socket.userId,
              timestamp: new Date()
            });
          }
        }
      } catch (error) {
        console.error('Error handling new task:', error);
        socket.emit('error', { message: 'Failed to broadcast new task' });
      }
    });

    // Handle discussion messages
    socket.on('new-message', async (data) => {
      try {
        const { message, discussionId, projectId } = data;

        // Verify user has access to the project
        const accessResult = await query(
          `SELECT pm.user_id FROM project_members pm WHERE pm.project_id = $1 AND pm.user_id = $2
           UNION
           SELECT p.created_by as user_id FROM projects p WHERE p.id = $1 AND p.created_by = $2`,
          [projectId, socket.userId]
        );

        if (accessResult.rows.length > 0) {
          // Broadcast message to project members
          socket.to(`project:${projectId}`).emit('discussion-message', {
            message,
            discussionId,
            projectId,
            author: socket.userId,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Error handling new message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing-start', (data) => {
      const { projectId, discussionId } = data;
      socket.to(`project:${projectId}`).emit('user-typing', {
        userId: socket.userId,
        discussionId,
        isTyping: true
      });
    });

    socket.on('typing-stop', (data) => {
      const { projectId, discussionId } = data;
      socket.to(`project:${projectId}`).emit('user-typing', {
        userId: socket.userId,
        discussionId,
        isTyping: false
      });
    });

    // Handle project updates
    socket.on('project-updated', async (data) => {
      try {
        const { project, changes } = data;

        // Verify user is project creator or admin
        const accessResult = await query(
          `SELECT p.created_by, pm.role FROM projects p
           LEFT JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $2
           WHERE p.id = $1 AND (p.created_by = $2 OR pm.role IN ('admin', 'owner'))`,
          [project.id, socket.userId]
        );

        if (accessResult.rows.length > 0) {
          // Broadcast project update to all members
          socket.to(`project:${project.id}`).emit('project-changed', {
            project,
            changes,
            updatedBy: socket.userId,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Error handling project update:', error);
        socket.emit('error', { message: 'Failed to broadcast project update' });
      }
    });

    // Handle member addition to projects
    socket.on('member-added', async (data) => {
      try {
        const { projectId, newMember } = data;

        // Notify the new member they've been added
        socket.to(`user:${newMember.id}`).emit('added-to-project', {
          projectId,
          addedBy: socket.userId,
          timestamp: new Date()
        });

        // Notify existing project members
        socket.to(`project:${projectId}`).emit('new-member', {
          member: newMember,
          projectId,
          addedBy: socket.userId,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Error handling member addition:', error);
        socket.emit('error', { message: 'Failed to notify about new member' });
      }
    });

    // Handle notifications
    socket.on('send-notification', async (data) => {
      try {
        const { recipientId, notification } = data;

        // Send notification to specific user
        socket.to(`user:${recipientId}`).emit('notification', {
          ...notification,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Error sending notification:', error);
        socket.emit('error', { message: 'Failed to send notification' });
      }
    });

    // Handle deadline reminders
    socket.on('deadline-reminder', async (data) => {
      try {
        const { taskId, projectId, assigneeId, deadline } = data;

        if (assigneeId) {
          socket.to(`user:${assigneeId}`).emit('deadline-alert', {
            taskId,
            projectId,
            deadline,
            type: 'approaching',
            timestamp: new Date()
          });
        }

        // Also notify project members
        socket.to(`project:${projectId}`).emit('project-deadline-alert', {
          taskId,
          deadline,
          assigneeId,
          type: 'approaching',
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Error handling deadline reminder:', error);
      }
    });

    // Handle presence updates
    socket.on('update-presence', (data) => {
      const { status } = data; // 'active', 'away', 'busy', 'offline'
      
      // Update user presence in cache
      appCache.cache.set(`presence:${socket.userId}`, status, 300); // 5 minutes

      // Get all projects the user is part of and broadcast presence
      query(
        `SELECT DISTINCT project_id FROM project_members WHERE user_id = $1
         UNION
         SELECT DISTINCT id as project_id FROM projects WHERE created_by = $1`,
        [socket.userId]
      ).then((result) => {
        result.rows.forEach((row) => {
          socket.to(`project:${row.project_id}`).emit('user-presence-changed', {
            userId: socket.userId,
            status,
            timestamp: new Date()
          });
        });
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected`);

      // Remove from connected users
      connectedUsers.delete(socket.userId);

      // Update offline status
      appCache.setUserOffline(socket.userId);

      // Notify all project rooms about user going offline
      query(
        `SELECT DISTINCT project_id FROM project_members WHERE user_id = $1
         UNION
         SELECT DISTINCT id as project_id FROM projects WHERE created_by = $1`,
        [socket.userId]
      ).then((result) => {
        result.rows.forEach((row) => {
          socket.to(`project:${row.project_id}`).emit('user-offline', {
            userId: socket.userId,
            timestamp: new Date()
          });
        });
      }).catch((error) => {
        console.error('Error notifying about user disconnect:', error);
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  // Broadcast server-wide notifications
  const broadcastNotification = (notification) => {
    io.emit('server-notification', {
      ...notification,
      timestamp: new Date()
    });
  };

  // Broadcast to specific project
  const broadcastToProject = (projectId, event, data) => {
    io.to(`project:${projectId}`).emit(event, {
      ...data,
      timestamp: new Date()
    });
  };

  // Broadcast to specific user
  const broadcastToUser = (userId, event, data) => {
    io.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date()
    });
  };

  // Get online users count
  const getOnlineUsersCount = () => {
    return connectedUsers.size;
  };

  // Get users in project
  const getUsersInProject = async (projectId) => {
    const sockets = await io.in(`project:${projectId}`).fetchSockets();
    return sockets.map(socket => socket.userId);
  };

  return {
    broadcastNotification,
    broadcastToProject,
    broadcastToUser,
    getOnlineUsersCount,
    getUsersInProject
  };
};

module.exports = {
  initializeSocket
};
