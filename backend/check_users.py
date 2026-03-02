import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os, json
load_dotenv()

async def main():
    client = AsyncIOMotorClient(os.getenv("MONGO_URI", "mongodb://localhost:27017/kisancall"))
    users = client["kisancall"]["users"]

    emails = ["sanketrautel17@gmail.com", "sanketrautel846@gmail.com"]
    for email in emails:
        doc = await users.find_one({"email": email})
        if doc:
            info = {
                "id": str(doc["_id"]),
                "email": doc.get("email"),
                "name": doc.get("name"),
                "role": doc.get("role"),
                "is_verified": doc.get("is_verified"),
                "is_online": doc.get("is_online"),
            }
            print(json.dumps(info))
        else:
            print(f'{{"email": "{email}", "status": "NOT FOUND"}}')

    client.close()

asyncio.run(main())
