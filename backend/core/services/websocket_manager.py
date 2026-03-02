"""
KisanCall — WebSocket Connection Manager
Manages active WS connections for farmers and experts.
Messages are JSON-encoded dicts with at minimum {"type": "..."}
"""

import asyncio
import json
import logging
from typing import Dict, Optional

from fastapi import WebSocket

from commons.logger import logger as get_logger

logger = get_logger(__name__)


class ConnectionManager:
    """
    Thread-safe per-role WebSocket registry.

    Usage:
        manager.connect_farmer(user_id, websocket)
        await manager.send_to_farmer(user_id, {"type": "call_incoming", ...})
        manager.disconnect_farmer(user_id)
    """

    def __init__(self):
        # Maps user_id (str) → WebSocket
        self._farmers: Dict[str, WebSocket] = {}
        self._experts: Dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()

    # ─── Farmer Connections ────────────────────────────────────────────────────

    async def connect_farmer(self, user_id: str, websocket: WebSocket) -> None:
        """Accept and register a farmer WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self._farmers[user_id] = websocket
        logger.info(f"[WS] Farmer {user_id} connected. Total farmers: {len(self._farmers)}")

    def disconnect_farmer(self, user_id: str) -> None:
        """Remove a farmer's WebSocket connection."""
        self._farmers.pop(user_id, None)
        logger.info(f"[WS] Farmer {user_id} disconnected. Total farmers: {len(self._farmers)}")

    async def send_to_farmer(self, user_id: str, data: dict) -> bool:
        """
        Send a JSON message to a specific farmer.
        Returns True if sent, False if farmer not connected.
        """
        ws = self._farmers.get(user_id)
        if ws:
            try:
                await ws.send_json(data)
                return True
            except Exception as e:
                logger.warning(f"[WS] Failed to send to farmer {user_id}: {e}")
                self.disconnect_farmer(user_id)
        return False

    def is_farmer_connected(self, user_id: str) -> bool:
        return user_id in self._farmers

    # ─── Expert Connections ────────────────────────────────────────────────────

    async def connect_expert(self, user_id: str, websocket: WebSocket) -> None:
        """Accept and register an expert WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self._experts[user_id] = websocket
        logger.info(f"[WS] Expert {user_id} connected. Total experts: {len(self._experts)}")

    def disconnect_expert(self, user_id: str) -> None:
        """Remove an expert's WebSocket connection."""
        self._experts.pop(user_id, None)
        logger.info(f"[WS] Expert {user_id} disconnected. Total experts: {len(self._experts)}")

    async def send_to_expert(self, user_id: str, data: dict) -> bool:
        """
        Send a JSON message to a specific expert.
        Returns True if sent, False if expert not connected.
        """
        ws = self._experts.get(user_id)
        if ws:
            try:
                await ws.send_json(data)
                return True
            except Exception as e:
                logger.warning(f"[WS] Failed to send to expert {user_id}: {e}")
                self.disconnect_expert(user_id)
        return False

    def is_expert_connected(self, user_id: str) -> bool:
        return user_id in self._experts

    # ─── Broadcast / Utilities ────────────────────────────────────────────────

    async def broadcast_to_experts(self, data: dict) -> int:
        """Broadcast a message to all connected experts. Returns number sent."""
        sent = 0
        failed = []
        for user_id, ws in list(self._experts.items()):
            try:
                await ws.send_json(data)
                sent += 1
            except Exception:
                failed.append(user_id)
        for uid in failed:
            self.disconnect_expert(uid)
        return sent

    def get_stats(self) -> dict:
        return {
            "farmers_online": len(self._farmers),
            "experts_online": len(self._experts),
        }


# ─── Singleton instance ───────────────────────────────────────────────────────

manager = ConnectionManager()
