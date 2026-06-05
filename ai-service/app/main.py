import logging

from fastapi import FastAPI

from app.config import get_settings
from app.routers import chat, health

settings = get_settings()
logging.basicConfig(level=settings.log_level.upper())

app = FastAPI(
    title="Taqwin AI Service",
    description="FastAPI microservice for coach reasoning (Block A2 skeleton).",
    version=settings.service_version,
)

app.include_router(health.router)
app.include_router(chat.router)
