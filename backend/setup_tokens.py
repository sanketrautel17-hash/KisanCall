"""
Fix roles + generate JWT tokens for both users to use in the browser.
sanketrautel17@gmail.com  -> expert
sanketrautel846@gmail.com -> farmer
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
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

    # sanketrautel17 -> EXPERT
    expert = await users.find_one({"email": "sanketrautel17@gmail.com"})
    # sanketrautel846 -> FARMER  
    farmer = await users.find_one({"email": "sanketrautel846@gmail.com"})

    if not expert:
        print("ERROR: sanketrautel17@gmail.com not found in DB")
        return
    if not farmer:
        print("ERROR: sanketrautel846@gmail.com not found in DB")
        return

    # Fix roles if needed
    if expert.get("role") != "expert":
        await users.update_one({"_id": expert["_id"]}, {"$set": {"role": "expert"}})
        print(f"Fixed sanketrautel17 role: farmer -> expert")
    else:
        print(f"sanketrautel17 role is already expert OK")

    if farmer.get("role") != "farmer":
        await users.update_one({"_id": farmer["_id"]}, {"$set": {"role": "farmer"}})
        print(f"Fixed sanketrautel846 role -> farmer")
    else:
        print(f"sanketrautel846 role is already farmer OK")

    # Make sure both are verified + expert is offline to start clean
    await users.update_one({"_id": expert["_id"]}, {"$set": {"is_verified": True, "is_online": False}})
    await users.update_one({"_id": farmer["_id"]}, {"$set": {"is_verified": True}})

    expert_id = str(expert["_id"])
    farmer_id = str(farmer["_id"])

    expert_token = make_token(expert_id, "expert")
    farmer_token = make_token(farmer_id, "farmer")

    # Re-fetch updated docs
    expert = await users.find_one({"_id": expert["_id"]})
    farmer = await users.find_one({"_id": farmer["_id"]})

    result = {
        "expert": {
            "id": expert_id,
            "email": expert.get("email"),
            "name": expert.get("name"),
            "role": expert.get("role"),
            "is_verified": expert.get("is_verified"),
            "token": expert_token,
        },
        "farmer": {
            "id": farmer_id,
            "email": farmer.get("email"),
            "name": farmer.get("name"),
            "role": farmer.get("role"),
            "is_verified": farmer.get("is_verified"),
            "token": farmer_token,
        }
    }

    print("\n=== USER DATA ===")
    print(json.dumps(result, indent=2))
    client.close()

asyncio.run(main())
