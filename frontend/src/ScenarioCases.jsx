import React from "react";

export default function ScenarioCases({ cases, currency }) {
  if (!cases?.length) return null;
  const money = value => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  return <section aria-label="Four simulation cases">
    <h3>Four simulation cases</h3>
    <p>Best and worst describe the selected expense assumptions, not guaranteed limits or probabilities. Both test the proposed alternative. Income stays fixed; job loss and other shocks are excluded. Cases can coincide when expenses or variation are zero.</p>
    <div className="decision-table-wrap chat-table-wrap"><table>
      <thead><tr><th>Case</th><th>Final savings</th><th>Lowest cash</th><th>Assumptions</th></tr></thead>
      <tbody>{cases.map(item => <tr key={item.id}><th scope="row">{item.label}</th><td>{money(item.final_savings)}</td><td>{money(item.minimum_cash)}</td><td>{item.assumption}</td></tr>)}</tbody>
    </table></div>
    <details><summary>Monthly balances for all four cases</summary><div className="decision-table-wrap chat-table-wrap"><table><thead><tr><th>Month</th>{cases.map(c => <th key={c.id}>{c.label}</th>)}</tr></thead><tbody>{cases[0].trajectory.map((_, i) => <tr key={i}><th scope="row">{i + 1}</th>{cases.map(c => <td key={c.id}>{money(c.trajectory[i])}</td>)}</tr>)}</tbody></table></div></details>
  </section>;
}
