"""
Pydantic models for request/response validation
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, date
from enum import Enum

# Enums
class UserRole(str, Enum):
    admin = "admin"
    user = "user"

class ProjectMemberRole(str, Enum):
    owner = "owner"
    admin = "admin"
    member = "member"

class TaskStatus(str, Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"

# Base models
class BaseResponse(BaseModel):
    success: bool = True
    message: str = ""

# User models
class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole
    created_at: datetime

    class Config:
        from_attributes = True

class UserResponse(BaseResponse):
    data: Optional[User] = None

# Token models
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class TokenData(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None

class LoginResponse(BaseResponse):
    data: Optional[Token] = None
    user: Optional[User] = None

# Project models
class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None

class ProjectMember(BaseModel):
    id: int
    name: str
    email: str
    role: ProjectMemberRole
    joined_at: datetime

class Project(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    owner_id: int
    owner_name: str
    created_at: datetime
    members: Optional[List[ProjectMember]] = []

class ProjectResponse(BaseResponse):
    data: Optional[Project] = None

class ProjectListResponse(BaseResponse):
    data: Optional[List[Project]] = []

class AddMemberRequest(BaseModel):
    email: EmailStr
    role: ProjectMemberRole = ProjectMemberRole.member

# Task models
class TaskCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    due_date: Optional[date] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    due_date: Optional[date] = None
    status: Optional[TaskStatus] = None

class Task(BaseModel):
    id: int
    project_id: int
    title: str
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    due_date: Optional[date] = None
    status: TaskStatus
    created_by: int
    created_by_name: str
    created_at: datetime
    updated_at: datetime

class TaskResponse(BaseResponse):
    data: Optional[Task] = None

class TaskListResponse(BaseResponse):
    data: Optional[List[Task]] = []

# Comment models
class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)
    parent_comment_id: Optional[int] = None

class Comment(BaseModel):
    id: int
    project_id: Optional[int] = None
    task_id: Optional[int] = None
    parent_comment_id: Optional[int] = None
    author_id: int
    author_name: str
    content: str
    created_at: datetime
    replies: Optional[List['Comment']] = []

class CommentResponse(BaseResponse):
    data: Optional[Comment] = None

class CommentListResponse(BaseResponse):
    data: Optional[List[Comment]] = []

# Notification models
class Notification(BaseModel):
    id: int
    user_id: int
    project_id: Optional[int] = None
    task_id: Optional[int] = None
    title: str
    body: str
    is_read: bool
    created_at: datetime
    project_name: Optional[str] = None
    task_title: Optional[str] = None

class NotificationResponse(BaseResponse):
    data: Optional[Notification] = None

class NotificationListResponse(BaseResponse):
    data: Optional[List[Notification]] = []

class MarkNotificationRequest(BaseModel):
    notification_ids: List[int]

# WebSocket models
class WebSocketMessage(BaseModel):
    type: str
    data: dict
    room: Optional[str] = None

# Progress models
class ProjectProgress(BaseModel):
    total_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    todo_tasks: int
    completion_percentage: float

class ProgressResponse(BaseResponse):
    data: Optional[ProjectProgress] = None

# Error models
class ErrorResponse(BaseResponse):
    success: bool = False
    error: str
    details: Optional[dict] = None

# Update Comment model to handle self-referencing
Comment.model_rebuild()
