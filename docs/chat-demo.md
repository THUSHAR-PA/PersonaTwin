# PersonaTwin conversational prototype

Branch: `feature/chat-decision-assistant`, based on `8c611b6`.
The first professor demonstration is local and needs no inference subscription.

## What is implemented

Chat is the default signed-in screen. Each conversation can:

1. Read the user's current saved financial/career profiles, including Wallet-derived
   financial aggregates. An older account does not need a manual snapshot first.
2. Interpret a natural-language question with the configured local Ollama model.
3. Ask one missing input at a time.
4. Compare a purchase/loan, savings goal, or the financial impact of changing jobs.
5. Display cash trajectories, remaining new debt, the preferred option, why each
   option was considered, and why alternatives rank differently.
6. Show entered assumptions and their quoted source, defaults, forecast provenance,
   a contribution breakdown and rerun conditions that would satisfy the financial checks.
7. Accept follow-ups and keep the original comparison unchanged in saved messages.

Profile editing, Wallet sync, calculators, saved decision runs, outcomes and
history imports remain available through Profiles and Simulations.

## Run on Windows

Get the chat branch first:

```bat
cd C:\Projects\PersonaTwin
git fetch origin
git switch feature/chat-decision-assistant
git pull --ff-only origin feature/chat-decision-assistant
```

