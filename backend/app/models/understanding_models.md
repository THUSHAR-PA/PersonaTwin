# Model 
    A model is simply a Python class that represents a table in the database.
## user.py
    user.py defines the User model.
    A model is simply a Python class that represents a table in the database.

        When SQLAlchemy sees this:

        class User(Base):

        it knows:

        "Create a table called users."

        So

        User

        ⇓

        users

    Imports
        import uuid

        We use UUIDs instead of integer IDs.

        Instead of

        1
        2
        3
        4

        users get IDs like

        550e8400-e29b-41d4-a716-446655440000

        Much safer and more professional.
    from sqlalchemy import ...

        These are PostgreSQL column types.

        Example

        String

        becomes

        VARCHAR
        Integer

        becomes

        INTEGER  And So On..
    Base
        class User(Base):

        Remember

        Base

        is the parent class.

        Every SQLAlchemy model inherits from it.

        Without it...

        SQLAlchemy doesn't know this class is a database table
    
    Table Name
        __tablename__ = "users"

        This tells SQLAlchemy

        CREATE TABLE users

        instead of

        CREATE TABLE User

    ID
        id = mapped_column(
            UUID(as_uuid=True),
            primary_key=True,
            default=uuid.uuid4
        )

        This creates

        id UUID PRIMARY KEY

        Every new user automatically gets

        2ab4...

        98ff...

        7c2d...

        No duplicates.

    
    
    Full Name
        full_name

        Stores

        Thushar P A

        Nothing fancy.

        Email
        unique=True

        means

        Two users cannot have

        abc@gmail.com

        PostgreSQL will reject it.

        and so on
