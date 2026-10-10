import React, { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, ChevronRight, MessageSquare, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import "./chat.css";

const API = import.meta.env.VITE_API_BASE_URL || "";
const COLORS = ["#687782", "#087f78", "#98652d", "#765aba", "#3267b0"];
const LABELS = {
  price: "Purchase price", cheaper_price: "Cheaper alternative price", running_cost: "Monthly ownership cost",
  months: "Comparison months", delay_months: "Wait before buying (months)", down_payment: "Down payment",
  annual_rate: "Annual loan interest (%)", loan_months: "Loan tenure (months)",
  monthly_reduction: "Monthly spending reduction", target_amount: "Savings target",
  target_monthly_income: "New monthly take-home income", gap_months: "Months without income",
  transition_cost: "One-time transition cost", reserve_months: "Cash buffer (months)",
};
const money = (value, currency = "INR") => new Intl.NumberFormat("en-IN", {
  style: "currency", currency, maximumFractionDigits: 2,
}).format(value);
const when = value => value ? new Date(value).toLocaleString() : "Not recorded";

async function api(userId, token, path, options = {}) {
  const response = await fetch(API + "/users/" + userId + "/chat" + path, {
    signal: AbortSignal.timeout(90000), ...options,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const error = new Error(Array.isArray(detail) ? detail[0]?.msg : detail ||
      "Chat could not load. Check the backend and run its database migrations.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function Trajectory({ comparison }) {
  const { options, months, currency, reserve } = comparison;
  const series = options.map(option => [option.initial_cash, ...option.trajectory.map(point => point.cash)]);
  const low = Math.min(0, ...series.flat()), high = Math.max(reserve, ...series.flat(), 1);
  const span = high - low || 1;
  const x = index => 75 + index / months * 615;
  const y = amount => 205 - (amount - low) / span * 165;
  return <figure className="chat-chart">
    <figcaption>Projected available cash <span>Same starting profile · {months} months</span></figcaption>
    <svg viewBox="0 0 720 250" role="img" aria-label="Cash trajectories for the compared options">
      <title>Cash paths and the selected buffer</title>
      <desc>Exact final balances and minimum balances are in the comparison table. The dashed horizontal line is the selected cash buffer.</desc>
      {[low, (low + high) / 2, high].map((amount, i) => <g key={i}>
        <line x1="75" x2="690" y1={y(amount)} y2={y(amount)} stroke="#e7ecee" />
        <text x="67" y={y(amount) + 4} textAnchor="end">{new Intl.NumberFormat("en", { notation: "compact" }).format(amount)}</text>
      </g>)}
      <line x1="75" x2="690" y1={y(reserve)} y2={y(reserve)} stroke="#b37434" strokeDasharray="5 5" />
      <text x="690" y={Math.max(18, y(reserve) - 8)} textAnchor="end">Buffer: {money(reserve, currency)}</text>
      {series.map((points, i) => <polyline key={options[i].id} fill="none" stroke={COLORS[i % COLORS.length]}
        strokeWidth={options[i].id === comparison.recommended_id ? "3.5" : "2"} strokeDasharray={i === 0 ? "6 4" : undefined}
        points={points.map((amount, index) => x(index) + "," + y(amount)).join(" ")}>
        <title>{options[i].label}: final cash {money(options[i].final_cash, currency)}</title>
      </polyline>)}
      <text x="75" y="234">Start</text>
      <text x="690" y="234" textAnchor="end">Month {months}</text>
    </svg>
    <ul className="chat-legend">{options.map((option, i) => <li key={option.id}>
      <span style={{ background: COLORS[i % COLORS.length] }} />{option.label}
    </li>)}</ul>
  </figure>;
}

function Context({ data, currency, compact = false }) {
  if (!data?.financial) return null;
  const finance = data.financial;
  return <div className={compact ? "chat-context compact-context" : "chat-context"} aria-label="Financial context">
    <div><span>Monthly income</span><strong>{money(finance.monthly_income, currency)}</strong></div>
    <div><span>Monthly expenses</span><strong>{money(finance.monthly_expense, currency)}</strong></div>
    <div><span>Available savings</span><strong>{money(finance.current_savings, currency)}</strong></div>
  </div>;
}

function Comparison({ message }) {
  const { comparison: result, plan, context } = message;
  const { currency, options } = result;
  return <div className="chat-comparison">
    <div className="chat-result-title"><span className="chat-kicker">SIMULATION COMPARISON</span>
      <span>{options.length} paths · {result.months} months</span></div>
    <Trajectory comparison={result} />
    <div className="chat-table-wrap" role="region" aria-label="Scenario comparison" tabIndex={0}>
      <table className="chat-table" aria-label="Scenario results">
        <thead><tr><th>Option</th><th>Final cash</th><th>Lowest cash</th><th>New debt left</th><th>Buffer check</th></tr></thead>
        <tbody>{options.map(option => <tr key={option.id} className={option.id === result.recommended_id ? "chat-selected" : ""}>
          <th scope="row">{option.label}{option.id === result.recommended_id && <span className="chat-choice"><Check size={12} /> Preferred{option.conditional ? " · conditional" : ""}</span>}</th>
          <td>{money(option.final_cash, currency)}</td><td>{money(option.minimum_cash, currency)}</td>
          <td>{money(option.remaining_new_loan, currency)}</td>
          <td><span className={option.meets_reserve ? "chat-pass" : "chat-caution"}>{option.meets_reserve ? "Meets buffer" : option.cash_deficit ? "Cash deficit" : "Below buffer"}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
    <details className="chat-detail" open>
      <summary>Why this recommendation?</summary>
      <p>{result.rule}</p>
      <div className="chat-option-reasons">{options.map(option => <article key={option.id}>
        <h4>{option.label}</h4>
        <p><strong>Why considered:</strong> {option.why_considered}</p>
        <p>{option.explanation}</p>
        {option.monthly_emi != null && <p>EMI: {money(option.monthly_emi, currency)} for {option.loan_months} months · total loan interest: {money(option.loan_interest, currency)}. Fees excluded.</p>}
        {option.monthly_reduction != null && <p>Monthly spending cut: {money(option.monthly_reduction, currency)}.</p>}
      </article>)}</div>
    </details>
    <details className="chat-detail">
      <summary>What would change this recommendation?</summary>
      <p>These are conditional comparisons. Extra savings or a job offer are not assumed available.</p>
      {result.conditions.map(condition => <p key={condition.option}>
        <strong>{condition.option}:</strong> starting with {money(condition.starting_cash, currency)} ({money(condition.additional_starting_cash, currency)} extra)
        {" "}would meet the selected financial checks. Rerun minimum: {money(condition.minimum_cash, currency)}; final cash: {money(condition.final_cash, currency)}.
      </p>)}
      <ul>{result.change_factors.map(item => <li key={item}>{item}</li>)}</ul>
    </details>
    <details className="chat-detail">
      <summary>Inputs, data sources & calculation breakdown</summary>
      <Context data={context} currency={currency} compact />
      <p>Saved profile read: {when(context.read_at)}. Source: {context.financial_source?.replaceAll("_", " ")}.
        {" "}Wallet last synced: {when(context.wallet_synced_at)}. This comparison keeps its original inputs when your profile changes.</p>
      {context.career && <p>Career context: {context.career.current_role || "Role not recorded"} · goal: {context.career.dream_role || context.person?.career_goal || "not recorded"}. New income is an entered assumption.</p>}
      <dl className="chat-inputs">{Object.entries(plan).filter(([key]) => LABELS[key]).map(([key, value]) => <div key={key}>
        <dt>{LABELS[key]}</dt><dd>{value.toLocaleString("en-IN")} <small>“{plan.evidence?.[key]}”</small></dd>
      </div>)}</dl>
      <p><strong>Expense forecast:</strong> {result.forecast.method.replaceAll("_", " ")}. {result.forecast.reason}</p>
      <p>{result.forecast.history_months} imported months. {context.history_source?.name ? "History source: " + context.history_source.name + "." : "Wallet transactions are not automatically treated as complete monthly training data."}</p>
      {result.forecast.evaluation && <p>Rolling validation MAE: model {money(result.forecast.evaluation.model_mae, currency)}; baseline {money(result.forecast.evaluation.baseline_mae, currency)}. This does not measure recommendation accuracy.</p>}
      {options.filter(option => option.id !== "baseline").map(option => <div className="chat-contribution" key={option.id}>
        <strong>{option.label} · change from baseline: {money(option.difference_from_baseline, currency)}</strong>
        <ul>{option.contributions.map(item => <li key={item.label}>{item.label}: {money(item.amount, currency)}</li>)}</ul>
      </div>)}
      <ul>{result.assumptions.map(item => <li key={item}>{item}</li>)}</ul>
    </details>
    {!!result.omitted.length && <aside className="chat-omitted"><strong>Add more alternatives</strong><ul>{result.omitted.map(item => <li key={item}>{item}</li>)}</ul></aside>}
  </div>;
}

export default function ChatWorkspace({ userId, token, onOpenFinancialProfile }) {
  const [conversations, setConversations] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [context, setContext] = useState(null);
  const [currency, setCurrency] = useState("INR");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [model, setModel] = useState(null);
  const [checking, setChecking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [more, setMore] = useState(false);
  const end = useRef(null), input = useRef(null), sending = useRef(false);
  const key = "pt_chat_id_" + userId;

  useEffect(() => {
    let active = true;
    Promise.all([api(userId, token, "/conversations"), api(userId, token, "/context")]).then(async ([items, data]) => {
      if (!active) return;
      setConversations(items); setMore(items.length === 50); setContext(data);
      if (["INR", "USD", "EUR", "GBP"].includes(data.currency)) setCurrency(data.currency);
      const last = sessionStorage.getItem(key);
      if (last) {
        try {
          const saved = await api(userId, token, "/conversations/" + last);
          if (active) { setConversation(saved); setCurrency(saved.currency); }
        } catch (err) { if (err.status === 404) sessionStorage.removeItem(key); else throw err; }
      }
    }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setInitializing(false); });
    api(userId, token, "/status").then(data => { if (active) setModel(data); }).catch(() => {});
    return () => { active = false; };
  }, [userId, token, key]);

  async function refreshContext() {
    setChecking(true);
    try {
      const [data, status] = await Promise.all([api(userId, token, "/context"), api(userId, token, "/status")]);
      setContext(data); setModel(status); setError("");
    } catch (err) { setError(err.message); } finally { setChecking(false); }
  }

  async function selectConversation(id) {
    if (sending.current) return;
    setBusy(true); setError(""); setConfirmDelete(false);
    try {
      const saved = await api(userId, token, "/conversations/" + id);
      setConversation(saved); setCurrency(saved.currency); setDraft("");
      sessionStorage.setItem(key, saved.id);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function loadMore() {
    setBusy(true);
    try {
      const items = await api(userId, token, "/conversations?offset=" + conversations.length);
      setConversations(previous => [...previous, ...items]); setMore(items.length === 50);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  function newConversation() {
    setConversation(null); setDraft(""); setError(""); setConfirmDelete(false);
    sessionStorage.removeItem(key);
    if (["INR", "USD", "EUR", "GBP"].includes(context?.currency)) setCurrency(context.currency);
    input.current?.focus();
  }

  async function removeConversation() {
    setBusy(true);
    try {
      await api(userId, token, "/conversations/" + conversation.id, { method: "DELETE" });
      setConversations(items => items.filter(item => item.id !== conversation.id));
      newConversation();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function send(event) {
    event.preventDefault();
    if (!draft.trim() || sending.current || initializing) return;
    sending.current = true; setBusy(true); setError(""); setConfirmDelete(false);
    let current = conversation;
    try {
      if (!current) {
        current = await api(userId, token, "/conversations", { method: "POST", body: JSON.stringify({ currency }) });
        setConversation(current); sessionStorage.setItem(key, current.id);
        setConversations(items => [current, ...items]);
      }
      const result = await api(userId, token, "/conversations/" + current.id + "/messages", {
        method: "POST", body: JSON.stringify({ message: draft.trim(), version: current.version }),
      });
      setConversation(result); setDraft("");
      setConversations(items => [result, ...items.filter(item => item.id !== result.id)]);
      const latest = result.messages.at(-1)?.context;
      if (latest) setContext(latest);
      setModel(previous => ({ ...previous, available: true, detail: "Model responded" }));
      requestAnimationFrame(() => { end.current?.scrollIntoView({ block: "end" }); input.current?.focus(); });
    } catch (err) {
      let message = err.name === "TimeoutError" ? "The request timed out. Reload this conversation before retrying; the backend may still be finishing." : err.message;
      if (current) {
        // Reconcile after failures, including a response lost after a successful save.
        try {
          const saved = await api(userId, token, "/conversations/" + current.id);
          setConversation(saved);
          if (saved.version > current.version) message += " The saved conversation has been reloaded; review it before resending.";
        } catch { /* Keep the draft when the backend is unavailable. */ }
      }
      setError(message);
    } finally { sending.current = false; setBusy(false); }
  }

  const messages = conversation?.messages || [];
  return <section className="chat-workspace" aria-label="Decision assistant">
    <div className="chat-heading"><div><span className="chat-kicker">YOUR DECISION SPACE</span>
      <h2>Think it through with your twin.</h2><p>Ask a question. Compare the possibilities. Understand the trade-offs.</p></div>
      <button className="secondary-action" onClick={newConversation} disabled={busy || initializing}><Plus size={16} /> New conversation</button></div>
    <div className="chat-layout">
      <aside className="chat-history" aria-label="Saved conversations">
        <h3><MessageSquare size={15} /> Conversations</h3>
        {!conversations.length && <p>Your conversations and comparisons will appear here.</p>}
        <div className="chat-history-list">{conversations.map(item => <button key={item.id} disabled={busy}
          className={conversation?.id === item.id ? "active" : ""} aria-current={conversation?.id === item.id ? "true" : undefined}
          onClick={() => selectConversation(item.id)}><span>{item.title}</span><small>{new Date(item.updated_at).toLocaleDateString()} · {item.currency}</small></button>)}</div>
        {more && <button className="ghost-action" onClick={loadMore} disabled={busy}>Older conversations</button>}
        <div className="chat-model-status"><span className={model?.available ? "chat-dot ready" : "chat-dot"} />
          <span>{model?.detail || "Checking local model…"}</span>
          <button className="tool-action" onClick={refreshContext} disabled={busy || checking} aria-label="Check model and refresh saved context"><RefreshCw size={13} /></button>
        </div>
      </aside>
      <div className="chat-main">
        <div className="chat-profile-bar">
          <div className="chat-profile-title"><strong>Your saved finances</strong>
            <button className="ghost-action" onClick={onOpenFinancialProfile} disabled={busy}>View profile <ChevronRight size={14} /></button></div>
          <Context data={context} currency={context?.currency || currency} />
          {!context?.financial && !initializing && <p>Save a financial profile or connect Persona Wallet to compare your options.</p>}
          {context?.wallet_synced_at && <small>Wallet last synced {when(context.wallet_synced_at)}. New messages read the latest saved profile.</small>}
          {context?.mixed_currency && <p className="chat-caution">Your Wallet has mixed currencies. Separate them before comparing.</p>}
        </div>
        {initializing && <p role="status">Loading your decision space…</p>}
        {!messages.length && !initializing && <div className="chat-welcome">
          <span className="chat-welcome-icon"><Sparkles size={24} /></span><h3>What are you deciding?</h3>
          <p>I’ll use your saved finances, ask for missing details, and show how each option changes your cash path.</p>
          <div className="chat-starters">{[
            ["Purchase", "Can I afford a bike for 150000?"],
            ["Savings", "Can I reach 300000 in savings within 12 months?"],
            ["Career", "Should I switch to a job paying 60000 take-home per month?"],
          ].map(([label, prompt]) => <button key={label} disabled={busy} onClick={() => { setDraft(prompt); input.current?.focus(); }}>
            <strong>{label}</strong><span>{prompt}</span><ChevronRight size={16} />
          </button>)}</div>
          <small>Amounts use the selected currency. Career income is your assumption; salary prediction is not connected.</small>
        </div>}
        <div className="chat-messages" aria-label="Conversation messages">
          {messages.map(message => <article key={message.id} className={"chat-message " + message.role} aria-label={message.role === "user" ? "Your message" : "PersonaTwin response"}>
            <div className="chat-message-label">{message.role === "user" ? "You" : <><Sparkles size={14} /> PersonaTwin</>}</div>
            <p className="chat-message-text">{message.text}</p>
            {message.needs_profile && <button className="secondary-action" onClick={onOpenFinancialProfile}>Set up financial profile</button>}
            {message.comparison && <Comparison message={message} />}
          </article>)}
          {busy && sending.current && <p className="chat-working" role="status"><span className="chat-dot ready" /> Reading your question and comparing the relevant paths…</p>}
          <div ref={end} />
        </div>
        <div aria-live="polite">{error && <p className="chat-error" role="alert">{error}</p>}</div>
        <form className="chat-composer" onSubmit={send}>
          <label htmlFor="chat-message">Ask your twin</label>
          <textarea id="chat-message" ref={input} rows={3} maxLength={2000} value={draft} disabled={busy || initializing}
            placeholder="Can I afford this? What if I wait, spend less, or change jobs?"
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} />
          <div className="chat-composer-footer">
            <label>Currency <select aria-label="Currency" value={currency} disabled={!!conversation || busy || initializing} onChange={event => setCurrency(event.target.value)}>
              {["INR", "USD", "EUR", "GBP"].map(value => <option key={value}>{value}</option>)}</select></label>
            <span>Enter to send · Shift + Enter for a new line</span>
            <button className="primary-action" disabled={busy || initializing || !draft.trim()} type="submit"><ArrowUp size={16} /> Send</button>
          </div>
        </form>
        <div className="chat-footnote"><small>Scenario estimates depend on your inputs. No payments or applications are made.</small>
          {conversation && !confirmDelete && <button className="ghost-action" disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={13} /> Delete conversation</button>}
          {confirmDelete && <div className="chat-delete-confirm"><span>Delete this saved conversation?</span>
            <button className="secondary-action" disabled={busy} onClick={removeConversation}>Delete</button>
            <button className="ghost-action" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button></div>}
        </div>
      </div>
    </div>
  </section>;
}