Keep your existing
`DATABASE_URL` and `SECRET_KEY` in `backend\.env`. Add:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b
```

These are server settings, never frontend variables. The browser talks to FastAPI;
FastAPI talks to Ollama on the same computer. No Ollama CORS setting is needed.

In Command Prompt:

```bat
cd C:\Projects\PersonaTwin\backend
.venv\Scripts\activate
python -m pip install -r requirements.txt
python -m alembic upgrade head
python -m alembic current
```

The new revision is **20261010_chat** and adds only `chat_conversations`.
The migration updates the database named by `DATABASE_URL`, including a cloud
database if configured. Use your normal database backup process before applying it.
Existing profiles, Wallet snapshots and saved decision tables are retained.

Make sure the Ollama application is running. In another terminal:

```bat
ollama run qwen3:4b
```

Exit its interactive prompt with `/bye`; the Ollama service should remain running.
In the activated backend terminal, test the actual model:

```bat
python scripts\smoke_chat_model.py
```

This sends eight synthetic prompts to your actual model, checks extracted values
and follow-ups, and reports latency. It does not access your database. The automated
repository tests substitute the model, so this separate local check is necessary.
Share any FAIL lines without including `.env` contents.

Then start FastAPI:

```bat
python -m uvicorn app.main:app --reload --port 8000
```

In a second terminal:

```bat
cd C:\Projects\PersonaTwin\frontend
npm ci
npm run dev -- --port 5173 --strictPort
```

Open http://localhost:5173. Check that an old `VITE_API_BASE_URL` setting does not
point to a different backend. Chat is the default screen after login.

## Professor demonstration

Use a separate synthetic demonstration account. Do not overwrite a real Wallet
profile. Save monthly income **INR 50,000**, expenses **INR 30,000**, available savings
**INR 180,000**, investments/debts **0**. Use INR in the conversation.

### Purchase

Send these in order:

- `Can I afford a bike for 150000?`
- Answer the ownership-cost question with `Monthly running cost 2000`.
- `Use a loan: down payment 30000, annual interest 10%, tenure 36 months.`
- `What if the cheaper bike costs 80000?`
- `Why did you choose that option?`

With no imported history, the 12-month comparison uses fixed profile expenses
and a configurable default buffer of three expense months (INR 90,000):

| Option | Final cash | Lowest cash |
| --- | ---: | ---: |
| Keep current plan | 420,000 | 180,000 |
| Buy now with cash | 246,000 | 30,000 |
| Buy after 3 months | 252,000 | 108,000 |
| Cheaper bike at 80,000 | 316,000 | 100,000 |

The delayed purchase qualifies before the cheaper option is supplied. The cheaper
option becomes preferred under the stated cost/buffer rule. The loan EMI is about
INR 3,872.06, with INR 83,910.90 still owed after 12 months. Explain that the loan's
cash balance alone does not describe its debt burden.

Open **Why this recommendation?**, **What would change this recommendation?** and
**Inputs, data sources & calculation breakdown**. Refresh the page to show
persistence and reopen the saved conversation.

### Savings

Start a new conversation:

- `Can I reach 300000 in savings within 12 months?`
- `Cut monthly spending by 2000`

This account already reaches the target on its current path: INR 420,000 versus
INR 444,000 with the spending cut. The explanation should not demand an unnecessary cut.

### Job change

Start a new conversation:

- `Should I switch to a job paying 60000 take-home per month?`
- `The unpaid gap is 2 months`
- `Transition cost 10000`

Current path: INR 420,000. Switch with the gap: INR 410,000. A conditional switch
with no income gap: INR 530,000. That last path requires a secured offer/start date;
the system does not predict that it is available.

## How the explanation works

Ollama extracts a bounded JSON intent and explicit numeric changes. The server
validates its schema, ranges and exact numeric evidence from the latest user
message. It does not execute generated code or allow the model to choose URLs,
SQL, users or financial actions. Malformed model responses fail visibly, without
fabricated fallback results.

The backend assembles the twin context and calls deterministic Python comparisons.
Expense forecasting reuses the existing history/Ridge service with disclosed
fallbacks. Recommendations and displayed explanations come from calculated
results and explicit rules, not from the model's private thinking text.

All options use the same income/expense assumptions over full future calendar
months. Upfront costs and monthly closing balances are checked. Daily liquidity
timing is not modeled. Existing debt service must already be in monthly expenses.
Loan interest is calculated from entered fixed annual interest and monthly payments;
fees, changing rates, investment returns, inflation and new tax calculations are excluded.

Ranking policies are prototype choices, not bank eligibility rules:

- Purchases: preserve the selected cash buffer, then minimize modeled cost;
  break ties by higher minimum cash. Purchase urgency and quality are not scored.
- Savings: reach the target and preserve the buffer with the smallest modeled cut.
- Job changes: preserve the buffer, then maximize ending cash. Career satisfaction,
  salary prediction and employment probabilities are outside this prototype.

Counterfactuals rerun each path with a higher starting balance sufficient to meet
the reserve/target checks. They state the extra cash needed, not where it comes
from, and do not guarantee the option would outrank every other option.

Conversations have ownership checks, optimistic version checks and an 80-message
limit. A failed send preserves the draft. After an uncertain network response the
UI reloads saved messages before asking the user to retry.

## Scope and deployment

Persona Models integration is deferred. One active decision is compared per
conversation; combined purchase-plus-job-change planning, autonomous actions and
general-purpose career coaching are not implemented. The explanations are
auditable rule/contribution/counterfactual explanations, not SHAP, causal evidence
or a claim of real-world recommendation accuracy.

The application does not auto-convert currencies. Wallet data freshness is shown;
chat reads saved aggregates rather than silently refreshing Wallet credentials.
Imported monthly history is reused; raw Wallet transactions are not automatically
claimed to be complete forecast training data.

This release is ready for **local application verification**, not a verified
public deployment. A cloud FastAPI server cannot reach the laptop at its own
`127.0.0.1`. A publicly accessible demo would need a separately configured inference
service. No paid service, deployment or public exposure of Ollama is configured.

## Verification

```bat
cd C:\Projects\PersonaTwin\backend
python -m pip install -r requirements-dev.txt
python -m pytest tests -q
```

Browser tests use `tests/ollama_fixture.py`, an explicitly named test-only Ollama
substitute that rejects unknown prompts. Point a **disposable test backend** at
`http://127.0.0.1:11555`, start that fixture in another terminal, then run
`npm run test:e2e` from `frontend`. Do not point your normal demo backend at it.
CI includes this setup. For an already installed Chromium binary the tests also
accept `E2E_CHROMIUM_EXECUTABLE`.

The model check in `scripts/smoke_chat_model.py` must be run with your real Ollama
configuration before calling the professor demo ready.
