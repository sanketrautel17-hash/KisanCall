"""
KisanCall — MongoDB async connection using Motor
"""

import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/kisancall")

client: AsyncIOMotorClient = None


async def connect_db():
    """Create the MongoDB connection on app startup."""
    global client
    client = AsyncIOMotorClient(MONGO_URI)
    print(f"[DB] MongoDB connected: {MONGO_URI}")


async def close_db():
    """Close the MongoDB connection on app shutdown."""
    global client
    if client:
        client.close()
        print("[DB] MongoDB connection closed.")


def get_db():
    """Return the kisancall database instance."""
    return client["kisancall"]


def get_collection(name: str):
    """Return a named collection from the kisancall database."""
    return get_db()[name]
