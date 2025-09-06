import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Project, CreateProjectData } from '../types';
import apiService from '../services/api';
import NotificationCenter from '../components/NotificationCenter';
import './DashboardPage.css';

const DashboardPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newProject, setNewProject] = useState<CreateProjectData>({
    name: '',
    description: ''
  });
  const [error, setError] = useState('');

  const { user, logout } = useAuth();

  useEffect(() => {
    loadProjects();
    loadUnreadCount();
    
    // Refresh unread count every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectsData = await apiService.getProjects();
      setProjects(projectsData);
    } catch (err) {
      setError('Failed to load projects');
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (err) {
      console.error('Error loading unread count:', err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const createdProject = await apiService.createProject(newProject);
      setProjects(prev => [createdProject, ...prev]);
      setShowCreateModal(false);
      setNewProject({ name: '', description: '' });
    } catch (err) {
      setError('Failed to create project');
      console.error('Error creating project:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getProjectMemberCount = (project: Project) => {
    return project.members?.length || 0;
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your projects...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1>SynergySphere</h1>
            <p>Welcome back, {user?.name}!</p>
          </div>
          <div className="header-right">
            <div className="notification-bell" onClick={() => setShowNotifications(true)}>
              🔔
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </div>
            <button 
              className="btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              + New Project
            </button>
            <button 
              className="btn-secondary"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        <div className="dashboard-content">
          <div className="section-header">
            <h2>Your Projects</h2>
            <p>{projects.length} projects</p>
          </div>

          {projects.length === 0 ? (
            <div className="empty-state">
              <h3>No projects yet</h3>
              <p>Create your first project to get started with team collaboration.</p>
              <button 
                className="btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                Create Your First Project
              </button>
            </div>
          ) : (
            <div className="projects-grid">
              {projects.map(project => (
                <Link 
                  key={project.id} 
                  to={`/project/${project.id}`} 
                  className="project-card"
                >
                  <div className="project-header">
                    <h3>{project.name}</h3>
                    <span className="member-count">
                      {getProjectMemberCount(project)} members
                    </span>
                  </div>
                  <p className="project-description">
                    {project.description || 'No description'}
                  </p>
                  <div className="project-footer">
                    <span className="project-owner">
                      Owner: {project.owner_name}
                    </span>
                    <span className="project-date">
                      Created {formatDate(project.created_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Create New Project</h3>
              <button 
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreateProject} className="modal-form">
              <div className="form-group">
                <label htmlFor="project-name">Project Name</label>
                <input
                  type="text"
                  id="project-name"
                  value={newProject.name}
                  onChange={(e) => setNewProject(prev => ({
                    ...prev,
                    name: e.target.value
                  }))}
                  required
                  placeholder="Enter project name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="project-description">Description</label>
                <textarea
                  id="project-description"
                  value={newProject.description}
                  onChange={(e) => setNewProject(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                  placeholder="Enter project description (optional)"
                  rows={4}
                />
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notification Center */}
      <NotificationCenter 
        isOpen={showNotifications} 
        onClose={() => {
          setShowNotifications(false);
          loadUnreadCount(); // Refresh count when closing
        }} 
      />
    </div>
  );
};

export default DashboardPage;
