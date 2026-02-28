"""
KisanCall — Recording Service (Phase 4)

Responsibilities:
  - Accept raw PCM/WAV audio bytes submitted from the frontend at call end
  - Save the audio file to the local recordings directory
  - Return the saved file path for downstream transcription

Note on audio capture strategy:
  The frontend (React) will record the call audio using the browser's MediaRecorder API
  during the WebRTC call. At call end, it POSTs the audio blob (webm/wav) to
  POST /call/recording/{call_id}. This service persists it to disk.

Directory: backend/recordings/<call_id>.webm   (or .wav)
"""

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

# ─── Config ───────────────────────────────────────────────────────────────────

# Recordings are stored in: <backend_root>/recordings/
RECORDINGS_DIR = Path(__file__).resolve().parents[3] / "recordings"


def ensure_recordings_dir() -> None:
    """Create the recordings directory if it doesn't exist."""
    RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)


def get_recording_path(call_id: str, extension: str = "webm") -> Path:
    """Return the expected file path for a call's audio recording."""
    ensure_recordings_dir()
    return RECORDINGS_DIR / f"{call_id}.{extension}"


async def save_recording(call_id: str, audio_bytes: bytes, content_type: str = "audio/webm") -> Path:
    """
    Save raw audio bytes to disk for a given call.

    Args:
        call_id:      MongoDB call _id string.
        audio_bytes:  Raw bytes from the uploaded audio file.
        content_type: MIME type of the uploaded file (audio/webm, audio/wav, etc.)

    Returns:
        Path object pointing to the saved file.

    Raises:
        IOError: If the file cannot be written.
    """
    ensure_recordings_dir()

    # Determine extension from MIME type
    ext_map = {
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/wav": "wav",
        "audio/mpeg": "mp3",
        "audio/mp4": "mp4",
    }
    ext = ext_map.get(content_type, "webm")
    file_path = get_recording_path(call_id, ext)

    try:
        with open(file_path, "wb") as f:
            f.write(audio_bytes)
        logger.info(f"[Recording] Saved audio for call {call_id} → {file_path} ({len(audio_bytes)} bytes)")
        return file_path
    except IOError as e:
        logger.error(f"[Recording] Failed to save audio for call {call_id}: {e}")
        raise


def recording_exists(call_id: str) -> tuple[bool, Path | None]:
    """
    Check whether a recording exists for a call (any extension).

    Returns:
        (True, path) if found, (False, None) if not.
    """
    ensure_recordings_dir()
    for ext in ("webm", "wav", "ogg", "mp3", "mp4"):
        path = get_recording_path(call_id, ext)
        if path.exists():
            return True, path
    return False, None


def delete_recording(call_id: str) -> bool:
    """
    Delete the recording for a call after processing to save disk space.

    Returns:
        True if deleted, False if not found.
    """
    found, path = recording_exists(call_id)
    if found and path:
        try:
            os.remove(path)
            logger.info(f"[Recording] Deleted recording for call {call_id}")
            return True
        except OSError as e:
            logger.warning(f"[Recording] Could not delete recording for call {call_id}: {e}")
    return False
