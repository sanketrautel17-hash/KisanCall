"""
KisanCall — User model (Pydantic v2 + MongoDB schema)
Roles: farmer | expert
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId


# ─── Pydantic Helpers ─────────────────────────────────────────────────────────

class PyObjectId(str):
    """Custom type to handle MongoDB ObjectId serialization."""

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError(f"Invalid ObjectId: {v}")
        return str(v)


# ─── DB Document Schema (what gets stored in MongoDB) ─────────────────────────

class UserDocument(BaseModel):
    """Represents the full user document as stored in MongoDB."""

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    name: str
    email: EmailStr
    hashed_password: str
    role: str                          # "farmer" | "expert"
    is_verified: bool = False          # True after email verification
    is_online: bool = False            # For experts: availability toggle
    verification_token: Optional[str] = None  # UUID token for email link
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }


# ─── Request / Response Schemas (what the API accepts/returns) ────────────────

class SignupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = Field(..., pattern="^(farmer|expert)$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str                   # Google ID token (JWT)
    role: str = Field(default="farmer", pattern="^(farmer|expert)$")  # needed for new accounts


class UserPublic(BaseModel):
    """Safe user data returned in API responses (no password)."""
    id: str
    name: str
    email: str
    role: str
    is_verified: bool
    is_online: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
