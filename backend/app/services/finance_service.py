import os
from uuid import UUID

import httpx
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


def sync_financial_summary(
    db: Session,
    user_id: UUID,
) -> FinancialProfile:
    """Fetch the user's summary from Persona Wallet and persist it locally."""
    wallet_token = os.getenv("PERSONA_WALLET_TOKEN")
    if not wallet_token:
        raise RuntimeError("PERSONA_WALLET_TOKEN is not configured.")

    wallet_url = os.getenv(
        "PERSONA_WALLET_API_URL",
        "https://persona-wallet.onrender.com",
    ).rstrip("/")

    headers = {"Authorization": f"Bearer {wallet_token}"}

    try:
        response = httpx.get(
            f"{wallet_url}/integration/financial-summary",
            headers=headers,
            timeout=15,
        )
        response.raise_for_status()
        summary = response.json()
    except httpx.HTTPStatusError as error:
        if error.response.status_code in (401, 403):
            raise PermissionError("Persona Wallet token is invalid or expired.")
        if error.response.status_code != 500:
            raise RuntimeError("Persona Wallet could not return financial data.")

        try:
            accounts_response = httpx.get(
                f"{wallet_url}/accounts/",
                headers=headers,
                timeout=15,
            )
            accounts_response.raise_for_status()
            accounts = accounts_response.json()

            transactions_response = httpx.get(
                f"{wallet_url}/transactions/",
                headers=headers,
                timeout=15,
            )
            transactions_response.raise_for_status()
            transactions = transactions_response.json()
        except (httpx.HTTPError, ValueError) as fallback_error:
            raise RuntimeError("Persona Wallet could not return financial data.") from fallback_error

        account_ids = {
            account["id"] for account in accounts if account.get("is_system") is False
        }
        income = 0.0
        expenses = 0.0
        for transaction in transactions:
            if transaction.get("status") != "SUCCESS":
                continue
            amount = float(transaction.get("amount", 0) or 0)
            if transaction.get("to_account_id") in account_ids:
                income += amount
            elif transaction.get("from_account_id") in account_ids:
                expenses += amount

        summary = {
            "monthly_income": income,
            "monthly_expense": expenses,
            "current_savings": sum(
                float(account.get("balance", 0) or 0)
                for account in accounts
                if account.get("id") in account_ids
            ),
            "investments": 0,
            "debts": 0,
        }
    except (httpx.HTTPError, ValueError) as error:
        raise RuntimeError("Persona Wallet could not be reached.") from error

    def first_number(*keys: str) -> float:
        for key in keys:
            value = summary.get(key) if isinstance(summary, dict) else None
            if value is not None:
                try:
                    return float(value)
                except (TypeError, ValueError):
                    continue
        return 0.0

    values = {
        "monthly_income": first_number("monthly_income", "monthly_income_total", "income"),
        "monthly_expense": first_number("monthly_expense", "monthly_expenses", "expenses"),
        "current_savings": first_number("current_savings", "savings", "balance", "total_balance"),
        "investments": first_number("investments", "investment_balance"),
        "debts": first_number("debts", "debt", "total_debt"),
    }

    profile = get_financial_profile(db, user_id)
    if profile is None:
        profile = FinancialProfile(user_id=user_id, **values)
        db.add(profile)
    else:
        for field, value in values.items():
            setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile