"""
Comments endpoints
Threaded discussions for projects and tasks
"""

from fastapi import APIRouter, HTTPException, status, Depends, Path, Query
import logging
from typing import Optional

from ..models import CommentCreate, CommentResponse, CommentListResponse, User
from ..auth import get_current_active_user, check_project_access
from ..database import execute_query

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=CommentListResponse)
async def get_comments(
    project_id: Optional[int] = Query(None),
    task_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_active_user)
):
    """Get comments for a project or task"""
    try:
        if not project_id and not task_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either project_id or task_id must be provided"
            )
        
        if project_id:
            query = """
            SELECT c.*, u.name as author_name
            FROM comments c
            JOIN users u ON c.author_id = u.id
            WHERE c.project_id = %s
            ORDER BY c.created_at ASC
            """
            comments_data = execute_query(query, (project_id,), fetch_all=True)
        else:
            query = """
            SELECT c.*, u.name as author_name
            FROM comments c
            JOIN users u ON c.author_id = u.id
            WHERE c.task_id = %s
            ORDER BY c.created_at ASC
            """
            comments_data = execute_query(query, (task_id,), fetch_all=True)
        
        return CommentListResponse(
            success=True,
            message=f"Retrieved {len(comments_data)} comments",
            data=comments_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get comments: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve comments"
        )

@router.post("/")
async def create_comment(
    comment_data: CommentCreate,
    project_id: Optional[int] = Query(None),
    task_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new comment"""
    try:
        if not project_id and not task_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either project_id or task_id must be provided"
            )
        
        query = """
        INSERT INTO comments (project_id, task_id, parent_comment_id, author_id, content)
        VALUES (%s, %s, %s, %s, %s)
        """
        comment_id = execute_query(query, (
            project_id,
            task_id,
            comment_data.parent_comment_id,
            current_user.id,
            comment_data.content
        ))
        
        return {
            "success": True,
            "message": "Comment created successfully",
            "comment_id": comment_id
        }
        
    except Exception as e:
        logger.error(f"Failed to create comment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create comment"
        )
