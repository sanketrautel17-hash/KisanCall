"""
KisanCall — Matchmaking Service
Finds an available (online + verified) expert and assigns them to a call.
"""

import logging
from typing import Optional

from bson import ObjectId

from core.database import get_collection
from core.services.websocket_manager import manager
from commons.logger import logger as get_logger

logger = get_logger(__name__)


async def find_available_expert(exclude_ids: list[str] | None = None) -> Optional[dict]:
    """
    Find the first online, verified expert who is not currently in an active call.

    Args:
        exclude_ids: Optional list of expert user_id strings to skip.

    Returns:
        Expert's MongoDB document dict, or None if no expert is available.
    """
    users = get_collection("users")
    calls = get_collection("calls")

    # Build exclude filter
    exclude_filter = []
    if exclude_ids:
        try:
            exclude_filter = [ObjectId(eid) for eid in exclude_ids]
        except Exception:
            exclude_filter = []

    # Query online + verified experts not excluded
    query: dict = {
        "role": "expert",
        "is_online": True,
        "is_verified": True,
    }
    if exclude_filter:
        query["_id"] = {"$nin": exclude_filter}

    # Get all online experts
    candidates = await users.find(query).to_list(length=100)

    if not candidates:
        logger.info("[Matchmaking] No online experts found.")
        return None

    # Filter out experts already in an active call
    busy_result = await calls.distinct("expert_id", {"status": "active"})
    busy_expert_ids = set(str(eid) for eid in busy_result)

    for expert in candidates:
        expert_id_str = str(expert["_id"])
        if expert_id_str not in busy_expert_ids:
            logger.info(f"[Matchmaking] Found available expert: {expert_id_str}")
            return expert

    logger.info("[Matchmaking] All online experts are currently busy.")
    return None


async def assign_expert_to_call(call_id: str, expert: dict) -> None:
    """
    Assign an expert to a pending call — updates the call document.
    Does NOT change call status (that happens in /call/accept).

    Args:
        call_id: MongoDB _id string of the call
        expert: Full MongoDB expert document
    """
    calls = get_collection("calls")
    await calls.update_one(
        {"_id": ObjectId(call_id)},
        {
            "$set": {
                "expert_id": str(expert["_id"]),
                "expert_name": expert["name"],
            }
        },
    )
    logger.info(f"[Matchmaking] Assigned expert {expert['_id']} to call {call_id}")


async def notify_expert_incoming_call(expert_id: str, call_doc: dict) -> bool:
    """
    Send a WebSocket notification to the expert about an incoming call.

    Args:
        expert_id: Expert's user_id string
        call_doc: The call MongoDB document

    Returns:
        True if notification was delivered, False otherwise.
    """
    payload = {
        "type": "incoming_call",
        "call_id": str(call_doc["_id"]),
        "farmer_name": call_doc["farmer_name"],
        "topic": call_doc["topic"],
        "created_at": call_doc["created_at"].isoformat(),
    }
    delivered = await manager.send_to_expert(expert_id, payload)
    if delivered:
        logger.info(f"[Matchmaking] Incoming call notification sent to expert {expert_id}")
    else:
        logger.warning(f"[Matchmaking] Expert {expert_id} not connected via WS — notification not delivered")
    return delivered
