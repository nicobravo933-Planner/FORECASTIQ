"""
forecastiq — FastAPI app factory.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.datasets import router as datasets_router
from app.api.events import router as events_router
from app.api.forecast import router as forecast_router
from app.api.health import router as health_router
from app.core.config import settings
from app.core.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup
    setup_logging()
    yield
    # Shutdown — liberar recursos si es necesario


def create_app() -> FastAPI:
    app = FastAPI(
        title="forecastiq API",
        version="0.1.0",
        description="Automated ML forecasting with AI chat",
        docs_url="/docs" if settings.debug else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    # CORS — permite requests del frontend Next.js
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(health_router)
    app.include_router(datasets_router)
    app.include_router(forecast_router)
    app.include_router(events_router)

    return app


app = create_app()
