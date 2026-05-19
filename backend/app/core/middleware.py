"""
Request logging middleware — registra cada HTTP request con structlog.

Campos logueados por request:
  request_id  → UUID único por request (para correlacionar logs)
  method      → GET / POST / etc.
  path        → endpoint path
  status_code → HTTP response status
  duration_ms → tiempo total del request en ms
  user_agent  → cliente (útil para detectar bots)

El request_id se propaga via contextvars → disponible en cualquier
log que ocurra durante el ciclo de vida del request.
"""

import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = structlog.get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware que loguea método, path, status y duración de cada request."""

    # Paths que no necesitan log (reduce ruido en Railway)
    _SKIP_PATHS = frozenset({"/health", "/metrics", "/favicon.ico"})

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path in self._SKIP_PATHS:
            return await call_next(request)

        request_id = str(uuid.uuid4())
        start = time.perf_counter()

        # Bindear request_id al contexto → se propaga a todos los logs del request
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        response = await call_next(request)

        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        logger.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
            user_agent=request.headers.get("user-agent", ""),
        )

        # Propagar request_id al cliente en la respuesta
        response.headers["X-Request-Id"] = request_id
        return response
