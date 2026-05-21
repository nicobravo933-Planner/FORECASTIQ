"""
Logging estructurado con structlog.
En producción: JSON puro → Railway/Loki lo parsea campo a campo.
En desarrollo:  formato colorido y legible para el terminal.

Cuando ALLOY_LOKI_URL está configurado, los logs también se pushean
a Grafana Alloy vía HTTP → Loki → Grafana Cloud.
"""

import logging
import logging.handlers
import sys
from typing import Any

import structlog

from app.core.config import settings


class LokiHTTPHandler(logging.Handler):
    """
    Handler que pushea logs JSON a Loki via HTTP POST.
    Usa urllib (stdlib) para no crear dependencia en httpx/requests.
    Los logs van al Alloy receiver en Railway (puerto 3100).
    """

    def __init__(self, url: str) -> None:
        super().__init__()
        self.url = url

    def emit(self, record: logging.LogRecord) -> None:
        try:
            import json
            import time
            import urllib.request

            msg = self.format(record)
            # Timestamp en nanosegundos (formato Loki)
            ts_ns = str(int(time.time() * 1e9))

            payload: dict[str, Any] = {
                "streams": [
                    {
                        "stream": {
                            "service_name": "forecastiq",
                            "level": record.levelname.lower(),
                            "environment": settings.environment,
                        },
                        "values": [[ts_ns, msg]],
                    }
                ]
            }

            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                self.url,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            # Fire-and-forget con timeout corto — nunca bloquear la app
            urllib.request.urlopen(req, timeout=1)  # noqa: S310
        except Exception:
            self.handleError(record)


def setup_logging() -> None:
    """Configura structlog + stdlib logging. Llamar una sola vez al startup."""
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    use_json = settings.log_format == "json" or settings.is_production

    # Processors compartidos entre stdlib y structlog
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if use_json:
        # Producción: JSON → Railway stdout + Loki
        processors: list[structlog.types.Processor] = [
            *shared_processors,
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ]
    else:
        # Desarrollo: colores + pretty print
        processors = [
            *shared_processors,
            structlog.dev.ConsoleRenderer(colors=True),
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )

    # Redirigir stdlib logging → structlog (captura uvicorn, celery, etc.)
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
        force=True,
    )

    # Loki HTTP push — activo solo cuando ALLOY_LOKI_URL está configurado
    if settings.alloy_loki_url:
        loki_handler = LokiHTTPHandler(url=settings.alloy_loki_url)
        loki_handler.setLevel(logging.INFO)
        logging.getLogger().addHandler(loki_handler)

    # Silenciar loggers ruidosos de librerías externas
    for noisy in ("uvicorn.access", "httpx", "httpcore", "multipart"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> structlog.types.FilteringBoundLogger:
    """Factory helper — usar en cada módulo en lugar de logging.getLogger."""
    return structlog.get_logger(name)  # type: ignore[no-any-return]
