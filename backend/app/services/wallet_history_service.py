"""Review-only Wallet history bridge. No credentials or transactions are persisted."""

import calendar
import csv
import io
import math
import os
from datetime import date

import httpx


def review_wallet_history(payload, today=None):
    today = today or date.today()
    bank = payload.get("financial_twin") if isinstance(payload, dict) else None
    if not isinstance(bank, dict) or not isinstance(
        bank.get("monthly_cash_flow"), list
    ):
        raise ValueError(
            "Wallet did not return monthly cash flow. Deploy its current financial-summary API first."
        )
    currency = bank.get("currency")
    currencies = {
        row.get("currency") for row in bank.get("accounts", []) if isinstance(row, dict)
    }
    if currency != "INR" or currencies - {"INR"}:
        raise ValueError(
            "Wallet training history requires INR-only accounts; mixed currencies cannot be combined."
        )
    current = today.year * 12 + today.month - 1
    records = {}
    for row in bank["monthly_cash_flow"]:
        try:
            period = date.fromisoformat(row["month"] + "-01")
            index = period.year * 12 + period.month - 1
            if index >= current or index < current - 24:
                continue  # Partial/current/future/out-of-window totals never enter training.
            if index in records:
                raise ValueError()
            amounts = []
            for field in ("income", "expenses"):
                value = row[field]
                if isinstance(value, bool):
                    raise ValueError()
                value = float(value)
                if not math.isfinite(value) or not 0 <= value <= 1e12:
                    raise ValueError()
                amounts.append(value)
            activity = row.get("transaction_count")
            recorded = (
                isinstance(activity, int)
                and not isinstance(activity, bool)
                and activity > 0
            )
            records[index] = {
                "month": row["month"],
                "income": amounts[0],
                "expense": amounts[1],
                "has_activity": recorded,
            }
        except (KeyError, TypeError, ValueError):
            raise ValueError(
                "Wallet monthly history is malformed, duplicated or contains invalid amounts. No history was imported."
            )
    # The Wallet can emit zero-filled buckets for unrecorded months. Do not turn
    # these into observations. Only offer the recent uninterrupted active suffix.
    usable = []
    for index in range(current - 1, current - 25, -1):
        row = records.get(index)
        if row is None or not row["has_activity"]:
            break
        usable.append(row)
    usable.reverse()
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(["month", "income", "expense"])
    writer.writerows((row["month"], row["income"], row["expense"]) for row in usable)
    return {
        "currency": currency,
        "requested_months": 24,
        "returned_months": len(records),
        "usable_months": len(usable),
        "rows": [records[key] for key in sorted(records)],
        "excluded_months": [
            records[key]["month"]
            for key in sorted(records)
            if not records[key]["has_activity"]
        ],
        "csv_text": output.getvalue() if usable else "",
        "source_name": (
            f"Reviewed Persona Wallet totals through {usable[-1]['month']}"
            if usable
            else "Persona Wallet monthly totals"
        ),
        "note": "These are Wallet ledger totals, not proof of complete bank coverage. Review income, expenses and transfer classifications, then confirm completeness before importing. Unrecorded/zero-activity buckets and earlier disconnected history are not auto-filled. If a zero-activity month is genuinely complete, enter its verified totals manually.",
    }


def fetch_wallet_history(wallet_token, today=None):
    today = today or date.today()
    current = today.year * 12 + today.month - 1
    year, month0 = divmod(current - 1, 12)
    end = date(year, month0 + 1, calendar.monthrange(year, month0 + 1)[1])
    url = os.getenv(
        "PERSONA_WALLET_API_URL", "https://persona-wallet.onrender.com"
    ).rstrip("/")
    try:
        response = httpx.get(
            f"{url}/integration/financial-summary",
            headers={"Authorization": f"Bearer {wallet_token}"},
            params={"months": 24, "end_date": end.isoformat()},
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPStatusError as error:
        if error.response.status_code in (401, 403):
            raise PermissionError(
                "Your Wallet session expired. Reconnect Wallet through Profile & Wallet, then retry."
            ) from error
        raise RuntimeError(
            "Wallet history could not be fetched. Your existing profile and history were kept."
        ) from error
    except (httpx.HTTPError, ValueError) as error:
        raise RuntimeError(
            "Wallet history could not be read. Your existing profile and history were kept."
        ) from error
    return review_wallet_history(payload, today)
