"""Deterministic comparisons and auditable recommendation rules for chat."""

import math
import re
from datetime import date
from app.services.decision_service import month_end
from app.services.forecast_service import forecast_expenses

INTEGER_FIELDS = {"months", "delay_months", "loan_months", "gap_months"}
LIMITS = {
    "months": (1, 60),
    "delay_months": (1, 59),
    "loan_months": (1, 120),
    "gap_months": (0, 60),
    "annual_rate": (0, 100),
    "reserve_months": (0, 24),
}
ALLOWED = {
    "purchase": {
        "price",
        "cheaper_price",
        "months",
        "delay_months",
        "down_payment",
        "annual_rate",
        "loan_months",
        "running_cost",
        "reserve_months",
    },
    "savings": {"months", "monthly_reduction", "target_amount", "reserve_months"},
    "job_switch": {
        "months",
        "target_monthly_income",
        "gap_months",
        "transition_cost",
        "reserve_months",
    },
}


def evidenced(value, quote):
    multipliers = {
        "k": 1000,
        "thousand": 1000,
        "lakh": 100000,
        "lakhs": 100000,
        "crore": 10000000,
        "million": 1000000,
    }
    for number, suffix in re.findall(
        r"(?<![\w.])(-?\s*[0-9][0-9,]*(?:\.[0-9]+)?)\s*(lakhs?|crore|million|thousand|k)?\b",
        quote.lower(),
    ):
        number = number.replace(" ", "")
        amount = float(number.replace(",", "")) * multipliers.get(suffix, 1)
        if math.isclose(value, amount, rel_tol=1e-9, abs_tol=1e-6):
            return True
    words = {
        "zero": 0,
        "none": 0,
        "no": 0,
        "one": 1,
        "two": 2,
        "three": 3,
        "four": 4,
        "five": 5,
        "six": 6,
        "twelve": 12,
    }
    return any(
        value == v and re.search(rf"\b{k}\b", quote.lower()) for k, v in words.items()
    )


def merge_plan(old, intent, message):
    plan = (
        {} if intent.new_topic or old.get("scenario") != intent.scenario else dict(old)
    )
    plan["scenario"] = intent.scenario
    provenance = dict(plan.get("evidence", {}))
    seen = set()
    for update in intent.updates:
        if update.field in seen:
            raise ValueError(
                "I found more than one value for the same assumption. Please state the value you want to use."
            )
        seen.add(update.field)
        if update.field not in ALLOWED.get(intent.scenario, set()):
            raise ValueError(
                "This question combines assumptions that this prototype cannot yet simulate together. Please compare the purchase and job change in separate conversations."
            )
        exact_quote = re.search(
            r"(?<![\w.,+-])" + re.escape(update.evidence) + r"(?!\w|[.,]\d)",
            message,
            flags=re.IGNORECASE,
        )
        if (
            not exact_quote
            or not evidenced(update.value, update.evidence)
            or not evidenced(update.value, message)
        ):
            raise ValueError(
                "I could not verify an extracted amount. Please restate the amount and its purpose using digits (for example, price 150000)."
            )
        low, high = LIMITS.get(update.field, (0, 1e12))
        if not low <= update.value <= high or (
            update.field in INTEGER_FIELDS and not update.value.is_integer()
        ):
            raise ValueError(
                f"{update.field.replace('_', ' ')} must be between {low} and {high}"
                + (" in whole months." if update.field in INTEGER_FIELDS else ".")
            )
        plan[update.field] = (
            int(update.value) if update.field in INTEGER_FIELDS else update.value
        )
        provenance[update.field] = update.evidence
    plan["evidence"] = provenance
    return plan


def project_cash(cash, incomes, expenses, costs, upfront):
    """Monthly cash accounting; no generated text participates in arithmetic."""
    points = [cash - upfront]
    for income, expense, cost in zip(incomes, expenses, costs, strict=True):
        points.append(points[-1] + income - expense - cost)
    return points


