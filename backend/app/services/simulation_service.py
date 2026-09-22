from __future__ import annotations

from math import pow
from typing import Any


def run_investment_simulation(parameters: dict[str, Any]) -> dict[str, Any]:
	principal = _positive_number(parameters, "principal")
	annual_rate = _non_negative_number(parameters, "annual_rate")
	years = _positive_number(parameters, "years")
	monthly_contribution = _non_negative_number(parameters, "monthly_contribution")

	monthly_rate = annual_rate / 100 / 12
	months = round(years * 12)
	if monthly_rate == 0:
		future_value = principal + monthly_contribution * months
	else:
		future_value = (
			principal * pow(1 + monthly_rate, months)
			+ monthly_contribution * ((pow(1 + monthly_rate, months) - 1) / monthly_rate)
		)

	contributions = principal + monthly_contribution * months
	growth = future_value - contributions
	score = max(0, min(100, round(50 + annual_rate * 2 - (years * 1.5), 1)))
	risk_level = "Low" if annual_rate < 6 else "Moderate" if annual_rate < 10 else "High"

	return {
		"score": score,
		"risk_level": risk_level,
		"simulation_name": "Investment Projection",
		"summary": f"Your projected portfolio could grow to {future_value:,.2f} over {years:g} years.",
		"metrics": {
			"projected_value": round(future_value, 2),
			"total_contributions": round(contributions, 2),
			"estimated_growth": round(growth, 2),
			"annual_return": annual_rate,
			"time_horizon_years": years,
		},
		"recommendations": _investment_recommendations(annual_rate, years, monthly_contribution),
	}


def run_vehicle_purchase_simulation(parameters: dict[str, Any]) -> dict[str, Any]:
	return _loan_simulation(parameters, "vehicle_price", "Vehicle Purchase", "vehicle")


def run_home_loan_simulation(parameters: dict[str, Any]) -> dict[str, Any]:
	return _loan_simulation(parameters, "home_price", "Home Loan", "home")


def _loan_simulation(
	parameters: dict[str, Any],
	price_key: str, name: str, asset_name: str,
) -> dict[str, Any]:
	price = _positive_number(parameters, price_key)
	down_payment = _non_negative_number(parameters, "down_payment")
	interest_rate = _non_negative_number(parameters, "interest_rate")
	tenure_months = _positive_number(parameters, "tenure_months")
	loan_amount = price - down_payment
	if loan_amount <= 0:
		raise ValueError("down_payment must be less than the purchase price.")
	monthly_rate = interest_rate / 100 / 12
	if monthly_rate == 0:
		monthly_payment = loan_amount / tenure_months
	else:
		factor = (1 + monthly_rate) ** tenure_months
		monthly_payment = loan_amount * monthly_rate * factor / (factor - 1)
	total_paid = monthly_payment * tenure_months
	return {
		"score": round(max(0, min(100, 100 - (monthly_payment / price * 100))), 1),
		"risk_level": "Low" if monthly_payment / price < 0.01 else "Moderate" if monthly_payment / price < 0.03 else "High",
		"simulation_name": name,
		"summary": f"The estimated monthly {asset_name} payment is {monthly_payment:,.2f}.",
		"metrics": {"loan_amount": round(loan_amount, 2), "monthly_payment": round(monthly_payment, 2), "total_paid": round(total_paid, 2), "total_interest": round(total_paid - loan_amount, 2)},
		"recommendations": ["Compare this payment with your monthly budget before committing.", "Keep an emergency fund separate from the down payment."],
	}


def run_higher_studies_simulation(parameters: dict[str, Any]) -> dict[str, Any]:
	cost = _positive_number(parameters, "education_cost")
	salary_gain = _positive_number(parameters, "expected_salary_gain")
	years_to_recover = _positive_number(parameters, "years_to_recover")
	payback_years = cost / salary_gain
	score = max(0, min(100, 100 - payback_years * 15))
	return {
		"score": round(score, 1), "risk_level": "Low" if payback_years <= 3 else "Moderate" if payback_years <= 6 else "High",
		"simulation_name": "Higher Studies Plan", "summary": f"The education cost is estimated to recover in {payback_years:.1f} years.",
		"metrics": {"education_cost": cost, "annual_salary_gain": salary_gain, "estimated_payback_years": round(payback_years, 2), "planned_recovery_years": years_to_recover},
		"recommendations": ["Validate the salary gain with current job-market data.", "Include living costs and lost income in the final education budget."],
	}


