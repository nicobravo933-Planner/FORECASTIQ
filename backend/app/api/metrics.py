"""
GET /metrics — endpoint Prometheus para scraping de métricas.

Expone métricas HTTP estándar generadas por prometheus-fastapi-instrumentator:
  http_requests_total          → contador por método/path/status
  http_request_duration_seconds → histograma de latencias
  http_requests_in_progress    → gauge de requests en vuelo

En producción estas métricas las consume Grafana Cloud (Mimir) via Alloy.
En local: curl http://localhost:8000/metrics
"""

from fastapi import APIRouter, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from prometheus_fastapi_instrumentator import Instrumentator

router = APIRouter(tags=["observability"])

# Instancia global — se registra una sola vez al importar este módulo
instrumentator = Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    should_respect_env_var=False,
    should_instrument_requests_inprogress=True,
    excluded_handlers=["/metrics", "/health"],
    inprogress_name="http_requests_in_progress",
    inprogress_labels=True,
)


@router.get("/metrics", include_in_schema=False)
async def metrics() -> Response:
    """Endpoint Prometheus — devuelve métricas en formato text/plain."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )


def setup_metrics(app: object) -> None:
    """
    Inicializar instrumentación Prometheus en la app FastAPI.
    El endpoint /metrics se registra via router, no via expose().
    """
    from fastapi import FastAPI

    assert isinstance(app, FastAPI)
    instrumentator.instrument(app)
