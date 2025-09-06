"""
Tasks endpoints
CRUD operations for task management
"""

from fastapi import APIRouter, HTTPException, status, Depends, Path
import logging

from ..models import (
    TaskCreate, TaskUpdate, TaskResponse, TaskListResponse, Task, User
)
from ..auth import get_current_active_user, check_project_access
from ..database import DatabaseManager
from ..notification_service import notification_service

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/project/{project_id}", response_model=TaskListResponse)
async def get_project_tasks(
    project_id: int = Path(..., description="Project ID"),
    current_user: User = Depends(get_current_active_user)
):
    """Get all tasks for a project"""
    try:
        if not check_project_access(current_user.id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this project"
            )
        
        tasks_data = DatabaseManager.get_project_tasks(project_id)
        tasks = [Task(**task) for task in tasks_data]
        
        return TaskListResponse(
            success=True,
            message=f"Retrieved {len(tasks)} tasks",
            data=tasks
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get tasks for project {project_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve tasks"
        )

@router.post("/project/{project_id}", response_model=TaskResponse)
async def create_task(
    project_id: int = Path(..., description="Project ID"),
    task_data: TaskCreate = ...,
    current_user: User = Depends(get_current_active_user)
):
    """Create a new task"""
    try:
        if not check_project_access(current_user.id, project_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this project"
            )
        
        task_id = DatabaseManager.create_task(
            project_id=project_id,
            title=task_data.title,
            description=task_data.description or '',
            assignee_id=task_data.assignee_id,
            due_date=task_data.due_date if task_data.due_date else None,
            created_by=current_user.id
        )
        
        # Get created task details
        created_task_data = DatabaseManager.get_task_by_id(task_id)
        task = Task(**created_task_data)
        
        # Send notifications if task is assigned
        if task_data.assignee_id:
            # Get all necessary data for notifications
            assignee_data = DatabaseManager.get_user_by_id(task_data.assignee_id)
            project_data = DatabaseManager.get_project_by_id(project_id)
            assigner_data = DatabaseManager.get_user_by_id(current_user.id)
            
            # Send comprehensive notifications
            notification_service.send_task_assignment_notifications(
                task_data=created_task_data,
                assignee_data=assignee_data,
                assigner_data=assigner_data,
                project_data=project_data
            )
        
        logger.info(f"Task '{task_data.title}' created successfully by user {current_user.id}")
        return TaskResponse(
            success=True,
            message="Task created successfully",
            data=task
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create task: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create task"
        )

@router.put("/{task_id}/status")
async def update_task_status(
    task_id: int = Path(..., description="Task ID"),
    status_update: dict = ...,
    current_user: User = Depends(get_current_active_user)
):
    """Update task status - only assignee can update"""
    try:
        new_status = status_update.get('status')
        if new_status not in ['todo', 'in_progress', 'done']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status"
            )
        
        # Get task details
        task_data = DatabaseManager.get_task_by_id(task_id)
        if not task_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found"
            )
        
        # Check permissions: only the assigned user can update task status
        if task_data['assignee_id'] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the assigned user can update task status"
            )
        
        # Update task status
        DatabaseManager.update_task_status(task_id, new_status)
        
        # Send notifications about status change
        project_data = DatabaseManager.get_project_by_id(task_data['project_id'])
        updater_data = DatabaseManager.get_user_by_id(current_user.id)
        
        notification_service.send_task_status_notifications(
            task_data=task_data,
            updater_data=updater_data,
            project_data=project_data,
            new_status=new_status
        )
        
        logger.info(f"Task {task_id} status updated to {new_status} by user {current_user.id}")
        return {
            "success": True,
            "message": "Task status updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update task status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update task status"
        )
