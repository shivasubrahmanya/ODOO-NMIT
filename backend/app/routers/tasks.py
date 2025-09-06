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
            description=task_data.description,
            assignee_id=task_data.assignee_id,
            due_date=task_data.due_date.isoformat() if task_data.due_date else None,
            created_by=current_user.id
        )
        
        # Create notification if task is assigned
        if task_data.assignee_id:
            DatabaseManager.create_notification(
                user_id=task_data.assignee_id,
                project_id=project_id,
                task_id=task_id,
                title="Task Assigned",
                body=f'You have been assigned to task "{task_data.title}"'
            )
        
        # Get created task
        tasks = DatabaseManager.get_project_tasks(project_id)
        created_task = next((t for t in tasks if t['id'] == task_id), None)
        task = Task(**created_task)
        
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
    """Update task status"""
    try:
        new_status = status_update.get('status')
        if new_status not in ['todo', 'in_progress', 'done']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status"
            )
        
        DatabaseManager.update_task_status(task_id, new_status)
        
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
