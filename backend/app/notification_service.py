"""
Notification service for in-app notifications
Handles creating and managing user notifications
"""

import logging
from typing import List, Optional
from .database import DatabaseManager
from .email_service import email_service

logger = logging.getLogger(__name__)

class NotificationService:
    
    @staticmethod
    def create_notification(user_id: int, title: str, body: str, 
                          project_id: Optional[int] = None, 
                          task_id: Optional[int] = None) -> bool:
        """Create a new in-app notification for a user"""
        try:
            DatabaseManager.create_notification(
                user_id=user_id,
                project_id=project_id,
                task_id=task_id,
                title=title,
                body=body
            )
            logger.info(f"Notification created for user {user_id}: {title}")
            return True
        except Exception as e:
            logger.error(f"Failed to create notification for user {user_id}: {str(e)}")
            return False

    @staticmethod
    def send_task_assignment_notifications(task_data: dict, assignee_data: dict, 
                                         assigner_data: dict, project_data: dict) -> None:
        """Send both email and in-app notifications for task assignment"""
        try:
            # Create in-app notification
            NotificationService.create_notification(
                user_id=assignee_data['id'],
                project_id=project_data['id'],
                task_id=task_data['id'],
                title="New Task Assigned",
                body=f'You have been assigned to task "{task_data["title"]}" in project "{project_data["name"]}"'
            )
            
            # Send email notification
            due_date = task_data.get('due_date')
            if due_date:
                due_date = due_date.strftime('%Y-%m-%d') if hasattr(due_date, 'strftime') else str(due_date)
            
            email_service.send_task_assignment_email(
                assignee_email=assignee_data['email'],
                assignee_name=assignee_data['name'],
                task_title=task_data['title'],
                project_name=project_data['name'],
                assigner_name=assigner_data['name'],
                due_date=due_date
            )
            
            logger.info(f"Task assignment notifications sent to {assignee_data['email']}")
            
        except Exception as e:
            logger.error(f"Failed to send task assignment notifications: {str(e)}")

    @staticmethod
    def send_task_status_notifications(task_data: dict, updater_data: dict, 
                                     project_data: dict, new_status: str) -> None:
        """Send notifications for task status updates"""
        try:
            # Get project members to notify (excluding the updater)
            project_members = DatabaseManager.get_project_members(project_data['id'])
            
            for member in project_members:
                if member['user_id'] != updater_data['id']:
                    # Create in-app notification
                    status_map = {
                        'todo': 'moved to To Do',
                        'in_progress': 'started working on',
                        'done': 'completed'
                    }
                    action = status_map.get(new_status, f'updated status to {new_status}')
                    
                    NotificationService.create_notification(
                        user_id=member['user_id'],
                        project_id=project_data['id'],
                        task_id=task_data['id'],
                        title="Task Status Update",
                        body=f'{updater_data["name"]} {action} task "{task_data["title"]}"'
                    )
                    
                    # Send email notification to project owner if task is completed
                    if new_status == 'done' and member['user_id'] == project_data['owner_id']:
                        email_service.send_task_status_update_email(
                            recipient_email=member['email'],
                            recipient_name=member['name'],
                            task_title=task_data['title'],
                            project_name=project_data['name'],
                            updater_name=updater_data['name'],
                            new_status=new_status
                        )
            
            logger.info(f"Task status notifications sent for task {task_data['id']}")
            
        except Exception as e:
            logger.error(f"Failed to send task status notifications: {str(e)}")

    @staticmethod
    def send_project_member_added_notifications(project_data: dict, new_member_data: dict, 
                                              adder_data: dict) -> None:
        """Send notifications when a new member is added to a project"""
        try:
            # Notify the new member
            NotificationService.create_notification(
                user_id=new_member_data['id'],
                project_id=project_data['id'],
                title="Added to Project",
                body=f'You have been added to project "{project_data["name"]}" by {adder_data["name"]}'
            )
            
            # Notify other project members
            project_members = DatabaseManager.get_project_members(project_data['id'])
            for member in project_members:
                if member['user_id'] not in [new_member_data['id'], adder_data['id']]:
                    NotificationService.create_notification(
                        user_id=member['user_id'],
                        project_id=project_data['id'],
                        title="New Team Member",
                        body=f'{new_member_data["name"]} joined project "{project_data["name"]}"'
                    )
            
            logger.info(f"Project member notifications sent for project {project_data['id']}")
            
        except Exception as e:
            logger.error(f"Failed to send project member notifications: {str(e)}")

    @staticmethod
    def send_comment_notifications(comment_data: dict, author_data: dict, 
                                 project_data: dict, task_data: Optional[dict] = None) -> None:
        """Send notifications for new comments"""
        try:
            # Get project members to notify (excluding the comment author)
            project_members = DatabaseManager.get_project_members(project_data['id'])
            
            comment_location = f'task "{task_data["title"]}"' if task_data else 'project'
            
            for member in project_members:
                if member['user_id'] != author_data['id']:
                    NotificationService.create_notification(
                        user_id=member['user_id'],
                        project_id=project_data['id'],
                        task_id=task_data['id'] if task_data else None,
                        title="New Comment",
                        body=f'{author_data["name"]} commented on {comment_location} in "{project_data["name"]}"'
                    )
            
            logger.info(f"Comment notifications sent for project {project_data['id']}")
            
        except Exception as e:
            logger.error(f"Failed to send comment notifications: {str(e)}")

    @staticmethod
    def get_user_notifications(user_id: int, limit: int = 50) -> List[dict]:
        """Get notifications for a user"""
        try:
            return DatabaseManager.get_user_notifications(user_id, limit)
        except Exception as e:
            logger.error(f"Failed to get notifications for user {user_id}: {str(e)}")
            return []

    @staticmethod
    def mark_notifications_read(notification_ids: List[int]) -> bool:
        """Mark notifications as read"""
        try:
            DatabaseManager.mark_notifications_read(notification_ids)
            return True
        except Exception as e:
            logger.error(f"Failed to mark notifications as read: {str(e)}")
            return False

    @staticmethod
    def get_unread_notification_count(user_id: int) -> int:
        """Get count of unread notifications for a user"""
        try:
            return DatabaseManager.get_unread_notification_count(user_id)
        except Exception as e:
            logger.error(f"Failed to get unread notification count for user {user_id}: {str(e)}")
            return 0

# Global notification service instance
notification_service = NotificationService()
