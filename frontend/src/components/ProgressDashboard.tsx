import React, { useState, useEffect } from 'react';
import { Project, Task } from '../types';
import apiService from '../services/api';
import './ProgressDashboard.css';

interface ProjectProgress {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  todo_tasks: number;
  completion_percentage: number;
}

interface ProgressDashboardProps {
  projectId: number;
  project: Project;
  tasks: Task[];
}

const ProgressDashboard: React.FC<ProgressDashboardProps> = ({ projectId, project, tasks }) => {
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, [projectId, tasks]);

  const loadProgress = async () => {
    try {
      setLoading(true);
      const progressData = await apiService.getProjectProgress(projectId);
      setProgress(progressData);
    } catch (err) {
      console.error('Error loading progress:', err);
      // Calculate progress from tasks if API fails
      calculateProgressFromTasks();
    } finally {
      setLoading(false);
    }
  };

  const calculateProgressFromTasks = () => {
    const total = tasks.length;
    const completed = tasks.filter(task => task.status === 'done').length;
    const inProgress = tasks.filter(task => task.status === 'in_progress').length;
    const todo = tasks.filter(task => task.status === 'todo').length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    setProgress({
      total_tasks: total,
      completed_tasks: completed,
      in_progress_tasks: inProgress,
      todo_tasks: todo,
      completion_percentage: Math.round(percentage * 100) / 100
    });
  };

  const getOverdueTasks = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return tasks.filter(task => {
      if (!task.due_date || task.status === 'done') return false;
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    });
  };

  const getUpcomingTasks = () => {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    
    return tasks.filter(task => {
      if (!task.due_date || task.status === 'done') return false;
      const dueDate = new Date(task.due_date);
      return dueDate >= today && dueDate <= nextWeek;
    });
  };

  const getTeamProductivity = () => {
    const memberStats = new Map();
    
    tasks.forEach(task => {
      const assigneeName = task.assignee_name || 'Unassigned';
      if (!memberStats.has(assigneeName)) {
        memberStats.set(assigneeName, { total: 0, completed: 0 });
      }
      const stats = memberStats.get(assigneeName);
      stats.total++;
      if (task.status === 'done') {
        stats.completed++;
      }
    });

    return Array.from(memberStats.entries()).map(([name, stats]) => ({
      name,
      total: stats.total,
      completed: stats.completed,
      percentage: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
    }));
  };

  if (loading) {
    return (
      <div className="progress-dashboard loading">
        <div className="loading-spinner"></div>
        <p>Loading progress data...</p>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="progress-dashboard error">
        <p>Unable to load progress data</p>
      </div>
    );
  }

  const overdueTasks = getOverdueTasks();
  const upcomingTasks = getUpcomingTasks();
  const teamStats = getTeamProductivity();

  return (
    <div className="progress-dashboard">
      {/* Overall Progress */}
      <div className="progress-section">
        <h3>Project Progress</h3>
        <div className="progress-cards">
          <div className="progress-card total">
            <div className="card-icon">📊</div>
            <div className="card-content">
              <h4>{progress.total_tasks}</h4>
              <p>Total Tasks</p>
            </div>
          </div>
          
          <div className="progress-card completed">
            <div className="card-icon">✅</div>
            <div className="card-content">
              <h4>{progress.completed_tasks}</h4>
              <p>Completed</p>
            </div>
          </div>
          
          <div className="progress-card in-progress">
            <div className="card-icon">🔄</div>
            <div className="card-content">
              <h4>{progress.in_progress_tasks}</h4>
              <p>In Progress</p>
            </div>
          </div>
          
          <div className="progress-card todo">
            <div className="card-icon">📝</div>
            <div className="card-content">
              <h4>{progress.todo_tasks}</h4>
              <p>To Do</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="progress-bar-container">
          <div className="progress-bar-header">
            <span>Overall Completion</span>
            <span className="percentage">{progress.completion_percentage}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progress.completion_percentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Task Status Breakdown */}
      <div className="progress-section">
        <h3>Task Breakdown</h3>
        <div className="task-breakdown">
          <div className="breakdown-chart">
            <div className="chart-container">
              <div className="pie-chart">
                <div 
                  className="pie-slice completed"
                  style={{
                    '--percentage': progress.completion_percentage,
                    '--rotation': 0
                  } as React.CSSProperties}
                ></div>
                <div 
                  className="pie-slice in-progress"
                  style={{
                    '--percentage': progress.total_tasks > 0 ? (progress.in_progress_tasks / progress.total_tasks) * 100 : 0,
                    '--rotation': progress.completion_percentage * 3.6
                  } as React.CSSProperties}
                ></div>
                <div 
                  className="pie-slice todo"
                  style={{
                    '--percentage': progress.total_tasks > 0 ? (progress.todo_tasks / progress.total_tasks) * 100 : 0,
                    '--rotation': (progress.completion_percentage + (progress.in_progress_tasks / progress.total_tasks) * 100) * 3.6
                  } as React.CSSProperties}
                ></div>
              </div>
              <div className="chart-center">
                <span className="center-percentage">{progress.completion_percentage}%</span>
                <span className="center-label">Complete</span>
              </div>
            </div>
          </div>
          
          <div className="breakdown-legend">
            <div className="legend-item">
              <div className="legend-color completed"></div>
              <span>Completed ({progress.completed_tasks})</span>
            </div>
            <div className="legend-item">
              <div className="legend-color in-progress"></div>
              <span>In Progress ({progress.in_progress_tasks})</span>
            </div>
            <div className="legend-item">
              <div className="legend-color todo"></div>
              <span>To Do ({progress.todo_tasks})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts and Warnings */}
      {(overdueTasks.length > 0 || upcomingTasks.length > 0) && (
        <div className="progress-section">
          <h3>Task Alerts</h3>
          <div className="alerts-container">
            {overdueTasks.length > 0 && (
              <div className="alert overdue">
                <div className="alert-icon">⚠️</div>
                <div className="alert-content">
                  <h4>Overdue Tasks</h4>
                  <p>{overdueTasks.length} task(s) are past their due date</p>
                  <ul>
                    {overdueTasks.slice(0, 3).map(task => (
                      <li key={task.id}>{task.title}</li>
                    ))}
                    {overdueTasks.length > 3 && <li>...and {overdueTasks.length - 3} more</li>}
                  </ul>
                </div>
              </div>
            )}
            
            {upcomingTasks.length > 0 && (
              <div className="alert upcoming">
                <div className="alert-icon">📅</div>
                <div className="alert-content">
                  <h4>Upcoming Deadlines</h4>
                  <p>{upcomingTasks.length} task(s) due in the next 7 days</p>
                  <ul>
                    {upcomingTasks.slice(0, 3).map(task => (
                      <li key={task.id}>{task.title} - Due {new Date(task.due_date!).toLocaleDateString()}</li>
                    ))}
                    {upcomingTasks.length > 3 && <li>...and {upcomingTasks.length - 3} more</li>}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Team Productivity */}
      {teamStats.length > 0 && (
        <div className="progress-section">
          <h3>Team Productivity</h3>
          <div className="team-stats">
            {teamStats.map(member => (
              <div key={member.name} className="member-stat">
                <div className="member-info">
                  <span className="member-name">{member.name}</span>
                  <span className="member-tasks">{member.completed}/{member.total} tasks</span>
                </div>
                <div className="member-progress">
                  <div className="member-progress-bar">
                    <div 
                      className="member-progress-fill"
                      style={{ width: `${member.percentage}%` }}
                    ></div>
                  </div>
                  <span className="member-percentage">{member.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressDashboard;
