from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.career_profile import CareerProfile
from app.schemas.career_profile import (
    CareerProfileCreate,
    CareerProfileUpdate,
)


def create_career_profile(
    db: Session,
    user_id: UUID,
    profile_data: CareerProfileCreate,
) -> CareerProfile:
    """
    Create a career profile for a user.
    """

    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise ValueError("User not found.")

    existing = (
        db.query(CareerProfile)
        .filter(CareerProfile.user_id == user_id)
        .first()
    )

    if existing:
        raise ValueError(
            "Career profile already exists."
        )

    profile = CareerProfile(
        user_id=user_id,
        current_role=profile_data.current_role,
        years_of_experience=profile_data.years_of_experience,
        expected_salary=profile_data.expected_salary,
        dream_role=profile_data.dream_role,
        skills=profile_data.skills,
        certifications=profile_data.certifications,
    )

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return profile


def get_career_profile(
    db: Session,
    user_id: UUID,
) -> CareerProfile | None:
    """
    Retrieve a user's career profile.
    """

    return (
        db.query(CareerProfile)
        .filter(CareerProfile.user_id == user_id)
        .first()
    )


def update_career_profile(
    db: Session,
    user_id: UUID,
    profile_data: CareerProfileUpdate,
) -> CareerProfile | None:
    """
    Update a user's career profile.
    """

    profile = (
        db.query(CareerProfile)
        .filter(CareerProfile.user_id == user_id)
        .first()
    )

    if profile is None:
        return None

    update_data = profile_data.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)

    return profile


def delete_career_profile(
    db: Session,
    user_id: UUID,
) -> bool:
    """
    Delete a user's career profile.
    """

    profile = (
        db.query(CareerProfile)
        .filter(CareerProfile.user_id == user_id)
        .first()
    )

    if profile is None:
        return False

    db.delete(profile)
    db.commit()

    return True