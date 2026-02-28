"""
KisanCall — Auth Service
Handles: password hashing, JWT tokens, email verification tokens
"""

import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv

from core.database import get_collection

load_dotenv()

# ─── Config ───────────────────────────────────────────────────────────────────

JWT_SECRET = os.getenv("JWT_SECRET", "fallback_secret_change_me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))

# ─── Password Hashing ─────────────────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(plain: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify plaintext password against bcrypt hash."""
    return pwd_context.verify(plain, hashed)


# ─── JWT Tokens ───────────────────────────────────────────────────────────────

def create_access_token(data: dict) -> str:
    """Create a signed JWT token with expiry."""
    payload = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    payload.update({"exp": expire})
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT token. Returns payload or None."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


# ─── Email Verification Token ─────────────────────────────────────────────────

def generate_verification_token() -> str:
    """Generate a unique UUID token for email verification."""
    return str(uuid.uuid4())


# ─── FastAPI Dependencies ─────────────────────────────────────────────────────

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    FastAPI dependency — extract and verify current user from JWT.
    Returns the full user document from MongoDB.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception

    user_id: str = payload.get("sub")
    if not user_id:
        raise credentials_exception

    # Fetch full user from DB
    users = get_collection("users")
    from bson import ObjectId
    user = await users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise credentials_exception

    if not user.get("is_verified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in",
        )

    return user


async def require_farmer(user: dict = Depends(get_current_user)) -> dict:
    """FastAPI dependency — only allow farmers."""
    if user.get("role") != "farmer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to farmers only",
        )
    return user


async def require_expert(user: dict = Depends(get_current_user)) -> dict:
    """FastAPI dependency — only allow experts."""
    if user.get("role") != "expert":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to experts only",
        )
    return user
