"""
Email service for sending notifications
Handles SMTP configuration and email templates
"""

import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from .config import settings

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.smtp_from = settings.SMTP_FROM

    def send_email(self, to_email: str, subject: str, body: str, is_html: bool = False) -> bool:
        """Send an email to the specified recipient"""
        # Check if email is disabled for development
        if self.smtp_user == 'disabled@example.com':
            logger.info(f"Email sending disabled - would send to {to_email}: {subject}")
            return True
            
        try:
            # Create message
            message = MIMEMultipart()
            message['From'] = self.smtp_from
            message['To'] = to_email
            message['Subject'] = subject

            # Add body to email
            content_type = 'html' if is_html else 'plain'
            message.attach(MIMEText(body, content_type))

            # Create SMTP session
            server = smtplib.SMTP(self.smtp_host, self.smtp_port)
            server.starttls()  # Enable TLS encryption
            server.login(self.smtp_user, self.smtp_password)
            
            # Send email
            text = message.as_string()
            server.sendmail(self.smtp_from, to_email, text)
            server.quit()
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    def send_task_assignment_email(self, assignee_email: str, assignee_name: str, 
                                 task_title: str, project_name: str, 
                                 assigner_name: str, due_date: Optional[str] = None) -> bool:
        """Send task assignment notification email"""
        subject = f"New Task Assigned: {task_title}"
        
        # Create HTML email body
        due_date_text = f"<p><strong>Due Date:</strong> {due_date}</p>" if due_date else ""
        
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #667eea;">New Task Assignment</h2>
                    
                    <p>Hi {assignee_name},</p>
                    
                    <p>You have been assigned a new task in <strong>{project_name}</strong>:</p>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <h3 style="margin-top: 0; color: #2d3748;">{task_title}</h3>
                        {due_date_text}
                        <p><strong>Assigned by:</strong> {assigner_name}</p>
                    </div>
                    
                    <p>Please log in to SynergySphere to view the full task details and start working on it.</p>
                    
                    <p style="margin-top: 30px;">
                        <a href="http://localhost:3000" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                            Open SynergySphere
                        </a>
                    </p>
                    
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e9ecef;">
                    <p style="font-size: 12px; color: #6c757d;">
                        This is an automated message from SynergySphere. Please do not reply to this email.
                    </p>
                </div>
            </body>
        </html>
        """
        
        # Plain text fallback
        plain_body = f"""
        New Task Assignment
        
        Hi {assignee_name},
        
        You have been assigned a new task in {project_name}:
        
        Task: {task_title}
        {f'Due Date: {due_date}' if due_date else ''}
        Assigned by: {assigner_name}
        
        Please log in to SynergySphere to view the full task details and start working on it.
        
        Visit: http://localhost:3000
        """
        
        return self.send_email(assignee_email, subject, html_body, is_html=True)

    def send_task_status_update_email(self, recipient_email: str, recipient_name: str,
                                    task_title: str, project_name: str, 
                                    updater_name: str, new_status: str) -> bool:
        """Send task status update notification email"""
        status_map = {
            'todo': 'To Do',
            'in_progress': 'In Progress', 
            'done': 'Completed'
        }
        
        status_display = status_map.get(new_status, new_status)
        subject = f"Task Status Update: {task_title}"
        
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #667eea;">Task Status Update</h2>
                    
                    <p>Hi {recipient_name},</p>
                    
                    <p>A task in <strong>{project_name}</strong> has been updated:</p>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <h3 style="margin-top: 0; color: #2d3748;">{task_title}</h3>
                        <p><strong>New Status:</strong> <span style="color: #28a745;">{status_display}</span></p>
                        <p><strong>Updated by:</strong> {updater_name}</p>
                    </div>
                    
                    <p style="margin-top: 30px;">
                        <a href="http://localhost:3000" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                            View Project
                        </a>
                    </p>
                </div>
            </body>
        </html>
        """
        
        return self.send_email(recipient_email, subject, html_body, is_html=True)

# Global email service instance
email_service = EmailService()
