from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.health_profile import HealthProfile
from app.schemas.health_profile import (
    HealthProfileCreate,
    HealthProfileUpdate,
)


def create_health_profile(
    db: Session,
    user_id: UUID,
    profile_data: HealthProfileCreate,
) -> HealthProfile:
    """
    Create a health profile for a user.
    """

    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise ValueError("User not found.")

    existing = (
        db.query(HealthProfile)
        .filter(HealthProfile.user_id == user_id)
        .first()
    )

    if existing:
        raise ValueError(
            "Health profile already exists."
        )

    profile = HealthProfile(
        user_id=user_id,
        height=profile_data.height,
        weight=profile_data.weight,
        sleep_hours=profile_data.sleep_hours,
        exercise_days=profile_data.exercise_days,
    )

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return profile


def get_health_profile(
    db: Session,
    user_id: UUID,
) -> HealthProfile | None:
    """
    Retrieve a user's health profile.
    """

    return (
        db.query(HealthProfile)
        .filter(HealthProfile.user_id == user_id)
        .first()
    )


def update_health_profile(
    db: Session,
    user_id: UUID,
    profile_data: HealthProfileUpdate,
) -> HealthProfile | None:
    """
    Update a user's health profile.
    """

    profile = (
        db.query(HealthProfile)
        .filter(HealthProfile.user_id == user_id)
        .first()
    )

    if profile is None:
        return None

    update_data = profile_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)

    return profile


def delete_health_profile(
    db: Session,
    user_id: UUID,
) -> bool:
    """
    Delete a user's health profile.
    """

    profile = (
        db.query(HealthProfile)
        .filter(HealthProfile.user_id == user_id)
        .first()
    )

    if profile is None:
        return False

    db.delete(profile)
    db.commit()

    return True