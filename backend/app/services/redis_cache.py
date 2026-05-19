"""
Redis cache + rate limiting usando Upstash Redis (HTTP API).

No usa redis-py: Upstash provee una API REST compatible con httpx.
Esto evita mantener una conexión TCP persistente en un entorno serverless.

Rate limiting: token bucket simplificado.
  - Ventana fija de 1 hora por clave (usuario o IP)
  - Límite: CHAT_RATE_LIMIT requests por ventana
  - Si Redis no está disponible: falla abierto (permite el request)
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

CHAT_RATE_LIMIT = 30  # mensajes de chat por hora por usuario
UPLOAD_RATE_LIMIT = 5  # uploads CSV por hora por IP
FORECAST_RATE_LIMIT = 10  # jobs de forecast por hora por IP+usuario
RATE_WINDOW_SECS = 3600  # ventana fija: 1 hora

RATE_KEY_PREFIX_CHAT = "fiq:rl:chat:"
RATE_KEY_PREFIX_UPLOAD = "fiq:rl:upload:"
RATE_KEY_PREFIX_FORECAST = "fiq:rl:forecast:"

# Alias legacy — mantiene compatibilidad con chat.py
RATE_KEY_PREFIX = RATE_KEY_PREFIX_CHAT


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.upstash_redis_token}",
        "Content-Type": "application/json",
    }


def _base_url() -> str:
    return settings.upstash_redis_url.rstrip("/")


# ── Helpers Upstash REST API ──────────────────────────────────────────────────


def _redis_command(*args: Any) -> Any:
    """
    Ejecuta un comando Redis via Upstash REST API.
    Retorna el campo 'result' de la respuesta o None en caso de error.
    """
    if not settings.upstash_redis_url or not settings.upstash_redis_token:
        return None

    try:
        url = f"{_base_url()}/{'/'.join(str(a) for a in args)}"
        resp = httpx.get(url, headers=_headers(), timeout=3.0)
        resp.raise_for_status()
        return resp.json().get("result")
    except Exception as exc:
        logger.warning(
            "Redis command failed (%s %s): %s", args[0], args[1] if len(args) > 1 else "", exc
        )
        return None


# ── Rate limiting ─────────────────────────────────────────────────────────────


class RateLimitResult:
    def __init__(self, allowed: bool, remaining: int, reset_in: int) -> None:
        self.allowed = allowed
        self.remaining = remaining  # requests restantes en la ventana
        self.reset_in = reset_in  # segundos hasta que se resetea el contador


def _check_rate_limit_generic(key_prefix: str, identifier: str, limit: int) -> RateLimitResult:
    """
    Núcleo reutilizable de rate limiting.

    Estrategia: contador con TTL en Redis (ventana fija de RATE_WINDOW_SECS).
      INCR <prefix><identifier>  → incrementa; crea con valor 1 si no existe
      Si count == 1 → EXPIRE para anclar la ventana de 1 hora

    Falla abierto si Redis no está disponible (permite el request).
    """
    if not settings.upstash_redis_url or not settings.upstash_redis_token:
        return RateLimitResult(allowed=True, remaining=limit, reset_in=RATE_WINDOW_SECS)

    key = f"{key_prefix}{identifier}"

    try:
        count_result = _redis_command("INCR", key)
        if count_result is None:
            return RateLimitResult(allowed=True, remaining=limit, reset_in=RATE_WINDOW_SECS)

        count = int(count_result)

        if count == 1:
            _redis_command("EXPIRE", key, str(RATE_WINDOW_SECS))

        ttl_result = _redis_command("TTL", key)
        reset_in = int(ttl_result) if ttl_result and int(ttl_result) > 0 else RATE_WINDOW_SECS

        return RateLimitResult(
            allowed=count <= limit,
            remaining=max(0, limit - count),
            reset_in=reset_in,
        )

    except Exception as exc:
        logger.warning("Rate limit check failed for %s: %s — allowing request", key, exc)
        return RateLimitResult(allowed=True, remaining=limit, reset_in=RATE_WINDOW_SECS)


def check_rate_limit(identifier: str) -> RateLimitResult:
    """Rate limit para chat (30 req/h). Mantiene firma original para compatibilidad."""
    return _check_rate_limit_generic(RATE_KEY_PREFIX_CHAT, identifier, CHAT_RATE_LIMIT)


def check_upload_rate_limit(ip: str) -> RateLimitResult:
    """Rate limit para uploads CSV: 5 por hora por IP."""
    return _check_rate_limit_generic(RATE_KEY_PREFIX_UPLOAD, ip, UPLOAD_RATE_LIMIT)


def check_forecast_rate_limit(identifier: str) -> RateLimitResult:
    """Rate limit para jobs de forecast: 10 por hora por IP+usuario."""
    return _check_rate_limit_generic(RATE_KEY_PREFIX_FORECAST, identifier, FORECAST_RATE_LIMIT)


# ── Generic cache helpers ─────────────────────────────────────────────────────


def cache_set(key: str, value: str, ttl_secs: int = 3600) -> bool:
    """Guarda un valor en Redis con TTL. Retorna True si fue exitoso."""
    if not settings.upstash_redis_url:
        return False
    result = _redis_command("SET", key, value, "EX", str(ttl_secs))
    return bool(result == "OK")


def cache_get(key: str) -> str | None:
    """Lee un valor de Redis. Retorna None si no existe o hay error."""
    if not settings.upstash_redis_url:
        return None
    result = _redis_command("GET", key)
    return str(result) if result is not None else None


def cache_delete(key: str) -> bool:
    """Elimina una clave de Redis. Retorna True si existía."""
    if not settings.upstash_redis_url:
        return False
    result = _redis_command("DEL", key)
    return bool(result is not None and int(result) > 0)
