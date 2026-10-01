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
    WalletAccountRequest,
    WalletLoginRequest,
    WalletSignupRequest,
    WalletTokenRequest,
)
from app.services.finance_service import (
    create_financial_profile,
    get_financial_profile,
    update_financial_profile,
    delete_financial_profile,
    wallet_authenticate,
    wallet_create_account,
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
    "/wallet/accounts",
)
def wallet_create_account_route(
    payload: WalletAccountRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        return wallet_create_account(
            payload.wallet_token,
            payload.model_dump(exclude={"wallet_token"}),
        )
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error))
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error))


@router.post(
    "/wallet/signup",
)
def wallet_signup(
    payload: WalletSignupRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        return wallet_authenticate("signup", payload.model_dump())
    except PermissionError as error:
        detail = str(error)
        status_code = 409 if "already registered" in detail.lower() else 401
        raise HTTPException(status_code=status_code, detail=detail)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error))


@router.post(
    "/wallet/login",
)
def wallet_login(
    payload: WalletLoginRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        return wallet_authenticate("login", payload.model_dump())
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error))
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error))


@router.post(
    "/sync",
    response_model=FinancialProfileResponse,
)
def sync_profile(
    user_id: UUID,
    payload: WalletTokenRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_user_owns_resource(user_id, current_user)

    try:
        return sync_financial_summary(db, user_id, payload.wallet_token if payload else None)
    except PermissionError as error:
        raise HTTPException(status_code=401, detail=str(error))
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error))