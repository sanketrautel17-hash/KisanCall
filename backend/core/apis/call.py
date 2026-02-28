"""
KisanCall — Call Routes (Phase 3 + 4: WebRTC Calling + AI Post-Call)

HTTP endpoints:
  POST /call/request              → Farmer requests a call
  POST /call/accept/{call_id}     → Expert accepts the call
  POST /call/reject/{call_id}     → Expert rejects the call
  POST /call/end/{call_id}        → Either party ends the call (triggers AI pipeline)
  POST /call/recording/{call_id}  → Upload call audio for transcription (Phase 4)
  POST /api/offer                 → WebRTC offer SDP (farmer → backend → expert)
  POST /api/answer                → WebRTC answer SDP (expert → backend → farmer)
  POST /api/ice-candidate         → ICE candidate relay (bidirectional)
  GET  /call/status/{call_id}     → Poll call status

WebSocket endpoints:
  WS /ws/farmer                   → Farmer real-time notifications
  WS /ws/expert                   → Expert real-time notifications
"""

import asyncio
import logging
from datetime import datetime
from typing import Annotated, Optional

from bson import ObjectId
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    UploadFile,
    File,
    WebSocket,
    WebSocketDisconnect,
    status,
)

from core.database import get_collection
from core.models.call import (
    CallPublic,
    CallRequestPayload,
    FollowupNotePayload,
    ICECandidatePayload,
    WebRTCAnswerPayload,
    WebRTCOfferPayload,
)
from core.services.auth_service import get_current_user, require_expert, require_farmer
from core.services.matchmaking import (
    assign_expert_to_call,
    find_available_expert,
    notify_expert_incoming_call,
)
from core.services.websocket_manager import manager
from core.services.recording import save_recording, recording_exists, delete_recording
from core.services.transcription import transcribe_audio
from core.services.ai_summary import generate_summary

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _serialize_call(doc: dict) -> CallPublic:
    """Convert a MongoDB call document to the public response schema."""
    return CallPublic(
        id=str(doc["_id"]),
        farmer_id=str(doc["farmer_id"]),
        farmer_name=doc["farmer_name"],
        expert_id=doc.get("expert_id"),
        expert_name=doc.get("expert_name"),
        topic=doc["topic"],
        status=doc["status"],
        offer_sdp=doc.get("offer_sdp"),        # ← needed by ExpertCallScreen fallback
        transcript=doc.get("transcript"),
        summary=doc.get("summary"),
        language_detected=doc.get("language_detected"),
        followup_note=doc.get("followup_note"),
        created_at=doc["created_at"],
        accepted_at=doc.get("accepted_at"),
        ended_at=doc.get("ended_at"),
        duration_seconds=doc.get("duration_seconds"),
    )


