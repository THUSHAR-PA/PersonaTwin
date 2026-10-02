# Persona Wallet is the bank; PersonaTwin mirrors it

Persona Wallet owns spendable accounts, imported statement history and transfers.
Its version 3.0 `financial_twin` contract combines these sources into one account
ledger. PersonaTwin stores the full response in `financial_profiles.wallet_snapshot`
and records `wallet_synced_at` only after a successful authenticated sync.

| PersonaTwin field | Bank source |
| --- | --- |
| monthly_income | observed_monthly_income; declared_monthly_income only when no activity exists |
| monthly_expense | monthly_expenses over the reported analysis window |
| current_savings | current cash_balance, including transfers after imports |
| investments | declared profile investment_value, not monthly contributions |
| debts | total_outstanding_debt |

The snapshot retains salary, assets, mortgage/loan principal, rates, EMI schedules,
monthly ratios, observation dates and complete `account_statements`. Summary values
feed the existing twin scores. `/users/{id}/twin/` also exposes `financial_twin` and
the last successful sync date. Users can see the bank accounts, debt details and
recent activity in Profiles → Financial. Every financial profile endpoint requires
authentication and ownership.

Connect the same Persona Wallet login in PersonaTwin. While connected, the active
browser tab syncs every 30 seconds and when it regains focus; simulation submission
also requests a refresh. Editing profile forms pauses background refresh. This is
session-based polling, not a server webhook: closed tabs do not refresh. Wallet
tokens remain in session storage, expire according to the bank’s JWT lifetime and
require reconnection; they are never persisted in the financial snapshot. Failed,
expired or malformed responses preserve the last successful values and timestamp.
The user sees a stale-data/error message and can reconnect or retry.

## Deploy both applications

1. Deploy Persona Wallet’s backend and frontend together, with
   `alembic upgrade head` before its backend starts. Its bank-ledger migration funds
   existing imported/demo accounts from their known closing balances.
2. Deploy this PersonaTwin backend and frontend together. From `backend`, run
   `alembic upgrade head` before starting FastAPI. The new migration adds nullable
   snapshot/date columns and preserves existing financial profiles.
3. Keep `PERSONA_WALLET_API_URL` set to the intended bank backend (default:
   `https://persona-wallet.onrender.com`). Keep existing database and private signing
   key configuration. Reconnect the wallet login after deployment, then sync.

Do not use old wallet-only totals as monthly values. The integration rejects an
unknown response layout rather than resetting the profile to zeros. It retains
compatibility with an explicit older five-number monthly contract.

## Validation

Run `PYTHONPATH=backend pytest backend/tests -q` after installing backend
requirements and pytest. Run `npm ci && npm run build` in `frontend`. Tests cover
full snapshot persistence, repeat sync after balance changes, mortgage/history
retention, ownership, failure preservation, malformed responses, and the snapshot
migration against an existing financial row. PostgreSQL migrations compile offline;
no production database is used by the tests.
