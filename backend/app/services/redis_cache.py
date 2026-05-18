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

CHAT_RATE_LIMIT = 30  # requests permitidos por hora por usuario
RATE_WINDOW_SECS = 3600  # 1 hora
RATE_KEY_PREFIX = "fiq:rl:chat:"


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


def check_rate_limit(identifier: str) -> RateLimitResult:
    """
    Verifica y actualiza el rate limit para un identificador (IP o user_id).

    Estrategia: contador con TTL en Redis.
      INCR fiq:rl:chat:<identifier>  → incrementa (crea con valor 1 si no existe)
      Si el contador se creó ahora → EXPIRE para fijar la ventana

    Si Redis no está disponible → falla abierto (permite el request).

    Returns:
        RateLimitResult con .allowed=True si el request puede continuar.
    """
    if not settings.upstash_redis_url or not settings.upstash_redis_token:
        # Redis no configurado → desarrollo local sin límite
        return RateLimitResult(allowed=True, remaining=CHAT_RATE_LIMIT, reset_in=RATE_WINDOW_SECS)

    key = f"{RATE_KEY_PREFIX}{identifier}"

    try:
        # INCR devuelve el nuevo valor del contador
        count_result = _redis_command("INCR", key)
        if count_result is None:
            # Falla abierto
            return RateLimitResult(
                allowed=True, remaining=CHAT_RATE_LIMIT, reset_in=RATE_WINDOW_SECS
            )

        count = int(count_result)

        # Si es el primer request de la ventana, fijar TTL
        if count == 1:
            _redis_command("EXPIRE", key, str(RATE_WINDOW_SECS))

        # Consultar TTL restante para el header de reset
        ttl_result = _redis_command("TTL", key)
        reset_in = int(ttl_result) if ttl_result and int(ttl_result) > 0 else RATE_WINDOW_SECS

        remaining = max(0, CHAT_RATE_LIMIT - count)
        allowed = count <= CHAT_RATE_LIMIT

        return RateLimitResult(allowed=allowed, remaining=remaining, reset_in=reset_in)

    except Exception as exc:
        logger.warning("Rate limit check failed for %s: %s — allowing request", identifier, exc)
        return RateLimitResult(allowed=True, remaining=CHAT_RATE_LIMIT, reset_in=RATE_WINDOW_SECS)


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
