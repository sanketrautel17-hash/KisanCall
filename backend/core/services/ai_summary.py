"""
KisanCall — AI Summary Service (Phase 4)

Uses Groq's LLM (llama-3.1-8b-instant) to generate a structured consultation
summary from the call transcript.

The summary is returned in the SAME language the user spoke (Hindi or English),
with key sections:
  - Problem described by farmer
  - Advice given by expert
  - Action items / next steps
  - Follow-up required (yes/no)

Groq API docs: https://console.groq.com/docs/openai
"""

import logging
import os
from typing import Optional

import httpx
from dotenv import load_dotenv
from commons.logger import logger as get_logger

load_dotenv()

logger = get_logger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"  # Best quality available on Groq


# ─── System prompts ───────────────────────────────────────────────────────────

SYSTEM_PROMPT_EN = """You are an expert agricultural consultant summarizer for KisanCall, 
a farmer tele-consultation platform in India.

Given a raw conversation transcript between a farmer and an expert, generate a 
structured consultation summary. The transcript may contain both Hindi and English words.

Return a structured summary in ENGLISH with the following sections:

**Farmer's Problem:**
[What problem or query the farmer described]

**Expert's Advice:**
[What guidance or solution the expert provided]

**Action Items:**
[Bullet list of specific steps the farmer should take]

**Follow-up Required:**
[Yes/No and why]

**Consultation Summary:**
[2-3 sentence overall summary of the consultation]

Be concise, practical, and use simple language a farmer can understand.
If the transcript is empty or too short to summarize, return: "Transcript too short to summarize."
"""

SYSTEM_PROMPT_HI = """आप KisanCall के लिए एक कृषि परामर्श सारांश विशेषज्ञ हैं।
KisanCall भारत में किसानों के लिए एक टेली-परामर्श प्लेटफॉर्म है।

एक किसान और एक कृषि विशेषज्ञ के बीच की बातचीत के कच्चे ट्रांसक्रिप्ट को देखकर,
एक संरचित परामर्श सारांश तैयार करें। ट्रांसक्रिप्ट में हिंदी और अंग्रेजी दोनों शब्द हो सकते हैं।

HINDI में निम्नलिखित खंडों के साथ एक संरचित सारांश लौटाएं:

**किसान की समस्या:**
[किसान ने कौन सी समस्या या प्रश्न बताया]

**विशेषज्ञ की सलाह:**
[विशेषज्ञ ने कौन सा मार्गदर्शन या समाधान दिया]

**क्या करना है (एक्शन आइटम):**
[किसान को क्या कदम उठाने चाहिए - बुलेट सूची]

**फॉलो-अप जरूरी:**
[हाँ/नहीं और क्यों]

**परामर्श सारांश:**
[2-3 वाक्यों में पूरे परामर्श का सारांश]

सरल और व्यावहारिक भाषा का उपयोग करें जो किसान समझ सके।
यदि ट्रांसक्रिप्ट बहुत छोटा है, तो लिखें: "ट्रांसक्रिप्ट सारांश के लिए बहुत छोटा है।"
"""


# ─── Main summary function ────────────────────────────────────────────────────

async def generate_summary(transcript: str, language: str = "en") -> dict:
    """
    Generate an AI consultation summary via Groq LLM.

    Args:
        transcript: Full text transcript from Deepgram.
        language:   Detected language code ("hi" or "en"). Defaults to "en".

    Returns:
        dict with keys:
            - summary    (str): Formatted summary text, or "" on failure
            - language   (str): Same language code passed in
            - model      (str): Model used
            - tokens     (int): Total tokens used
            - error      (str | None): Error message if any
    """
    if not GROQ_API_KEY:
        logger.error("[AISummary] GROQ_API_KEY is not set in environment.")
        return _failed_summary("GROQ_API_KEY is not configured.", language)

    # Sanitize transcript
    transcript = transcript.strip() if transcript else ""
    if len(transcript) < 20:
        logger.warning(f"[AISummary] Transcript too short ({len(transcript)} chars) — skipping summary.")
        return _failed_summary("Transcript too short to summarize.", language)

    # Choose system prompt based on language
    use_hindi = language.startswith("hi")
    system_prompt = SYSTEM_PROMPT_HI if use_hindi else SYSTEM_PROMPT_EN
    response_lang = "Hindi" if use_hindi else "English"

    user_message = (
        f"Please summarize the following KisanCall consultation transcript in {response_lang}:\n\n"
        f"---TRANSCRIPT START---\n{transcript}\n---TRANSCRIPT END---"
    )

    logger.info(f"[AISummary] Generating summary (lang={language}, chars={len(transcript)})...")

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.3,        # Low temp for factual summaries
        "max_tokens": 1024,
        "top_p": 0.9,
        "stream": False,
    }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                GROQ_API_URL,
                json=payload,
                headers=headers,
            )

        if response.status_code != 200:
            logger.error(f"[AISummary] Groq error {response.status_code}: {response.text[:300]}")
            return _failed_summary(f"Groq returned HTTP {response.status_code}", language)

        data = response.json()
        return _parse_groq_response(data, language)

    except httpx.TimeoutException:
        logger.error("[AISummary] Groq request timed out.")
        return _failed_summary("Summary generation timed out.", language)
    except Exception as e:
        logger.error(f"[AISummary] Unexpected error: {e}")
        return _failed_summary(str(e), language)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _parse_groq_response(data: dict, language: str) -> dict:
    """Extract the summary text from Groq's OpenAI-compatible response."""
    try:
        choices = data.get("choices", [])
        if not choices:
            return _failed_summary("Groq returned no choices.", language)

        message = choices[0].get("message", {})
        summary = message.get("content", "").strip()

        usage = data.get("usage", {})
        tokens = usage.get("total_tokens", 0)
        model = data.get("model", GROQ_MODEL)

        logger.info(f"[AISummary] ✓ Summary generated ({len(summary)} chars, {tokens} tokens)")

        return {
            "summary": summary,
            "language": language,
            "model": model,
            "tokens": tokens,
            "error": None,
        }

    except Exception as e:
        logger.error(f"[AISummary] Failed to parse Groq response: {e}")
        return _failed_summary(f"Response parse error: {e}", language)


def _failed_summary(reason: str, language: str = "en") -> dict:
    """Return a standardized failure dict."""
    return {
        "summary": "",
        "language": language,
        "model": GROQ_MODEL,
        "tokens": 0,
        "error": reason,
    }
