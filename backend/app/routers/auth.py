"""
Authentication endpoints
Register, login, logout functionality
"""

from fastapi import APIRouter, HTTPException, status, Depends
from datetime import timedelta
import logging

from ..models import (
    UserCreate, UserLogin, LoginResponse, UserResponse, User, Token, ErrorResponse
)
from ..auth import (
    authenticate_user, create_access_token, get_password_hash, get_current_active_user
)
from ..database import DatabaseManager
from ..config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    """Register a new user"""
    try:
        # Check if user already exists
        existing_user = DatabaseManager.get_user_by_email(user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Hash password and create user
        hashed_password = get_password_hash(user_data.password)
        user_id = DatabaseManager.create_user(
            name=user_data.name,
            email=user_data.email,
            password_hash=hashed_password
        )
        
        # Get created user
        created_user = DatabaseManager.get_user_by_id(user_id)
        user = User(**created_user)
        
        logger.info(f"User registered successfully: {user_data.email}")
        return UserResponse(
            success=True,
            message="User registered successfully",
            data=user
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )

@router.post("/login", response_model=LoginResponse)
async def login(login_data: UserLogin):
    """Login user and return JWT token"""
    try:
        # Authenticate user
        user = authenticate_user(login_data.email, login_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id), "email": user.email},
            expires_delta=access_token_expires
        )
        
        token = Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # in seconds
        )
        
        logger.info(f"User logged in successfully: {login_data.email}")
        return LoginResponse(
            success=True,
            message="Login successful",
            data=token,
            user=user
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_active_user)):
    """Logout user (client-side token removal)"""
    # In a more complex setup, you might invalidate the token server-side
    # For now, we just confirm the token is valid and let client handle removal
    logger.info(f"User logged out: {current_user.email}")
    return {"success": True, "message": "Logged out successfully"}

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return UserResponse(
        success=True,
        message="User information retrieved",
        data=current_user
    )

@router.post("/verify-token")
async def verify_token(current_user: User = Depends(get_current_active_user)):
    """Verify if the current token is valid"""
    return {
        "success": True,
        "message": "Token is valid",
        "user_id": current_user.id,
        "email": current_user.email
    }
