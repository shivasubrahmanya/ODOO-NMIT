import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Project, Task, Comment, ProjectMember, CreateTaskData, UpdateTaskStatusData, AddMemberData, CreateCommentData } from '../types';
import apiService from '../services/api';
import './ProjectPage.css';

const ProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const projectId = parseInt(id || '0');

  // State management
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal states
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);

  // Form states
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newTask, setNewTask] = useState<CreateTaskData>({
    title: '',
    description: '',
    assignee_id: undefined,
    due_date: undefined
  });
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (projectId) {
      loadProjectData();
    }
  }, [projectId]);

  const loadProjectData = async () => {
    try {
      setLoading(true);
      const [projectData, tasksData, commentsData] = await Promise.all([
        apiService.getProject(projectId),
        apiService.getProjectTasks(projectId),
        apiService.getComments(projectId)
      ]);
      
      setProject(projectData);
      setTasks(tasksData);
      setComments(commentsData);
    } catch (err) {
      setError('Failed to load project data');
      console.error('Error loading project:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const memberData: AddMemberData = {
        email: newMemberEmail,
        role: 'member'
      };
      await apiService.addProjectMember(projectId, memberData);
      setNewMemberEmail('');
      setShowAddMemberModal(false);
      await loadProjectData(); // Reload to get updated member list
    } catch (err) {
      setError('Failed to add member');
      console.error('Error adding member:', err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiService.createTask(projectId, newTask);
      setNewTask({
        title: '',
        description: '',
        assignee_id: undefined,
        due_date: undefined
      });
      setShowCreateTaskModal(false);
      await loadProjectData(); // Reload to get updated task list
    } catch (err) {
      setError('Failed to create task');
      console.error('Error creating task:', err);
    }
  };

  const handleUpdateTaskStatus = async (taskId: number, newStatus: 'todo' | 'in_progress' | 'done') => {
    try {
      const statusData: UpdateTaskStatusData = { status: newStatus };
      await apiService.updateTaskStatus(taskId, statusData);
      await loadProjectData(); // Reload to get updated task list
    } catch (err: any) {
      if (err.message.includes('Only the assigned user')) {
        setError('Only the assigned user can update this task status');
      } else {
        setError('Failed to update task status');
      }
      console.error('Error updating task status:', err);
    }
  };

  const canUpdateTaskStatus = (task: Task) => {
    return task.assignee_id === user?.id;
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const commentData: CreateCommentData = {
        content: newComment
      };
      await apiService.createComment(commentData, projectId);
      setNewComment('');
      await loadProjectData(); // Reload to get updated comments
    } catch (err) {
      setError('Failed to add comment');
      console.error('Error adding comment:', err);
    }
  };

  const getTasksByStatus = (status: 'todo' | 'in_progress' | 'done') => {
    return tasks.filter(task => task.status === status);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isProjectOwner = () => {
    return project?.owner_id === user?.id;
  };

  if (loading) {
    return (
      <div className="project-loading">
        <div className="loading-spinner"></div>
        <p>Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="project-error">
        <h2>Project not found</h2>
        <Link to="/dashboard">← Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="project-page">
      {/* Header */}
      <header className="project-header">
        <div className="project-nav">
          <Link to="/dashboard" className="back-link">
            ← Back to Dashboard
          </Link>
        </div>
        
        <div className="project-info">
          <h1>{project.name}</h1>
          <p className="project-description">{project.description}</p>
          <div className="project-meta">
            <span>Owner: {project.owner_name}</span>
            <span>Created: {formatDate(project.created_at)}</span>
            <span>Members: {project.members?.length || 0}</span>
          </div>
        </div>

        <div className="project-actions">
          {isProjectOwner() && (
            <button 
              className="btn-primary"
              onClick={() => setShowAddMemberModal(true)}
            >
              + Add Member
            </button>
          )}
          <button 
            className="btn-primary"
            onClick={() => setShowCreateTaskModal(true)}
          >
            + New Task
          </button>
          <button 
            className="btn-secondary"
            onClick={() => setShowCommentsModal(true)}
          >
            💬 Chat ({comments.length})
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Task Board */}
      <main className="task-board">
        <div className="board-column">
          <h3>To Do ({getTasksByStatus('todo').length})</h3>
          <div className="task-list">
            {getTasksByStatus('todo').map(task => (
              <div key={task.id} className="task-card todo">
                <h4>{task.title}</h4>
                <p>{task.description}</p>
                <div className="task-meta">
                  <span>Assigned: {task.assignee_name || 'Unassigned'}</span>
                  {task.due_date && <span>Due: {formatDate(task.due_date)}</span>}
                </div>
                <div className="task-actions">
                  {canUpdateTaskStatus(task) ? (
                    <button 
                      className="btn-small btn-primary"
                      onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
                    >
                      Start
                    </button>
                  ) : (
                    <span className="task-permission-note">
                      Only {task.assignee_name} can update this task
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="board-column">
          <h3>In Progress ({getTasksByStatus('in_progress').length})</h3>
          <div className="task-list">
            {getTasksByStatus('in_progress').map(task => (
              <div key={task.id} className="task-card in-progress">
                <h4>{task.title}</h4>
                <p>{task.description}</p>
                <div className="task-meta">
                  <span>Assigned: {task.assignee_name || 'Unassigned'}</span>
                  {task.due_date && <span>Due: {formatDate(task.due_date)}</span>}
                </div>
                <div className="task-actions">
                  {canUpdateTaskStatus(task) ? (
                    <>
                      <button 
                        className="btn-small btn-secondary"
                        onClick={() => handleUpdateTaskStatus(task.id, 'todo')}
                      >
                        Back
                      </button>
                      <button 
                        className="btn-small btn-success"
                        onClick={() => handleUpdateTaskStatus(task.id, 'done')}
                      >
                        Complete
                      </button>
                    </>
                  ) : (
                    <span className="task-permission-note">
                      Only {task.assignee_name} can update this task
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="board-column">
          <h3>Done ({getTasksByStatus('done').length})</h3>
          <div className="task-list">
            {getTasksByStatus('done').map(task => (
              <div key={task.id} className="task-card done">
                <h4>{task.title}</h4>
                <p>{task.description}</p>
                <div className="task-meta">
                  <span>Assigned: {task.assignee_name || 'Unassigned'}</span>
                  {task.due_date && <span>Due: {formatDate(task.due_date)}</span>}
                  <span>Completed: {formatDate(task.updated_at)}</span>
                </div>
                <div className="task-actions">
                  {canUpdateTaskStatus(task) ? (
                    <button 
                      className="btn-small btn-secondary"
                      onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
                    >
                      Reopen
                    </button>
                  ) : (
                    <span className="task-permission-note task-completed">
                      Completed by {task.assignee_name}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add Team Member</h3>
              <button 
                className="modal-close"
                onClick={() => setShowAddMemberModal(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleAddMember} className="modal-form">
              <div className="form-group">
                <label htmlFor="member-email">Email Address</label>
                <input
                  type="email"
                  id="member-email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  required
                  placeholder="Enter team member's email"
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setShowAddMemberModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateTaskModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Create New Task</h3>
              <button 
                className="modal-close"
                onClick={() => setShowCreateTaskModal(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreateTask} className="modal-form">
              <div className="form-group">
                <label htmlFor="task-title">Task Title</label>
                <input
                  type="text"
                  id="task-title"
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({
                    ...prev,
                    title: e.target.value
                  }))}
                  required
                  placeholder="Enter task title"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="task-description">Description</label>
                <textarea
                  id="task-description"
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                  placeholder="Enter task description (optional)"
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="task-assignee">Assign To</label>
                <select
                  id="task-assignee"
                  value={newTask.assignee_id || ''}
                  onChange={(e) => setNewTask(prev => ({
                    ...prev,
                    assignee_id: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                >
                  <option value="">Unassigned</option>
                  {project.members?.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="task-due-date">Due Date</label>
                <input
                  type="date"
                  id="task-due-date"
                  value={newTask.due_date || ''}
                  onChange={(e) => setNewTask(prev => ({
                    ...prev,
                    due_date: e.target.value || undefined
                  }))}
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setShowCreateTaskModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chat/Comments Modal */}
      {showCommentsModal && (
        <div className="modal-overlay">
          <div className="modal chat-modal">
            <div className="modal-header">
              <h3>Project Chat</h3>
              <button 
                className="modal-close"
                onClick={() => setShowCommentsModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="chat-container">
              <div className="comments-list">
                {comments.length === 0 ? (
                  <p className="no-comments">No messages yet. Start the conversation!</p>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className="comment">
                      <div className="comment-header">
                        <span className="comment-author">{comment.author_name}</span>
                        <span className="comment-time">{formatDate(comment.created_at)}</span>
                      </div>
                      <div className="comment-content">{comment.content}</div>
                    </div>
                  ))
                )}
              </div>
              
              <form onSubmit={handleAddComment} className="chat-form">
                <div className="chat-input-group">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Type your message..."
                    rows={3}
                    required
                  />
                  <button type="submit" className="btn-primary">
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectPage;