def answer(state, plan, response_kind="compare", *, as_of=None):
    scenario = plan.get("scenario", "summary")
    if scenario == "unsupported":
        return {
            "text": "I can compare purchases and loans, savings plans, or the financial impact of a job change. Tell me the decision you are considering. Learned salary/skill predictions are not connected yet."
        }
    finance = state.get("financial")
    if not finance:
        return {
            "text": "First save or connect your financial profile in Profiles → Financial. I need monthly income, monthly expenses and available savings. Then send your question again.",
            "needs_profile": True,
        }
    if state.get("mixed_currency"):
        raise ValueError(
            "Your Wallet combines different currencies. Separate the currencies before comparing scenarios; currency conversion is not implemented."
        )
    for key in ("monthly_income", "monthly_expense", "current_savings"):
        value = finance.get(key)
        if not isinstance(value, (float, int)) or not math.isfinite(value) or value < 0:
            raise ValueError(
                "Your financial profile needs finite, nonnegative income, expenses and savings before simulation."
            )
    income, expense, cash = (
        finance[k] for k in ("monthly_income", "monthly_expense", "current_savings")
    )
    currency = state["currency"]
    if currency not in {"INR", "USD", "EUR", "GBP"}:
        raise ValueError(
            "Select INR, USD, EUR or GBP. Currency conversion is not supported."
        )
    money = lambda v: f"{currency} {v:,.2f}"
    if scenario == "summary":
        career = state.get("career") or {}
        role = career.get("current_role") or "not recorded"
        goal = (
            career.get("dream_role")
            or (state.get("person") or {}).get("career_goal")
            or "not recorded"
        )
        return {
            "text": f"Your saved monthly income is {money(income)}, expenses are {money(expense)}, and available savings are {money(cash)}. That leaves {money(income - expense)} per month under the saved assumptions. Your current role is {role}; your career goal is {goal}. I can compare the financial impact of a job change using an income assumption you provide. What purchase, savings goal or job change would you like to compare?",
            "context": state,
        }
    required = {
        "purchase": [
            ("price", "What is the full purchase price?"),
            (
                "running_cost",
                "What additional monthly running or ownership cost should I include? Enter 0 if none.",
            ),
        ],
        "savings": [
            ("target_amount", "What total savings amount do you want to reach?"),
            ("months", "In how many months?"),
            (
                "monthly_reduction",
                "How much could you reduce monthly spending by? Enter 0 to check the current plan.",
            ),
        ],
        "job_switch": [
            (
                "target_monthly_income",
                "What monthly take-home income should I use for the new job? This is your assumption, not a salary prediction.",
            ),
            (
                "gap_months",
                "How many months would you be without income? Enter 0 for no gap.",
            ),
            (
                "transition_cost",
                "What one-time relocation or transition cost should I include? Enter 0 if none.",
            ),
        ],
    }
    missing = [question for field, question in required[scenario] if field not in plan]
    if missing:
        return {
            "text": "Let's compare that against your current finances. " + missing[0],
            "plan": plan,
            "context": state,
        }
    n = plan.get("months", 12)
    reserve_months = plan.get("reserve_months", 3)
    today = as_of or date.today()
    forecast = forecast_expenses(
        state.get("monthly_history", []), expense, n, as_of=today
    )
    expenses = forecast["values"]
    reserve = reserve_months * max([expense] + expenses)
    options = []

    def option(
        key,
        label,
        why,
        costs=None,
        incomes=None,
        upfront=0,
        liability=0,
        fulfills=True,
        total_cost=0,
    ):
        costs = costs if costs is not None else [0] * n
        incomes = incomes if incomes is not None else [income] * n
        points = project_cash(cash, incomes, expenses, costs, upfront)
        balance = points[-1]
        minimum = min(points)
        # Rerun with the cash needed to meet both the reserve and any savings target.
        target_shortfall = (
            plan["target_amount"] - balance if scenario == "savings" else 0
        )
        topup = math.ceil(max(0, reserve - minimum, target_shortfall) * 100) / 100
        counter_points = project_cash(cash + topup, incomes, expenses, costs, upfront)
        row = {
            "id": key,
            "label": label,
            "why_considered": why,
            "final_cash": round(balance, 2),
            "minimum_cash": round(minimum, 2),
            "remaining_new_loan": round(liability, 2),
            "cash_less_new_loan": round(balance - liability, 2),
            "total_cost": round(total_cost, 2),
            "meets_reserve": minimum >= reserve,
            "cash_deficit": minimum < 0,
            "fulfills": fulfills,
            "initial_cash": round(points[0], 2),
            "contributions": [
                {
                    "label": "Upfront purchase / transition",
                    "amount": round(-upfront, 2),
                },
                {
                    "label": "Income change",
                    "amount": round(sum(incomes) - income * n, 2),
                },
                {
                    "label": "Spending change / repayments",
                    "amount": round(-sum(costs), 2),
                },
            ],
            "counterfactual": {
                "additional_starting_cash": topup,
                "starting_cash": round(cash + topup, 2),
                "final_cash": round(counter_points[-1], 2),
                "minimum_cash": round(min(counter_points), 2),
                "verified": min(counter_points) + 0.005 >= reserve
                and (
                    scenario != "savings"
                    or counter_points[-1] + 0.005 >= plan["target_amount"]
                ),
            },
            "trajectory": [
                {
                    "period_end": month_end(today, i + 1).isoformat(),
                    "cash": round(points[i + 1], 2),
                }
                for i in range(n)
            ],
        }
        options.append(row)
        return row

    baseline = option(
        "baseline",
        "Keep current plan",
        "Shows what happens without the proposed change.",
        fulfills=scenario != "purchase",
    )
    omitted = []
    if scenario == "purchase":
        price, running = plan["price"], plan["running_cost"]
        if price <= 0:
            raise ValueError("The purchase price must be greater than zero.")
        option(
            "cash",
            "Buy now with cash",
            "Tests immediate ownership against your cash buffer.",
            upfront=price,
            costs=[running] * n,
            total_cost=price + running * n,
        )
        delay = plan.get("delay_months", min(3, n - 1))
        if 0 < delay < n:
            costs = [
                0 if i < delay else running + (price if i == delay else 0)
                for i in range(n)
            ]
            option(
                "delay",
                f"Buy after {delay} months",
                "Tests whether saving first protects your buffer.",
                costs=costs,
                total_cost=price + running * (n - delay),
            )
        elif "delay_months" in plan:
            raise ValueError(
                "The purchase delay must be shorter than the projection horizon."
            )
        cheaper = plan.get("cheaper_price")
        if cheaper is not None:
            if not 0 < cheaper < price:
                raise ValueError(
                    "The cheaper alternative must have a positive price below the original purchase."
                )
            option(
                "cheaper",
                "Buy the cheaper alternative",
                "Tests your stated lower price; suitability still depends on whether it meets your needs.",
                upfront=cheaper,
                costs=[running] * n,
                total_cost=cheaper + running * n,
            )
        else:
            omitted.append("Cheaper alternative: tell me its price to include it.")
        loan_fields = {"down_payment", "annual_rate", "loan_months"}
        if loan_fields <= plan.keys():
            principal = price - plan["down_payment"]
            if principal <= 0:
                raise ValueError(
                    "The down payment must be smaller than the purchase price."
                )
            r, term = plan["annual_rate"] / 1200, plan["loan_months"]
            emi = (
                principal / term
                if r == 0
                else principal * r / -math.expm1(-term * math.log1p(r))
            )
            remaining = principal
            for _ in range(min(n, term)):
                remaining = max(0, remaining * (1 + r) - emi)
            row = option(
                "loan",
                "Buy with a loan",
                "Tests monthly affordability and the debt still owed after this comparison.",
                upfront=plan["down_payment"],
                costs=[running + (emi if i < term else 0) for i in range(n)],
                liability=remaining,
                total_cost=plan["down_payment"] + emi * term + running * n,
            )
            row["monthly_emi"] = round(emi, 2)
            row["loan_interest"] = round(emi * term - principal, 2)
            row["loan_months"] = term
        else:
            omitted.append(
                "Loan excluded: provide down payment, annual interest percentage and loan tenure in months. Loan fees are not included."
            )
        eligible = [o for o in options if o["fulfills"] and o["meets_reserve"]]
        chosen = (
            min(eligible, key=lambda o: (o["total_cost"], -o["minimum_cash"]))
            if eligible
            else baseline
        )
        rule = "Among purchase options that preserve the stated cash buffer throughout, choose the lowest modeled cost; break ties using the larger minimum cash balance. This does not value urgency or product quality."
        text = (
            f"My financial recommendation is: {chosen['label']}. "
            if eligible
            else "I would postpone committing: none of the modeled purchase options preserves the selected cash buffer. "
        )
    elif scenario == "savings":
        reduction, target = plan["monthly_reduction"], plan["target_amount"]
        if reduction > min(expenses):
            raise ValueError(
                "The monthly spending reduction exceeds projected expenses. Choose a smaller reduction."
            )
        option(
            "reduction",
            "Reduce monthly spending",
            "Tests the spending change you proposed.",
            costs=[-reduction] * n,
        )["monthly_reduction"] = reduction
        needed = max(0, math.ceil((target - baseline["final_cash"]) / n * 100) / 100)
        if needed <= min(expenses):
            option(
                "target",
                "Reduction needed for target",
                "Solves and reruns the spending cut needed to reach your goal; essential expenses may make it impractical.",
                costs=[-needed] * n,
            )["monthly_reduction"] = needed
        else:
            omitted.append(
                "Even reducing all modeled expenses cannot reach the target within this horizon."
            )
        for o in options:
            o["fulfills"] = o["final_cash"] >= target
        eligible = [o for o in options if o["fulfills"] and o["meets_reserve"]]
        chosen = min(eligible, key=lambda o: o["final_cash"]) if eligible else baseline
        rule = "Choose the smallest modeled change that reaches the target while preserving the selected cash buffer. Spending cuts require your review against essential costs."
        text = (
            f"My financial recommendation is: {chosen['label']}. "
            if eligible
            else "The target and cash-buffer requirements are not both met. Review the timeline, target or income assumptions. "
        )
    else:
        gap, new_income, cost = (
            plan["gap_months"],
            plan["target_monthly_income"],
            plan["transition_cost"],
        )
        if gap > n:
            raise ValueError("The income gap cannot exceed the projection horizon.")
        option(
            "switch",
            "Switch with the stated income gap",
            "Includes your entered salary, time without pay and transition cost.",
            upfront=cost,
            incomes=[0 if i < gap else new_income for i in range(n)],
        )
        if gap:
            option(
                "secured",
                "Switch only with no income gap",
                "A conditional alternative: requires arranging an offer/start date with no unpaid gap. Its availability is not predicted.",
                upfront=cost,
                incomes=[new_income] * n,
            )["conditional"] = True
        eligible = [o for o in options if o["meets_reserve"]]
        chosen = max(eligible, key=lambda o: o["final_cash"]) if eligible else baseline
        rule = "Prefer the highest final cash among options preserving the selected buffer. This ranks financial outcomes only, not career satisfaction or job availability."
        text = (
            f"On the financial assumptions, I prefer: {chosen['label']}. "
            if eligible
            else "None of these paths preserves the selected buffer. Reconsider the gap, transition cost or timing. "
        )
        if chosen.get("conditional"):
            text += "This option depends on securing an offer and start date without an unpaid gap; it is not a predicted job outcome. "
    for o in options:
        o["difference_from_baseline"] = round(
            o["final_cash"] - baseline["final_cash"], 2
        )
        if o is chosen:
            o["explanation"] = (
                (
                    f"Selected: minimum cash {money(o['minimum_cash'])} meets the {money(reserve)} buffer. "
                    + (
                        f"Modeled cost is {money(o['total_cost'])}, the lowest among qualifying purchases (ties use minimum cash)."
                        if scenario == "purchase"
                        else f"Final cash {money(o['final_cash'])} reaches the target with the smallest modeled spending change."
                        if scenario == "savings"
                        else f"Final cash {money(o['final_cash'])} is highest among options meeting the buffer."
                    )
                )
                if eligible
                else "Reference plan only; no option satisfies all constraints."
            )
        elif not o["meets_reserve"]:
            o["explanation"] = (
                f"Its minimum cash of {money(o['minimum_cash'])} falls below the {money(reserve)} buffer."
            )
        elif not o["fulfills"]:
            o["explanation"] = (
                "It preserves cash but does not accomplish the requested purchase or savings target."
            )
        else:
            o["explanation"] = (
                f"Feasible, but its modeled cost is {money(o['total_cost'])} versus {money(chosen['total_cost'])} for the selected option; equal costs are ranked by minimum cash."
                if scenario == "purchase"
                else f"Feasible, but it cuts more spending than needed: final cash {money(o['final_cash'])} versus {money(chosen['final_cash'])}."
                if scenario == "savings"
                else f"Feasible, but ends with {money(chosen['final_cash'] - o['final_cash'])} less cash than the selected path."
            )
    text += f"Over {n} months, this path ends with {money(chosen['final_cash'])} cash; the lowest balance is {money(chosen['minimum_cash'])}. The comparison buffer is {money(reserve)} ({reserve_months:g} months of the highest modeled monthly expense)."
    if response_kind == "explain":
        text = f"Here is why the options rank this way: {rule} " + text
    elif response_kind == "conditions":
        text = (
            "The conditions below rerun each option with enough starting cash to meet the financial checks. Extra funds are hypothetical, not assumed available. "
            + text
        )
    return {
        "text": text,
        "plan": plan,
        "context": state,
        "comparison": {
            "engine_version": "chat-cashflow-v1",
            "as_of": today.isoformat(),
            "scenario": scenario,
            "currency": currency,
            "months": n,
            "options": options,
            "recommended_id": chosen["id"] if eligible else None,
            "rule": rule,
            "reserve": reserve,
            "forecast": forecast,
            "omitted": omitted,
            "conditions": [
                {"option": o["label"], **o["counterfactual"]}
                for o in options
                if o["id"] != "baseline"
                and o["counterfactual"]["additional_starting_cash"] > 0
            ],
            "change_factors": [
                "Change the price, ownership cost, loan terms or waiting period to rerun a purchase.",
                "Change the savings target, timeline or spending reduction to rerun a savings goal.",
                "Change the new monthly take-home income, unpaid gap or transition cost to rerun a job change.",
                "The cash buffer is a prototype preference, not an eligibility rule from a bank. You can change reserve months in chat.",
            ],
            "assumptions": [
                "All options start from the same saved profile and use the same expense forecast.",
                "Projections begin next calendar month; current partial-month cash flows are excluded.",
                f"Projection horizon: {n} months. Cash buffer: {reserve_months:g} months. Values not supplied in chat use disclosed defaults (12 and 3).",
                "Existing debt payments must already be included in monthly expenses. No inflation, tax changes or investment returns are modeled.",
                "Career outcomes use entered income assumptions; no salary, promotion or job probability model is connected.",
                "Purchase ranking ignores resale value, urgency and differences in product quality. Loan total cost includes its full term; cash projections cover the selected horizon.",
                "The default purchase delay is three months (or the longest shorter delay if the horizon is under four months).",
                "Initial cash after upfront costs and monthly closing balances are checked; daily payment timing is not modeled.",
                "This is a deterministic what-if comparison, not a calibrated probability or SHAP explanation.",
            ],
        },
    }
