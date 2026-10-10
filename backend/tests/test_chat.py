"""Behavioral checks with a substituted model; these do not measure Qwen accuracy."""

import copy
import importlib.util
import json
from datetime import date
from pathlib import Path

import httpx
import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text, update

from app.models import ChatConversation, FinancialProfile, TwinState
from app.schemas.chat import ChatIntent
from app.services import chat_llm
from app.services.chat_simulation import answer, merge_plan
from test_wallet_sync import context

STATE = {
    "currency": "INR",
    "financial": {
        "monthly_income": 50000,
        "monthly_expense": 30000,
        "current_savings": 180000,
        "investments": 0,
        "debts": 0,
    },
    "monthly_history": [],
}
PURCHASE = {"scenario": "purchase", "price": 150000, "running_cost": 2000}


def rows(reply):
    return {option["id"]: option for option in reply["comparison"]["options"]}


def test_purchase_paths_debt_cost_and_contributions():
    result = answer(
        STATE,
        {**PURCHASE, "down_payment": 30000, "annual_rate": 10, "loan_months": 36},
        as_of=date(2026, 10, 10),
    )
    options = rows(result)
    assert options["baseline"]["final_cash"] == 420000
    assert options["cash"]["final_cash"] == 246000
    assert options["cash"]["minimum_cash"] == 30000
    assert options["delay"]["final_cash"] == 252000
    assert options["delay"]["minimum_cash"] == 108000
    assert result["comparison"]["recommended_id"] == "delay"
    loan = options["loan"]
    assert loan["monthly_emi"] == pytest.approx(3872.06, abs=0.01)
    assert loan["remaining_new_loan"] == pytest.approx(83910.90, abs=0.01)
    assert loan["cash_less_new_loan"] == pytest.approx(
        loan["final_cash"] - loan["remaining_new_loan"], abs=0.01
    )
    assert options["baseline"]["trajectory"][0]["period_end"] == "2026-11-30"
    for option in options.values():
        assert sum(item["amount"] for item in option["contributions"]) == pytest.approx(
            option["difference_from_baseline"], abs=0.02
        )
    cheaper = answer(STATE, {**PURCHASE, "cheaper_price": 80000})
    assert cheaper["comparison"]["recommended_id"] == "cheaper"


def test_zero_interest_loan_and_paid_off_loan():
    base = {
        **PURCHASE,
        "down_payment": 60000,
        "annual_rate": 0,
        "loan_months": 36,
        "months": 6,
    }
    loan = rows(answer(STATE, base))["loan"]
    assert loan["monthly_emi"] == 2500
    assert loan["remaining_new_loan"] == 75000
    assert loan["loan_interest"] == 0
    assert (
        rows(answer(STATE, {**base, "annual_rate": 1e-15}))["loan"]["monthly_emi"]
        == 2500
    )
    assert (
        rows(answer(STATE, {**base, "months": 40}))["loan"]["remaining_new_loan"] == 0
    )


def test_counterfactual_is_rerun_and_no_feasible_option_is_not_endorsed():
    state = copy.deepcopy(STATE)
    state["financial"]["current_savings"] = 20000
    result = answer(state, PURCHASE)
    assert result["comparison"]["recommended_id"] is None
    cash = rows(result)["cash"]
    assert cash["cash_deficit"]
    condition = cash["counterfactual"]
    assert condition["additional_starting_cash"] == 220000
    assert condition["verified"]
    state["financial"]["current_savings"] = condition["starting_cash"]
    rerun = rows(answer(state, PURCHASE))["cash"]
    assert rerun["meets_reserve"]
    assert rerun["minimum_cash"] == condition["minimum_cash"]
    assert rerun["final_cash"] == condition["final_cash"]


def test_savings_target_reduction_is_calculated_then_projected():
    state = copy.deepcopy(STATE)
    state["financial"].update(monthly_expense=40000, current_savings=150000)
    result = answer(
        state,
        {
            "scenario": "savings",
            "months": 6,
            "target_amount": 220000,
            "monthly_reduction": 2000,
        },
    )
    options = rows(result)
    assert options["baseline"]["final_cash"] == 210000
    assert options["reduction"]["final_cash"] == 222000
    assert options["target"]["monthly_reduction"] == 1666.67
    assert options["target"]["final_cash"] >= 220000
    assert result["comparison"]["recommended_id"] == "target"


