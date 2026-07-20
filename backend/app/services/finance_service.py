from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.financial_profile import FinancialProfile
from app.schemas.financial_profile import (
    FinancialProfileCreate,
    FinancialProfileUpdate,
)


def create_financial_profile(
    db: Session,
    user_id: UUID,
    profile_data: FinancialProfileCreate,
) -> FinancialProfile:
    """
    Create a financial profile for a user.

    A user can have only one financial profile.

    Args:
        db:
            SQLAlchemy database session.

        user_id:
            UUID of the user.

        profile_data:
            Financial profile information.

    Returns:
        Newly created FinancialProfile.

    Raises:
        ValueError:
            If the user does not exist or already has
            a financial profile.
    """

    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise ValueError("User not found.")

    existing = (
        db.query(FinancialProfile)
        .filter(FinancialProfile.user_id == user_id)
        .first()
    )

    if existing:
        raise ValueError(
            "Financial profile already exists."
        )

    profile = FinancialProfile(
        user_id=user_id,
        monthly_income=profile_data.monthly_income,
        monthly_expense=profile_data.monthly_expense,
        current_savings=profile_data.current_savings,
        investments=profile_data.investments,
        debts=profile_data.debts,
    )

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return profile


def get_financial_profile(
    db: Session,
    user_id: UUID,
) -> FinancialProfile | None:
    """
    Retrieve a user's financial profile.
    """

    return (
        db.query(FinancialProfile)
        .filter(FinancialProfile.user_id == user_id)
        .first()
    )


def update_financial_profile(
    db: Session,
    user_id: UUID,
    profile_data: FinancialProfileUpdate,
) -> FinancialProfile | None:
    """
    Update a user's financial profile.
    """

    profile = (
        db.query(FinancialProfile)
        .filter(FinancialProfile.user_id == user_id)
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


def delete_financial_profile(
    db: Session,
    user_id: UUID,
) -> bool:
    """
    Delete a user's financial profile.
    """

    profile = (
        db.query(FinancialProfile)
        .filter(FinancialProfile.user_id == user_id)
        .first()
    )

    if profile is None:
        return False

    db.delete(profile)
    db.commit()

    return True