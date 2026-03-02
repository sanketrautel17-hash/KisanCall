"""
KisanCall — MongoDB async connection using Motor
"""

import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

from commons.logger import logger as get_logger

load_dotenv()

log = get_logger(__name__)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/kisancall")

client: AsyncIOMotorClient = None


async def connect_db():
    """Create the MongoDB connection on app startup."""
    global client
    try:
        client = AsyncIOMotorClient(MONGO_URI)
        log.info(f"[DB] MongoDB connected: {MONGO_URI}")
    except Exception as e:
        log.error(f"[DB] Failed to connect to MongoDB: {e}")
        raise


async def close_db():
    """Close the MongoDB connection on app shutdown."""
    global client
    if client:
        client.close()
        log.info("[DB] MongoDB connection closed.")


def get_db():
    """Return the kisancall database instance."""
    return client["kisancall"]


def get_collection(name: str):
    """Return a named collection from the kisancall database."""
    return get_db()[name]
