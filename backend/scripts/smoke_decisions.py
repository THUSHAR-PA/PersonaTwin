"""Exercise the running API with a disposable synthetic account, then remove it."""
import argparse
from datetime import date
from uuid import uuid4

import httpx


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://localhost:8000")
    args = parser.parse_args()
    with httpx.Client(base_url=args.base_url, timeout=60) as client:
        login = {"email": f"decision-smoke-{uuid4()}@example.com", "password": str(uuid4())}
        response = client.post("/auth/register", json={**login, "full_name": "Synthetic Decision Smoke Test"})
        response.raise_for_status()
        auth = client.post("/auth/login", json=login)
        auth.raise_for_status()
        client.headers["Authorization"] = f"Bearer {auth.json()['access_token']}"
        me = client.get("/auth/me")
        me.raise_for_status()
        root = f"/users/{me.json()['id']}"
        try:
            profile = client.post(root + "/financial/", json={"monthly_income": 50000, "monthly_expense": 40000, "current_savings": 20000, "investments": 0, "debts": 0})
            profile.raise_for_status()
            state = client.post(root + "/decisions/states", json={"currency": "INR"})
            state.raise_for_status()
            payload = {"state_id": state.json()["id"], "months": 6, "target_amount": 90000, "monthly_reduction": 2000, "forecast": "profile"}
            decision = client.post(root + "/decisions/", json=payload)
            decision.raise_for_status()
            run = decision.json()
            assert run["result"]["baseline"]["final_savings"] == 80000
            assert run["result"]["alternative"]["final_savings"] == 92000
            feedback = client.post(root + f"/decisions/{run['id']}/feedback", json={"choice": "considering", "note": "Synthetic verification only."})
            feedback.raise_for_status()
            assert len(feedback.json()["events"]) == 1
            current = date.today().year * 12 + date.today().month - 1
            rows = ["month,income,expense"] + [f"{(current - 18 + i) // 12:04d}-{(current - 18 + i) % 12 + 1:02d},50000,{10000 + i * 1000}" for i in range(18)]
            imported = client.post(root + "/decisions/history", json={"currency": "INR", "source_name": "Synthetic linear trend fixture, not research evidence", "consent": True, "csv_text": "\n".join(rows)})
            imported.raise_for_status()
            forecast = client.post(root + "/decisions/", json={**payload, "state_id": imported.json()["id"], "forecast": "auto", "uncertainty_pct": 10})
            forecast.raise_for_status()
            assert forecast.json()["result"]["forecast"]["method"] == "ridge_trend"
            assert forecast.json()["result"]["uncertainty"]["samples"] == 1000
            saved = client.get(root + f"/decisions/{run['id']}")
            saved.raise_for_status()
            assert saved.json()["result"] == run["result"]
            print("PASS: profile, state, deterministic comparison, feedback, CSV import, trained forecast, Monte Carlo, immutable history")
        finally:
            removed = client.delete(root)
            removed.raise_for_status()
            print("Disposable account and its records removed.")


if __name__ == "__main__":
    main()
