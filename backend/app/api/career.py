from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import ensure_user_owns_resource, get_current_user
from app.models.user import User
from app.schemas.career_profile import (
    CareerProfileCreate,
    CareerProfileUpdate,
    CareerProfileResponse,
)
from app.services.career_service import (
    create_career_profile,
    get_career_profile,
    update_career_profile,
    delete_career_profile,
    sync_github_profile,
)

router = APIRouter(
    prefix="/users/{user_id}/career",
    tags=["Career Profile"],
)


@router.post(
    "/",
    response_model=CareerProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_profile(
    user_id: UUID,
    profile: CareerProfileCreate,
    db: Session = Depends(get_db),
):
    try:
        return create_career_profile(
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
    response_model=CareerProfileResponse,
)
def get_profile(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    profile = get_career_profile(db, user_id)

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="Career profile not found.",
        )

    return profile


@router.put(
    "/",
    response_model=CareerProfileResponse,
)
def update_profile(
    user_id: UUID,
    profile: CareerProfileUpdate,
    db: Session = Depends(get_db),
):
    updated = update_career_profile(
        db,
        user_id,
        profile,
    )

    if updated is None:
        raise HTTPException(
            status_code=404,
            detail="Career profile not found.",
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
    deleted = delete_career_profile(
        db,
        user_id,
    )

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Career profile not found.",
        )


@router.post(
    "/sync-github",
    response_model=CareerProfileResponse,
)
def sync_github(
    user_id: UUID,
    github_username: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_user_owns_resource(user_id, current_user)

    try:
        return sync_github_profile(db, user_id, github_username)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error))

