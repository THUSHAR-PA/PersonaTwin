# Database Models - PersonaTwin

## Current Implementation Status

The project has moved beyond the initial planning stage and now includes a working backend foundation for PersonaTwin.

### What has been implemented

- A FastAPI application entry point in the backend
- SQLAlchemy-based database models for users, financial profiles, career profiles, and health profiles
- UUID-based primary keys and one-to-one profile relationships
- Alembic migration setup for future schema changes
- Initial digital twin and simulation module scaffolding

This documentation now reflects both the planned architecture and the current implementation progress of the system.

## 📅 Date

July 12, 2026

---

# Goal

The objective of today's work was to design the database foundation for PersonaTwin.

Instead of storing all user information in a single table, the project separates the user's information into multiple profiles. This follows the concept of a **Digital Twin**, where each profile represents one aspect of a person's life.

Current architecture:

```
User
│
├── Financial Profile
├── Career Profile
└── Health Profile
```

---

# What is a Database Model?

A **database model** is a Python class that represents a database table.

In SQLAlchemy:

```python
class User(Base):
```

creates a table named:

```sql
users
```

Every model in PersonaTwin inherits from the `Base` class.

---

# Why Multiple Tables?

Initially, it might seem easier to create one large `users` table.

Example:

```
Users

id
name
email
income
expense
weight
height
skills
education
career
salary
...
```

As the project grows, this becomes difficult to maintain.

Instead, PersonaTwin separates data according to responsibility.

```
User
│
├── Financial Profile
├── Career Profile
└── Health Profile
```

Advantages:

* Better organization
* Easier maintenance
* Cleaner code
* Easier expansion in the future

---

# User Model

Purpose:

Stores the user's identity and personal information.

Fields:

* ID
* Full Name
* Email
* Age
* Gender
* Country
* Education
* University
* CGPA
* Career Goal
* Dream Country
* Risk Tolerance
* Created At

The User table **does not** store financial or health information.

Those belong in their respective profile tables.

---

# Financial Profile

Purpose:

Stores the user's financial condition.

Fields:

* Monthly Income
* Monthly Expense
* Current Savings
* Investments
* Debts

Example Question this table helps answer:

> "Can the user afford to buy a laptop?"

---

# Career Profile

Purpose:

Stores career-related information.

Fields:

* Current Role
* Years of Experience
* Expected Salary
* Dream Role
* Skills
* Certifications

Skills and certifications are stored as JSON arrays because this is sufficient for the current project scope and avoids unnecessary complexity.

---

# Health Profile

Purpose:

Stores the user's basic health information.

Fields:

* Height
* Weight
* Sleep Hours
* Exercise Days

Example Question:

> "Is the user's current lifestyle healthy?"

---

# UUID

Instead of integer IDs:

```
1
2
3
```

PersonaTwin uses UUIDs.

Example:

```
550e8400-e29b-41d4-a716-446655440000
```

Reasons:

* Hard to guess
* Better for APIs
* Common in modern applications
* Prevents ID collisions

---

# Foreign Key

Every profile table contains:

```
user_id
```

Example:

```
FinancialProfile

user_id
```

This value points to

```
User.id
```

This creates a relationship between the user and their profile.

Database relationship:

```
User

1 -------- 1 FinancialProfile
```

The same applies to:

* CareerProfile
* HealthProfile

---

# SQLAlchemy Relationship

SQLAlchemy provides another concept called `relationship()`.

Without a relationship:

```python
finance = db.query(FinancialProfile).filter(
    FinancialProfile.user_id == user.id
).first()
```

With a relationship:

```python
user.financial_profile
```

SQLAlchemy automatically loads the related object.

Relationship works only in Python.

Foreign keys work inside the database.

---

# One-to-One Relationship

PersonaTwin uses one-to-one relationships.

```
User

1 -------- 1 FinancialProfile

1 -------- 1 CareerProfile

1 -------- 1 HealthProfile
```

A user can own only one profile of each type.

---

# Cascade Delete

Relationships use:

```python
cascade="all, delete-orphan"
```

Meaning:

If a user is deleted,

their related profiles are automatically deleted.

This prevents orphan records.

---

# JSON Fields

CareerProfile stores:

* Skills
* Certifications

Instead of separate tables, JSON is used.

Example:

```json
[
    "Python",
    "FastAPI",
    "Machine Learning"
]
```

This keeps the database simple while still allowing multiple values.

---

# Project Architecture

Current database architecture:

```
                User
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
 Financial    Career     Health
  Profile     Profile    Profile
```

This forms the **Digital Twin**.

---

# What Was Completed

* Database connection
* SQLAlchemy Base
* Database session
* User model
* FinancialProfile model
* CareerProfile model
* HealthProfile model
* One-to-one relationships

---

# What Comes Next

The next milestone is creating the actual PostgreSQL tables.

Tasks:

* Configure Alembic
* Generate initial migration
* Create PostgreSQL tables
* Verify schema in pgAdmin

After that:

* CRUD APIs
* Digital Twin Builder
* Simulation Engine
* AI Recommendation Engine

---

# Key Learnings

* A SQLAlchemy model represents a database table.
* UUIDs are better than integer IDs for this project.
* Foreign keys connect tables inside the database.
* `relationship()` connects objects inside Python.
* One-to-one relationships are suitable for the Digital Twin design.
* Splitting data into profiles creates a cleaner and more maintainable architecture than storing everything in a single table.

---

# Summary

At the end of this milestone, PersonaTwin now has a complete database structure for representing a user's digital twin.

The project has moved from an empty backend to a structured system capable of storing identity, financial, career, and health information. This forms the foundation for future modules such as simulations, recommendations, and AI-driven decision support.