async def _get_call_or_404(call_id: str) -> dict:
    """Fetch a call document by ID, raise 404 if not found."""
    calls = get_collection("calls")
    try:
        doc = await calls.find_one({"_id": ObjectId(call_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid call ID format")
    if not doc:
        raise HTTPException(status_code=404, detail="Call not found")
    return doc


# ─── POST /call/request ───────────────────────────────────────────────────────

@router.post("/call/request", status_code=status.HTTP_201_CREATED)
async def request_call(
    body: CallRequestPayload,
    farmer: Annotated[dict, Depends(require_farmer)],
):
    """
    Farmer requests a call on a specific topic.
    Backend finds an available expert and notifies them via WebSocket.
    """
    calls = get_collection("calls")

    # Check: farmer doesn't already have a pending/active call
    existing = await calls.find_one({
        "farmer_id": str(farmer["_id"]),
        "status": {"$in": ["pending", "active"]},
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You already have an active or pending call. Please end it first.",
        )

    # Insert call with pending status
    call_doc = {
        "farmer_id": str(farmer["_id"]),
        "farmer_name": farmer["name"],
        "expert_id": None,
        "expert_name": None,
        "topic": body.topic,
        "status": "pending",
        "offer_sdp": None,
        "answer_sdp": None,
        "transcript": None,
        "summary": None,
        "language_detected": None,
        "followup_note": None,
        "created_at": datetime.utcnow(),
        "accepted_at": None,
        "started_at": None,
        "ended_at": None,
        "duration_seconds": None,
    }

    result = await calls.insert_one(call_doc)
    call_doc["_id"] = result.inserted_id

    # Find an available expert
    expert = await find_available_expert()

    if not expert:
        # No expert available — call stays pending, farmer will be notified when expert connects
        logger.info(f"[Call] No expert available for call {result.inserted_id}")
        return {
            "status": "success",
            "message": "Call placed. Waiting for an available expert...",
            "data": _serialize_call(call_doc),
        }

    # Assign expert to call
    await assign_expert_to_call(str(result.inserted_id), expert)
    call_doc["expert_id"] = str(expert["_id"])
    call_doc["expert_name"] = expert["name"]

    # Notify expert via WebSocket
    await notify_expert_incoming_call(str(expert["_id"]), call_doc)

    return {
        "status": "success",
        "message": "Call placed. Expert has been notified.",
        "data": _serialize_call(call_doc),
    }


# ─── POST /call/accept/{call_id} ─────────────────────────────────────────────

@router.post("/call/accept/{call_id}")
async def accept_call(
    call_id: str,
    expert: Annotated[dict, Depends(require_expert)],
):
    """
    Expert accepts a call. Status: pending → active.
    Notifies the farmer via WebSocket.
    """
    calls = get_collection("calls")
    call = await _get_call_or_404(call_id)

    # Verify this expert is the assigned one
    if call.get("expert_id") != str(expert["_id"]):
        raise HTTPException(status_code=403, detail="This call was not assigned to you")

    if call["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot accept a call with status '{call['status']}'")

    now = datetime.utcnow()
    await calls.update_one(
        {"_id": ObjectId(call_id)},
        {"$set": {"status": "active", "accepted_at": now, "started_at": now}},
    )

    # Notify farmer: call was accepted
    await manager.send_to_farmer(
        call["farmer_id"],
        {
            "type": "call_accepted",
            "call_id": call_id,
            "expert_name": expert["name"],
            "message": f"Expert {expert['name']} has accepted your call. Connecting...",
        },
    )

    logger.info(f"[Call] Expert {expert['_id']} accepted call {call_id}")
    return {
        "status": "success",
        "message": "Call accepted",
        "data": {"call_id": call_id, "status": "active"},
    }


# ─── POST /call/reject/{call_id} ─────────────────────────────────────────────

@router.post("/call/reject/{call_id}")
async def reject_call(
    call_id: str,
    expert: Annotated[dict, Depends(require_expert)],
):
    """
    Expert rejects a call. Tries to find another expert; if none, call stays pending
    or becomes 'rejected'.
    """
    calls = get_collection("calls")
    call = await _get_call_or_404(call_id)

    if call.get("expert_id") != str(expert["_id"]):
        raise HTTPException(status_code=403, detail="This call was not assigned to you")

    if call["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot reject a call with status '{call['status']}'")

    # Try to find another expert
    new_expert = await find_available_expert(exclude_ids=[str(expert["_id"])])

    if new_expert:
        # Re-assign to new expert
        await assign_expert_to_call(call_id, new_expert)
        call["expert_id"] = str(new_expert["_id"])
        call["expert_name"] = new_expert["name"]
        await notify_expert_incoming_call(str(new_expert["_id"]), call)

        await manager.send_to_farmer(
            call["farmer_id"],
            {
                "type": "call_reassigned",
                "call_id": call_id,
                "message": "Your call has been reassigned to another expert.",
            },
        )

        return {"status": "success", "message": "Call rejected; reassigned to another expert"}

    # No other expert — mark as rejected
    await calls.update_one(
        {"_id": ObjectId(call_id)},
        {"$set": {"status": "rejected", "ended_at": datetime.utcnow()}},
    )

    # Notify farmer
    await manager.send_to_farmer(
        call["farmer_id"],
        {
            "type": "call_rejected",
            "call_id": call_id,
            "message": "No experts are available right now. Please try again later.",
        },
    )

    logger.info(f"[Call] Call {call_id} rejected — no alternative expert available")
    return {"status": "success", "message": "Call rejected. No experts available."}


# ─── POST /call/end/{call_id} ────────────────────────────────────────────────

@router.post("/call/end/{call_id}")
async def end_call(
    call_id: str,
    background_tasks: BackgroundTasks,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """
    Either party can end the call. Status: active → ended.
    Notifies the other party via WebSocket.
    Fires the Phase 4 AI pipeline (transcription + summary) as a background task
    if a recording is already uploaded.
    """
    calls = get_collection("calls")
    call = await _get_call_or_404(call_id)

    user_id = str(current_user["_id"])

    # Authorise: must be the farmer or expert of this call
    if call["farmer_id"] != user_id and call.get("expert_id") != user_id:
        raise HTTPException(status_code=403, detail="You are not part of this call")

    if call["status"] not in ("active", "pending"):
        raise HTTPException(status_code=400, detail=f"Cannot end a call with status '{call['status']}'")

    now = datetime.utcnow()
    started = call.get("started_at") or call.get("created_at")
    duration = int((now - started).total_seconds()) if started else None

    await calls.update_one(
        {"_id": ObjectId(call_id)},
        {"$set": {"status": "ended", "ended_at": now, "duration_seconds": duration}},
    )

    # Notify the other party
    ended_by = current_user.get("name", "other party")
    if call["farmer_id"] == user_id and call.get("expert_id"):
        # Farmer ended → notify expert
        await manager.send_to_expert(
            call["expert_id"],
            {"type": "call_ended", "call_id": call_id, "ended_by": ended_by},
        )
    elif call.get("expert_id") == user_id:
        # Expert ended → notify farmer
        await manager.send_to_farmer(
            call["farmer_id"],
            {"type": "call_ended", "call_id": call_id, "ended_by": ended_by},
        )

    # Phase 4: If recording already uploaded, kick off AI pipeline in background
    already_recorded, _ = recording_exists(call_id)
    if already_recorded:
        background_tasks.add_task(_run_postcall_pipeline, call_id)
        logger.info(f"[Call] AI pipeline queued for call {call_id} (recording exists)")

    logger.info(f"[Call] Call {call_id} ended by {user_id}. Duration: {duration}s")
    return {
        "status": "success",
        "message": "Call ended",
        "data": {
            "call_id": call_id,
            "duration_seconds": duration,
            "ai_processing": already_recorded,  # Let frontend know if AI is running
        },
    }


# ─── POST /call/recording/{call_id} ──────────────────────────────────────────

@router.post("/call/recording/{call_id}")
async def upload_recording(
    call_id: str,
    background_tasks: BackgroundTasks,
    current_user: Annotated[dict, Depends(get_current_user)],
    audio: UploadFile = File(..., description="Recorded call audio (webm/wav/ogg)"),
):
    """
    Upload the call audio recording from the browser (MediaRecorder blob).
    Saves the file to disk, then triggers the AI pipeline:
      1. Deepgram STT → transcript
      2. Groq LLM   → summary
      3. Save both to MongoDB

    Can be called BEFORE or AFTER /call/end — both cases are handled.
    """
    call = await _get_call_or_404(call_id)
    user_id = str(current_user["_id"])

    # Authorise: farmer or expert of this call only
    if call["farmer_id"] != user_id and call.get("expert_id") != user_id:
        raise HTTPException(status_code=403, detail="You are not part of this call")

    # Validate file
    allowed_types = {"audio/webm", "audio/wav", "audio/ogg", "audio/mpeg", "audio/mp4"}
    content_type = audio.content_type or "audio/webm"
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio type: {content_type}. Expected one of {allowed_types}",
        )

    # Read and save
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

    try:
        saved_path = await save_recording(call_id, audio_bytes, content_type)
    except IOError as e:
        raise HTTPException(status_code=500, detail=f"Failed to save recording: {e}")

    # If call is already ended, kick off AI pipeline immediately
    if call["status"] == "ended":
        background_tasks.add_task(_run_postcall_pipeline, call_id)
        processing_msg = "Recording saved. AI transcription and summary starting..."
    else:
        # Call still active — pipeline will run when /call/end is called
        processing_msg = "Recording saved. AI pipeline will run after call ends."

    logger.info(f"[Recording] Uploaded {saved_path.name} ({len(audio_bytes)} bytes) for call {call_id}")
    return {
        "status": "success",
        "message": processing_msg,
        "data": {
            "call_id": call_id,
            "file_size_bytes": len(audio_bytes),
            "content_type": content_type,
        },
    }


# ─── Phase 4: Post-Call AI Pipeline ──────────────────────────────────────────

async def _run_postcall_pipeline(call_id: str) -> None:
    """
    Background task: transcribe the call audio, generate an AI summary,
    then persist both to MongoDB and notify the farmer via WebSocket.

    Steps:
      1. Find the saved recording file
      2. Transcribe via Deepgram STT → transcript + detected language
      3. Generate consultation summary via Groq LLM
      4. Update MongoDB call document with transcript + summary
      5. Notify farmer via WebSocket that summary is ready
      6. Delete recording from disk (optional, saves space)
    """
    logger.info(f"[PostCall] Starting AI pipeline for call {call_id}")
    calls = get_collection("calls")

    # ── Step 1: Locate the recording ──────────────────────────────────────────
    found, audio_path = recording_exists(call_id)
    if not found or audio_path is None:
        logger.warning(f"[PostCall] No recording found for call {call_id}. Skipping AI pipeline.")
        return

    # ── Step 2: Transcription (Deepgram) ─────────────────────────────────────
    try:
        t_result = await transcribe_audio(audio_path)
    except Exception as e:
        logger.error(f"[PostCall] Transcription crashed for call {call_id}: {e}")
        t_result = {"transcript": "", "language": "en", "confidence": 0.0, "words": [], "error": str(e)}

    transcript = t_result.get("transcript", "")
    language = t_result.get("language", "en")

    if t_result.get("error"):
        logger.warning(f"[PostCall] Transcription error for call {call_id}: {t_result['error']}")

    # ── Step 3: AI Summary (Groq) ─────────────────────────────────────────────
    try:
        s_result = await generate_summary(transcript, language)
    except Exception as e:
        logger.error(f"[PostCall] Summary generation crashed for call {call_id}: {e}")
        s_result = {"summary": "", "language": language, "model": "", "tokens": 0, "error": str(e)}

    summary = s_result.get("summary", "")

    if s_result.get("error"):
        logger.warning(f"[PostCall] Summary error for call {call_id}: {s_result['error']}")

    # ── Step 4: Persist to MongoDB ────────────────────────────────────────────
    update_fields: dict = {
        "transcript": transcript or None,
        "summary": summary or None,
        "language_detected": language,
        "ai_processed_at": datetime.utcnow(),
        "ai_error": t_result.get("error") or s_result.get("error"),
    }

    await calls.update_one(
        {"_id": ObjectId(call_id)},
        {"$set": update_fields},
    )
    transcript_str: str = transcript if isinstance(transcript, str) else ""
    summary_str: str = summary if isinstance(summary, str) else ""
    logger.info(
        f"[PostCall] MongoDB updated for call {call_id} \u2014 "
        f"transcript={len(transcript_str)} chars, summary={len(summary_str)} chars"
    )

    # ── Step 5: Notify farmer via WebSocket ───────────────────────────────────
    call_doc = await calls.find_one({"_id": ObjectId(call_id)})
    if call_doc:
        farmer_id = call_doc.get("farmer_id")
        if farmer_id:
            await manager.send_to_farmer(
                farmer_id,
                {
                    "type": "summary_ready",
                    "call_id": call_id,
                    "has_transcript": bool(transcript),
                    "has_summary": bool(summary),
                    "language": language,
                    "message": "Your consultation summary is ready!",
                },
            )
        # Also notify expert
        expert_id = call_doc.get("expert_id")
        if expert_id:
            await manager.send_to_expert(
                expert_id,
                {
                    "type": "summary_ready",
                    "call_id": call_id,
                    "has_transcript": bool(transcript),
                    "has_summary": bool(summary),
                    "message": "Consultation summary generated.",
                },
            )

    # ── Step 6: Delete recording from disk ────────────────────────────────────
    delete_recording(call_id)
    logger.info(f"[PostCall] ✓ AI pipeline complete for call {call_id}")


# ─── GET /call/status/{call_id} ──────────────────────────────────────────────

@router.get("/call/status/{call_id}", response_model=CallPublic)
async def get_call_status(
    call_id: str,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Poll the current status of a call (useful as fallback if WS disconnects)."""
    call = await _get_call_or_404(call_id)
    user_id = str(current_user["_id"])

    if call["farmer_id"] != user_id and call.get("expert_id") != user_id:
        raise HTTPException(status_code=403, detail="You are not part of this call")

    return _serialize_call(call)


# ─── WebRTC Signaling ─────────────────────────────────────────────────────────
# The signaling relay works like this:
#   1. Farmer sends offer SDP → POST /api/offer  → stored in DB + forwarded to expert via WS
#   2. Expert sends answer SDP → POST /api/answer → stored in DB + forwarded to farmer via WS
#   3. Both send ICE candidates → POST /api/ice-candidate → forwarded to the other party via WS


@router.post("/api/offer")
async def webrtc_offer(
    body: WebRTCOfferPayload,
    farmer: Annotated[dict, Depends(require_farmer)],
):
    """
    Farmer sends WebRTC offer SDP.
    Stores in DB and forwards to expert via WebSocket.
    """
    calls = get_collection("calls")
    call = await _get_call_or_404(body.call_id)

    if call["farmer_id"] != str(farmer["_id"]):
        raise HTTPException(status_code=403, detail="Not your call")

    if call["status"] != "active":
        raise HTTPException(status_code=400, detail="Call is not active")

    # Store offer SDP
    await calls.update_one(
        {"_id": ObjectId(body.call_id)},
        {"$set": {"offer_sdp": body.sdp}},
    )

    # Forward to expert
    if call.get("expert_id"):
        await manager.send_to_expert(
            call["expert_id"],
            {
                "type": "webrtc_offer",
                "call_id": body.call_id,
                "sdp": body.sdp,
                "sdp_type": body.type,
            },
        )

    return {"status": "success", "message": "Offer forwarded to expert"}


@router.post("/api/answer")
async def webrtc_answer(
    body: WebRTCAnswerPayload,
    expert: Annotated[dict, Depends(require_expert)],
):
    """
    Expert sends WebRTC answer SDP.
    Stores in DB and forwards to farmer via WebSocket.
    """
    calls = get_collection("calls")
    call = await _get_call_or_404(body.call_id)

    if call.get("expert_id") != str(expert["_id"]):
        raise HTTPException(status_code=403, detail="Not your call")

    if call["status"] != "active":
        raise HTTPException(status_code=400, detail="Call is not active")

    # Store answer SDP
    await calls.update_one(
        {"_id": ObjectId(body.call_id)},
        {"$set": {"answer_sdp": body.sdp}},
    )

    # Forward to farmer
    await manager.send_to_farmer(
        call["farmer_id"],
        {
            "type": "webrtc_answer",
            "call_id": body.call_id,
            "sdp": body.sdp,
            "sdp_type": body.type,
        },
    )

    return {"status": "success", "message": "Answer forwarded to farmer"}


@router.post("/api/ice-candidate")
async def ice_candidate(
    body: ICECandidatePayload,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """
    Relay ICE candidate between farmer and expert.
    Detects caller role and forwards to the other party.
    """
    call = await _get_call_or_404(body.call_id)
    user_id = str(current_user["_id"])
    role = current_user.get("role")

    payload = {
        "type": "ice_candidate",
        "call_id": body.call_id,
        "candidate": body.candidate,
        "sdp_mid": body.sdp_mid,
        "sdp_mline_index": body.sdp_mline_index,
    }

    if role == "farmer" and call["farmer_id"] == user_id:
        # Send to expert
        if call.get("expert_id"):
            await manager.send_to_expert(call["expert_id"], payload)
    elif role == "expert" and call.get("expert_id") == user_id:
        # Send to farmer
        await manager.send_to_farmer(call["farmer_id"], payload)
    else:
        raise HTTPException(status_code=403, detail="Not part of this call")

    return {"status": "success", "message": "ICE candidate relayed"}


# ─── WebSocket: Farmer ────────────────────────────────────────────────────────

@router.websocket("/ws/farmer")
async def farmer_ws(websocket: WebSocket):
    """
    Persistent WebSocket for farmers.
    Auth: farmer must send {"type": "auth", "token": "<JWT>"} as first message.
    """
    from core.services.auth_service import decode_access_token
    from core.database import get_collection as gc

    await websocket.accept()
    user_id: Optional[str] = None

    try:
        # Step 1: Wait for auth message
        raw = await websocket.receive_json()
        if raw.get("type") != "auth":
            await websocket.send_json({"type": "error", "message": "First message must be auth"})
            await websocket.close(code=4001)
            return

        token = raw.get("token", "")
        payload = decode_access_token(token)
        if not payload or payload.get("role") != "farmer":
            await websocket.send_json({"type": "error", "message": "Invalid or missing JWT token"})
            await websocket.close(code=4003)
            return

        user_id = payload["sub"]

        # Register (already accepted, so use internal dict directly)
        manager._farmers[user_id] = websocket
        await websocket.send_json({"type": "connected", "message": "Farmer WebSocket connected", "user_id": user_id})

        logger.info(f"[WS:farmer] {user_id} authenticated")

        # On reconnect: check for pending calls and notify
        calls = gc("calls")
        pending = await calls.find_one({
            "farmer_id": user_id,
            "status": "pending",
        })
        if pending:
            await websocket.send_json({
                "type": "pending_call",
                "call_id": str(pending["_id"]),
                "message": "You have a pending call waiting for an expert.",
            })

        # Step 2: Keep alive — listen for heartbeats or end messages
        while True:
            msg = await websocket.receive_json()
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif msg.get("type") == "end_call" and msg.get("call_id"):
                # Allow farmer to end call via WS
                calls = gc("calls")
                call = await calls.find_one({"_id": ObjectId(msg["call_id"])})
                if call and call["farmer_id"] == user_id and call["status"] in ("active", "pending"):
                    now = datetime.utcnow()
                    started = call.get("started_at") or call.get("created_at")
                    duration = int((now - started).total_seconds()) if started else None
                    await calls.update_one(
                        {"_id": ObjectId(msg["call_id"])},
                        {"$set": {"status": "ended", "ended_at": now, "duration_seconds": duration}},
                    )
                    if call.get("expert_id"):
                        await manager.send_to_expert(
                            call["expert_id"],
                            {"type": "call_ended", "call_id": msg["call_id"], "ended_by": "farmer"},
                        )
                    await websocket.send_json({"type": "call_ended", "call_id": msg["call_id"]})

    except WebSocketDisconnect:
        logger.info(f"[WS:farmer] {user_id} disconnected")
    except Exception as e:
        logger.error(f"[WS:farmer] Error for {user_id}: {e}")
    finally:
        if user_id:
            manager.disconnect_farmer(user_id)


# ─── WebSocket: Expert ────────────────────────────────────────────────────────

@router.websocket("/ws/expert")
async def expert_ws(websocket: WebSocket):
    """
    Persistent WebSocket for experts.
    Auth: expert must send {"type": "auth", "token": "<JWT>"} as first message.
    After auth, expert can also toggle online status:
      {"type": "set_online", "is_online": true|false}
    """
    from core.services.auth_service import decode_access_token
    from core.database import get_collection as gc

    await websocket.accept()
    user_id: Optional[str] = None

    try:
        # Step 1: Auth
        raw = await websocket.receive_json()
        if raw.get("type") != "auth":
            await websocket.send_json({"type": "error", "message": "First message must be auth"})
            await websocket.close(code=4001)
            return

        token = raw.get("token", "")
        payload = decode_access_token(token)
        if not payload or payload.get("role") != "expert":
            await websocket.send_json({"type": "error", "message": "Invalid or missing JWT token"})
            await websocket.close(code=4003)
            return

        user_id = payload["sub"]

        # Register
        manager._experts[user_id] = websocket
        await websocket.send_json({"type": "connected", "message": "Expert WebSocket connected", "user_id": user_id})

        logger.info(f"[WS:expert] {user_id} authenticated")

        # On expert connect: check for any pending call assigned to them
        calls = gc("calls")
        assigned_pending = await calls.find_one({
            "expert_id": user_id,
            "status": "pending",
        })
        if assigned_pending:
            await websocket.send_json({
                "type": "incoming_call",
                "call_id": str(assigned_pending["_id"]),
                "farmer_name": assigned_pending["farmer_name"],
                "topic": assigned_pending["topic"],
                "created_at": assigned_pending["created_at"].isoformat(),
                "message": "You have a pending incoming call.",
            })

        # Step 2: Message loop
        while True:
            msg = await websocket.receive_json()

            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg.get("type") == "set_online":
                is_online = bool(msg.get("is_online", False))
                users = gc("users")
                await users.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$set": {"is_online": is_online}},
                )
                await websocket.send_json({
                    "type": "status_updated",
                    "is_online": is_online,
                    "message": "Online" if is_online else "Offline",
                })
                logger.info(f"[WS:expert] {user_id} set is_online={is_online}")

                # If expert just came online, check if any unassigned pending calls exist
                if is_online:
                    unassigned = await calls.find_one({
                        "status": "pending",
                        "expert_id": None,
                    })
                    if unassigned:
                        # Assign this expert
                        users_col = gc("users")
                        expert_doc = await users_col.find_one({"_id": ObjectId(user_id)})
                        if expert_doc:
                            await assign_expert_to_call(str(unassigned["_id"]), expert_doc)
                            unassigned["expert_id"] = user_id
                            unassigned["expert_name"] = expert_doc["name"]
                            await notify_expert_incoming_call(user_id, unassigned)

            elif msg.get("type") == "end_call" and msg.get("call_id"):
                calls = gc("calls")
                call = await calls.find_one({"_id": ObjectId(msg["call_id"])})
                if call and call.get("expert_id") == user_id and call["status"] in ("active", "pending"):
                    now = datetime.utcnow()
                    started = call.get("started_at") or call.get("created_at")
                    duration = int((now - started).total_seconds()) if started else None
                    await calls.update_one(
                        {"_id": ObjectId(msg["call_id"])},
                        {"$set": {"status": "ended", "ended_at": now, "duration_seconds": duration}},
                    )
                    await manager.send_to_farmer(
                        call["farmer_id"],
                        {"type": "call_ended", "call_id": msg["call_id"], "ended_by": "expert"},
                    )
                    await websocket.send_json({"type": "call_ended", "call_id": msg["call_id"]})

    except WebSocketDisconnect:
        logger.info(f"[WS:expert] {user_id} disconnected")
    except Exception as e:
        logger.error(f"[WS:expert] Error for {user_id}: {e}")
    finally:
        if user_id:
            manager.disconnect_expert(user_id)
