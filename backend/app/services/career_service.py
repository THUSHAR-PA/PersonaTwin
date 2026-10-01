from uuid import UUID
import os

import httpx
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


def sync_github_profile(
    db: Session,
    user_id: UUID,
    github_username: str,
    github_token: str | None = None,
) -> CareerProfile:
    """Import public GitHub profile and repository signals into career data."""
    username = github_username.strip().lstrip("@").strip()
    if not username:
        raise ValueError("GitHub username is required.")

    return sync_github_data(db, user_id, username, github_token or os.getenv("GITHUB_TOKEN"))


def sync_github_data(
    db: Session,
    user_id: UUID,
    github_username: str,
    github_token: str | None = None,
) -> CareerProfile:
    """Import GitHub profile and repository signals using a supplied token."""
    headers = {"Accept": "application/vnd.github+json"}
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"

    try:
        profile_response = httpx.get(
            f"https://api.github.com/user" if github_token else f"https://api.github.com/users/{github_username}",
            headers=headers,
            timeout=15,
        )
        profile_response.raise_for_status()
        github_profile = profile_response.json()
        username = github_profile.get("login", github_username)

        repositories_response = httpx.get(
            f"https://api.github.com/user/repos" if github_token else f"https://api.github.com/users/{username}/repos",
            params={"per_page": 100, "sort": "updated"},
            headers=headers,
            timeout=15,
        )
        repositories_response.raise_for_status()
        repositories = repositories_response.json()
    except httpx.HTTPStatusError as error:
        if error.response.status_code == 404:
            raise ValueError("GitHub user not found.") from error
        if error.response.status_code == 403:
            raise RuntimeError("GitHub API rate limit reached. Configure GITHUB_TOKEN and try again.") from error
        raise RuntimeError("GitHub could not return career data.") from error
    except (httpx.HTTPError, ValueError) as error:
        raise RuntimeError("GitHub could not be reached.") from error

    profile = get_career_profile(db, user_id)
    existing_skills = list(profile.skills or []) if profile else []
    existing_certifications = list(profile.certifications or []) if profile else []
    languages = sorted({
        repository.get("language")
        for repository in repositories
        if repository.get("language")
    })
    topics = sorted({
        topic
        for repository in repositories
        for topic in repository.get("topics", [])
    })

    repository_text = " ".join(
        " ".join(
            str(repository.get(field) or "")
            for field in ("name", "description", "language")
        )
        + " "
        + " ".join(repository.get("topics", []))
        for repository in repositories
    ).lower()
    language_names = {language.lower() for language in languages}
    inferred_skills = set(languages)

    skill_keywords = {
        "React": ("react", "next.js", "nextjs"),
        "TypeScript": ("typescript",),
        "JavaScript": ("javascript", "node", "express"),
        "Python": ("python", "django", "flask", "fastapi"),
        "Java": ("java", "spring", "android"),
        "C#": ("c#", ".net", "asp.net"),
        "Go": ("golang", " go "),
        "Rust": ("rust",),
        "SQL": ("sql", "postgres", "mysql", "database"),
        "Machine Learning": ("machine-learning", "machine learning", "tensorflow", "pytorch", "scikit"),
        "Data Analysis": ("data-analysis", "data analysis", "pandas", "numpy", "jupyter"),
        "Cloud": ("aws", "azure", "gcp", "cloud"),
        "Docker": ("docker", "container"),
        "Kubernetes": ("kubernetes", "k8s"),
        "Terraform": ("terraform",),
    }
    for skill, keywords in skill_keywords.items():
        if any(keyword in repository_text for keyword in keywords):
            inferred_skills.add(skill)

    role_signals = [
        ("Machine Learning Engineer", ("machine learning", "tensorflow", "pytorch", "scikit", "ml")),
        ("Data Analyst", ("data analysis", "pandas", "numpy", "jupyter", "analytics")),
        ("DevOps Engineer", ("docker", "kubernetes", "terraform", "aws", "azure", "gcp", "devops")),
        ("Frontend Developer", ("react", "next.js", "nextjs", "frontend", "vue", "angular")),
        ("Backend Developer", ("django", "flask", "fastapi", "spring", "express", "backend", "api")),
        ("Mobile Developer", ("android", "ios", "swift", "kotlin", "react native", "flutter")),
    ]
    inferred_role = "Software Developer"
    for role, keywords in role_signals:
        if sum(keyword in repository_text for keyword in keywords) >= 1:
            inferred_role = role
            break
    if not language_names and not topics:
        inferred_role = "Developer"

    values = {
        "current_role": inferred_role,
        "years_of_experience": profile.years_of_experience if profile else 0,
        "expected_salary": profile.expected_salary if profile else 0,
        "dream_role": profile.dream_role if profile else "",
        "skills": sorted(set(existing_skills) | inferred_skills),
        "certifications": sorted(set(existing_certifications + topics)),
    }
    if not values["current_role"]:
        values["current_role"] = profile.current_role if profile else ""

    if profile is None:
        profile = CareerProfile(user_id=user_id, **values)
        db.add(profile)
    else:
        for field, value in values.items():
            setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile