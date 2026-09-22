from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import ensure_user_owns_resource, get_current_user
from app.models.user import User
from app.schemas.financial_profile import (
    FinancialProfileCreate,
    FinancialProfileUpdate,
    FinancialProfileResponse,
)
from app.services.finance_service import (
    create_financial_profile,
    get_financial_profile,
    update_financial_profile,
    delete_financial_profile,
    sync_financial_summary,
)

router = APIRouter(
    prefix="/users/{user_id}/financial",
    tags=["Financial Profile"],
)


@router.post(
    "/",
    response_model=FinancialProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_profile(
    user_id: UUID,
    profile: FinancialProfileCreate,
    db: Session = Depends(get_db),
):
    try:
        return create_financial_profile(
            db,
            user_id,
            profile,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/",
    response_model=FinancialProfileResponse,
)
def get_profile(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    profile = get_financial_profile(
        db,
        user_id,
    )

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="Financial profile not found.",
        )

    return profile


@router.put(
    "/",
    response_model=FinancialProfileResponse,
)
def update_profile(
    user_id: UUID,
    profile: FinancialProfileUpdate,
    db: Session = Depends(get_db),
):
    updated = update_financial_profile(
        db,
        user_id,
        profile,
    )

    if updated is None:
        raise HTTPException(
            status_code=404,
            detail="Financial profile not found.",
        )

    return updated


@router.delete(
    "/",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_profile(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    deleted = delete_financial_profile(
        db,
        user_id,
    )

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Financial profile not found.",
        )


@router.post(
    "/sync",
    response_model=FinancialProfileResponse,
)
def sync_profile(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_user_owns_resource(user_id, current_user)

    try:
        return sync_financial_summary(db, user_id)
    except PermissionError as error:
        raise HTTPException(status_code=502, detail=str(error))
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error))