"""
Authentication utilities
JWT token creation/validation and password hashing
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import settings
from .database import DatabaseManager
from .models import TokenData, User

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security scheme
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate password hash"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> TokenData:
    """Verify and decode JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: int = payload.get("sub")
        email: str = payload.get("email")
        
        if user_id is None or email is None:
            raise credentials_exception
            
        token_data = TokenData(user_id=int(user_id), email=email)
        return token_data
        
    except JWTError:
        raise credentials_exception

def authenticate_user(email: str, password: str) -> Optional[User]:
    """Authenticate user with email and password"""
    user_data = DatabaseManager.get_user_by_email(email)
    if not user_data:
        return None
    
    if not verify_password(password, user_data['password_hash']):
        return None
    
    return User(**user_data)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get current authenticated user from JWT token"""
    token = credentials.credentials
    token_data = verify_token(token)
    
    user_data = DatabaseManager.get_user_by_id(token_data.user_id)
    if user_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return User(**user_data)

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user (placeholder for future user status checks)"""
    return current_user

def check_project_access(user_id: int, project_id: int) -> bool:
    """Check if user has access to a project"""
    # Check if user is project owner
    project = DatabaseManager.get_project_by_id(project_id)
    if not project:
        return False
    
    if project['owner_id'] == user_id:
        return True
    
    # Check if user is project member
    members = DatabaseManager.get_project_members(project_id)
    return any(member['id'] == user_id for member in members)

def check_project_admin(user_id: int, project_id: int) -> bool:
    """Check if user is admin or owner of a project"""
    # Check if user is project owner
    project = DatabaseManager.get_project_by_id(project_id)
    if not project:
        return False
    
    if project['owner_id'] == user_id:
        return True
    
    # Check if user is project admin
    members = DatabaseManager.get_project_members(project_id)
    for member in members:
        if member['id'] == user_id and member['role'] in ['admin', 'owner']:
            return True
    
    return False
