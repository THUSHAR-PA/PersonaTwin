# 🚀 PersonaTwin

> **An Explainable AI Personal Decision Simulator using Human Digital Twin Technology**

PersonaTwin is an AI-powered Human Digital Twin platform that helps users make better life decisions by creating a digital representation of themselves. Instead of giving generic AI responses, PersonaTwin uses the user's personal profile, financial situation, career information, and health data to simulate different future scenarios and generate explainable recommendations.

The goal of the project is to combine **Digital Twin Technology**, **Artificial Intelligence**, **Decision Support Systems**, **Simulation**, and **Explainable AI (XAI)** into one unified platform.

---

# 📌 Project Objectives

The system aims to:

* Build a Human Digital Twin for every user.
* Model multiple aspects of a person's life.
* Simulate future outcomes based on user decisions.
* Provide AI-powered recommendations.
* Explain every recommendation instead of acting like a black box.
* Create a scalable architecture that supports future AI models.

---

# ✨ Planned Features

## Version 1 (Current Development)

* User Authentication
* User Digital Twin
* Financial Profile
* Career Profile
* Health Profile
* AI Chat Interface
* Decision Engine
* Scenario Simulation
* Explainable Recommendations

---

## Future Versions

* Monte Carlo Simulation
* Career Prediction Models
* Salary Prediction
* Financial Forecasting
* Investment Advisor
* Health Prediction
* Wearable Device Integration
* Google Fit Integration
* Banking APIs
* Calendar Integration
* Email Integration

---

# 🏗️ System Architecture

```
                        React Frontend
                               │
                               ▼
                      FastAPI Backend
                               │
                ┌──────────────┴──────────────┐
                │                             │
          Authentication                 REST APIs
                │                             │
                └──────────────┬──────────────┘
                               ▼
                      Decision Engine
                               │
        ┌──────────────┬──────────────┬──────────────┐
        │              │              │
        ▼              ▼              ▼
  Digital Twin   Simulation     Prediction Engine
        │              │              │
        └──────────────┴──────────────┘
                       │
                       ▼
              Recommendation Engine
                       │
                       ▼
              Explainability Engine
                       │
                       ▼
                  PostgreSQL Database
```

---

# 📂 Project Structure

```
PersonaTwin/

backend/
│
├── app/
│   ├── api/
│   ├── database/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   ├── simulation/
│   ├── twin/
│   ├── ml/
│   ├── agents/
│   ├── utils/
│   └── main.py
│
├── tests/
│
frontend/
│
├── assets/
├── css/
└── js/
│
database/
│
docker/
│
docs/
│
ml/

README.md
```

---

# 🧩 Folder Responsibilities

## backend/app/api

Contains all FastAPI routes.

Example:

* Authentication
* User APIs
* Simulation APIs
* Recommendation APIs

---

## backend/app/models

Contains SQLAlchemy database models.

Examples:

* User
* FinancialProfile
* CareerProfile
* HealthProfile

---

## backend/app/schemas

Contains all Pydantic schemas.

Examples:

* UserCreate
* UserUpdate
* UserResponse

---

## backend/app/database

Database connection

SQLAlchemy Base

Alembic configuration

---

## backend/app/services

Business logic.

Examples

* UserService
* RecommendationService
* SimulationService

---

## backend/app/twin

Digital Twin implementation.

Responsible for:

* Creating user twin
* Updating twin
* Combining all user information
* Returning one DigitalTwin object

---

## backend/app/simulation

Simulation engine.

Examples

* What-if analysis
* Scenario comparison
* Future projections

---

## backend/app/ml

Machine Learning models.

Future modules:

* Career prediction
* Salary prediction
* Financial prediction
* Health prediction

---

## backend/app/agents

LLM agents.

Examples

* Financial Advisor
* Career Advisor
* Health Advisor

---

## backend/app/utils

Utility functions.

Examples

* Helper functions
* Validators
* Logger
* Configuration

---

# 🛠️ Tech Stack