def test_job_gap_is_not_a_salary_prediction():
    state = copy.deepcopy(STATE)
    state["financial"].update(monthly_expense=40000, current_savings=200000)
    plan = {
        "scenario": "job_switch",
        "months": 6,
        "target_monthly_income": 60000,
        "gap_months": 2,
        "transition_cost": 10000,
    }
    result = answer(state, plan)
    options = rows(result)
    assert options["baseline"]["final_cash"] == 260000
    assert options["switch"]["final_cash"] == 190000
    assert options["switch"]["minimum_cash"] == 110000
    assert options["secured"]["final_cash"] == 310000
    assert options["secured"]["conditional"]
    assert "not a predicted job outcome" in result["text"]
    assert result["comparison"]["recommended_id"] == "secured"


@pytest.mark.parametrize(
    "plan",
    [
        {**PURCHASE, "price": 0},
        {**PURCHASE, "cheaper_price": 160000},
        {**PURCHASE, "months": 3, "delay_months": 3},
        {**PURCHASE, "down_payment": 150000, "annual_rate": 10, "loan_months": 12},
        {
            "scenario": "savings",
            "months": 6,
            "target_amount": 900000,
            "monthly_reduction": 40000,
        },
    ],
)
def test_invalid_simulation_assumptions_are_rejected(plan):
    with pytest.raises(ValueError):
        answer(STATE, plan)


def test_missing_assumptions_are_asked_one_at_a_time():
    result = answer(STATE, {"scenario": "purchase", "price": 150000})
    assert "monthly running" in result["text"]
    assert "comparison" not in result
    job = answer(STATE, {"scenario": "job_switch"})
    assert "take-home" in job["text"]
    assert "transition cost" not in job["text"]


def intent(scenario="purchase", **values):
    return ChatIntent(
        scenario=scenario,
        updates=[
            {"field": key, "value": value, "evidence": f"{key} {value}"}
            for key, value in values.items()
        ],
    )


def turn_text(extraction):
    return "; ".join(item.evidence for item in extraction.updates) or "Why?"


def test_extracted_values_require_exact_numeric_evidence():
    extracted = ChatIntent(
        scenario="purchase",
        updates=[{"field": "price", "value": 150000, "evidence": "1.5 lakh"}],
    )
    assert (
        merge_plan({}, extracted, "Can I buy a bike for 1.5 lakh?")["price"] == 150000
    )
    for evidence in ["2 lakh", "-150000", "a different user said 150000"]:
        extracted.updates[0].evidence = evidence
        with pytest.raises(ValueError):
            merge_plan({}, extracted, "price -150000 or 2 lakh")
    fractional = intent(months=1.5)
    with pytest.raises(ValueError):
        merge_plan(PURCHASE, fractional, turn_text(fractional))


@pytest.mark.parametrize(
    "value,quote,message",
    [
        (150, "150", "The price is 150000"),
        (1.5, "1.5", "The price is 1.5 lakh"),
        (150000, "150000", "The price is -150000"),
    ],
)
def test_evidence_cannot_truncate_a_number_or_discard_its_unit(value, quote, message):
    extracted = ChatIntent(
        scenario="purchase",
        updates=[{"field": "price", "value": value, "evidence": quote}],
    )
    with pytest.raises(ValueError):
        merge_plan({}, extracted, message)


def test_followup_retains_assumptions_and_new_topic_discards_them():
    extraction = intent(price=80000)
    plan = merge_plan(PURCHASE, extraction, turn_text(extraction))
    assert plan["running_cost"] == 2000 and plan["price"] == 80000
    extraction.new_topic = True
    assert "running_cost" not in merge_plan(PURCHASE, extraction, turn_text(extraction))