def run_job_switch_simulation(parameters: dict[str, Any]) -> dict[str, Any]:
	target_salary = _positive_number(parameters, "target_salary")
	switching_cost = _non_negative_number(parameters, "switching_cost")
	expected_years = _positive_number(parameters, "expected_years")
	break_even_months = switching_cost / target_salary * 12
	return {
		"score": round(max(0, min(100, 85 - break_even_months * 4)), 1), "risk_level": "Low" if break_even_months <= 1 else "Moderate" if break_even_months <= 3 else "High",
		"simulation_name": "Job Switch Projection", "summary": f"The switching cost could be recovered in {break_even_months:.1f} months at the target salary.",
		"metrics": {"target_salary": target_salary, "switching_cost": switching_cost, "break_even_months": round(break_even_months, 2), "expected_years": expected_years},
		"recommendations": ["Confirm the target role and compensation with multiple opportunities.", "Keep enough savings to cover the transition period."],
	}


def run_startup_simulation(parameters: dict[str, Any]) -> dict[str, Any]:
	initial_investment = _positive_number(parameters, "initial_investment")
	annual_revenue = _positive_number(parameters, "expected_annual_revenue")
	annual_cost = _non_negative_number(parameters, "expected_annual_cost")
	risk_multiplier = _positive_number(parameters, "risk_multiplier")
	annual_profit = annual_revenue - annual_cost
	return {
		"score": round(max(0, min(100, annual_profit / initial_investment * 20 / risk_multiplier)), 1), "risk_level": "High" if risk_multiplier >= 1 else "Moderate",
		"simulation_name": "Startup Projection", "summary": f"The projected annual result is {annual_profit:,.2f} before taxes.",
		"metrics": {"annual_revenue": annual_revenue, "annual_cost": annual_cost, "annual_profit": round(annual_profit, 2), "break_even_years": round(initial_investment / annual_profit, 2) if annual_profit > 0 else "not reached"},
		"recommendations": ["Validate revenue assumptions with a conservative scenario.", "Separate personal emergency savings from startup capital."],
	}


def run_fitness_simulation(parameters: dict[str, Any]) -> dict[str, Any]:
	workouts = _non_negative_number(parameters, "weekly_workouts")
	sleep = _non_negative_number(parameters, "average_sleep_hours")
	stress = _non_negative_number(parameters, "stress_level")
	score = max(0, min(100, workouts / 5 * 50 + max(0, 100 - abs(7.5 - sleep) * 20) / 2 - stress * 2))
	return _health_result("Fitness", score, {"weekly_workouts": workouts, "average_sleep_hours": sleep, "stress_level": stress}, "Aim for consistent activity, adequate sleep, and manageable stress.")


def run_sleep_simulation(parameters: dict[str, Any]) -> dict[str, Any]:
	sleep = _non_negative_number(parameters, "sleep_hours")
	caffeine = _non_negative_number(parameters, "caffeine_intake")
	screen_time = _non_negative_number(parameters, "screen_time_hours")
	score = max(0, min(100, 100 - abs(8 - sleep) * 16 - caffeine * 4 - screen_time * 3))
	return _health_result("Sleep", score, {"sleep_hours": sleep, "caffeine_intake": caffeine, "screen_time_hours": screen_time}, "Small changes to evening habits can improve sleep consistency.")


def _health_result(name: str, score: float, metrics: dict[str, float], recommendation: str) -> dict[str, Any]:
	return {"score": round(score, 1), "risk_level": "Low" if score >= 70 else "Moderate" if score >= 45 else "High", "simulation_name": f"{name} Projection", "summary": f"Your estimated {name.lower()} score is {score:.0f} out of 100.", "metrics": metrics, "recommendations": [recommendation]}


def _investment_recommendations(
	annual_rate: float,
	years: float,
	monthly_contribution: float,
) -> list[str]:
	recommendations = []
	if annual_rate >= 10:
		recommendations.append("Validate the return assumption against your risk tolerance.")
	if years < 5:
		recommendations.append("Consider a longer time horizon to reduce the impact of market volatility.")
	if monthly_contribution == 0:
		recommendations.append("Adding regular monthly contributions could materially improve the projection.")
	if not recommendations:
		recommendations.append("Review the projection periodically and keep contributions consistent.")
	return recommendations


def _positive_number(parameters: dict[str, Any], key: str) -> float:
	value = _number(parameters, key)
	if value <= 0:
		raise ValueError(f"{key} must be greater than zero.")
	return value


def _non_negative_number(parameters: dict[str, Any], key: str) -> float:
	value = _number(parameters, key)
	if value < 0:
		raise ValueError(f"{key} cannot be negative.")
	return value


def _number(parameters: dict[str, Any], key: str) -> float:
	value = parameters.get(key)
	if isinstance(value, bool) or not isinstance(value, (int, float)):
		raise ValueError(f"{key} must be a number.")
	return float(value)
