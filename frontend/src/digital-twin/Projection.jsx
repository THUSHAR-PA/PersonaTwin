import React, { useId } from "react";
import { amount, dateLabel, known } from "./format";

/** Exact saved trajectory, never an illustrative curve or a new prediction. */
export default function Projection({ result, branch = "alternative" }) {
  const id = useId().replaceAll(":", "");
  const rows =
    result?.trajectory?.filter(
      (row) => known(row.baseline) && known(row.alternative),
    ) || [];
  if (!rows.length)
    return <p className="dt-muted">No saved projection is available.</p>;
  const values = rows.flatMap((row) => [row.baseline, row.alternative]);
  const low = Math.min(...values, 0),
    high = Math.max(...values, 1),
    range = high - low || 1;
  const x = (i) => 16 + (rows.length === 1 ? 0.5 : i / (rows.length - 1)) * 448;
  const y = (v) => 111 - ((v - low) / range) * 92;
  const path = (key) =>
    rows.map((row, i) => `${i ? "L" : "M"}${x(i)},${y(row[key])}`).join(" ");
  return (
    <figure className="dt-projection">
      <svg viewBox="0 0 480 142" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>
          Saved savings projection: current plan and proposed change. Exact
          amounts are in the table below.
        </title>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#54e7ed" stopOpacity=".22" />
            <stop offset="1" stopColor="#54e7ed" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[26, 68, 110].map((py) => (
          <line
            key={py}
            x1="16"
            x2="464"
            y1={py}
            y2={py}
            stroke="#244353"
            strokeDasharray="3 6"
          />
        ))}
        <path
          d={`${path(branch)} L${x(rows.length - 1)},115 L${x(0)},115 Z`}
          fill={`url(#${id})`}
        />
        <path
          d={path("baseline")}
          fill="none"
          stroke="#8f9cba"
          strokeWidth={branch === "baseline" ? 3 : 1.5}
          strokeDasharray="5 5"
        />
        <path
          d={path("alternative")}
          fill="none"
          stroke="#5ae9ec"
          strokeWidth={branch === "alternative" ? 3 : 1.5}
        />
        {rows.length === 1 &&
          ["baseline", "alternative"].map((key) => (
            <circle
              key={key}
              cx={x(0)}
              cy={y(rows[0][key])}
              r="3"
              fill={key === "baseline" ? "#8f9cba" : "#5ae9ec"}
            />
          ))}
        <text x="16" y="136">
          {rows[0].period_end?.slice(0, 7)}
        </text>
        <text x="464" y="136" textAnchor="end">
          {rows.at(-1).period_end?.slice(0, 7)}
        </text>
      </svg>
      <figcaption>
        <span>Current plan</span>
        <span>Proposed change</span>
        <small>{result.currency} · saved projection</small>
      </figcaption>
      <details className="dt-chart-table">
        <summary>Exact monthly values</summary>
        <div className="dt-table-scroll">
          <table>
            <caption>Saved projected savings</caption>
            <thead>
              <tr>
                <th>Month end</th>
                <th>Current plan</th>
                <th>Proposed change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.month}>
                  <th>{dateLabel(row.period_end)}</th>
                  <td>{amount(row.baseline, result.currency)}</td>
                  <td>{amount(row.alternative, result.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
