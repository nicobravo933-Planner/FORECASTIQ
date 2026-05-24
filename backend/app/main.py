"""
forecastiq — FastAPI app factory.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.batch import router as batch_router
from app.api.capabilities import router as capabilities_router
from app.api.chat import router as chat_router
from app.api.conversations import router as conversations_router
from app.api.datasets import router as datasets_router
from app.api.eda import router as eda_router
from app.api.events import router as events_router
from app.api.forecast import router as forecast_router
from app.api.health import router as health_router
from app.api.me import router as me_router
from app.api.metrics import router as metrics_router
from app.api.metrics import setup_metrics
from app.api.mlops import drift_router
from app.api.mlops import router as mlops_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.middleware import RequestLoggingMiddleware
from app.core.telemetry import instrument_fastapi, setup_telemetry


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup
    setup_logging()
    setup_telemetry()
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

    # Request logging — loguea método/path/status/duration_ms con structlog
    app.add_middleware(RequestLoggingMiddleware)

    # Routers
    app.include_router(health_router)
    app.include_router(eda_router)
    app.include_router(capabilities_router)
    app.include_router(datasets_router)
    app.include_router(forecast_router)
    app.include_router(events_router)
    app.include_router(chat_router)
    app.include_router(conversations_router)
    app.include_router(me_router)
    app.include_router(metrics_router)
    app.include_router(mlops_router)
    app.include_router(drift_router)
    app.include_router(batch_router)

    # Prometheus /metrics — debe ir después de registrar todos los routers
    setup_metrics(app)

    # OpenTelemetry — auto-instrumenta FastAPI (debe ir al final)
    instrument_fastapi(app)

    return app


app = create_app()
