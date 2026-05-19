"""
OpenTelemetry setup — traces distribuidos hacia Grafana Cloud (Tempo).

Qué se traza automáticamente:
  - Cada request HTTP a FastAPI (via auto-instrumentación)
  - Cada llamada saliente httpx (LLM calls a OpenRouter/Gemini)

Qué se traza manualmente (spans explícitos):
  - Cada job de forecast en Celery (modelo, dataset_id, duración, métricas)

El exporter usa OTLP/HTTP → Grafana Cloud solo cuando OTEL_ENABLED=true.
En desarrollo (OTEL_ENABLED=false) no se envía nada — zero overhead.
"""

from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager
from typing import TYPE_CHECKING, Any

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

from app.core.config import settings

if TYPE_CHECKING:
    from opentelemetry.trace import Span

# Tracer global — importar desde aquí en el resto del código
tracer = trace.get_tracer("forecastiq")


def setup_telemetry() -> None:
    """
    Inicializa el TracerProvider con el exporter correcto.
    Llamar una sola vez en create_app() antes de registrar routers.

    - OTEL_ENABLED=false → ConsoleExporter (dev, no envía nada a Grafana)
    - OTEL_ENABLED=true  → OTLP/HTTP → Grafana Cloud Tempo
    """
    resource = Resource.create(
        {
            "service.name": settings.otel_service_name,
            "service.version": settings.app_version,
            "deployment.environment": settings.environment,
        }
    )

    provider = TracerProvider(resource=resource)

    if settings.otel_enabled and settings.otel_otlp_endpoint:
        # Producción: envía traces a Grafana Cloud via OTLP/HTTP
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

        # Parsear headers: "Authorization=Basic xxx,X-Scope-OrgID=yyy"
        headers: dict[str, str] = {}
        if settings.otel_otlp_headers:
            for pair in settings.otel_otlp_headers.split(","):
                if "=" in pair:
                    k, v = pair.split("=", 1)
                    headers[k.strip()] = v.strip()

        otlp_exporter = OTLPSpanExporter(
            endpoint=f"{settings.otel_otlp_endpoint}/v1/traces",
            headers=headers,
        )
        provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
    else:
        # Dev: exporter mudo (no imprime nada, solo descarta los spans)
        # Cambiar a ConsoleSpanExporter() para debug local si hace falta
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

    trace.set_tracer_provider(provider)

    # Auto-instrumentación httpx — traza llamadas LLM (OpenRouter, Gemini)
    try:
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

        HTTPXClientInstrumentor().instrument()
    except ImportError:
        pass  # paquete opcional — no bloquear startup


def instrument_fastapi(app: Any) -> None:
    """
    Auto-instrumenta FastAPI: crea un span por request con método, path y status.
    Llamar después de setup_telemetry() y después de registrar todos los routers.
    """
    try:
        from fastapi import FastAPI
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        assert isinstance(app, FastAPI)
        FastAPIInstrumentor.instrument_app(
            app,
            excluded_urls="/health,/metrics",  # no trazar infra endpoints
        )
    except ImportError:
        pass


@contextmanager
def forecast_span(
    dataset_id: str,
    model_name: str,
    horizon: int,
    freq: str,
) -> Generator[Span, None, None]:
    """
    Context manager para trazar un job de forecast como span OTel.

    Uso en celery_app.py:
        with forecast_span(dataset_id, model_name, horizon, freq) as span:
            # ... pipeline de forecast ...
            span.set_attribute("forecast.mape", mape)
    """
    with tracer.start_as_current_span("forecast.run") as span:
        span.set_attribute("forecast.dataset_id", dataset_id)
        span.set_attribute("forecast.model", model_name)
        span.set_attribute("forecast.horizon", horizon)
        span.set_attribute("forecast.freq", freq)
        yield span
