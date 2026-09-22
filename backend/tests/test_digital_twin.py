from app.twin.digital_twin import DigitalTwin


def test_digital_twin_sync_aggregates_profile_data():
    twin = DigitalTwin()

    result = twin.sync(
        user={"full_name": "Aisha", "career_goal": "Product Manager"},
        financial_profile={"monthly_income": 5500, "monthly_expense": 2600, "current_savings": 18000},
        career_profile={"years_of_experience": 4, "expected_salary": 95000, "dream_role": "Senior PM"},
        health_profile={"sleep_hours": 7.5, "exercise_days": 4},
    )

    assert result is twin
    assert twin.name == "Aisha"
    assert 0 <= twin.career_score <= 100
    assert 0 <= twin.finance_score <= 100
    assert 0 <= twin.learning_score <= 100
    assert twin.profile_summary["career_goal"] == "Product Manager"


def test_digital_twin_simulate_job_switch_returns_actionable_summary():
    twin = DigitalTwin().sync(
        user={"full_name": "Aisha", "career_goal": "Product Manager"},
        financial_profile={"monthly_income": 5500, "monthly_expense": 2600, "current_savings": 18000},
        career_profile={"years_of_experience": 4, "expected_salary": 95000, "dream_role": "Senior PM"},
        health_profile={"sleep_hours": 7.5, "exercise_days": 4},
    )

    simulation = twin.simulate(
        "job_switch",
        target_salary=130000,
        switching_cost=12000,
        expected_years=3,
    )

    assert simulation["simulation_name"] == "Job Switch Projection"
    assert simulation["score"] >= 0
    assert "recommendations" in simulation
    assert len(simulation["recommendations"]) >= 1
