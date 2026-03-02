"""
KisanCall — Expert Routes

GET  /expert/dashboard      → expert profile + active call + online status
GET  /expert/calls          → full call history for the logged-in expert
POST /expert/toggle-online  → toggle expert's online/offline availability
POST /expert/followup/{call_id} → add a follow-up note after call ends
"""

from datetime import datetime
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from core.database import get_collection
from core.models.call import CallPublic, FollowupNotePayload
from core.models.user import UserPublic
from core.services.auth_service import require_expert
from commons.logger import logger as get_logger

log = get_logger(__name__)
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


# ─── GET /expert/dashboard ────────────────────────────────────────────────────

@router.get("/dashboard")
async def expert_dashboard(
    expert: Annotated[dict, Depends(require_expert)],
):
    """
    Expert's profile, online status, and any active call.
    """
    expert_id = str(expert["_id"])
    log.info(f"[Expert:dashboard] Request — expert_id={expert_id}")
    calls = get_collection("calls")

    active_call = await calls.find_one(
        {"expert_id": expert_id, "status": {"$in": ["pending", "active"]}},
        sort=[("created_at", -1)],
    )

    total = await calls.count_documents({"expert_id": expert_id})
    ended = await calls.count_documents({"expert_id": expert_id, "status": "ended"})

    log.debug(f"[Expert:dashboard] expert_id={expert_id} — total={total}, ended={ended}, is_online={expert.get('is_online')}")
    return {
        "status": "success",
        "data": {
            "user": UserPublic(
                id=expert_id,
                name=expert["name"],
                email=expert["email"],
                role=expert["role"],
                is_verified=expert.get("is_verified", False),
                is_online=expert.get("is_online", False),
                created_at=expert["created_at"],
            ),
            "active_call": _serialize_call(active_call) if active_call else None,
            "stats": {
                "total_consultations": total,
                "completed_consultations": ended,
            },
        },
    }


# ─── POST /expert/toggle-online ───────────────────────────────────────────────

@router.post("/toggle-online")
async def toggle_online(
    expert: Annotated[dict, Depends(require_expert)],
):
    """
    Toggle the expert's online/offline availability.
    Returns the new status.
    """
    users = get_collection("users")
    expert_id = expert["_id"]
    current_status = expert.get("is_online", False)
    new_status = not current_status

    await users.update_one(
        {"_id": expert_id},
        {"$set": {"is_online": new_status}},
    )
    log.info(f"[Expert:toggle-online] expert_id={expert_id} — is_online set to {new_status}")

    # If expert just came online, check for unassigned pending calls
    if new_status:
        from core.services.matchmaking import assign_expert_to_call, notify_expert_incoming_call
        calls = get_collection("calls")
        unassigned = await calls.find_one({"status": "pending", "expert_id": None})
        if unassigned:
            log.info(f"[Expert:toggle-online] Found unassigned pending call {unassigned['_id']} — assigning to expert {expert_id}")
            await assign_expert_to_call(str(unassigned["_id"]), expert)
            unassigned["expert_id"] = str(expert["_id"])
            unassigned["expert_name"] = expert["name"]
            await notify_expert_incoming_call(str(expert["_id"]), unassigned)

    return {
        "status": "success",
        "data": {
            "is_online": new_status,
            "message": "You are now Online 🟢" if new_status else "You are now Offline 🔴",
        },
    }


# ─── GET /expert/calls ────────────────────────────────────────────────────────

@router.get("/calls")
async def expert_call_history(
    expert: Annotated[dict, Depends(require_expert)],
    page: int = 1,
    limit: int = 20,
):
    """
    Paginated call history for the logged-in expert.
    Sorted by most recent first.
    """
    calls = get_collection("calls")
    expert_id = str(expert["_id"])

    skip = (page - 1) * limit
    cursor = calls.find({"expert_id": expert_id}).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    total = await calls.count_documents({"expert_id": expert_id})

    return {
        "status": "success",
        "data": {
            "calls": [_serialize_call(d) for d in docs],
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit,
        },
    }


# ─── POST /expert/followup/{call_id} ──────────────────────────────────────────

@router.post("/followup/{call_id}")
async def add_followup_note(
    call_id: str,
    body: FollowupNotePayload,
    expert: Annotated[dict, Depends(require_expert)],
):
    """
    Add a follow-up note to an ended call.
    Only the expert who handled the call can add a note.
    """
    log.info(f"[Expert:followup] expert_id={expert['_id']} — adding note to call_id={call_id}")
    calls = get_collection("calls")

    try:
        call = await calls.find_one({"_id": ObjectId(call_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid call ID")

    if not call:
        raise HTTPException(status_code=404, detail="Call not found")

    if call.get("expert_id") != str(expert["_id"]):
        log.warning(f"[Expert:followup] Unauthorized — expert {expert['_id']} does not own call {call_id}")
        raise HTTPException(status_code=403, detail="You did not handle this call")

    if call["status"] != "ended":
        log.warning(f"[Expert:followup] Call {call_id} is not ended (status={call['status']})")
        raise HTTPException(status_code=400, detail="Follow-up notes can only be added after call ends")

    await calls.update_one(
        {"_id": ObjectId(call_id)},
        {"$set": {"followup_note": body.note}},
    )
    log.info(f"[Expert:followup] Note saved for call_id={call_id}")

    return {
        "status": "success",
        "message": "Follow-up note saved successfully",
        "data": {"call_id": call_id, "note": body.note},
    }
