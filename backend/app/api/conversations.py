"""
Endpoints de historial de conversaciones de chat — Phase chat-history.

  POST   /api/chat/conversations          → crear o actualizar conversación
  GET    /api/chat/conversations          → listar conversaciones del usuario
  GET    /api/chat/conversations/{id}     → cargar conversación completa
  DELETE /api/chat/conversations/{id}     → borrar conversación
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.dependencies import AuthUser
from app.services.supabase import (
    delete_conversation,
    get_conversation,
    list_conversations,
    save_conversation,
)

router = APIRouter(prefix="/api/chat/conversations", tags=["conversations"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class ConversationMessage(BaseModel):
    id: str
    role: str  # "user" | "assistant"
    content: str
    created_at: str


class SaveConversationRequest(BaseModel):
    conversation_id: str | None = None  # None = crear nueva
    title: str = Field(..., min_length=1, max_length=200)
    messages: list[ConversationMessage]
    model_id: str | None = None


class SaveConversationResponse(BaseModel):
    conversation_id: str


class ConversationListItem(BaseModel):
    id: str
    title: str
    model_id: str | None
    created_at: str
    updated_at: str


class ConversationDetail(BaseModel):
    id: str
    title: str
    model_id: str | None
    messages: list[dict[str, Any]]
    created_at: str
    updated_at: str


class DeleteResponse(BaseModel):
    deleted: bool


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("", response_model=SaveConversationResponse, status_code=status.HTTP_200_OK)
async def upsert_conversation(
    body: SaveConversationRequest,
    user: AuthUser,
) -> SaveConversationResponse:
    """
    Crea una nueva conversación o actualiza una existente.
    Si body.conversation_id es null → INSERT y retorna el nuevo id.
    Si body.conversation_id tiene valor → UPDATE y retorna el mismo id.
    """
    messages_data = [m.model_dump() for m in body.messages]
    conversation_id = save_conversation(
        conversation_id=body.conversation_id,
        user_id=user.user_id,
        title=body.title,
        messages=messages_data,
        model_id=body.model_id,
    )
    return SaveConversationResponse(conversation_id=conversation_id)


@router.get("", response_model=list[ConversationListItem])
async def get_conversations(
    user: AuthUser,
    page: int = 1,
    page_size: int = 30,
) -> list[ConversationListItem]:
    """
    Lista las conversaciones del usuario autenticado, ordenadas por updated_at DESC.
    No incluye el array messages completo — solo metadatos.
    """
    rows = list_conversations(
        user_id=user.user_id,
        page=page,
        page_size=page_size,
    )
    return [
        ConversationListItem(
            id=str(row["id"]),
            title=str(row["title"]),
            model_id=row.get("model_id"),
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
        )
        for row in rows
    ]


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def load_conversation(
    conversation_id: str,
    user: AuthUser,
) -> ConversationDetail:
    """
    Retorna una conversación completa con todos sus mensajes.
    404 si no existe o no pertenece al usuario autenticado.
    """
    row = get_conversation(conversation_id=conversation_id, user_id=user.user_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversación '{conversation_id}' no encontrada.",
        )
    messages = row.get("messages")
    if not isinstance(messages, list):
        messages = []
    return ConversationDetail(
        id=str(row["id"]),
        title=str(row["title"]),
        model_id=row.get("model_id"),
        messages=messages,
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
    )


@router.delete("/{conversation_id}", response_model=DeleteResponse)
async def remove_conversation(
    conversation_id: str,
    user: AuthUser,
) -> DeleteResponse:
    """
    Borra una conversación del usuario.
    Retorna deleted=true si existía, deleted=false si no se encontró.
    """
    deleted = delete_conversation(conversation_id=conversation_id, user_id=user.user_id)
    return DeleteResponse(deleted=deleted)
