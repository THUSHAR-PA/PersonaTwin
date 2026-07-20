from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


def create_user(db: Session, user_data: UserCreate) -> User:
    """
    Create a new user.

    This function checks whether the email already exists.
    If the email is unique, a new user record is created
    and stored in the database.

    Args:
        db (Session):
            SQLAlchemy database session.

        user_data (UserCreate):
            Validated user registration data.

    Returns:
        User:
            Newly created User object.

    Raises:
        ValueError:
            If a user with the given email already exists.
    """

    existing_user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )

    if existing_user:
        raise ValueError("Email already exists.")

    new_user = User(
        full_name=user_data.full_name,
        email=user_data.email,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


def get_user_by_id(db: Session, user_id: UUID) -> User | None:
    """
    Retrieve a user by their unique ID.

    Args:
        db (Session):
            SQLAlchemy database session.

        user_id (UUID):
            UUID of the user.

    Returns:
        User | None:
            User object if found, otherwise None.
    """

    return (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )


def get_all_users(db: Session) -> list[User]:
    """
    Retrieve all users from the database.

    Args:
        db (Session):
            SQLAlchemy database session.

    Returns:
        list[User]:
            List of all users.
    """

    return (
        db.query(User)
        .order_by(User.created_at.desc())
        .all()
    )


def update_user(
    db: Session,
    user_id: UUID,
    user_data: UserUpdate,
) -> User | None:
    """
    Update an existing user's profile.

    Only the fields provided in the request are updated.

    Args:
        db (Session):
            SQLAlchemy database session.

        user_id (UUID):
            UUID of the user.

        user_data (UserUpdate):
            Validated user update data.

    Returns:
        User | None:
            Updated User object if found,
            otherwise None.
    """

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if user is None:
        return None

    update_data = user_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return user


def delete_user(db: Session, user_id: UUID) -> bool:
    """
    Delete a user from the database.

    Args:
        db (Session):
            SQLAlchemy database session.

        user_id (UUID):
            UUID of the user.

    Returns:
        bool:
            True if the user was deleted successfully.
            False if the user does not exist.
    """

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if user is None:
        return False

    db.delete(user)
    db.commit()

    return True