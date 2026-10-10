import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, GitCompareArrows, History, Play, RefreshCw, Trash2, Upload } from "lucide-react";
import "./decisions.css";
import DecisionOutcomes from "./DecisionOutcomes";

const labels = { savings_goal: "Savings goal", job_switch: "Job switch", higher_studies: "Higher studies", lifestyle: "Lifestyle budget" };
const initial = { title: "Savings goal", scenario: "savings_goal", months: 12, target_amount: 100000, monthly_reduction: 0, forecast: "auto", uncertainty_pct: 0, target_monthly_income: 50000, transition_cost: 0, gap_months: 0, monthly_lifestyle_cost: 0, weekly_activity_hours: 0, seed: 42, samples: 1000 };
const money = (value, currency) => new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
const stamp = (value) => new Date(value).toLocaleString();

function ProjectionChart({ result }) {
  const canvas = useRef(null);
  useEffect(() => {
    const draw = () => {
      const element = canvas.current;
      if (!element) return;
      const width = element.clientWidth, height = element.clientHeight, dpr = window.devicePixelRatio || 1;
      element.width = width * dpr; element.height = height * dpr;
      const ctx = element.getContext("2d"); ctx.scale(dpr, dpr);
      const paths = result.trajectory, band = result.uncertainty?.alternative;
      const values = paths.flatMap(p => [p.baseline, p.alternative]);
      if (band) values.push(...band.p10, ...band.p90);
      values.push(result.target_amount, 0);
      const min = Math.min(...values), max = Math.max(...values, 1), range = max - min || 1;
      const left = 65, right = width - 18, top = 16, bottom = height - 32;
      const x = i => left + i * (right - left) / Math.max(1, paths.length - 1);
      const y = v => bottom - (v - min) / range * (bottom - top);
      ctx.font = "11px sans-serif"; ctx.fillStyle = "#56636b";
      for (let i = 0; i <= 4; i++) {
        const value = min + i * range / 4, py = y(value);
        ctx.strokeStyle = "#dce3e7"; ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(right, py); ctx.stroke();
        ctx.fillText(new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value), 4, py + 4);
      }
      if (band) {
        ctx.beginPath(); band.p90.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
        [...band.p10].reverse().forEach((v, i) => ctx.lineTo(x(paths.length - i - 1), y(v)));
        ctx.closePath(); ctx.fillStyle = "#d4ede8"; ctx.fill();
      }
      ctx.setLineDash([5, 5]); ctx.strokeStyle = "#b55338";
      ctx.beginPath(); ctx.moveTo(left, y(result.target_amount)); ctx.lineTo(right, y(result.target_amount)); ctx.stroke(); ctx.setLineDash([]);
      for (const [key, color] of [["baseline", "#677cad"], ["alternative", "#087f78"]]) {
        ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
        paths.forEach((p, i) => i ? ctx.lineTo(x(i), y(p[key])) : ctx.moveTo(x(i), y(p[key]))); ctx.stroke();
        if (paths.length === 1) { ctx.beginPath(); ctx.arc(x(0), y(paths[0][key]), 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
      }
      ctx.fillStyle = "#56636b"; ctx.fillText(paths[0].period_end.slice(0, 7), left, height - 8);
      if (paths.length > 1) ctx.fillText(paths.at(-1).period_end.slice(0, 7), Math.max(left, right - 50), height - 8);
    };
    const observer = new ResizeObserver(draw); observer.observe(canvas.current); draw();
    return () => observer.disconnect();
  }, [result]);
  return <figure className="decision-chart"><canvas ref={canvas} role="img" aria-label="Projected savings: baseline and alternative, with savings target. Exact amounts in the monthly projection table." /><figcaption><span className="legend-base">Keep current plan</span><span className="legend-alt">With this change</span><span className="legend-goal">Target</span>{result.uncertainty && <span>Alternative 10th-90th percentile</span>}</figcaption></figure>;
}

export default function DecisionWorkspace({ userId, token, calculators, onOpenFinancialProfile }) {
  const resultSection = useRef(null);
  const [tab, setTab] = useState("new"), [form, setForm] = useState(initial);
  const [currency, setCurrency] = useState("INR"), [stateId, setStateId] = useState("");
  const [states, setStates] = useState([]), [runs, setRuns] = useState([]), [run, setRun] = useState(null);
  const [loadingSources, setLoadingSources] = useState(true);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(null), [confirmDelete, setConfirmDelete] = useState(false);
  const [csv, setCsv] = useState(""), [source, setSource] = useState(""), [consent, setConsent] = useState(false);
  const [note, setNote] = useState(""), [choice, setChoice] = useState("considering");
  const api = useCallback(async (path, method = "GET", payload) => {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/users/${userId}/decisions${path}`, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(60000),
    });
    if (response.status === 204) return null;
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(Array.isArray(body?.detail) ? body.detail.map(e => `${e.loc.at(-1)}: ${e.msg}`).join("; ") : body?.detail || `Request failed (${response.status}).`);
    return body;
  }, [userId, token]);
  const reload = useCallback(async () => {
    const [nextStates, nextRuns] = await Promise.all([api("/states?limit=100"), api("/?limit=100")]);
    setStates(nextStates); setRuns(nextRuns);
    if (nextStates[0]?.data.currency) setCurrency(nextStates[0].data.currency);
  }, [api]);
  useEffect(() => { let live = true; reload().catch(e => live && setMessage({ error: true, text: e.message })).finally(() => live && setLoadingSources(false)); return () => { live = false; }; }, [reload]);
  useEffect(() => {
    if (run && tab === "new") {
      resultSection.current?.focus({ preventScroll: true });
      resultSection.current?.scrollIntoView({ block: "start" });
    }
  }, [run?.id, tab]);
  const perform = async action => {
    setBusy(true); setMessage(null);
    try { await action(); } catch (e) { setMessage({ error: true, text: e.message }); } finally { setBusy(false); }
  };
  const number = (name, label, min = 0, max = 1e12, step = "any") => <label>{label}<input required type="number" min={min} max={max} step={step} value={form[name]} onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))} /></label>;
  const create = event => {
    event.preventDefault(); perform(async () => {
      const state = stateId ? states.find(s => s.id === stateId) : await api("/states", "POST", { currency });
      const payload = { state_id: state.id, title: form.title, scenario: form.scenario, forecast: form.forecast };
      for (const key of ["months", "target_amount", "monthly_reduction", "uncertainty_pct", "seed", "samples"]) payload[key] = Number(form[key]);
      if (["job_switch", "higher_studies"].includes(form.scenario)) for (const key of ["target_monthly_income", "transition_cost", "gap_months"]) payload[key] = Number(form[key]);
      if (form.scenario === "lifestyle") for (const key of ["monthly_lifestyle_cost", "weekly_activity_hours"]) payload[key] = Number(form[key]);
      setRun(await api("/", "POST", payload)); setConfirmDelete(false); await reload();
    });
  };
  const openRun = id => perform(async () => { setRun(await api(`/${id}`)); setConfirmDelete(false); setTab("new"); setNote(""); });
  const result = run?.result;
  const startingState = stateId ? states.find(s => s.id === stateId) : states[0];
  const finance = startingState?.data.financial;
  return <div className="decision-workspace">
    <header className="decision-heading"><h2><GitCompareArrows size={20} /> Simulations</h2><button className="secondary-action compact" title="Refresh simulations" aria-label="Refresh simulations" onClick={() => perform(reload)} disabled={busy}><RefreshCw size={16} /></button></header>
    <div className="decision-tabs" role="tablist" aria-label="Simulation views">{[["new", "New simulation"], ["history", "Saved simulations"], ["calculators", "Calculators"], ["states", "Profile history"], ["data", "Expense data"]].map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</div>
    {message && <p role={message.error ? "alert" : "status"} className={`decision-message ${message.error ? "error" : ""}`}>{message.text}</p>}
    {tab === "new" && <>
      <section className="simulation-source" aria-label="Starting finances">
        <div className="decision-heading"><h3>Starting finances</h3><button className="secondary-action compact" onClick={onOpenFinancialProfile}>{finance ? "Financial profile" : "Add financial profile"}</button></div>
        {loadingSources ? <p role="status">Loading financial profile...</p> : finance ? <>
          <dl className="simulation-source-values">{[["Monthly income", finance.monthly_income], ["Monthly expenses", finance.monthly_expense], ["Available savings", finance.current_savings]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value, startingState.data.currency || currency)}</dd></div>)}</dl>
          <small>{stateId ? "Historical profile" : "Latest saved profile"} | {stamp(startingState.created_at)} | {startingState.data.currency || "Currency unconfirmed"}</small>
        </> : <p role="status">Financial profile required.</p>}
      </section>
      <form className="decision-form" onSubmit={create}>
        <h3>Scenario and goal</h3>
        <div className="decision-fields">
          <label>Scenario<select value={form.scenario} onChange={e => setForm(p => ({ ...p, scenario: e.target.value, title: labels[e.target.value] }))}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>Simulation name<input required maxLength={120} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></label>
          {number("months", "Projection months", 1, 120, 1)}{number("target_amount", "Savings target")}
        </div>
        <h3>Changes to your plan</h3>
        <div className="decision-fields">
          {number("monthly_reduction", "Monthly spending reduction")}
          {["job_switch", "higher_studies"].includes(form.scenario) && <>{number("target_monthly_income", "New monthly take-home income")}{number("transition_cost", "One-time transition / tuition cost")}{number("gap_months", "Months without income", 0, 60, 1)}</>}
          {form.scenario === "lifestyle" && <>{number("monthly_lifestyle_cost", "Monthly activity budget")}{number("weekly_activity_hours", "Planned activity hours / week", 0, 40)}</>}
        </div>
        <details className="decision-assumptions"><summary>Data and forecast settings</summary><div className="decision-fields">
          <label>Starting state<select value={stateId} onChange={e => { setStateId(e.target.value); const selected = states.find(s => s.id === e.target.value); if (selected?.data.currency) setCurrency(selected.data.currency); }}><option value="">Latest saved profile</option>{states.map(s => <option key={s.id} value={s.id} disabled={!s.data.currency}>{stamp(s.created_at)} - {s.source}{!s.data.currency ? " (currency unconfirmed)" : ""}</option>)}</select></label>
          <label>Currency<select value={currency} disabled={Boolean(stateId)} onChange={e => setCurrency(e.target.value)}>{["INR", "USD", "EUR", "GBP"].map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Expense forecast<select value={form.forecast} onChange={e => setForm(p => ({ ...p, forecast: e.target.value }))}><option value="auto">Evaluate from history</option><option value="profile">Saved profile assumption</option></select></label>
        </div></details>
        <details className="decision-assumptions"><summary>Uncertainty assumptions</summary><div className="decision-fields">{number("uncertainty_pct", "Expense variation (%)", 0, 50)}{number("samples", "Simulation paths", 100, 5000, 1)}{number("seed", "Random seed", 0, 4294967295, 1)}</div></details>
        <button className="primary-action compact" disabled={busy || loadingSources || !finance}><Play size={16} />{busy ? "Running..." : "Run simulation"}</button>
      </form>
      {result && <section ref={resultSection} tabIndex={-1} className="decision-result" aria-label="Simulation result">
        <div className="decision-heading"><div><h2>{run.title}</h2><small>{stamp(run.created_at)} | {result.currency} | {result.forecast.method.replaceAll("_", " ")}</small></div><button className="secondary-action compact" title="Export saved decision" aria-label="Export saved decision" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(run, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = `decision-${run.id}.json`; a.click(); URL.revokeObjectURL(url); }}><Download size={16} /></button></div>
        <p className="simulation-result-context">{result.trajectory[0].period_end} to {result.trajectory.at(-1).period_end} | Savings target: {money(result.target_amount, result.currency)}</p>
        <div className="decision-totals">{[["Keep current plan", result.baseline.final_savings], ["With this change", result.alternative.final_savings], ["Savings difference", result.difference]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{money(value, result.currency)}</strong></div>)}</div>
        <ProjectionChart result={result} />
        {result.uncertainty && <p className="decision-message">Conditional goal attainment: baseline {(result.uncertainty.baseline.goal_probability * 100).toFixed(1)}%, alternative {(result.uncertainty.alternative.goal_probability * 100).toFixed(1)}%.</p>}
        <div className="decision-explanation"><h3>What changes the outcome</h3><div className="decision-table-wrap"><table><thead><tr><th>Factor</th><th>Cash difference</th></tr></thead><tbody>{result.contributions.map(c => <tr key={c.factor}><td>{c.factor}</td><td>{money(c.amount, result.currency)}</td></tr>)}</tbody></table></div>
          <h3>Monthly saving needed</h3><p>{result.counterfactual.feasible ? `Reducing monthly spending by ${money(result.counterfactual.monthly_reduction, result.currency)} produces ${money(result.counterfactual.result, result.currency)} from the current plan.` : result.counterfactual.reason}</p><small>{result.counterfactual.reason}</small>
          <h3>Recommendations</h3>{result.recommendations.map(item => <div className="decision-recommendation" key={item.action}><Check size={16} /><div><strong>{item.action}</strong><p>{item.reason}</p></div></div>)}
        </div>
        <details><summary>Forecast evaluation and attribution</summary><p>{result.forecast.reason}</p>{result.forecast.evaluation && <p>Rolling validation MAE: model {money(result.forecast.evaluation.model_mae, result.currency)}, baseline {money(result.forecast.evaluation.baseline_mae, result.currency)}. Promotion threshold: more than 5% improvement.</p>}{result.forecast.attribution.map(a => <p key={a.feature}>{a.feature}: {money(a.contribution, result.currency)}</p>)}<small>Engine: {result.engine_version} | Forecast: {result.forecast.version} | History: {result.forecast.history_months} months</small></details>
        <details><summary>Monthly projection</summary><div className="decision-table-wrap"><table><thead><tr><th>Period end</th><th>Keep current plan</th><th>With this change</th><th>Expense forecast</th></tr></thead><tbody>{result.trajectory.map(p => <tr key={p.month}><td>{p.period_end}</td><td>{money(p.baseline, result.currency)}</td><td>{money(p.alternative, result.currency)}</td><td>{money(p.expense_forecast, result.currency)}</td></tr>)}</tbody></table></div></details>
        <details><summary>Saved assumptions and limitations</summary><pre>{JSON.stringify(run.request, null, 2)}</pre>{result.warnings.map(w => <p key={w}>{w}</p>)}</details>
        <form className="decision-feedback" onSubmit={e => { e.preventDefault(); perform(async () => { setRun(await api(`/${run.id}/feedback`, "POST", { choice, note })); setMessage({ text: "Feedback saved." }); }); }}><h3>Your decision</h3><div className="decision-fields"><label>Response<select value={choice} onChange={e => setChoice(e.target.value)}><option value="considering">Considering</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option></select></label><label>Note<input maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label></div><button className="secondary-action compact" disabled={busy}><Check size={16} />Save feedback</button></form>
        <DecisionOutcomes run={run} busy={busy} onSave={payload => perform(async () => { setRun(await api(`/${run.id}/outcomes`, "POST", payload)); setMessage({ text: "Outcome saved." }); })} />
        {run.events.length > 0 && <div className="decision-events"><h3>Feedback and outcomes</h3>{run.events.map(e => <p key={e.id}><small>{stamp(e.created_at)}</small> {e.kind === "feedback" ? `${e.data.choice}: ${e.data.note}` : `${e.data.observed_on}: ${money(e.data.savings, result.currency)}; forecast difference ${money(e.data.error, result.currency)}`}</p>)}</div>}
        <div className="decision-delete">{confirmDelete ? <><span>Delete this decision and its feedback?</span><button disabled={busy} className="secondary-action compact" onClick={() => perform(async () => { await api(`/${run.id}`, "DELETE"); setRun(null); setConfirmDelete(false); await reload(); })}>Delete</button><button className="secondary-action compact" onClick={() => setConfirmDelete(false)}>Cancel</button></> : <button className="secondary-action compact" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />Delete decision</button>}</div>
      </section>}
    </>}
    {tab === "history" && <section><h3>Saved simulations</h3>{!runs.length ? <p className="decision-empty">No saved simulations.</p> : <div className="decision-table-wrap"><table><thead><tr><th>Simulation</th><th>Created</th><th>Keep current plan</th><th>With this change</th></tr></thead><tbody>{runs.map(r => <tr key={r.id}><td><button className="decision-link" disabled={busy} onClick={() => openRun(r.id)}>{r.title}</button><small>{labels[r.scenario]}</small></td><td>{stamp(r.created_at)}</td><td>{money(r.baseline.final_savings, r.currency)}</td><td>{money(r.alternative.final_savings, r.currency)}</td></tr>)}</tbody></table></div>}<small>Latest 100 simulations.</small></section>}
    {tab === "calculators" && calculators}
    {tab === "states" && <section><h3>Profile history</h3>{!states.length ? <p className="decision-empty">No historical states yet.</p> : states.map(s => <details key={s.id}><summary>{stamp(s.created_at)} | {s.source} | {s.data.currency || "Currency unconfirmed"}</summary><pre>{JSON.stringify(s.data, null, 2)}</pre><button className="secondary-action compact" disabled={!s.data.currency} onClick={() => { setStateId(s.id); setCurrency(s.data.currency); setTab("new"); }}><History size={16} />Use this state</button></details>)}<small>Latest 100 states.</small></section>}
    {tab === "data" && <section><h3>Monthly expense data</h3><form onSubmit={e => { e.preventDefault(); perform(async () => { await api("/history", "POST", { csv_text: csv, source_name: source, consent, currency }); await reload(); setMessage({ text: "Monthly history imported into a new twin state." }); }); }}>
      <div className="decision-fields"><label>CSV: month,income,expense<input required type="file" accept=".csv,text/csv" onChange={e => { const file = e.target.files[0]; if (file) perform(async () => { if (file.size > 100000) throw new Error("CSV must be smaller than 100 KB."); setCsv(await file.text()); setSource(file.name); }); }} /></label><label>Data source<input required maxLength={120} value={source} onChange={e => setSource(e.target.value)} /></label><label>Currency<select value={currency} onChange={e => setCurrency(e.target.value)}>{["INR", "USD", "EUR", "GBP"].map(c => <option key={c}>{c}</option>)}</select></label></div><label className="decision-checkbox"><input required type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I have permission to use these monthly records.</label><button disabled={busy || !csv || !consent} className="primary-action compact"><Upload size={16} />Import history</button>
      </form>{states[0]?.data.monthly_history?.length > 0 && <div className="decision-table-wrap"><table><thead><tr><th>Month</th><th>Income</th><th>Expense</th></tr></thead><tbody>{states[0].data.monthly_history.map(m => <tr key={m.month}><td>{m.month}</td><td>{money(m.income, states[0].data.currency)}</td><td>{money(m.expense, states[0].data.currency)}</td></tr>)}</tbody></table></div>}</section>}
  </div>;
}
