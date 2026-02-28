"""
KisanCall — Farmer Routes

GET  /farmer/dashboard   → farmer profile + active/pending call summary
GET  /farmer/calls       → full call history for the logged-in farmer
"""

from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends

from core.database import get_collection
from core.models.call import CallPublic
from core.models.user import UserPublic
from core.services.auth_service import require_farmer

router = APIRouter()


def _serialize_call(doc: dict) -> CallPublic:
    return CallPublic(
        id=str(doc["_id"]),
        farmer_id=str(doc["farmer_id"]),
        farmer_name=doc["farmer_name"],
        expert_id=doc.get("expert_id"),
        expert_name=doc.get("expert_name"),
        topic=doc["topic"],
        status=doc["status"],
        offer_sdp=doc.get("offer_sdp"),
        transcript=doc.get("transcript"),
        summary=doc.get("summary"),
        language_detected=doc.get("language_detected"),
        followup_note=doc.get("followup_note"),
        created_at=doc["created_at"],
        accepted_at=doc.get("accepted_at"),
        ended_at=doc.get("ended_at"),
        duration_seconds=doc.get("duration_seconds"),
    )


# ─── GET /farmer/dashboard ────────────────────────────────────────────────────

@router.get("/dashboard")
async def farmer_dashboard(
    farmer: Annotated[dict, Depends(require_farmer)],
):
    """
    Return the farmer's profile and any active/pending calls.
    Used as the initial data load for the farmer dashboard page.
    """
    calls = get_collection("calls")
    farmer_id = str(farmer["_id"])

    # Active or pending call
    active_call = await calls.find_one(
        {"farmer_id": farmer_id, "status": {"$in": ["pending", "active"]}},
        sort=[("created_at", -1)],
    )

    # Total calls summary
    total = await calls.count_documents({"farmer_id": farmer_id})
    ended = await calls.count_documents({"farmer_id": farmer_id, "status": "ended"})

    return {
        "status": "success",
        "data": {
            "user": UserPublic(
                id=farmer_id,
                name=farmer["name"],
                email=farmer["email"],
                role=farmer["role"],
                is_verified=farmer.get("is_verified", False),
                is_online=farmer.get("is_online", False),
                created_at=farmer["created_at"],
            ),
            "active_call": _serialize_call(active_call) if active_call else None,
            "stats": {
                "total_calls": total,
                "completed_calls": ended,
            },
        },
    }


# ─── GET /farmer/calls ────────────────────────────────────────────────────────

@router.get("/calls")
async def farmer_call_history(
    farmer: Annotated[dict, Depends(require_farmer)],
    page: int = 1,
    limit: int = 20,
):
    """
    Paginated call history for the logged-in farmer.
    Sorted by most recent first.
    """
    calls = get_collection("calls")
    farmer_id = str(farmer["_id"])

    skip = (page - 1) * limit

    cursor = calls.find({"farmer_id": farmer_id}).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    total = await calls.count_documents({"farmer_id": farmer_id})

    return {
        "status": "success",
        "data": {
            "calls": [_serialize_call(d) for d in docs],
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit,
        },
    }
