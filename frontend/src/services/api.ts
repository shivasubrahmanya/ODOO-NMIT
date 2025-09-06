// API service for SynergySphere backend communication

import { 
  User, LoginResponse, Project, Task, Comment, Notification, 
  ProjectProgress, CreateProjectData, CreateTaskData, 
  UpdateTaskStatusData, AddMemberData, CreateCommentData 
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';

class ApiService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  // Authentication
  async register(name: string, email: string, password: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const result = await this.handleResponse<{ data: User }>(response);
    return result.data;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const result = await this.handleResponse<LoginResponse>(response);
    
    // Store tokens
    if (result.data) {
      localStorage.setItem('access_token', result.data.access_token);
      localStorage.setItem('user', JSON.stringify(result.user));
    }
    
    return result;
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: this.getAuthHeaders()
    });
    const result = await this.handleResponse<{ data: User }>(response);
    return result.data;
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    const response = await fetch(`${API_BASE_URL}/projects/`, {
      headers: this.getAuthHeaders()
    });
    const result = await this.handleResponse<{ data: Project[] }>(response);
    return result.data || [];
  }

  async createProject(projectData: CreateProjectData): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(projectData)
    });
    const result = await this.handleResponse<{ data: Project }>(response);
    return result.data;
  }

  async getProject(projectId: number): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
      headers: this.getAuthHeaders()
    });
    const result = await this.handleResponse<{ data: Project }>(response);
    return result.data;
  }

  async addProjectMember(projectId: number, memberData: AddMemberData): Promise<void> {
    await fetch(`${API_BASE_URL}/projects/${projectId}/members`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(memberData)
    });
  }

  async getProjectProgress(projectId: number): Promise<ProjectProgress> {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/progress`, {
      headers: this.getAuthHeaders()
    });
    const result = await this.handleResponse<{ data: ProjectProgress }>(response);
    return result.data;
  }

  // Tasks
  async getProjectTasks(projectId: number): Promise<Task[]> {
    const response = await fetch(`${API_BASE_URL}/tasks/project/${projectId}`, {
      headers: this.getAuthHeaders()
    });
    const result = await this.handleResponse<{ data: Task[] }>(response);
    return result.data || [];
  }

  async createTask(projectId: number, taskData: CreateTaskData): Promise<Task> {
    const response = await fetch(`${API_BASE_URL}/tasks/project/${projectId}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(taskData)
    });
    const result = await this.handleResponse<{ data: Task }>(response);
    return result.data;
  }

  async updateTaskStatus(taskId: number, statusData: UpdateTaskStatusData): Promise<void> {
    await fetch(`${API_BASE_URL}/tasks/${taskId}/status`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(statusData)
    });
  }

  // Comments
  async getComments(projectId?: number, taskId?: number): Promise<Comment[]> {
    const params = new URLSearchParams();
    if (projectId) params.append('project_id', projectId.toString());
    if (taskId) params.append('task_id', taskId.toString());
    
    const response = await fetch(`${API_BASE_URL}/comments/?${params}`, {
      headers: this.getAuthHeaders()
    });
    const result = await this.handleResponse<{ data: Comment[] }>(response);
    return result.data || [];
  }

  async createComment(commentData: CreateCommentData, projectId?: number, taskId?: number): Promise<void> {
    const params = new URLSearchParams();
    if (projectId) params.append('project_id', projectId.toString());
    if (taskId) params.append('task_id', taskId.toString());
    
    await fetch(`${API_BASE_URL}/comments/?${params}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(commentData)
    });
  }

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    const response = await fetch(`${API_BASE_URL}/notifications/`, {
      headers: this.getAuthHeaders()
    });
    const result = await this.handleResponse<{ data: Notification[] }>(response);
    return result.data || [];
  }

  async markNotificationsAsRead(notificationIds: number[]): Promise<void> {
    await fetch(`${API_BASE_URL}/notifications/mark-read`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ notification_ids: notificationIds })
    });
  }

  async deleteNotification(notificationId: number): Promise<void> {
    await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
  }

  // WebSocket connection
  connectWebSocket(projectId?: number): WebSocket {
    const token = localStorage.getItem('access_token');
    const wsUrl = projectId 
      ? `ws://127.0.0.1:8000/api/ws/project/${projectId}?token=${token}`
      : `ws://127.0.0.1:8000/api/ws/notifications?token=${token}`;
    
    return new WebSocket(wsUrl);
  }
}

export default new ApiService();
