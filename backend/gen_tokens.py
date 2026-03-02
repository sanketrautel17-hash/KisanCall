"""
Generate JWT tokens and write clean output to a JSON file.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os, json
from jose import jwt
from datetime import datetime, timedelta

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/kisancall")
JWT_SECRET = os.getenv("JWT_SECRET", "fallback_secret_change_me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))

def make_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    users = client["kisancall"]["users"]

    expert = await users.find_one({"email": "sanketrautel17@gmail.com"})
    farmer = await users.find_one({"email": "sanketrautel846@gmail.com"})

    result = {
        "expert": {
            "id": str(expert["_id"]),
            "email": expert.get("email"),
            "name": expert.get("name"),
            "role": expert.get("role"),
            "is_verified": expert.get("is_verified"),
            "token": make_token(str(expert["_id"]), expert.get("role")),
        },
        "farmer": {
            "id": str(farmer["_id"]),
            "email": farmer.get("email"),
            "name": farmer.get("name"),
            "role": farmer.get("role"),
            "is_verified": farmer.get("is_verified"),
            "token": make_token(str(farmer["_id"]), farmer.get("role")),
        }
    }

    with open("tokens.json", "w") as f:
        json.dump(result, f, indent=2)

    print("Written to tokens.json")
    client.close()

asyncio.run(main())