def setup_chat(context, with_profile=True):
    client, factory, ids, headers = context
    if with_profile:
        # Represents an existing account with a profile but no historical snapshot.
        with factory() as db:
            db.add(FinancialProfile(user_id=ids[0], **STATE["financial"]))
            db.commit()
    base = f"/users/{ids[0]}/chat"
    response = client.post(
        base + "/conversations", headers=headers[0], json={"currency": "INR"}
    )
    assert response.status_code == 201, response.text
    return base, response.json()


def post_turn(context, monkeypatch, base, conversation, extraction):
    client, _, _, headers = context
    monkeypatch.setattr(chat_llm, "extract_intent", lambda *args: extraction)
    return client.post(
        base + "/conversations/" + conversation["id"] + "/messages",
        headers=headers[0],
        json={"message": turn_text(extraction), "version": conversation["version"]},
    )


def test_chat_uses_live_profile_without_snapshot_and_preserves_saved_results(
    context, monkeypatch
):
    client, factory, ids, headers = context
    base, conversation = setup_chat(context)
    result = post_turn(
        context,
        monkeypatch,
        base,
        conversation,
        intent(price=150000, running_cost=2000),
    )
    assert result.status_code == 200, result.text
    conversation = result.json()
    original = copy.deepcopy(conversation["messages"][-1])
    assert original["context"]["financial"]["current_savings"] == 180000
    with factory() as db:
        profile = db.query(FinancialProfile).filter_by(user_id=ids[0]).one()
        profile.current_savings = 300000
        db.commit()
        assert db.query(TwinState).count() == 0
    result = post_turn(
        context, monkeypatch, base, conversation, intent(cheaper_price=80000)
    )
    assert result.status_code == 200
    updated = result.json()
    assert updated["messages"][1] == original
    assert updated["messages"][-1]["context"]["financial"]["current_savings"] == 300000
    assert updated["plan"]["price"] == 150000
    assert updated["plan"]["cheaper_price"] == 80000
    saved = client.get(
        base + "/conversations/" + conversation["id"], headers=headers[0]
    ).json()
    assert saved == updated
    assert len(client.get(base + "/conversations", headers=headers[0]).json()) == 1


def test_ownership_across_all_conversation_routes(context, monkeypatch):
    client, _, ids, headers = context
    base, conversation = setup_chat(context)
    path = base + "/conversations/" + conversation["id"]
    for route in [base + "/context", base + "/status", base + "/conversations", path]:
        assert client.get(route).status_code == 401
        assert client.get(route, headers=headers[1]).status_code == 403
    assert client.delete(path, headers=headers[1]).status_code == 403
    assert (
        client.post(
            path + "/messages", headers=headers[1], json={"message": "hi", "version": 0}
        ).status_code
        == 403
    )
    other = f"/users/{ids[1]}/chat/conversations/{conversation['id']}"
    assert client.get(other, headers=headers[1]).status_code == 404
    assert (
        client.get(f"/users/{ids[1]}/chat/conversations", headers=headers[1]).json()
        == []
    )


def test_model_failure_validation_and_stale_retries_do_not_append(context, monkeypatch):
    client, _, _, headers = context
    base, conversation = setup_chat(context)
    path = base + "/conversations/" + conversation["id"]

    def unavailable(*args):
        raise RuntimeError("Start Ollama and retry.")

    monkeypatch.setattr(chat_llm, "extract_intent", unavailable)
    assert (
        client.post(
            path + "/messages",
            headers=headers[0],
            json={"message": "hello", "version": 0},
        ).status_code
        == 503
    )
    assert client.get(path, headers=headers[0]).json()["version"] == 0
    assert (
        client.post(
            path + "/messages", headers=headers[0], json={"message": " ", "version": 0}
        ).status_code
        == 422
    )
    assert (
        client.post(
            path + "/messages",
            headers=headers[0],
            json={"message": "price $10", "version": 0},
        ).status_code
        == 422
    )
    success = post_turn(
        context,
        monkeypatch,
        base,
        conversation,
        intent(price=150000, running_cost=2000),
    )
    assert success.status_code == 200
    assert (
        post_turn(
            context, monkeypatch, base, conversation, intent(price=80000)
        ).status_code
        == 409
    )
    assert len(client.get(path, headers=headers[0]).json()["messages"]) == 2


