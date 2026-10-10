import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";

const money = (value, currency) => value == null ? "Not available" : new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

export default function DecisionOutcomes({ run, busy, onSave }) {
  const [month, setMonth] = useState("");
  const [branch, setBranch] = useState("alternative");
  const [savings, setSavings] = useState("");
  const [note, setNote] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const completed = run.result.trajectory.filter(point => point.period_end <= today);
  const selected = completed.find(point => String(point.month) === month) || completed[0];
  const evaluation = run.outcome_evaluation;
  const previous = evaluation?.branches[branch]?.observations.find(point => point.month === selected?.month);
  useEffect(() => { setMonth(""); setBranch("alternative"); setSavings(""); setNote(""); }, [run.id]);

  return <div className="decision-outcomes">
    <h3>Observed savings</h3>
    {evaluation ? <>
      <div className="decision-table-wrap"><table aria-label="Observed savings summary">
        <thead><tr><th>Metric</th><th>Keep current plan</th><th>With this change</th></tr></thead>
        <tbody>{[["count", "Observed months"], ["mae", "Mean absolute error"], ["rmse", "Root mean square error"], ["mean_error", "Mean signed error"]].map(([key, label]) => <tr key={key}><th scope="row">{label}</th>{["baseline", "alternative"].map(strategy => <td key={strategy}>{key === "count" ? evaluation.branches[strategy][key] : money(evaluation.branches[strategy][key], evaluation.currency)}</td>)}</tr>)}</tbody>
      </table></div>
      {Object.entries(evaluation.branches).filter(([, data]) => data.count > 0).map(([key, data]) => <details key={key}><summary>{key === "baseline" ? "Baseline observations" : "Alternative observations"}</summary><div className="decision-table-wrap"><table aria-label={`${key} observed months`}><thead><tr><th>Period end</th><th>Observed</th><th>Projected</th><th>Difference</th></tr></thead><tbody>{data.observations.map(point => <tr key={point.month}><td>{point.period_end}</td><td>{money(point.actual_savings, evaluation.currency)}</td><td>{money(point.projected_savings, evaluation.currency)}</td><td>{money(point.error, evaluation.currency)}</td></tr>)}</tbody></table></div></details>)}
      <p>Self-reported savings. Differences include income, spending and behavior changes; they are not expense-model accuracy.</p>
    </> : <p>Outcome summary unavailable.</p>}
    <details><summary>Record an observed outcome</summary>
      {!selected ? <p role="status">No completed projection months yet.</p> : <form onSubmit={event => { event.preventDefault(); onSave({ month: selected.month, observed_on: selected.period_end, savings: Number(savings), branch, note }); }}>
        <div className="decision-fields">
          <label>Completed period<select value={String(selected.month)} disabled={busy} onChange={event => { setMonth(event.target.value); setSavings(""); setNote(""); }}>{completed.map(point => <option key={point.month} value={point.month}>{point.period_end}</option>)}</select></label>
          <label>Strategy<select value={branch} disabled={busy} onChange={event => { setBranch(event.target.value); setSavings(""); setNote(""); }}><option value="alternative">With this change</option><option value="baseline">Keep current plan</option></select></label>
          <label>Actual savings<input required disabled={busy} type="number" min={-1e12} max={1e12} step="any" value={savings} onChange={event => setSavings(event.target.value)} /></label>
          <label>Outcome note<input disabled={busy} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></label>
        </div>
        {previous && <p>Recorded savings: {money(previous.actual_savings, run.result.currency)}. A correction retains the earlier entry.</p>}
        <button disabled={busy} className="secondary-action compact"><Check size={16} />{previous ? "Save correction" : "Save outcome"}</button>
      </form>}
    </details>
  </div>;
}
