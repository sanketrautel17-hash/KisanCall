"""
KisanCall — Transcription Service (Phase 4)

Uses Deepgram's REST API (not pipecat) to transcribe a saved audio file.

Flow:
  1. Read the audio file from disk
  2. POST it to Deepgram's pre-recorded transcription endpoint
  3. Return the full transcript text + detected language

Deepgram docs: https://developers.deepgram.com/reference/pre-recorded
"""

import logging
import os
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
DEEPGRAM_URL = "https://api.deepgram.com/v1/listen"


# ─── Main transcription function ──────────────────────────────────────────────

async def transcribe_audio(audio_path: Path) -> dict:
    """
    Send an audio file to Deepgram for transcription.

    Args:
        audio_path: Path to the saved audio file (webm, wav, mp3, etc.)

    Returns:
        dict with keys:
            - transcript (str): Full transcript text, or "" on failure
            - language   (str): Detected language code, e.g. "hi" or "en"
            - confidence (float): Average confidence, 0.0 on failure
            - words      (list): Word-level details from Deepgram
            - error      (str | None): Error message if any

    Raises:
        Never raises — all exceptions are caught and returned in the "error" key.
    """
    if not DEEPGRAM_API_KEY:
        logger.error("[Transcription] DEEPGRAM_API_KEY is not set in environment.")
        return _failed_result("DEEPGRAM_API_KEY is not configured.")

    if not audio_path.exists():
        logger.error(f"[Transcription] Audio file not found: {audio_path}")
        return _failed_result(f"Audio file not found: {audio_path}")

    # Determine MIME type from extension
    mime_map = {
        ".webm": "audio/webm",
        ".wav":  "audio/wav",
        ".ogg":  "audio/ogg",
        ".mp3":  "audio/mpeg",
        ".mp4":  "audio/mp4",
    }
    suffix = audio_path.suffix.lower()
    content_type = mime_map.get(suffix, "audio/webm")

    logger.info(f"[Transcription] Sending {audio_path.name} ({content_type}) to Deepgram...")

    try:
        audio_bytes = audio_path.read_bytes()
    except IOError as e:
        logger.error(f"[Transcription] Cannot read audio file: {e}")
        return _failed_result(f"Cannot read audio file: {e}")

    # Deepgram query params:
    #   model=nova-2          → best accuracy
    #   detect_language=true  → auto-detect Hindi / English
    #   smart_format=true     → punctuation + formatting
    #   disfluencies=false    → remove ums/uhs
    params = {
        "model": "nova-2",
        "detect_language": "true",
        "smart_format": "true",
        "disfluencies": "false",
        "punctuate": "true",
        "language": "hi-Latn",   # Hint: Hindi — Deepgram will still auto-detect if wrong
    }

    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
        "Content-Type": content_type,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                DEEPGRAM_URL,
                params=params,
                headers=headers,
                content=audio_bytes,
            )

        if response.status_code != 200:
            logger.error(f"[Transcription] Deepgram error {response.status_code}: {response.text[:300]}")
            return _failed_result(f"Deepgram returned HTTP {response.status_code}")

        data = response.json()
        return _parse_deepgram_response(data)

    except httpx.TimeoutException:
        logger.error("[Transcription] Deepgram request timed out.")
        return _failed_result("Transcription request timed out.")
    except Exception as e:
        logger.error(f"[Transcription] Unexpected error: {e}")
        return _failed_result(str(e))


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _parse_deepgram_response(data: dict) -> dict:
    """Extract transcript, language, and confidence from Deepgram's JSON response."""
    try:
        results = data.get("results", {})
        channels = results.get("channels", [])

        if not channels:
            return _failed_result("Deepgram returned no channels in results.")

        # First channel, first alternative
        alternatives = channels[0].get("alternatives", [])
        if not alternatives:
            return _failed_result("Deepgram returned no transcript alternatives.")

        best = alternatives[0]
        transcript = best.get("transcript", "").strip()
        confidence = best.get("confidence", 0.0)
        words = best.get("words", [])

        # Detected language (Deepgram puts it at channel level)
        detected_lang = channels[0].get("detected_language", "en")

        logger.info(
            f"[Transcription] ✓ {len(transcript)} chars, "
            f"lang={detected_lang}, confidence={confidence:.2f}"
        )

        return {
            "transcript": transcript,
            "language": detected_lang,
            "confidence": round(confidence, 4),
            "words": words,
            "error": None,
        }

    except Exception as e:
        logger.error(f"[Transcription] Failed to parse Deepgram response: {e}")
        return _failed_result(f"Response parse error: {e}")


def _failed_result(reason: str) -> dict:
    """Return a standardized failure dict."""
    return {
        "transcript": "",
        "language": "en",
        "confidence": 0.0,
        "words": [],
        "error": reason,
    }