## Backend

* Python 3.13
* FastAPI
* SQLAlchemy
* Pydantic
* Alembic

---

## Database

* PostgreSQL

---

## Frontend

* React
* Tailwind CSS
* Axios

---

## AI

* OpenAI / Groq API
* Scikit-learn
* NumPy
* Pandas

---

## Deployment

* Docker

---

# 🗄️ Database Design

The Human Digital Twin consists of multiple connected profiles.

```
                User
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
 Financial   Career    Health
  Profile    Profile   Profile
```

Each user owns one profile for every major life domain.

---

# 👨‍💻 Team Responsibilities

## Backend Developer

Responsible for:

* FastAPI
* SQLAlchemy
* APIs
* Database
* Authentication

---

## AI Developer

Responsible for:

* Decision Engine
* Recommendation Engine
* LLM Integration
* Prompt Engineering
* ML Models

---

## Frontend Developer

Responsible for:

* React
* Dashboard
* Forms
* Charts
* API Integration

---

## Database Developer

Responsible for:

* PostgreSQL
* Database Schema
* Relationships
* Alembic Migrations

---

## Documentation & Testing

Responsible for:

* Documentation
* Testing
* API Testing
* Bug Reports
* User Manual

---

# 📅 Development Roadmap

## Sprint 1

* Project setup
* PostgreSQL
* SQLAlchemy
* Database models
* CRUD APIs

---

## Sprint 2

* Digital Twin Engine
* User Profile
* Twin Service

---

## Sprint 3

* Decision Engine
* Simulation Engine
* Recommendation Engine

---

## Sprint 4

* React Frontend
* Dashboard
* User Profile UI

---

## Sprint 5

* AI Integration
* LLM
* Explainability

---

## Sprint 6

* Testing
* Deployment
* Documentation
* Final Presentation

---

# 🌿 Git Workflow

Never push directly to `main`.

Use feature branches.

```
main

↓

develop

↓

feature/database

feature/frontend

feature/simulation

feature/authentication

feature/chat

feature/dashboard
```

Merge all completed work into `develop`.

After testing, merge `develop` into `main`.

---

# 📌 Coding Standards

* Use type hints.
* Follow PEP8.
* Write meaningful commit messages.
* Keep functions small.
* Create reusable services.
* Avoid duplicate code.
* Add comments only where necessary.
* Use environment variables for secrets.

---

# 📄 API Endpoints (Planned)

## User

```
POST   /users
GET    /users
GET    /users/{id}
PUT    /users/{id}
DELETE /users/{id}
```

---

## Financial

```
POST /financial
GET  /financial/{id}
PUT  /financial/{id}
```

---

## Career

```
POST /career
GET  /career/{id}
PUT  /career/{id}
```

---

## Health

```
POST /health
GET  /health/{id}
PUT  /health/{id}
```

---

## Simulation

```
POST /simulate
```

---

## Recommendation

```
POST /recommend
```

---

## Chat

```
POST /chat
```

---

# 🚀 Getting Started

## Clone Repository

```bash
git clone <repository-url>
cd PersonaTwin
```

---

## Create Virtual Environment

```bash
python -m venv .venv
```

Activate

Windows

```bash
.venv\Scripts\activate
```

Linux/Mac

```bash
source .venv/bin/activate
```

---

## Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Configure Environment

Create a `.env` file inside the backend directory.

Example

```
DATABASE_URL=
OPENAI_API_KEY=
GROQ_API_KEY=
SECRET_KEY=
```

---

## Run Backend

```bash
uvicorn app.main:app --reload
```

---

# 🎯 Long-Term Vision

PersonaTwin is designed to evolve into a complete Human Digital Twin platform capable of assisting users with financial planning, career growth, health management, and everyday decision-making through AI-powered simulations and explainable recommendations.

---

# 👥 Team

This project is being developed as a Final Year B.Tech Project.

Contributors are expected to follow the project architecture, coding standards, and Git workflow to maintain consistency across the codebase.
