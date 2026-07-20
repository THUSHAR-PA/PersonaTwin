from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.health_profile import (
    HealthProfileCreate,
    HealthProfileUpdate,
    HealthProfileResponse,
)
from app.services.health_service import (
    create_health_profile,
    get_health_profile,
    update_health_profile,
    delete_health_profile,
)

router = APIRouter(
    prefix="/users/{user_id}/health",
    tags=["Health Profile"],
)


@router.post(
    "/",
    response_model=HealthProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_profile(
    user_id: UUID,
    profile: HealthProfileCreate,
    db: Session = Depends(get_db),
):
    try:
        return create_health_profile(
            db,
            user_id,
            profile,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.get(
    "/",
    response_model=HealthProfileResponse,
)
def get_profile(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    profile = get_health_profile(db, user_id)

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="Health profile not found.",
        )

    return profile


@router.put(
    "/",
    response_model=HealthProfileResponse,
)
def update_profile(
    user_id: UUID,
    profile: HealthProfileUpdate,
    db: Session = Depends(get_db),
):
    updated = update_health_profile(
        db,
        user_id,
        profile,
    )

    if updated is None:
        raise HTTPException(
            status_code=404,
            detail="Health profile not found.",
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
    deleted = delete_health_profile(
        db,
        user_id,
    )

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Health profile not found.",
        )