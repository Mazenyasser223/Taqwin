import logging

from fastapi import FastAPI

from app.config import get_settings
from app.routers import chat, health, intent, memory, plan, rag, tools

settings = get_settings()
logging.basicConfig(level=settings.log_level.upper())

app = FastAPI(
    title="Taqwin AI Service",
    description="FastAPI microservice for coach + plans (Blocks A2–B7, C1).",
    version=settings.service_version,
)

app.include_router(health.router)
app.include_router(intent.router)
app.include_router(chat.router)
app.include_router(rag.router)
app.include_router(plan.router)
app.include_router(memory.router)
app.include_router(tools.router)
