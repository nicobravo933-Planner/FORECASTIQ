"""
Dependencias compartidas de FastAPI (Depends()).
Phase 5: valida sesiones de Better Auth llamando a /api/auth/get-session.
"""

from __future__ import annotations

from typing import Annotated

import httpx
from fastapi import Depends, Header, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings

# ── Schema del usuario autenticado ────────────────────────────────────────────


class CurrentUser(BaseModel):
    """Datos del usuario autenticado, extraídos desde Better Auth."""

    user_id: str
    email: str
    name: str | None = None
    image: str | None = None


# ── Validación via Better Auth ────────────────────────────────────────────────


async def _validate_session(token: str) -> CurrentUser:
    """
    Llama a Better Auth (Next.js) para verificar el token de sesión.
    Better Auth expone GET /api/auth/get-session con el token como Bearer.
    Lanza 401 si el token es inválido o la sesión expiró.
    """
    url = f"{settings.better_auth_url}/api/auth/get-session"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers=headers)
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo contactar el servicio de autenticación.",
        ) from exc

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida o expirada.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    data = resp.json()
    user = data.get("user") or {}
    session = data.get("session") or {}

    user_id: str | None = user.get("id") or session.get("userId")
    email: str | None = user.get("email")

    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión sin datos de usuario.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return CurrentUser(
        user_id=user_id,
        email=email,
        name=user.get("name"),
        image=user.get("image"),
    )


def _extract_bearer(authorization: str | None) -> str | None:
    """Extrae el token del header Authorization: Bearer <token>."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return authorization[7:]


# ── Dependencias FastAPI ──────────────────────────────────────────────────────


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    """Requiere usuario autenticado. Lanza 401 si el token falta o es inválido."""
    token = _extract_bearer(authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header requerido.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return await _validate_session(token)


async def get_optional_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser | None:
    """
    Usuario opcional — no lanza error si no hay token.
    Usado en endpoints que funcionan anónimos pero mejoran con auth.
    """
    token = _extract_bearer(authorization)
    if not token:
        return None
    try:
        return await _validate_session(token)
    except HTTPException:
        return None


async def get_request_id(x_request_id: Annotated[str | None, Header()] = None) -> str | None:
    """Propaga el request ID para trazabilidad en logs."""
    return x_request_id


# ── Type aliases convenientes ─────────────────────────────────────────────────

AuthUser = Annotated[CurrentUser, Depends(get_current_user)]
OptionalUser = Annotated[CurrentUser | None, Depends(get_optional_user)]
