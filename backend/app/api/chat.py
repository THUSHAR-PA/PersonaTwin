"""Owned, versioned conversations with locally interpreted simulation requests."""

from datetime import datetime, timezone
import re
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import ensure_user_owns_resource, get_current_user
from app.models import ChatConversation, User
from app.schemas.chat import ChatCreateRequest, ChatMessageRequest
from app.services import chat_llm
from app.services.chat_simulation import answer, merge_plan
from app.services.twin_state_service import current_state_data

MAX_MESSAGES = 80
CLARIFICATIONS = {
    "monthly_income": "Please give the new job's monthly take-home income. I cannot treat annual salary or CTC as spendable monthly income.",
    "time_units": "Please give the duration in whole months, and say whether it is the comparison horizon, loan tenure, or unpaid gap.",
    "multiple_decisions": "This prototype compares one decision at a time. Shall we start with the purchase, savings goal, or job change? Combined decisions are not modeled yet.",
    "ambiguous_amount": "Please state the amount and what it represents, for example: purchase price 150000, running cost 2000 per month.",
    "currency_change": "A conversation uses one currency without conversion. Start a new conversation to choose a different currency.",
}


def owner(user_id: UUID, user: User = Depends(get_current_user)):
    ensure_user_owns_resource(user_id, user)


router = APIRouter(
    prefix="/users/{user_id}/chat", tags=["Chat"], dependencies=[Depends(owner)]
)


def owned(db: Session, user_id: UUID, conversation_id: UUID) -> ChatConversation:
    row = (
        db.query(ChatConversation)
        .filter_by(id=conversation_id, user_id=user_id)
        .first()
    )
    if row is None:
        raise HTTPException(404, "Conversation not found.")
    return row


def serialize(row: ChatConversation, detail=False):
    data = {
        "id": row.id,
        "title": row.title,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "currency": row.currency,
        "version": row.version,
    }
    if detail:
        data.update(plan=row.plan, messages=row.messages)
    return data


def context_data(db: Session, user_id: UUID, currency=None):
    data = current_state_data(db, user_id, currency=currency)
    # The explanation needs profile aggregates, never bank tokens or raw transactions.
    data.pop("health", None)
    data["read_at"] = datetime.now(timezone.utc).isoformat()
    return data


@router.get("/context")
def get_context(user_id: UUID, db: Session = Depends(get_db)):
    return context_data(db, user_id)


@router.get("/status")
def status(user_id: UUID):
    return chat_llm.model_status()


@router.get("/conversations")
def conversations(
    user_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(ChatConversation)
        .filter_by(user_id=user_id)
        .order_by(ChatConversation.updated_at.desc(), ChatConversation.id)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [serialize(row) for row in rows]


@router.post("/conversations", status_code=201)
def create(user_id: UUID, payload: ChatCreateRequest, db: Session = Depends(get_db)):
    try:
        context_data(db, user_id, payload.currency)
    except ValueError as error:
        raise HTTPException(422, str(error))
    row = ChatConversation(user_id=user_id, currency=payload.currency)
    db.add(row)
    db.commit()
    db.refresh(row)
    return serialize(row, detail=True)


@router.get("/conversations/{conversation_id}")
def detail(user_id: UUID, conversation_id: UUID, db: Session = Depends(get_db)):
    return serialize(owned(db, user_id, conversation_id), detail=True)


@router.delete("/conversations/{conversation_id}", status_code=204)
def delete(user_id: UUID, conversation_id: UUID, db: Session = Depends(get_db)):
    db.delete(owned(db, user_id, conversation_id))
    db.commit()


def validate_message_currency(message: str, currency: str):
    mentioned = set(re.findall(r"\b(INR|USD|EUR|GBP)\b", message.upper()))
    for symbol, name in [("₹", "INR"), ("$", "USD"), ("€", "EUR"), ("£", "GBP")]:
        if symbol in message:
            mentioned.add(name)
    if mentioned - {currency}:
        raise ValueError(
            f"This conversation uses {currency}; amounts are not converted. "
            "Use the same currency or start a new conversation."
        )


@router.post("/conversations/{conversation_id}/messages")
def send(
    user_id: UUID,
    conversation_id: UUID,
    payload: ChatMessageRequest,
    db: Session = Depends(get_db),
):
    row = owned(db, user_id, conversation_id)
    if payload.version != row.version:
        raise HTTPException(
            409, "This conversation changed. Reload it before sending again."
        )
    if len(row.messages) >= MAX_MESSAGES:
        raise HTTPException(
            422,
            "This conversation is full. Start a new conversation; the existing comparison remains saved.",
        )
    try:
        validate_message_currency(payload.message, row.currency)
        state = context_data(db, user_id, row.currency)
        previous = row.messages[-1]["text"] if row.messages else ""
        intent = chat_llm.extract_intent(payload.message, row.plan, previous)
        plan = dict(row.plan)
        if intent.clarification != "none":
            reply = {"text": CLARIFICATIONS[intent.clarification], "context": state}
        elif intent.scenario in {"summary", "unsupported"}:
            # An overview or out-of-scope question must not erase an active decision.
            reply = answer(state, {"scenario": intent.scenario})
        else:
            plan = merge_plan(plan, intent, payload.message)
            reply = answer(state, plan, intent.response_kind)
    except ValueError as error:
        db.rollback()
        raise HTTPException(422, str(error))
    except RuntimeError as error:
        db.rollback()
        raise HTTPException(503, str(error))

    now = datetime.now(timezone.utc)
    messages = row.messages + [
        {
            "id": str(uuid4()),
            "role": "user",
            "text": payload.message,
            "created_at": now.isoformat(),
        },
        {
            "id": str(uuid4()),
            "role": "assistant",
            "created_at": now.isoformat(),
            **reply,
        },
    ]
    # Compare-and-swap protects against retries, two tabs and concurrent inference.
    result = db.execute(
        update(ChatConversation)
        .where(
            ChatConversation.id == conversation_id,
            ChatConversation.user_id == user_id,
            ChatConversation.version == payload.version,
        )
        .values(
            messages=messages,
            plan=plan,
            version=payload.version + 1,
            updated_at=now,
            title=payload.message[:100] if not row.messages else row.title,
        )
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(
            409,
            "This conversation changed while the model was responding. Reload before retrying.",
        )
    db.commit()
    db.refresh(row)
    return serialize(row, detail=True)
