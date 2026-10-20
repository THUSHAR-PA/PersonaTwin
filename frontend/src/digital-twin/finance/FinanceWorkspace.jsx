import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronDown,
  CircleAlert,
  Coins,
  Database,
  Download,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useTwinResource } from "../useTwinDashboard";
import { amount, dateLabel, known, percent, sourceLabel } from "../format";
import FinanceForecast from "./FinanceForecast";
import WalletHistoryReview from "./WalletHistoryReview";
import "./finance.css";

const methods = {
  ridge_trend: "Ridge regression",
  trailing_mean: "Three-month average",
  profile_assumption: "Saved profile assumption",
};
const modules = [
  ["risk", "Financial Risk Prediction", ShieldCheck],
  ["expense", "Expense Forecasting", ChartNoAxesCombined],
  ["income", "Income Forecasting", TrendingUp],
  ["debt", "Debt Stress Prediction", Coins],
  ["goals", "Financial Goal Prediction", Target],
  ["behaviour", "Spending Behaviour Analysis", Activity],
];
const base = import.meta.env.VITE_API_BASE_URL || "";
function Badge({ children, kind = "calculated" }) {
  return <span className={`fi-badge fi-badge-${kind}`}>{children}</span>;
}
function Metric({ label, value, note }) {
  return (
    <div className="fi-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
function ForecastDetails({ forecast, rows, field, currency }) {
  if (!forecast)
    return (
      <p className="fi-muted">
        Save your financial profile and confirm one currency to enable
        forecasting.
      </p>
    );
  const evaluation = forecast.evaluation;
  return (
    <>
      <div className="fi-card-heading">
        <strong>{methods[forecast.method]}</strong>
        <Badge kind={forecast.kind === "ml_prediction" ? "ml" : "assumption"}>
          {forecast.kind === "ml_prediction"
            ? "ML prediction"
            : forecast.kind === "baseline"
              ? "Statistical baseline"
              : "Assumption"}
        </Badge>
      </div>
      <div className="fi-next-value">
        <span>Next complete month</span>
        <strong>{amount(forecast.values[0], currency)}</strong>
      </div>
      <FinanceForecast
        rows={rows}
        field={field}
        currency={currency}
        title={`${field === "income" ? "Income" : "Expense"} forecast`}
      />
      <p className="fi-muted">{forecast.reason}</p>
      {evaluation && (
        <details className="fi-method">
          <summary>Validation and explanation</summary>
          <dl>
            <div>
              <dt>Candidate MAE</dt>
              <dd>{amount(evaluation.model_mae, currency)}</dd>
            </div>
            <div>
              <dt>Baseline MAE</dt>
              <dd>{amount(evaluation.baseline_mae, currency)}</dd>
            </div>
            <div>
              <dt>Candidate RMSE</dt>
              <dd>{amount(evaluation.model_rmse, currency)}</dd>
            </div>
          </dl>
          <p>{evaluation.note}</p>
          <p>
            Ridge is used only when rolling validation MAE beats the average
            baseline by more than 5%. Forecasts are bounded between zero and
            three times the largest recorded/profile amount.
          </p>
          <ul>
            {forecast.attribution?.map((row) => (
              <li key={row.feature}>
                {row.feature}: {amount(row.contribution, currency)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

export default function FinanceWorkspace({
  userId,
  token,
  walletRevision,
  walletToken,
  onBack,
  onOpenProfile,
  onOpenSimulations,
  onSignIn,
}) {
  const { data, loading, error, refresh } = useTwinResource(
    userId,
    token,
    walletRevision,
    "finance",
  );
  const [scenario, setScenario] = useState(null),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  const [csv, setCsv] = useState(""),
    [source, setSource] = useState(""),
    [currency, setCurrency] = useState("INR"),
    [consent, setConsent] = useState(false);
  const [payment, setPayment] = useState(""),
    [selected, setSelected] = useState("all");
  const [walletReview, setWalletReview] = useState(null);
  const controller = useRef(),
    active = useRef(true),
    heading = useRef();
  const latest = scenario || data;
  useEffect(() => {
    heading.current?.focus();
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    setScenario(null);
    if (data?.currency) setCurrency(data.currency);
  }, [data]);
  useEffect(() => {
    setScenario(null);
    setActionError("");
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setCsv("");
    setSource("");
    setConsent(false);
    setPayment("");
    setWalletReview(null);
  }, [userId, token, walletToken]);
  useEffect(() => {
    if (error?.unauthorized) {
      controller.current?.abort();
      controller.current = null;
      setScenario(null);
      setCsv("");
      setSource("");
      setConsent(false);
      setPayment("");
      setWalletReview(null);
      setBusy(false);
    }
  }, [error?.unauthorized]);
  async function post(path, body) {
    if (busy) return;
    if (data?.demo) {
      setActionError(
        "Data imports and repayment scenarios require the connected application. This preview uses fictional data only.",
      );
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setActionError("");
    const timeout = setTimeout(() => abort.abort(), 20000);
    try {
      const response = await fetch(`${base}/users/${userId}/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: abort.signal,
      });
      if (
        !active.current ||
        controller.current !== abort ||
        abort.signal.aborted
      )
        return;
      if (!response.ok) {
        if ([401, 403].includes(response.status)) {
          setScenario(null);
          refresh();
          throw new Error("Your session has expired. Sign in again.");
        }
        const result = await response.json();
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Check the data format and required fields.",
        );
      }
      const result = await response.json();
      if (!active.current || controller.current !== abort) return;
      if (path === "twin/finance/wallet-history") {
        setWalletReview(result);
        setCsv(result.csv_text);
        setSource(result.source_name);
        setCurrency(result.currency);
        setConsent(false);
      } else if (path === "decisions/history") {
        setCsv("");
        setConsent(false);
        setWalletReview(null);
        await refresh();
      } else setScenario(result);
    } catch (error) {
      if (active.current && controller.current === abort)
        setActionError(
          error.name === "AbortError"
            ? "Request timed out. Please retry."
            : error.message,
        );
    } finally {
      clearTimeout(timeout);
      if (active.current && controller.current === abort) setBusy(false);
    }
  }
  const money = (value) =>
    amount(value, latest?.currency, latest?.mixed_currency);
  const summary = latest?.summary || {},
    risk = latest?.risk || {},
    debt = latest?.debt_stress || {},
    behaviour = latest?.behaviour || {};
  const show = (id) => selected === "all" || selected === id;
  return (
    <div className="digital-twin finance-workspace">
      <button className="fi-back" onClick={onBack}>
        <ArrowLeft size={15} /> Back to Digital Twin
      </button>
      <header className="fi-header">
        <div>
          <span className="dt-eyebrow">PERSONA INTELLIGENCE / FINANCE</span>
          <h1 ref={heading} tabIndex={-1}>
            Your financial twin<span>.</span>
          </h1>
          <p>A complete picture today. A clearer view of what comes next.</p>
        </div>
        <div className="fi-actions">
          <button
            className="dt-icon-button"
            aria-label="Refresh financial analysis"
            onClick={refresh}
            disabled={loading || busy}
          >
            <RefreshCw size={17} className={loading ? "dt-spin" : ""} />
          </button>
          <button className="dt-button" onClick={onOpenProfile}>
            <Wallet size={15} /> Profile & Wallet
          </button>
          <button
            className="dt-button dt-primary"
            onClick={() => onOpenSimulations()}
          >
            Explore a decision <ArrowUpRight size={14} />
          </button>
        </div>
      </header>
      {error && (
        <div className="dt-error" role="alert">
          <CircleAlert size={18} />
          <span>
            {error.message}
            {data ? " Showing the last loaded analysis." : ""}
          </span>
          <button
            className="dt-button"
            onClick={error.unauthorized ? onSignIn : refresh}
          >
            {error.unauthorized ? "Sign in again" : "Try again"}
          </button>
        </div>
      )}
      {actionError && (
        <p className="dt-error" role="alert">
          {actionError}
        </p>
      )}
      {loading && !data ? (
        <div className="fi-loading" role="status">
          Reading your financial picture and evaluating available models…
        </div>
      ) : (
        <>
          <section className="fi-overview" aria-label="Financial situation">
            <div className="fi-balance">
              <span className="dt-eyebrow">YOUR RECORDED POSITION</span>
              <span className="fi-balance-label">Available cash / savings</span>
              <strong>{money(summary.cash)}</strong>
              <p>
                {summary.profile_present === false
                  ? "No financial profile saved"
                  : sourceLabel(summary.source)}{" "}
                ·{" "}
                {summary.wallet_synced_at
                  ? `Wallet synced ${dateLabel(summary.wallet_synced_at, true)}`
                  : summary.profile_present === false
                    ? "Add your data through Profile & Wallet"
                    : "Manually entered profile"}
              </p>
              <Badge>Calculated from saved data</Badge>
            </div>
            <div className="fi-overview-grid">
              <Metric label="Monthly income" value={money(summary.income)} />
              <Metric label="Monthly expenses" value={money(summary.expense)} />
              <Metric
                label="Monthly surplus"
                value={money(summary.monthly_surplus)}
              />
              <Metric
                label="Savings rate"
                value={percent(summary.savings_rate)}
              />
              <Metric label="Investments" value={money(summary.investments)} />
              <Metric label="Outstanding debt" value={money(summary.debt)} />
              <Metric
                label="Recorded net assets"
                value={money(summary.recorded_net_assets)}
                note="Cash + investments − debt; excludes other assets"
              />
              <Metric
                label="Cash runway"
                value={
                  known(summary.cash_runway_months)
                    ? `${summary.cash_runway_months} months`
                    : "Not available"
                }
                note="Cash / expenses, assuming no income"
              />
            </div>
          </section>
          {known(summary.monthly_surplus) && summary.monthly_surplus >= 0 && (
            <p className="fi-situation" aria-label="Financial summary">
              {summary.monthly_surplus > 0
                ? `Your recorded income leaves ${money(summary.monthly_surplus)} each month after expenses.`
                : "Your recorded income and expenses currently break even."}
              {known(summary.cash_runway_months)
                ? ` Your available cash covers about ${summary.cash_runway_months} months of these expenses without income.`
                : ""}
              {known(summary.debt) && summary.debt > 0
                ? " Review the repayment burden below alongside this cash-flow position."
                : ""}
            </p>
          )}
          {summary.monthly_surplus < 0 && (
            <p className="fi-callout">
              <CircleAlert size={17} /> Your recorded monthly expenses exceed
              income by {money(-summary.monthly_surplus)}. This is a current
              cash-flow calculation.
            </p>
          )}
          <div className="fi-data-strip">
            <span>
              <Database size={14} /> {latest?.history?.months || 0} complete
              history months
            </span>
            <span>
              {latest?.history?.eligible
                ? "History eligible for model evaluation"
                : "Models need recent, confirmed history"}
            </span>
            <a href="#finance-data">
              Manage training data <ArrowUpRight size={13} />
            </a>
          </div>
          <nav
            className="fi-module-nav"
            aria-label="Financial analysis modules"
          >
            <button
              aria-pressed={selected === "all"}
              onClick={() => setSelected("all")}
            >
              All insights
            </button>
            {modules.map(([id, title, Icon]) => (
              <button
                key={id}
                aria-pressed={selected === id}
                onClick={() => setSelected(id)}
              >
                <Icon size={14} />
                {title}
              </button>
            ))}
          </nav>
          <div className="fi-module-grid">
            {show("risk") && (
              <section className="fi-card" aria-labelledby="finance-risk">
                <div className="fi-section-title">
                  <ShieldCheck size={20} />
                  <span>01</span>
                  <h2 id="finance-risk">Financial Risk Prediction</h2>
                </div>
                <Badge kind={risk.status === "ready" ? "ml" : "assumption"}>
                  {risk.status === "ready"
                    ? "Logistic regression"
                    : risk.status === "baseline"
                      ? "Validation gate not passed"
                      : "More data needed"}
                </Badge>
                <div className="fi-next-value">
                  <span>Next complete month's cash-flow shortfall</span>
                  <strong>
                    {known(risk.probability)
                      ? percent(risk.probability * 100)
                      : "Not estimated"}
                  </strong>
                </div>
                <p className="fi-muted">{risk.reason}</p>
                {known(risk.available_months) && (
                  <p className="fi-muted">
                    Eligible history: {risk.available_months} / 24 required
                    months. Wallet history must first be reviewed and imported
                    below.
                  </p>
                )}
                <p className="fi-muted">
                  Target: expenses exceed income. This does not predict loan
                  default, creditworthiness or overall financial wellbeing.
                </p>
                {risk.probability != null && (
                  <p className="fi-callout">
                    Uncalibrated research estimate; six validation observations
                    do not establish reliability.
                  </p>
                )}
                {risk.evaluation && (
                  <details className="fi-method">
                    <summary>Model evaluation</summary>
                    <dl>
                      <div>
                        <dt>Candidate Brier score</dt>
                        <dd>{risk.evaluation.brier.toFixed(4)}</dd>
                      </div>
                      <div>
                        <dt>Historical-rate baseline</dt>
                        <dd>{risk.evaluation.baseline_brier.toFixed(4)}</dd>
                      </div>
                      <div>
                        <dt>Balanced accuracy</dt>
                        <dd>
                          {known(risk.evaluation.balanced_accuracy)
                            ? percent(risk.evaluation.balanced_accuracy * 100)
                            : "Not estimable"}
                        </dd>
                      </div>
                    </dl>
                    <p>{risk.evaluation.note}</p>
                    <p>
                      Six expanding validation months, using earlier data only.
                      Both classes are required and Brier score must improve by
                      more than 5%.
                    </p>
                    <p>
                      Confusion matrix (actual rows / predicted columns;
                      surplus, deficit):{" "}
                      {risk.evaluation.confusion_matrix
                        .map((row) => row.join(", "))
                        .join(" / ")}
                    </p>
                    {risk.explanation && (
                      <>
                        <h3>What influenced this estimate</h3>
                        <p>
                          Contributions to model log odds. Positive values move
                          toward shortfall; negative values move away. These are
                          associations, not causal effects.
                        </p>
                        <ul>
                          {risk.explanation.factors.map((factor) => (
                            <li key={factor.feature}>
                              {factor.feature}: {factor.log_odds.toFixed(3)}
                            </li>
                          ))}
                        </ul>
                        <p>
                          Intercept: {risk.explanation.intercept.toFixed(3)}.
                          Intercept plus contributions transforms to the
                          displayed probability through the logistic function.
                        </p>
                      </>
                    )}
                  </details>
                )}
              </section>
            )}
            {show("expense") && (
              <section className="fi-card" aria-labelledby="finance-expense">
                <div className="fi-section-title">
                  <ChartNoAxesCombined size={20} />
                  <span>02</span>
                  <h2 id="finance-expense">Expense Forecasting</h2>
                </div>
                <ForecastDetails
                  forecast={latest?.forecasts?.expense}
                  rows={latest?.timeline}
                  field="expense"
                  currency={latest?.currency}
                />
              </section>
            )}
            {show("income") && (
              <section className="fi-card" aria-labelledby="finance-income">
                <div className="fi-section-title">
                  <TrendingUp size={20} />
                  <span>03</span>
                  <h2 id="finance-income">Income Forecasting</h2>
                </div>
                <ForecastDetails
                  forecast={latest?.forecasts?.income}
                  rows={latest?.timeline}
                  field="income"
                  currency={latest?.currency}
                />
                <p className="fi-muted">
                  Forecasts recorded inflows; future salary, promotions and job
                  offers are not predicted.
                </p>
              </section>
            )}
            {show("debt") && (
              <section className="fi-card" aria-labelledby="finance-debt">
                <div className="fi-section-title">
                  <Coins size={20} />
                  <span>04</span>
                  <h2 id="finance-debt">Debt Stress Prediction</h2>
                </div>
                <Badge kind="assumption">Conditional projection</Badge>
                <div className="fi-two-values">
                  <Metric
                    label="Monthly debt payments"
                    value={money(debt.monthly_payment)}
                  />
                  <Metric
                    label="Payment / current income"
                    value={percent(debt.payment_to_income_pct)}
                  />
                  <Metric
                    label="If income falls 20%"
                    value={percent(debt.stressed_payment_to_income_pct)}
                  />
                  <Metric
                    label="Payment / forecast income"
                    value={percent(debt.forecast_payment_to_income_pct)}
                  />
                </div>
                <p className="fi-muted">{debt.reason}</p>
                <p className="fi-muted">{debt.source}</p>
                <form
                  className="fi-inline-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    post("twin/finance/analyze", {
                      monthly_debt_payment: Number(payment),
                    });
                  }}
                >
                  <label>
                    Try a monthly repayment amount
                    <input
                      aria-label="Monthly debt payment"
                      type="number"
                      required
                      min="0"
                      max="1000000000000"
                      step="0.01"
                      value={payment}
                      onChange={(event) => setPayment(event.target.value)}
                    />
                  </label>
                  <button
                    className="dt-button"
                    disabled={
                      busy || latest?.mixed_currency || !latest?.currency
                    }
                  >
                    Calculate scenario
                  </button>
                </form>
                <p className="fi-muted">
                  Temporary assumption only. A trained debt-default classifier
                  needs repayment and missed-payment outcomes.
                </p>
              </section>
            )}
            {show("goals") && (
              <section className="fi-card" aria-labelledby="finance-goals">
                <div className="fi-section-title">
                  <Target size={20} />
                  <span>05</span>
                  <h2 id="finance-goals">Financial Goal Prediction</h2>
                </div>
                <Badge kind="assumption">
                  Projection using selected forecasts
                </Badge>
                {latest?.goals?.length ? (
                  latest.goals.map((goal) => (
                    <article className="fi-goal" key={goal.id}>
                      <h3>{goal.title}</h3>
                      <div>
                        <strong>{amount(goal.target, goal.currency)}</strong>
                        <span>
                          {percent(goal.progress_pct)} currently covered
                        </span>
                      </div>
                      {known(goal.progress_pct) && (
                        <progress
                          max="100"
                          value={goal.progress_pct}
                          aria-label={`${goal.title} progress`}
                        />
                      )}
                      <p>
                        {goal.status === "unavailable"
                          ? "Confirm matching currency and a financial profile to project this goal."
                          : goal.achievement_month
                            ? `Projected coverage: ${goal.achievement_month}`
                            : "Not reached within the next 12 projected months."}
                      </p>
                      <small>
                        Original saved deadline:{" "}
                        {dateLabel(goal.original_deadline)}. This is a fresh
                        forecast from today's profile, separate from the saved
                        decision.
                      </small>
                      <button
                        className="fi-text-button"
                        onClick={() => onOpenSimulations(goal.id)}
                      >
                        Open saved simulation <ArrowUpRight size={13} />
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="fi-empty">
                    <Target size={26} />
                    <h3>Give your savings a destination</h3>
                    <p>
                      Save a savings-goal simulation to see progress and
                      projected coverage here.
                    </p>
                    <button
                      className="dt-button"
                      onClick={() => onOpenSimulations()}
                    >
                      Create a goal
                    </button>
                  </div>
                )}
                <p className="fi-muted">
                  Goals share the same savings; money is not allocated
                  separately. Achievement probability is unavailable without a
                  validated uncertainty model.
                </p>
              </section>
            )}
            {show("behaviour") && (
              <section className="fi-card" aria-labelledby="finance-behaviour">
                <div className="fi-section-title">
                  <Activity size={20} />
                  <span>06</span>
                  <h2 id="finance-behaviour">Spending Behaviour Analysis</h2>
                </div>
                <Badge
                  kind={behaviour.status === "ready" ? "ml" : "assumption"}
                >
                  {behaviour.status === "ready"
                    ? "Isolation Forest · unsupervised"
                    : "More history needed"}
                </Badge>
                <h3 className="fi-behaviour-result">
                  {behaviour.status === "ready"
                    ? behaviour.unusual
                      ? `Unusual spending in ${behaviour.month}`
                      : `No spending novelty flagged in ${behaviour.month}`
                    : "Learning your spending pattern"}
                </h3>
                <p className="fi-muted">{behaviour.reason}</p>
                {known(behaviour.versus_previous_three_pct) && (
                  <p className="fi-muted">
                    Last completed month vs preceding three-month average:{" "}
                    {percent(behaviour.versus_previous_three_pct)}. Detector
                    trained on {behaviour.training_months} earlier months.
                  </p>
                )}
                <h3>
                  Where your money went{" "}
                  <Badge>Observed Wallet categories</Badge>
                </h3>
                {latest?.categories?.length ? (
                  <div className="fi-category-list">
                    {latest.categories.slice(0, 8).map((category) => (
                      <div key={category.category}>
                        <span>{category.category.replaceAll("_", " ")}</span>
                        <strong>{money(category.amount)}</strong>
                        <progress
                          max={Math.max(
                            ...latest.categories.map((item) => item.amount),
                            1,
                          )}
                          value={category.amount}
                          aria-label={`${category.category} spending`}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="fi-muted">
                    Sync Wallet to see categorized spending. Monthly CSV history
                    does not contain categories.
                  </p>
                )}
                {latest?.categories?.length > 0 && (
                  <p className="fi-muted">
                    Observation window: {dateLabel(latest.wallet_period.start)}{" "}
                    – {dateLabel(latest.wallet_period.end)}. Categories are
                    user-entered or heuristic; this is not ML classification.
                  </p>
                )}
              </section>
            )}
          </div>
          <section
            className="fi-card fi-projection"
            aria-label="Combined savings outlook"
          >
            <div>
              <span className="dt-eyebrow">INCOME MINUS EXPENSES</span>
              <h2>Your 12-month savings outlook</h2>
              <p className="fi-muted">
                Starting cash plus selected income and expense forecasts.
                Assumptions and model choices are shown above.
              </p>
            </div>
            <FinanceForecast
              rows={latest?.timeline}
              field="savings"
              currency={latest?.currency}
              title="Projected savings"
            />
          </section>
          <section
            className="fi-card fi-data-section"
            id="finance-data"
            aria-labelledby="finance-data-title"
          >
            <div>
              <span className="dt-eyebrow">DATA & MODEL READINESS</span>
              <h2 id="finance-data-title">
                Better history. More useful insights.
              </h2>
              <p className="fi-muted">
                Import confirmed monthly totals from your records. Include every
                completed month, including real zeros. Do not invent or fill
                missing observations.
              </p>
              <ul className="fi-readiness">
                <li>
                  <strong>Expense & income:</strong> 12 recent consecutive
                  months; Ridge must beat the baseline.
                </li>
                <li>
                  <strong>Cash-flow risk:</strong> 24 months, surplus and
                  deficit examples; validation must pass.
                </li>
                <li>
                  <strong>Spending novelty:</strong> 12 training months + one
                  month to inspect.
                </li>
                <li>
                  <strong>Debt & goals:</strong> saved balances, repayment
                  assumptions and goals; no default/success labels invented.
                </li>
              </ul>
              <p className="fi-muted">
                Current history: {latest?.history?.months || 0} months ·{" "}
                {latest?.history?.last_month || "No completed history"}
                {latest?.history?.source ? ` · ${latest.history.source}` : ""}
              </p>
              {latest?.history?.issue && (
                <p className="fi-callout">{latest.history.issue}</p>
              )}
              <WalletHistoryReview
                connected={Boolean(walletToken)}
                busy={busy}
                review={walletReview}
                onConnect={onOpenProfile}
                onLoad={() =>
                  post("twin/finance/wallet-history", {
                    wallet_token: walletToken,
                  })
                }
              />
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                post("decisions/history", {
                  csv_text: csv,
                  source_name: source,
                  currency,
                  consent,
                });
              }}
            >
              <label>
                History source
                <input
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  placeholder="e.g. Reviewed bank statements"
                  required
                  maxLength={120}
                />
              </label>
              <label>
                Currency
                <select
                  aria-label="History currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  {["INR", "USD", "EUR", "GBP"].map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              </label>
              <label>
                Monthly totals CSV
                <textarea
                  aria-label="Monthly history CSV"
                  value={csv}
                  onChange={(event) => setCsv(event.target.value)}
                  placeholder={"month,income,expense\nYYYY-MM,50000,35000"}
                  required
                  maxLength={100000}
                  rows={5}
                  spellCheck={false}
                />
              </label>
              <p className="fi-muted">
                Exact columns: month,income,expense. Up to 120 consecutive
                completed months. The latest month must be the previous complete
                month to enable ML.
              </p>
              <label className="fi-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  required
                />
                I have permission to use these records and confirm these are
                complete monthly totals in the selected currency.
              </label>
              <button
                className="dt-button dt-primary"
                disabled={busy || !consent || latest?.mixed_currency}
              >
                <Download size={15} />
                {busy ? "Processing…" : "Import & evaluate models"}
              </button>
            </form>
          </section>
          <details className="fi-limitations">
            <summary>
              Sources, assumptions & limitations <ChevronDown size={15} />
            </summary>
            <ul>
              {latest?.warnings?.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            <p>
              Wallet activity months:{" "}
              {latest?.wallet_quality?.months_with_activity ?? "Unknown"}. No
              activity recorded for:{" "}
              {latest?.wallet_quality?.missing_months?.join(", ") ||
                "None reported / unavailable"}
              .
            </p>
            <p>
              Model version: {latest?.models?.version || "Unavailable"}.
              Training data fingerprint:{" "}
              {latest?.models?.data_hash || "Unavailable"}. Personal data stays
              in the existing backend; no external model API is called.
            </p>
          </details>
        </>
      )}
    </div>
  );
}
