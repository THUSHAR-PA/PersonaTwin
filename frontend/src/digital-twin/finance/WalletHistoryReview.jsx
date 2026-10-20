import React from "react";
import { Database, Wallet } from "lucide-react";
import { amount } from "../format";

export default function WalletHistoryReview({
  connected,
  busy,
  review,
  onLoad,
  onConnect,
}) {
  return (
    <div className="fi-wallet-history">
      <h3>
        <Wallet size={17} /> Use your Persona Wallet history
      </h3>
      <p className="fi-muted">
        Wallet balances do not automatically become training data. Fetch up to
        24 completed months, review the totals, then confirm the import in the
        form.
      </p>
      <button
        type="button"
        className="dt-button"
        disabled={busy}
        onClick={connected ? onLoad : onConnect}
      >
        <Database size={15} />
        {connected
          ? "Review Wallet monthly history"
          : "Connect Wallet to load history"}
      </button>
      {review && (
        <>
          <p className="fi-callout">
            Wallet returned {review.returned_months} completed months.{" "}
            {review.usable_months} recent consecutive months with recorded
            activity have been placed in the import form. Nothing has been saved
            yet.
          </p>
          <p className="fi-muted">{review.note}</p>
          {!!review.excluded_months?.length && (
            <p className="fi-muted">
              No recorded activity (excluded):{" "}
              {review.excluded_months.join(", ")}.
            </p>
          )}
          {review.usable_months < 24 && (
            <p className="fi-muted">
              The risk classifier still needs 24 eligible months and both
              outcome classes. Expense/income forecasts need 12; spending
              detection needs 13.
            </p>
          )}
          <details>
            <summary>Review returned monthly totals</summary>
            <div className="fi-table-scroll">
              <table>
                <caption>
                  Completed-month Wallet totals · {review.currency}
                </caption>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Income</th>
                    <th>Expenses</th>
                    <th>Activity recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {review.rows.map((row) => (
                    <tr key={row.month}>
                      <th>{row.month}</th>
                      <td>{amount(row.income, review.currency)}</td>
                      <td>{amount(row.expense, review.currency)}</td>
                      <td>{row.has_activity ? "Yes" : "No; excluded"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
