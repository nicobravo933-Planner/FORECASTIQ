"""
Dependencias compartidas de FastAPI (Depends()).
Se expanden en fases posteriores con auth, DB sessions, etc.
"""
from typing import Annotated

from fastapi import Header, HTTPException


async def get_request_id(x_request_id: Annotated[str | None, Header()] = None) -> str | None:
    """Propaga el request ID para trazabilidad en logs."""
    return x_request_id
