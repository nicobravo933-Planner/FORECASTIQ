"""
Dependencias compartidas de FastAPI (Depends()).
Phase 5: agrega get_current_user (JWT) y get_optional_user.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import settings


# ── Schema del usuario autenticado ────────────────────────────────────────────


class CurrentUser(BaseModel):
    """Payload extraído del JWT emitido por Better Auth."""

    user_id: str
    email: str
    name: str | None = None
    image: str | None = None


# ── Helpers JWT ───────────────────────────────────────────────────────────────


def _decode_token(token: str) -> CurrentUser:
    """
    Verifica y decodifica el JWT de Better Auth.
    Better Auth firma con HMAC-SHA256 usando BETTER_AUTH_SECRET (== jwt_secret_key).
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id: str | None = payload.get("sub")
    email: str | None = payload.get("email")

    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token no contiene sub/email.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return CurrentUser(
        user_id=user_id,
        email=email,
        name=payload.get("name"),
        image=payload.get("image"),
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
    return _decode_token(token)


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
        return _decode_token(token)
    except HTTPException:
        return None


async def get_request_id(x_request_id: Annotated[str | None, Header()] = None) -> str | None:
    """Propaga el request ID para trazabilidad en logs."""
    return x_request_id


# ── Type aliases convenientes ─────────────────────────────────────────────────

AuthUser = Annotated[CurrentUser, Depends(get_current_user)]
OptionalUser = Annotated[CurrentUser | None, Depends(get_optional_user)]
