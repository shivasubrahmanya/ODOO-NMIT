"""
Projects endpoints
CRUD operations and member management
"""

from fastapi import APIRouter, HTTPException, status, Depends, Path
from typing import List
import logging

from ..models import (
    ProjectCreate, ProjectResponse, ProjectListResponse, AddMemberRequest,
    Project, ProjectMember, User, ProgressResponse, ProjectProgress
)
from ..auth import get_current_active_user, check_project_access, check_project_admin
from ..database import DatabaseManager

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=ProjectListResponse)
async def get_user_projects(current_user: User = Depends(get_current_active_user)):
    """Get all projects for the current user"""
    try:
        projects_data = DatabaseManager.get_user_projects(current_user.id)
        projects = []
        
        for project_data in projects_data:
            # Get project members
            members_data = DatabaseManager.get_project_members(project_data['id'])
            members = [ProjectMember(**member) for member in members_data]
            
            project = Project(**project_data, members=members)
            projects.append(project)
        
        return ProjectListResponse(
            success=True,
            message=f"Retrieved {len(projects)} projects",
            data=projects
        )
        
    except Exception as e:
        logger.error(f"Failed to get user projects: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve projects"
        )

@router.post("/", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_active_user)
):
    """Create a new project"""
    try:
        project_id = DatabaseManager.create_project(
            name=project_data.name,
            description=project_data.description,
            owner_id=current_user.id
        )
        
        # Get created project with members
        project_info = DatabaseManager.get_project_by_id(project_id)
        members_data = DatabaseManager.get_project_members(project_id)
        members = [ProjectMember(**member) for member in members_data]
        
        project = Project(**project_info, members=members)
        
        logger.info(f"Project created: {project_data.name} by user {current_user.id}")
        return ProjectResponse(
            success=True,
            message="Project created successfully",
            data=project
        )
        
    except Exception as e:
        logger.error(f"Failed to create project: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create project"
        )

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int = Path(..., description="Project ID"),
    current_user: User = Depends(get_current_active_user)
):
    """Get project details"""
    try:
        # Check project access
        if not check_project_access(current_user.id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this project"
            )
        
        project_data = DatabaseManager.get_project_by_id(project_id)
        if not project_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found"
            )
        
        # Get project members
        members_data = DatabaseManager.get_project_members(project_id)
        members = [ProjectMember(**member) for member in members_data]
        
        project = Project(**project_data, members=members)
        
        return ProjectResponse(
            success=True,
            message="Project retrieved successfully",
            data=project
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve project"
        )

@router.post("/{project_id}/members")
async def add_project_member(
    project_id: int = Path(..., description="Project ID"),
    member_request: AddMemberRequest = ...,
    current_user: User = Depends(get_current_active_user)
):
    """Add a member to the project"""
    try:
        # Check if user is project admin
        if not check_project_admin(current_user.id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only project admins can add members"
            )
        
        # Find user by email
        user_to_add = DatabaseManager.get_user_by_email(member_request.email)
        if not user_to_add:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found with this email"
            )
        
        # Check if user is already a member
        members = DatabaseManager.get_project_members(project_id)
        if any(member['id'] == user_to_add['id'] for member in members):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this project"
            )
        
        # Add member
        DatabaseManager.add_project_member(
            project_id=project_id,
            user_id=user_to_add['id'],
            role=member_request.role
        )
        
        # Create notification for the added user
        DatabaseManager.create_notification(
            user_id=user_to_add['id'],
            project_id=project_id,
            title="Added to Project",
            body=f"You have been added to the project as {member_request.role}"
        )
        
        logger.info(f"Member added to project {project_id}: {member_request.email}")
        return {
            "success": True,
            "message": "Member added successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add member to project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add member"
        )

@router.get("/{project_id}/progress", response_model=ProgressResponse)
async def get_project_progress(
    project_id: int = Path(..., description="Project ID"),
    current_user: User = Depends(get_current_active_user)
):
    """Get project progress statistics"""
    try:
        # Check project access
        if not check_project_access(current_user.id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this project"
            )
        
        tasks = DatabaseManager.get_project_tasks(project_id)
        
        total_tasks = len(tasks)
        completed_tasks = sum(1 for task in tasks if task['status'] == 'done')
        in_progress_tasks = sum(1 for task in tasks if task['status'] == 'in_progress')
        todo_tasks = sum(1 for task in tasks if task['status'] == 'todo')
        
        completion_percentage = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        progress = ProjectProgress(
            total_tasks=total_tasks,
            completed_tasks=completed_tasks,
            in_progress_tasks=in_progress_tasks,
            todo_tasks=todo_tasks,
            completion_percentage=round(completion_percentage, 2)
        )
        
        return ProgressResponse(
            success=True,
            message="Progress retrieved successfully",
            data=progress
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get project progress {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve progress"
        )