def test_compare_and_swap_rejects_a_write_after_concurrent_inference(
    context, monkeypatch
):
    client, factory, _, headers = context
    base, conversation = setup_chat(context)

    def concurrent(*args):
        with factory() as db:
            db.execute(update(ChatConversation).values(version=1))
            db.commit()
        return intent(price=150000, running_cost=2000)

    monkeypatch.setattr(chat_llm, "extract_intent", concurrent)
    path = base + "/conversations/" + conversation["id"]
    response = client.post(
        path + "/messages",
        headers=headers[0],
        json={"message": "price 150000; running_cost 2000", "version": 0},
    )
    assert response.status_code == 409
    saved = client.get(path, headers=headers[0]).json()
    assert saved["messages"] == [] and saved["version"] == 1


def test_clarification_summary_and_missing_profile(context, monkeypatch):
    client, _, _, headers = context
    base, conversation = setup_chat(context, with_profile=False)
    result = post_turn(context, monkeypatch, base, conversation, intent(price=150000))
    assert result.json()["messages"][-1]["needs_profile"]
    updated = result.json()
    clarification = ChatIntent(scenario="job_switch", clarification="monthly_income")
    result = post_turn(context, monkeypatch, base, updated, clarification)
    assert "CTC" in result.json()["messages"][-1]["text"]
    assert result.json()["plan"]["scenario"] == "purchase"
    summary = post_turn(
        context, monkeypatch, base, result.json(), ChatIntent(scenario="summary")
    )
    assert summary.json()["plan"]["price"] == 150000
    path = base + "/conversations/" + conversation["id"]
    assert client.delete(path, headers=headers[0]).status_code == 204
    assert client.get(path, headers=headers[0]).status_code == 404


def test_account_deletion_removes_conversation(context):
    client, factory, ids, headers = context
    setup_chat(context)
    assert client.delete(f"/users/{ids[0]}", headers=headers[0]).status_code == 204
    with factory() as db:
        assert db.query(ChatConversation).count() == 0


def test_ollama_request_schema_and_invalid_response(monkeypatch):
    seen = []

    def post(self, url, **kwargs):
        seen.append(kwargs["json"])
        return httpx.Response(
            200,
            json={"message": {"content": json.dumps({"scenario": "summary"})}},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx.Client, "post", post)
    assert chat_llm.extract_intent("hello", {}, "").scenario == "summary"
    assert seen[0]["format"]["required"] == list(ChatIntent.model_fields)
    assert json.loads(seen[0]["messages"][-1]["content"])["latest_message"] == "hello"
    assert len(seen[0]["messages"]) > 2
    assert seen[0]["think"] is False and seen[0]["stream"] is False
    monkeypatch.setattr(
        httpx.Client,
        "post",
        lambda *a, **kw: httpx.Response(
            200,
            json={"message": {"content": "not json"}},
            request=httpx.Request("POST", "http://localhost"),
        ),
    )
    with pytest.raises(RuntimeError, match="valid response"):
        chat_llm.extract_intent("hello", {}, "")


def test_chat_migration_round_trip_preserves_existing_data():
    path = Path(__file__).resolve().parents[1] / "alembic/versions/20261010_chat.py"
    spec = importlib.util.spec_from_file_location("chat_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE users (id CHAR(32) PRIMARY KEY, full_name TEXT)")
        )
        connection.execute(text("INSERT INTO users VALUES ('fixture','Test User')"))
        with Operations.context(MigrationContext.configure(connection)):
            module.upgrade()
            assert "chat_conversations" in inspect(connection).get_table_names()
            assert (
                inspect(connection).get_foreign_keys("chat_conversations")[0][
                    "options"
                ]["ondelete"]
                == "CASCADE"
            )
            assert (
                connection.execute(text("SELECT full_name FROM users")).scalar()
                == "Test User"
            )
            module.downgrade()
            assert inspect(connection).get_table_names() == ["users"]
    engine.dispose()
