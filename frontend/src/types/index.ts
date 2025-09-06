// Type definitions for SynergySphere

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: AuthTokens;
  user: User;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  owner_name: string;
  created_at: string;
  members: ProjectMember[];
}

export interface ProjectMember {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string;
  assignee_id: number | null;
  assignee_name: string | null;
  due_date: string | null;
  status: 'todo' | 'in_progress' | 'done';
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  project_id: number | null;
  task_id: number | null;
  parent_comment_id: number | null;
  author_id: number;
  author_name: string;
  content: string;
  created_at: string;
  replies?: Comment[];
}

export interface Notification {
  id: number;
  user_id: number;
  project_id: number | null;
  task_id: number | null;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  project_name: string | null;
  task_title: string | null;
}

export interface ProjectProgress {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  todo_tasks: number;
  completion_percentage: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface CreateProjectData {
  name: string;
  description: string;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  assignee_id?: number;
  due_date?: string;
}

export interface UpdateTaskStatusData {
  status: 'todo' | 'in_progress' | 'done';
}

export interface AddMemberData {
  email: string;
  role: 'admin' | 'member';
}

export interface CreateCommentData {
  content: string;
  parent_comment_id?: number;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  room?: string;
}
