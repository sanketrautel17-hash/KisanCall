"""
KisanCall — Call model (Pydantic v2 + MongoDB schema)
Status lifecycle: pending → active → ended
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from bson import ObjectId
from core.models.user import PyObjectId


# ─── DB Document Schema ────────────────────────────────────────────────────────

class CallDocument(BaseModel):
    """Represents the full call document as stored in MongoDB."""

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    farmer_id: str                      # MongoDB user _id of the farmer
    farmer_name: str
    expert_id: Optional[str] = None     # Assigned after expert accepts
    expert_name: Optional[str] = None
    topic: str                          # Crop problem category
    status: str = "pending"             # pending | active | ended | rejected

    # WebRTC session data
    offer_sdp: Optional[str] = None
    answer_sdp: Optional[str] = None

    # Post-call AI data
    transcript: Optional[str] = None
    summary: Optional[str] = None
    language_detected: Optional[str] = None   # "hi" | "en"
    followup_note: Optional[str] = None       # Expert's written follow-up

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    accepted_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
    }


# ─── Request / Response Schemas ───────────────────────────────────────────────

class CallRequestPayload(BaseModel):
    topic: str = Field(
        ...,
        description="Crop problem category",
        examples=["Crop Disease", "Soil Health", "Fertilizer", "Weather", "Pest Control"]
    )


class CallPublic(BaseModel):
    """Safe call data for API responses."""
    id: str
    farmer_id: str
    farmer_name: str
    expert_id: Optional[str]
    expert_name: Optional[str]
    topic: str
    status: str
    offer_sdp: Optional[str] = None    # Exposed so ExpertCallScreen can use it as fallback
    answer_sdp: Optional[str] = None   # Exposed so CallScreen can use it as fallback
    transcript: Optional[str]
    summary: Optional[str]
    language_detected: Optional[str]
    followup_note: Optional[str]
    created_at: datetime
    accepted_at: Optional[datetime]
    ended_at: Optional[datetime]
    duration_seconds: Optional[int]


class FollowupNotePayload(BaseModel):
    note: str = Field(..., min_length=5, max_length=2000)


class WebRTCOfferPayload(BaseModel):
    call_id: str
    sdp: str
    type: str   # "offer"


class WebRTCAnswerPayload(BaseModel):
    call_id: str
    sdp: str
    type: str   # "answer"


class ICECandidatePayload(BaseModel):
    call_id: str
    candidate: str
    sdp_mid: Optional[str] = None
    sdp_mline_index: Optional[int] = None
