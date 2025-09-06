"""
Notifications endpoints
"""

from fastapi import APIRouter, HTTPException, status, Depends
import logging

from ..models import NotificationListResponse, User, MarkNotificationRequest
from ..auth import get_current_active_user
from ..database import DatabaseManager, execute_query

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=NotificationListResponse)
async def get_user_notifications(
    current_user: User = Depends(get_current_active_user)
):
    """Get user notifications"""
    try:
        notifications = DatabaseManager.get_user_notifications(current_user.id)
        
        return NotificationListResponse(
            success=True,
            message=f"Retrieved {len(notifications)} notifications",
            data=notifications
        )
        
    except Exception as e:
        logger.error(f"Failed to get notifications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve notifications"
        )

@router.post("/mark-read")
async def mark_notifications_read(
    request: MarkNotificationRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Mark notifications as read"""
    try:
        if not request.notification_ids:
            return {"success": True, "message": "No notifications to mark"}
        
        # Use the database manager method
        DatabaseManager.mark_notifications_read(request.notification_ids)
        
        return {
            "success": True,
            "message": f"Marked {len(request.notification_ids)} notifications as read"
        }
        
    except Exception as e:
        logger.error(f"Failed to mark notifications as read: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark notifications as read"
        )

@router.get("/unread-count")
async def get_unread_notification_count(
    current_user: User = Depends(get_current_active_user)
):
    """Get count of unread notifications"""
    try:
        count = DatabaseManager.get_unread_notification_count(current_user.id)
        
        return {
            "success": True,
            "count": count
        }
        
    except Exception as e:
        logger.error(f"Failed to get unread notification count: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get notification count"
        )
