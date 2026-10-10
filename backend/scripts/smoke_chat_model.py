"""Check the actual configured Ollama on synthetic prompts, without a database."""

import json
from pathlib import Path
import sys
import time

from dotenv import load_dotenv

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

from app.services.chat_llm import extract_intent, model_status
from app.services.chat_simulation import merge_plan

PURCHASE = {"scenario": "purchase", "price": 150000, "running_cost": 2000}
CASES = [
    (
        "purchase + Indian units",
        "Can I afford a bike for ₹1.5 lakh?",
        {},
        "",
        "purchase",
        {"price": 150000},
        "none",
    ),
    (
        "missing cost follow-up",
        "2000 per month",
        {"scenario": "purchase", "price": 150000},
        "What additional monthly running or ownership cost should I include?",
        "purchase",
        {"running_cost": 2000},
        "none",
    ),
    (
        "cheaper alternative",
        "What if I choose a cheaper bike costing 80000?",
        PURCHASE,
        "",
        "purchase",
        {"cheaper_price": 80000},
        "none",
    ),
    (
        "loan terms",
        "Compare a loan with down payment 30000, annual interest 10%, and tenure 36 months.",
        PURCHASE,
        "",
        "purchase",
        {"down_payment": 30000, "annual_rate": 10, "loan_months": 36},
        "none",
    ),
    (
        "savings",
        "Can I reach total savings of 300000 in 12 months if I cut monthly spending by 2000?",
        {},
        "",
        "savings",
        {"target_amount": 300000, "months": 12, "monthly_reduction": 2000},
        "none",
    ),
    (
        "job change",
        "Should I switch to a job with take-home pay of 60000 per month, 2 months without income and a one-time transition cost of 10000?",
        {},
        "",
        "job_switch",
        {"target_monthly_income": 60000, "gap_months": 2, "transition_cost": 10000},
        "none",
    ),
    (
        "annual CTC clarification",
        "The new offer is 12 lakh CTC a year.",
        {"scenario": "job_switch"},
        "What monthly take-home income should I use for the new job?",
        "job_switch",
        {},
        "monthly_income",
    ),
    (
        "explanation follow-up",
        "Why did you choose that option?",
        PURCHASE,
        "",
        "purchase",
        {},
        "none",
    ),
]


def main():
    status = model_status()
    print(json.dumps(status))
    if not status["available"]:
        print("Start Ollama and download the configured model, then retry.")
        return 1
    failed = 0
    timings = []
    for name, question, plan, previous, scenario, expected, clarification in CASES:
        start = time.perf_counter()
        try:
            parsed = extract_intent(question, plan, previous)
            assert parsed.scenario == scenario, (
                f"Expected {scenario}; got {parsed.scenario}"
            )
            assert parsed.clarification == clarification, (
                f"Expected clarification {clarification}; got {parsed.clarification}"
            )
            if clarification == "none":
                merged = merge_plan(plan, parsed, question)
                for field, value in expected.items():
                    assert merged.get(field) == value, (
                        f"Expected {field}={value}; got {merged.get(field)}"
                    )
                assert {item.field for item in parsed.updates} <= set(expected), (
                    "Model invented or changed an unrelated assumption."
                )
                if plan:
                    assert not parsed.new_topic, (
                        "The model unexpectedly discarded the active plan."
                    )
                if name == "explanation follow-up":
                    assert parsed.response_kind == "explain"
            else:
                assert not parsed.updates, (
                    "Ambiguous annual salary must not populate monthly inputs."
                )
            elapsed = time.perf_counter() - start
            print(f"PASS {name}: {elapsed:.1f}s")
        except (RuntimeError, ValueError, AssertionError) as error:
            elapsed = time.perf_counter() - start
            print(f"FAIL {name}: {error} ({elapsed:.1f}s)")
            failed += 1
        timings.append(elapsed)
    print(f"\n{len(CASES) - failed}/{len(CASES)} synthetic extraction checks passed.")
    print(
        f"Mean response time: {sum(timings) / len(timings):.1f}s. This is a small smoke check, not a model accuracy benchmark."
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
