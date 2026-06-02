import os
from motor.motor_asyncio import AsyncIOMotorClient

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        uri = os.environ["MONGODB_URI"]
        _client = AsyncIOMotorClient(uri)
    return _client


def get_db():
    return get_client()["intruder_detection"]


def get_alerts_collection():
    return get_db()["alerts"]
