"""
Background scheduler for deadline reminders and email notifications
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, date, timedelta

from .config import settings
from .database import execute_query, DatabaseManager

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()

def send_email(to_email: str, subject: str, body: str):
    """Send email notification"""
    try:
        # Create message
        msg = MIMEMultipart()
        msg['From'] = settings.SMTP_FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Add body to email
        msg.attach(MIMEText(body, 'plain'))
        
        # Gmail SMTP configuration
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        server.starttls()  # Enable security
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        
        # Send email
        text = msg.as_string()
        server.sendmail(settings.SMTP_FROM, to_email, text)
        server.quit()
        
        logger.info(f"Email sent successfully to {to_email}")
        
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")

def check_upcoming_deadlines():
    """Check for tasks with upcoming deadlines and send reminders"""
    try:
        # Get tasks due in the next 3 days
        tomorrow = date.today() + timedelta(days=1)
        three_days = date.today() + timedelta(days=3)
        
        query = """
        SELECT t.id, t.title, t.due_date, t.assignee_id,
               u.name as assignee_name, u.email as assignee_email,
               p.name as project_name
        FROM tasks t
        JOIN users u ON t.assignee_id = u.id
        JOIN projects p ON t.project_id = p.id
        WHERE t.due_date BETWEEN %s AND %s
        AND t.status != 'done'
        AND t.assignee_id IS NOT NULL
        """
        
        tasks = execute_query(query, (tomorrow, three_days), fetch_all=True)
        
        for task in tasks:
            # Check if we already sent a reminder for this task today
            reminder_query = """
            SELECT COUNT(*) as count FROM notifications
            WHERE user_id = %s AND task_id = %s
            AND title = 'Deadline Reminder'
            AND DATE(created_at) = CURDATE()
            """
            
            reminder_count = execute_query(reminder_query, (task['assignee_id'], task['id']), fetch_one=True)
            
            if reminder_count['count'] == 0:
                days_until_due = (task['due_date'] - date.today()).days
                
                # Create notification
                DatabaseManager.create_notification(
                    user_id=task['assignee_id'],
                    task_id=task['id'],
                    title="Deadline Reminder",
                    body=f'Task "{task["title"]}" is due in {days_until_due} day(s)'
                )
                
                # Send email
                subject = f"Deadline Reminder: {task['title']}"
                body = f"""
                Hello {task['assignee_name']},
                
                This is a reminder that your task "{task['title']}" in project "{task['project_name']}" is due on {task['due_date']}.
                
                Please make sure to complete it on time.
                
                Best regards,
                SynergySphere Team
                """
                
                send_email(task['assignee_email'], subject, body)
                
        logger.info(f"Processed {len(tasks)} deadline reminders")
        
    except Exception as e:
        logger.error(f"Error checking deadlines: {e}")

def send_daily_digest():
    """Send daily digest of notifications (optional feature)"""
    try:
        # This could be expanded to send daily summaries
        logger.info("Daily digest check completed")
        
    except Exception as e:
        logger.error(f"Error sending daily digest: {e}")

def start_scheduler():
    """Start the background scheduler"""
    try:
        # Check deadlines every hour
        scheduler.add_job(
            check_upcoming_deadlines,
            IntervalTrigger(hours=1),
            id='deadline_check',
            name='Check upcoming deadlines'
        )
        
        # Send daily digest at 9 AM
        scheduler.add_job(
            send_daily_digest,
            'cron',
            hour=9,
            minute=0,
            id='daily_digest',
            name='Send daily digest'
        )
        
        scheduler.start()
        logger.info("Background scheduler started successfully")
        
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")

def stop_scheduler():
    """Stop the background scheduler"""
    try:
        scheduler.shutdown()
        logger.info("Background scheduler stopped")
        
    except Exception as e:
        logger.error(f"Error stopping scheduler: {e}")
