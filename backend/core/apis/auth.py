"""
KisanCall — Auth Routes
POST /auth/signup       → register farmer or expert
GET  /auth/verify-email → click link from email
POST /auth/login        → returns JWT token
GET  /auth/me           → get current user profile
POST /auth/google       → sign in / sign up with Google OAuth
"""

import os
from datetime import datetime
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv

import httpx

from core.database import get_collection
from core.models.user import SignupRequest, LoginRequest, TokenResponse, UserPublic, GoogleAuthRequest
from core.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    generate_verification_token,
    get_current_user,
)
from core.services.email_service import send_verification_email

load_dotenv()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
GOOGLE_CLIENT_ID = os.getenv("CLIENT_ID", "").strip()

router = APIRouter()


# ─── Helper ───────────────────────────────────────────────────────────────────

def _serialize_user(user: dict) -> UserPublic:
    """Convert MongoDB user document to safe public schema."""
    return UserPublic(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        role=user["role"],
        is_verified=user.get("is_verified", False),
        is_online=user.get("is_online", False),
        created_at=user.get("created_at", datetime.utcnow()),
    )


# ─── POST /auth/signup ────────────────────────────────────────────────────────

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest):
    """
    Register a new farmer or expert.
    Sends a verification email with a unique link.
    """
    users = get_collection("users")

    # Check if email already exists
    existing = await users.find_one({"email": body.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    # Build user document
    verification_token = generate_verification_token()
    user_doc = {
        "name": body.name,
        "email": body.email,
        "hashed_password": hash_password(body.password),
        "role": body.role,
        "is_verified": False,
        "is_online": False,
        "verification_token": verification_token,
        "created_at": datetime.utcnow(),
    }

    result = await users.insert_one(user_doc)

    # Send verification email (non-blocking — don't fail signup if email fails)
    email_sent = await send_verification_email(
        to_email=body.email,
        name=body.name,
        token=verification_token,
    )

    return {
        "status": "success",
        "message": (
            f"Account created! Please check {body.email} for a verification link."
            if email_sent
            else "Account created! Email sending failed — contact support."
        ),
        "data": {
            "user_id": str(result.inserted_id),
            "email_sent": email_sent,
        },
    }


# ─── GET /auth/verify-email ───────────────────────────────────────────────────

@router.get("/verify-email")
async def verify_email(token: str):
    """
    Clicked from the email link.
    Marks user as verified and redirects to login page.
    """
    users = get_collection("users")

    user = await users.find_one({"verification_token": token})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired verification link",
        )

    if user.get("is_verified"):
        # Already verified — redirect straight to login
        return RedirectResponse(url=f"{FRONTEND_URL}/login?already_verified=true")

    # Mark verified, clear token
    await users.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_verified": True, "verification_token": None}},
    )

    # Redirect to frontend login with success message
    return RedirectResponse(url=f"{FRONTEND_URL}/login?verified=true")


# ─── POST /auth/login ─────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    """
    Authenticate user → return JWT access token + user profile.
    """
    users = get_collection("users")

    user = await users.find_one({"email": body.email})

    # Generic error — don't reveal whether email exists
    invalid_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
    )

    if not user:
        raise invalid_exc

    if not verify_password(body.password, user["hashed_password"]):
        raise invalid_exc

    if not user.get("is_verified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before logging in",
        )

    # Create JWT
    token = create_access_token(data={"sub": str(user["_id"]), "role": user["role"]})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=_serialize_user(user),
    )


# ─── GET /auth/me ─────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserPublic)
async def get_me(current_user: Annotated[dict, Depends(get_current_user)]):
    """
    Return the authenticated user's profile.
    Protected — requires valid JWT in Authorization header.
    """
    return _serialize_user(current_user)


# ─── POST /auth/google ────────────────────────────────────────────────────────

@router.post("/google", response_model=TokenResponse)
async def google_auth(body: GoogleAuthRequest):
    """
    Sign in or sign up with Google OAuth.

    - Verifies the Google ID token via Google's tokeninfo endpoint
    - If user exists (by email): logs them in (links Google account)
    - If user is new: creates account with Google info, auto-verified
    - Returns the same KisanCall JWT token as /auth/login
    """
    # ── 1. Verify Google ID token with Google ─────────────────────────────────
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": body.credential},
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google token. Please try signing in again.",
        )

    token_info = response.json()

    # ── 2. Validate audience (must match our CLIENT_ID) ───────────────────────
    token_aud = token_info.get("aud", "")
    if GOOGLE_CLIENT_ID and token_aud != GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token audience mismatch.",
        )

    # ── 3. Extract user info from Google token ────────────────────────────────
    google_email = token_info.get("email")
    google_name  = token_info.get("name") or google_email.split("@")[0]
    email_verified = token_info.get("email_verified") == "true"

    if not google_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account did not provide an email address.",
        )

    if not email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your Google email is not verified. Please verify it with Google first.",
        )

    # ── 4. Find or create user ────────────────────────────────────────────────
    users = get_collection("users")
    user = await users.find_one({"email": google_email})

    if user:
        # Existing user — log them in (update name from Google if blank)
        if not user.get("name"):
            await users.update_one(
                {"_id": user["_id"]},
                {"$set": {"name": google_name}},
            )
            user["name"] = google_name
        # Ensure verified
        if not user.get("is_verified"):
            await users.update_one(
                {"_id": user["_id"]},
                {"$set": {"is_verified": True}},
            )
            user["is_verified"] = True

    else:
        # New user — create account (auto-verified via Google)
        user_doc = {
            "name": google_name,
            "email": google_email,
            "hashed_password": "",          # No password for Google users
            "role": body.role,              # farmer or expert (from frontend selection)
            "is_verified": True,            # Google already verified the email
            "is_online": False,
            "verification_token": None,
            "google_id": token_info.get("sub"),
            "avatar_url": token_info.get("picture"),
            "created_at": datetime.utcnow(),
        }
        result = await users.insert_one(user_doc)
        user = await users.find_one({"_id": result.inserted_id})

    # ── 5. Issue KisanCall JWT ────────────────────────────────────────────────
    token = create_access_token(data={"sub": str(user["_id"]), "role": user["role"]})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=_serialize_user(user),
    )
