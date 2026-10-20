import React, { useId } from "react";
import { amount, known } from "../format";

export default function FinanceForecast({ rows, field, currency, title }) {
  const id = useId();
  const values = rows?.map((row) => row[field]) || [];
  if (!values.length || values.some((value) => !known(value)))
    return (
      <p className="fi-muted">
        A forecast will appear when a financial profile and currency are
        available.
      </p>
    );
  const min = Math.min(0, ...values),
    max = Math.max(1, ...values),
    span = max - min;
  const x = (i) => 12 + (i / Math.max(values.length - 1, 1)) * 416;
  const y = (value) => 100 - ((value - min) / span) * 80;
  const path = values
    .map((value, i) => `${i ? "L" : "M"}${x(i)},${y(value)}`)
    .join(" ");
  return (
    <figure className="fi-chart">
      <svg viewBox="0 0 440 128" role="img" aria-labelledby={id}>
        <title id={id}>{title}. Exact monthly values follow the chart.</title>
        {[25, 62, 100].map((py) => (
          <line
            key={py}
            x1="12"
            x2="428"
            y1={py}
            y2={py}
            stroke="#203c4b"
            strokeDasharray="3 6"
          />
        ))}
        <path d={`${path} L428,108 L12,108 Z`} fill="#50d8de12" />
        <path
          d={path}
          fill="none"
          stroke={field === "expense" ? "#aaabff" : "#66e7da"}
          strokeWidth="2.5"
        />
        <text x="12" y="123">
          {rows[0].month}
        </text>
        <text x="428" y="123" textAnchor="end">
          {rows.at(-1).month}
        </text>
      </svg>
      <details>
        <summary>Exact monthly values</summary>
        <div className="fi-table-scroll">
          <table>
            <caption>
              {title} · {currency}
            </caption>
            <thead>
              <tr>
                <th>Month</th>
                <th>{field === "savings" ? "Projected savings" : title}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.month}>
                  <th>{row.month}</th>
                  <td>{amount(row[field], currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
