# 02_alembic_and_migrations.md

# Alembic & Database Migrations

## What is Alembic?

Alembic is the **database migration tool** used with SQLAlchemy.

It keeps the database schema synchronized with the SQLAlchemy models.

Instead of manually writing SQL commands every time the database changes, Alembic generates and manages those changes automatically.

---

# Why do we need Alembic?

Suppose we create this SQLAlchemy model.

```python
class User(Base):
    __tablename__ = "users"
```

This **does not** automatically create a table inside PostgreSQL.

The model only describes the table.

Something still has to create it.

That is Alembic's job.

---

# Without Alembic

Imagine adding a new field.

```python
phone_number = mapped_column(String)
```

You would have to manually execute SQL.

```sql
ALTER TABLE users
ADD COLUMN phone_number VARCHAR;
```

Every change requires manual SQL.

As the project grows, this becomes difficult to manage.

---

# With Alembic

You simply update the model.

```python
phone_number = mapped_column(String)
```

Then run

```bash
alembic revision --autogenerate -m "Added phone number"
```

Alembic compares

* SQLAlchemy Models
* PostgreSQL Database

It automatically generates the SQL needed.

Finally run

```bash
alembic upgrade head
```

Database updated.

No manual SQL required.

---

# What is a Migration?

A migration is simply a record of how the database changed.

Think of it like Git commits.

Git tracks

```
Source Code
```

Alembic tracks

```
Database Schema
```

Example

```
Migration 1

Create users table

↓

Migration 2

Create financial_profiles table

↓

Migration 3

Add phone_number column
```

Every change becomes part of the project's history.

---

# SQLAlchemy vs Alembic

Many beginners confuse these.

## SQLAlchemy

Responsible for

* Models
* Relationships
* ORM
* Database Queries

Example

```python
class User(Base):
```

SQLAlchemy describes what the table should look like.

---

## Alembic

Responsible for

* Creating tables
* Updating tables
* Tracking schema history
* Rolling back database changes

---

# Workflow

The normal development workflow is

```
Write Model

↓

Generate Migration

↓

Apply Migration

↓

Database Updated
```

---

# Important Commands

## Initialize Alembic

Only done once.

```bash
alembic init alembic
```

Creates

```
alembic/

alembic.ini
```

---

## Generate Migration

```bash
alembic revision --autogenerate -m "Create user table"
```

Meaning

* Compare models with database
* Generate migration file

Nothing is changed yet.

---

## Apply Migration

```bash
alembic upgrade head
```

Meaning

Apply the latest migration.

Database gets updated.

---

## Show Current Version

```bash
alembic current
```

Shows the migration currently applied.

---

## Show Migration History

```bash
alembic history
```

Lists every migration.

---

## Roll Back One Migration

```bash
alembic downgrade -1
```

Undo the most recent migration.

---

## Roll Back Everything

```bash
alembic downgrade base
```

Returns database to its initial state.

Useful during development.

---

# Typical Project Structure

```
backend/

├── alembic/
│   ├── versions/
│   ├── env.py
│   └── script.py.mako
│
├── app/
│   ├── models/
│   ├── database/
│   └── ...
│
└── alembic.ini
```

---

# What is `versions/`?

Every migration file is stored here.

Example

```
versions/

001_create_users.py

002_create_financial_profile.py

003_add_phone_number.py
```

Never edit these unless you know what you're doing.

---

# What is `env.py`?

This file tells Alembic

* Where the SQLAlchemy models are
* Which database to connect to
* Which metadata to compare

Without it, Alembic cannot detect models.

---

# What is `Base.metadata`?

Every SQLAlchemy model inherits from

```python
Base
```

Example

```python
class User(Base):
```

`Base.metadata` contains information about every model.

Alembic reads

```
Base.metadata

↓

User

FinancialProfile

CareerProfile

HealthProfile
```

Then compares them with PostgreSQL.

---

# Migration Lifecycle

```
Create Model

↓

Generate Migration

↓

Migration File Created

↓

Review Migration

↓

Upgrade Database

↓

Tables Created
```

---

# Common Commands

Create migration

```bash
alembic revision --autogenerate -m "message"
```

Apply latest migration

```bash
alembic upgrade head
```

Rollback last migration

```bash
alembic downgrade -1
```

Rollback everything

```bash
alembic downgrade base
```

Show current version

```bash
alembic current
```

Show history

```bash
alembic history
```

---

# Common Mistakes

### Forgetting to import models

Alembic cannot detect models that are never imported.

---

### Forgetting `Base.metadata`

Alembic has nothing to compare.

---

### Editing migration files randomly

Migration files represent database history.

Changing them carelessly can break the migration chain.

---

### Running `revision` without changing models

Alembic generates an empty migration.

---

# Alembic in PersonaTwin

Current workflow

```
Write User Model

↓

Write FinancialProfile

↓

Write CareerProfile

↓

Write HealthProfile

↓

Generate Migration

↓

Create PostgreSQL Tables

↓

CRUD APIs

↓

Digital Twin Builder
```

---

# Key Takeaways

* SQLAlchemy defines database models.
* Alembic creates and updates database tables.
* A migration is a version-controlled database change.
* Every schema modification should be made through a migration.
* Never manually edit PostgreSQL tables during development if Alembic is managing the schema.
* SQLAlchemy and Alembic work together—one defines the structure, the other applies it to the database.

---

# Summary

Alembic is a migration tool for SQLAlchemy.

Instead of writing SQL manually, developers modify SQLAlchemy models and let Alembic generate the required database changes.

For PersonaTwin, Alembic will manage the creation and future evolution of the database schema, ensuring that every teammate has the same database structure and that schema changes are tracked throughout the project.
