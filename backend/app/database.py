"""
Database connection and utilities
"""

import mysql.connector
from mysql.connector import pooling
from contextlib import contextmanager
import logging
from .config import settings

logger = logging.getLogger(__name__)

# Connection pool configuration
pool_config = {
    'pool_name': 'synergy_pool',
    'pool_size': 10,
    'pool_reset_session': True,
    'host': settings.DB_HOST,
    'port': settings.DB_PORT,
    'database': settings.DB_NAME,
    'user': settings.DB_USER,
    'password': settings.DB_PASSWORD,
    'charset': 'utf8mb4',
    'autocommit': False
}

# Global connection pool
connection_pool = None

def init_db():
    """Initialize database connection pool"""
    global connection_pool
    try:
        connection_pool = mysql.connector.pooling.MySQLConnectionPool(**pool_config)
        logger.info("Database connection pool initialized successfully")
        
        # Test connection
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
        logger.info("Database connection test successful")
        
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise

@contextmanager
def get_db_connection():
    """Get database connection from pool"""
    connection = None
    try:
        connection = connection_pool.get_connection()
        yield connection
    except mysql.connector.Error as e:
        if connection:
            connection.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        if connection and connection.is_connected():
            connection.close()

def execute_query(query: str, params: tuple = None, fetch_one: bool = False, fetch_all: bool = False):
    """Execute a database query"""
    with get_db_connection() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(query, params or ())
        
        if fetch_one:
            result = cursor.fetchone()
        elif fetch_all:
            result = cursor.fetchall()
        else:
            result = cursor.lastrowid
            
        conn.commit()
        cursor.close()
        return result

def execute_many(query: str, params_list: list):
    """Execute many queries with different parameters"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.executemany(query, params_list)
        conn.commit()
        cursor.close()
        return cursor.rowcount

class DatabaseManager:
    """Database operations manager"""
    
    @staticmethod
    def get_user_by_email(email: str):
        """Get user by email"""
        query = "SELECT * FROM users WHERE email = %s"
        return execute_query(query, (email,), fetch_one=True)
    
    @staticmethod
    def get_user_by_id(user_id: int):
        """Get user by ID"""
        query = "SELECT * FROM users WHERE id = %s"
        return execute_query(query, (user_id,), fetch_one=True)
    
    @staticmethod
    def create_user(name: str, email: str, password_hash: str, role: str = 'user'):
        """Create a new user"""
        query = "INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, %s)"
        return execute_query(query, (name, email, password_hash, role))
    
    @staticmethod
    def get_user_projects(user_id: int):
        """Get projects for a user"""
        query = """
        SELECT DISTINCT p.*, u.name as owner_name 
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        LEFT JOIN project_members pm ON p.id = pm.project_id
        WHERE p.owner_id = %s OR pm.user_id = %s
        ORDER BY p.created_at DESC
        """
        return execute_query(query, (user_id, user_id), fetch_all=True)
    
    @staticmethod
    def create_project(name: str, description: str, owner_id: int):
        """Create a new project"""
        query = "INSERT INTO projects (name, description, owner_id) VALUES (%s, %s, %s)"
        project_id = execute_query(query, (name, description, owner_id))
        
        # Add owner as project member
        member_query = "INSERT INTO project_members (project_id, user_id, role) VALUES (%s, %s, %s)"
        execute_query(member_query, (project_id, owner_id, 'owner'))
        
        return project_id
    
    @staticmethod
    def get_project_by_id(project_id: int):
        """Get project by ID"""
        query = """
        SELECT p.*, u.name as owner_name 
        FROM projects p 
        JOIN users u ON p.owner_id = u.id 
        WHERE p.id = %s
        """
        return execute_query(query, (project_id,), fetch_one=True)
    
    @staticmethod
    def get_project_members(project_id: int):
        """Get project members"""
        query = """
        SELECT u.id, u.name, u.email, pm.role, pm.joined_at
        FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = %s
        ORDER BY pm.joined_at
        """
        return execute_query(query, (project_id,), fetch_all=True)
    
    @staticmethod
    def add_project_member(project_id: int, user_id: int, role: str = 'member'):
        """Add member to project"""
        query = "INSERT INTO project_members (project_id, user_id, role) VALUES (%s, %s, %s)"
        return execute_query(query, (project_id, user_id, role))
    
    @staticmethod
    def create_task(project_id: int, title: str, description: str, assignee_id: int, due_date: str, created_by: int):
        """Create a new task"""
        query = """
        INSERT INTO tasks (project_id, title, description, assignee_id, due_date, created_by) 
        VALUES (%s, %s, %s, %s, %s, %s)
        """
        return execute_query(query, (project_id, title, description, assignee_id, due_date, created_by))
    
    @staticmethod
    def get_project_tasks(project_id: int):
        """Get tasks for a project"""
        query = """
        SELECT t.*, u.name as assignee_name, c.name as created_by_name
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        LEFT JOIN users c ON t.created_by = c.id
        WHERE t.project_id = %s
        ORDER BY t.created_at DESC
        """
        return execute_query(query, (project_id,), fetch_all=True)
    
    @staticmethod
    def update_task_status(task_id: int, status: str):
        """Update task status"""
        query = "UPDATE tasks SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s"
        return execute_query(query, (status, task_id))
    
    @staticmethod
    def create_notification(user_id: int, title: str, body: str, project_id: int = None, task_id: int = None):
        """Create a notification"""
        query = "INSERT INTO notifications (user_id, project_id, task_id, title, body) VALUES (%s, %s, %s, %s, %s)"
        return execute_query(query, (user_id, project_id, task_id, title, body))
    
    @staticmethod
    def get_user_notifications(user_id: int, limit: int = 50):
        """Get user notifications"""
        query = """
        SELECT n.*, p.name as project_name, t.title as task_title
        FROM notifications n
        LEFT JOIN projects p ON n.project_id = p.id
        LEFT JOIN tasks t ON n.task_id = t.id
        WHERE n.user_id = %s
        ORDER BY n.created_at DESC
        LIMIT %s
        """
        return execute_query(query, (user_id, limit), fetch_all=True)
