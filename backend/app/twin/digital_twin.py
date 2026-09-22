from __future__ import annotations

from typing import Any

from app.services.simulation_service import run_job_switch_simulation


class DigitalTwin:

    def __init__(self):
        self.name = "Thushar"
        self.career_score = 0
        self.finance_score = 0
        self.learning_score = 0
        self.github_connected = False
        self.profile_summary: dict[str, Any] = {}

    def sync(
        self,
        user: dict[str, Any] | None = None,
        financial_profile: dict[str, Any] | None = None,
        career_profile: dict[str, Any] | None = None,
        health_profile: dict[str, Any] | None = None,
    ):
        user = user or {}
        financial_profile = financial_profile or {}
        career_profile = career_profile or {}
        health_profile = health_profile or {}

        self.name = user.get("full_name") or self.name
        self.profile_summary = {
            "full_name": user.get("full_name") or self.name,
            "career_goal": user.get("career_goal") or "Not specified",
            "monthly_income": financial_profile.get("monthly_income", 0),
            "monthly_expense": financial_profile.get("monthly_expense", 0),
            "current_savings": financial_profile.get("current_savings", 0),
            "years_of_experience": career_profile.get("years_of_experience", 0),
            "expected_salary": career_profile.get("expected_salary", 0),
            "dream_role": career_profile.get("dream_role") or "Not specified",
            "sleep_hours": health_profile.get("sleep_hours", 0),
            "exercise_days": health_profile.get("exercise_days", 0),
        }

        self.career_score = self._compute_career_score(career_profile, user)
        self.finance_score = self._compute_finance_score(financial_profile)
        self.learning_score = self._compute_learning_score(career_profile, health_profile, user)

        return self

    def simulate(self, scenario: str, **kwargs):
        scenario_name = (scenario or "").lower()

        if scenario_name == "job_switch":
            target_salary = kwargs.get("target_salary", 0)
            switching_cost = kwargs.get("switching_cost", 0)
            expected_years = kwargs.get("expected_years", 1)
            return run_job_switch_simulation(
                {
                    "target_salary": target_salary,
                    "switching_cost": switching_cost,
                    "expected_years": expected_years,
                }
            )

        return {
            "score": round(self.career_score, 1),
            "simulation_name": scenario_name.replace("_", " ").title() or "Twin Simulation",
            "summary": "Scenario simulation is not yet implemented for this domain.",
            "metrics": {},
            "recommendations": [
                "Add more user profile data to improve the twin forecast.",
                "Use a concrete scenario such as job switch or higher studies.",
            ],
        }

    def predict(self):
        return {
            "name": self.name,
            "career_score": round(self.career_score, 1),
            "finance_score": round(self.finance_score, 1),
            "learning_score": round(self.learning_score, 1),
            "summary": (
                "Your digital twin indicates strong potential in your current trajectory, "
                "with the best opportunities in career growth and personal development."
            ),
            "recommendations": [
                "Continue building your skill stack in the direction of your dream role.",
                "Keep emergency savings and reduce lifestyle spending to improve financial resilience.",
                "Maintain sleep and exercise habits to support long-term performance.",
            ],
        }

    def _compute_career_score(self, career_profile: dict[str, Any], user: dict[str, Any]) -> float:
        experience = float(career_profile.get("years_of_experience", 0) or 0)
        expected_salary = float(career_profile.get("expected_salary", 0) or 0)
        goal = user.get("career_goal") or ""

        score = 30 + min(experience * 8, 35) + min(expected_salary / 3000, 25)

        if goal and "manager" in goal.lower():
            score += 10
        if career_profile.get("dream_role"):
            score += 5

        return max(0, min(100, score))

    def _compute_finance_score(self, financial_profile: dict[str, Any]) -> float:
        income = float(financial_profile.get("monthly_income", 0) or 0)
        expense = float(financial_profile.get("monthly_expense", 0) or 0)
        savings = float(financial_profile.get("current_savings", 0) or 0)
        debt = float(financial_profile.get("debts", 0) or 0)

        if income <= 0:
            return 0

        surplus_ratio = (income - expense) / income
        savings_ratio = min(savings / max(income * 12, 1), 1.0)
        debt_penalty = min(debt / max(income * 12, 1), 1.0) * 20

        score = 40 + (surplus_ratio * 35) + (savings_ratio * 25) - debt_penalty
        return max(0, min(100, score))

    def _compute_learning_score(self, career_profile: dict[str, Any], health_profile: dict[str, Any], user: dict[str, Any]) -> float:
        experience = float(career_profile.get("years_of_experience", 0) or 0)
        skills = career_profile.get("skills") or []
        sleep_hours = float(health_profile.get("sleep_hours", 0) or 0)
        exercise_days = int(health_profile.get("exercise_days", 0) or 0)
        education = user.get("education") or ""

        score = 25 + min(experience * 7, 35)
        score += min(len(skills) * 6, 20)
        score += min(max(0, sleep_hours - 5) * 5, 15)
        score += min(exercise_days * 3, 15)

        if education:
            score += 10

        return max(0, min(100, score))