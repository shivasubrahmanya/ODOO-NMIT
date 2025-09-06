const cron = require('cron');
const { query } = require('../config/database');
const { appCache } = require('../config/redis');

class DeadlineService {
  constructor(io) {
    this.io = io;
    this.deadlineCheckJob = null;
    this.startDeadlineMonitoring();
  }

  startDeadlineMonitoring() {
    // Run every hour to check for upcoming deadlines
    this.deadlineCheckJob = new cron.CronJob(
      '0 * * * *', // Every hour
      () => {
        this.checkUpcomingDeadlines();
        this.checkOverdueItems();
      },
      null,
      true,
      'UTC'
    );
    
    console.log('Deadline monitoring service started');
  }

  stopDeadlineMonitoring() {
    if (this.deadlineCheckJob) {
      this.deadlineCheckJob.stop();
      console.log('Deadline monitoring service stopped');
    }
  }

  async checkUpcomingDeadlines() {
    try {
      const now = new Date();
      const twentyFourHours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const fortyEightHours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      // Check for tasks with deadlines in the next 24 hours
      const upcomingTasksQuery = `
        SELECT 
          t.id, t.title, t.deadline, t.assigned_to, t.project_id,
          p.name as project_name,
          assignee.username as assignee_username,
          assignee.email as assignee_email,
          assignee.first_name as assignee_first_name,
          assignee.last_name as assignee_last_name
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        LEFT JOIN users assignee ON t.assigned_to = assignee.id
        WHERE t.status != 'done' 
        AND t.deadline BETWEEN $1 AND $2
        AND t.deadline IS NOT NULL
      `;

      const result = await query(upcomingTasksQuery, [now, twentyFourHours]);

      for (const task of result.rows) {
        await this.sendDeadlineNotification(task, 'approaching');
        
        // Also check for 48-hour notifications (less urgent)
        if (new Date(task.deadline) > fortyEightHours) {
          await this.sendDeadlineNotification(task, 'reminder');
        }
      }

      // Check for project deadlines
      const upcomingProjectsQuery = `
        SELECT 
          p.id, p.name, p.deadline, p.created_by,
          creator.username as creator_username,
          creator.email as creator_email,
          creator.first_name as creator_first_name,
          creator.last_name as creator_last_name
        FROM projects p
        JOIN users creator ON p.created_by = creator.id
        WHERE p.status = 'active' 
        AND p.deadline BETWEEN $1 AND $2
        AND p.deadline IS NOT NULL
      `;

      const projectResult = await query(upcomingProjectsQuery, [now, twentyFourHours]);

      for (const project of projectResult.rows) {
        await this.sendProjectDeadlineNotification(project, 'approaching');
      }

    } catch (error) {
      console.error('Error checking upcoming deadlines:', error);
    }
  }

  async checkOverdueItems() {
    try {
      const now = new Date();

      // Check for overdue tasks
      const overdueTasksQuery = `
        SELECT 
          t.id, t.title, t.deadline, t.assigned_to, t.project_id,
          p.name as project_name,
          assignee.username as assignee_username,
          assignee.email as assignee_email,
          assignee.first_name as assignee_first_name,
          assignee.last_name as assignee_last_name
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        LEFT JOIN users assignee ON t.assigned_to = assignee.id
        WHERE t.status != 'done' 
        AND t.deadline < $1
        AND t.deadline IS NOT NULL
      `;

      const result = await query(overdueTasksQuery, [now]);

      for (const task of result.rows) {
        // Check if we've already sent an overdue notification today
        const notificationKey = `overdue_notification:task:${task.id}:${now.toDateString()}`;
        const alreadySent = await appCache.cache.exists(notificationKey);

        if (!alreadySent) {
          await this.sendDeadlineNotification(task, 'overdue');
          // Mark as sent for today
          await appCache.cache.set(notificationKey, 'sent', 24 * 60 * 60); // 24 hours
        }
      }

      // Check for overdue projects
      const overdueProjectsQuery = `
        SELECT 
          p.id, p.name, p.deadline, p.created_by,
          creator.username as creator_username,
          creator.email as creator_email,
          creator.first_name as creator_first_name,
          creator.last_name as creator_last_name
        FROM projects p
        JOIN users creator ON p.created_by = creator.id
        WHERE p.status = 'active' 
        AND p.deadline < $1
        AND p.deadline IS NOT NULL
      `;

      const projectResult = await query(overdueProjectsQuery, [now]);

      for (const project of projectResult.rows) {
        const notificationKey = `overdue_notification:project:${project.id}:${now.toDateString()}`;
        const alreadySent = await appCache.cache.exists(notificationKey);

        if (!alreadySent) {
          await this.sendProjectDeadlineNotification(project, 'overdue');
          await appCache.cache.set(notificationKey, 'sent', 24 * 60 * 60);
        }
      }

    } catch (error) {
      console.error('Error checking overdue items:', error);
    }
  }

  async sendDeadlineNotification(task, type) {
    try {
      const { assigned_to, title, deadline, project_name, project_id } = task;
      
      if (!assigned_to) return; // Skip if no assignee

      let notificationTitle, notificationMessage, urgency;
      
      switch (type) {
        case 'approaching':
          notificationTitle = 'Task Deadline Approaching';
          notificationMessage = `Your task "${title}" in project "${project_name}" is due soon (${new Date(deadline).toLocaleDateString()})`;
          urgency = 'medium';
          break;
        case 'reminder':
          notificationTitle = 'Task Deadline Reminder';
          notificationMessage = `Reminder: Your task "${title}" in project "${project_name}" is due on ${new Date(deadline).toLocaleDateString()}`;
          urgency = 'low';
          break;
        case 'overdue':
          notificationTitle = 'Task Overdue';
          notificationMessage = `Your task "${title}" in project "${project_name}" was due on ${new Date(deadline).toLocaleDateString()} and is now overdue`;
          urgency = 'high';
          break;
        default:
          return;
      }

      // Save notification to database
      await query(
        `INSERT INTO notifications (user_id, title, message, type, related_id) 
         VALUES ($1, $2, $3, $4, $5)`,
        [assigned_to, notificationTitle, notificationMessage, 'task_deadline', task.id]
      );

      // Send real-time notification via WebSocket
      if (this.io) {
        this.io.to(`user:${assigned_to}`).emit('deadline-alert', {
          taskId: task.id,
          projectId: project_id,
          title: notificationTitle,
          message: notificationMessage,
          deadline: deadline,
          urgency: urgency,
          type: type,
          timestamp: new Date()
        });
      }

      // Update task status tracking in cache
      await this.updateTaskDeadlineStatus(task.id, type);

    } catch (error) {
      console.error('Error sending deadline notification:', error);
    }
  }

  async sendProjectDeadlineNotification(project, type) {
    try {
      const { id, name, deadline, created_by } = project;
      
      let notificationTitle, notificationMessage;
      
      switch (type) {
        case 'approaching':
          notificationTitle = 'Project Deadline Approaching';
          notificationMessage = `Your project "${name}" deadline is approaching (${new Date(deadline).toLocaleDateString()})`;
          break;
        case 'overdue':
          notificationTitle = 'Project Overdue';
          notificationMessage = `Your project "${name}" was due on ${new Date(deadline).toLocaleDateString()} and is now overdue`;
          break;
        default:
          return;
      }

      // Save notification to database
      await query(
        `INSERT INTO notifications (user_id, title, message, type, related_id) 
         VALUES ($1, $2, $3, $4, $5)`,
        [created_by, notificationTitle, notificationMessage, 'project_deadline', id]
      );

      // Send real-time notification via WebSocket
      if (this.io) {
        this.io.to(`user:${created_by}`).emit('project-deadline-alert', {
          projectId: id,
          title: notificationTitle,
          message: notificationMessage,
          deadline: deadline,
          type: type,
          timestamp: new Date()
        });

        // Also notify all project members
        this.io.to(`project:${id}`).emit('project-deadline-alert', {
          projectId: id,
          title: `Project Deadline ${type === 'approaching' ? 'Approaching' : 'Overdue'}`,
          message: notificationMessage,
          deadline: deadline,
          type: type,
          timestamp: new Date()
        });
      }

    } catch (error) {
      console.error('Error sending project deadline notification:', error);
    }
  }

  async updateTaskDeadlineStatus(taskId, status) {
    try {
      const cacheKey = `task_deadline_status:${taskId}`;
      await appCache.cache.set(cacheKey, status, 7 * 24 * 60 * 60); // 7 days
    } catch (error) {
      console.error('Error updating task deadline status:', error);
    }
  }

  async getTaskDeadlineStatus(taskId) {
    try {
      const cacheKey = `task_deadline_status:${taskId}`;
      return await appCache.cache.get(cacheKey, false);
    } catch (error) {
      console.error('Error getting task deadline status:', error);
      return null;
    }
  }

  // Manual trigger for testing purposes
  async triggerDeadlineCheck() {
    console.log('Manually triggering deadline check...');
    await this.checkUpcomingDeadlines();
    await this.checkOverdueItems();
    console.log('Manual deadline check completed');
  }

  // Get deadline statistics
  async getDeadlineStatistics() {
    try {
      const now = new Date();
      const twentyFourHours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const stats = await query(`
        SELECT 
          COUNT(CASE WHEN t.deadline < $1 AND t.status != 'done' THEN 1 END) as overdue_tasks,
          COUNT(CASE WHEN t.deadline BETWEEN $1 AND $2 AND t.status != 'done' THEN 1 END) as due_today,
          COUNT(CASE WHEN t.deadline BETWEEN $2 AND $3 AND t.status != 'done' THEN 1 END) as due_this_week,
          COUNT(CASE WHEN p.deadline < $1 AND p.status = 'active' THEN 1 END) as overdue_projects,
          COUNT(CASE WHEN p.deadline BETWEEN $1 AND $2 AND p.status = 'active' THEN 1 END) as projects_due_today
        FROM tasks t
        FULL OUTER JOIN projects p ON 1=1
        WHERE t.deadline IS NOT NULL OR p.deadline IS NOT NULL
      `, [now, twentyFourHours, sevenDays]);

      return stats.rows[0];
    } catch (error) {
      console.error('Error getting deadline statistics:', error);
      return {
        overdue_tasks: 0,
        due_today: 0,
        due_this_week: 0,
        overdue_projects: 0,
        projects_due_today: 0
      };
    }
  }
}

module.exports = DeadlineService;
