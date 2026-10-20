import React, { useEffect, useRef } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { DataKind, Progress, ValueRow } from "./TwinPanels";
import { amount, dateLabel, known, percent, sourceLabel } from "./format";
import Projection from "./Projection";

const titles = {
  financial: "Financial twin",
  career: "Career twin",
  skills: "Skills twin",
  goals: "Goals twin",
  health: "Health twin",
  decisions: "Decision intelligence",
};

export default function TwinDetails({
  module,
  data,
  decision,
  detail,
  branch,
  onClose,
  onProfile,
  onSimulations,
}) {
  const dialog = useRef();
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => {
      if (element.open) element.close();
    };
  }, []);
  const finance = data?.financial,
    career = data?.career,
    health = data?.health;
  const money = (value) =>
    amount(value, finance?.currency, finance?.mixed_currency);
  const profileButton = (domain, label = "Open profile") => (
    <button className="dt-button dt-primary" onClick={() => onProfile(domain)}>
      {label}
      <ArrowUpRight size={16} />
    </button>
  );
  const result = detail.data?.result;
  return (
    <dialog
      className="dt-dialog"
      ref={dialog}
      onClose={onClose}
      aria-labelledby="twin-detail-title"
      onClick={(event) => {
        if (event.target === dialog.current) dialog.current.close();
      }}
    >
      <div className="dt-dialog-inner">
        <header>
          <div>
            <span className="dt-eyebrow">A CLOSER LOOK</span>
            <h2 id="twin-detail-title">{titles[module]}</h2>
          </div>
          <button
            className="dt-icon-button"
            aria-label="Close details"
            onClick={() => dialog.current.close()}
            autoFocus
          >
            <X size={20} />
          </button>
        </header>
        {module === "financial" && (
          <>
            <DataKind>
              {finance ? sourceLabel(finance.source) : "No financial profile"}
            </DataKind>
            <div className="dt-detail-metrics">
              <ValueRow label={finance?.balance_label || "Total cash balance"}>
                {money(finance?.current_savings)}
              </ValueRow>
              <ValueRow label="Monthly income">
                {money(finance?.monthly_income)}
              </ValueRow>
              <ValueRow label="Monthly expenses">
                {money(finance?.monthly_expense)}
              </ValueRow>
              <ValueRow label="Investments">
                {money(finance?.investments)}
              </ValueRow>
              <ValueRow label="Debts">{money(finance?.debts)}</ValueRow>
              <ValueRow label="Savings rate · calculated">
                {percent(finance?.savings_rate)}
              </ValueRow>
              <ValueRow label="Financial risk classification">
                Not available
              </ValueRow>
            </div>
            {finance && (
              <p className="dt-muted">{finance.savings_rate_basis}</p>
            )}
            {finance?.mixed_currency ? (
              <p className="dt-callout">
                Your wallet contains multiple currencies. Combined balances and
                savings rates are hidden because currency conversion is not
                supported.
              </p>
            ) : finance && !finance.currency ? (
              <p className="dt-callout">
                Currency is unconfirmed. Confirm it in Simulations before
                treating these amounts as INR.
              </p>
            ) : null}
            <p className="dt-muted">
              {finance?.risk_note ||
                "Add a financial profile or connect Persona Wallet to load your finances."}
            </p>
            {finance?.wallet_synced_at && (
              <p className="dt-muted">
                Wallet snapshot: {dateLabel(finance.wallet_synced_at, true)}.
                Refreshing this page reads the last saved snapshot; connected
                Wallet sync runs separately.
              </p>
            )}
            <h3>
              Projected financial future{" "}
              <DataKind kind="projection">Saved projection</DataKind>
            </h3>
            {decision ? (
              <>
                <p>
                  {decision.title} · saved {dateLabel(decision.created_at)}
                </p>
                <ValueRow
                  label={`Current plan · ${dateLabel(decision.period_end)}`}
                >
                  {amount(decision.baseline_savings, decision.currency)}
                </ValueRow>
                <ValueRow label="With the proposed change">
                  {amount(decision.alternative_savings, decision.currency)}
                </ValueRow>
                <p className="dt-muted">
                  Uses that simulation's original inputs. Profile changes do not
                  recalculate it.
                </p>
              </>
            ) : (
              <p className="dt-muted">
                Save a simulation to see a financial projection with its
                assumptions.
              </p>
            )}
            <div className="dt-detail-actions">
              {profileButton("financial", "Manage finances")}
              <button className="dt-button" onClick={() => onSimulations()}>
                Run a simulation
              </button>
            </div>
          </>
        )}
        {module === "career" && (
          <>
            <DataKind>Saved profile</DataKind>
            <ValueRow label="Current direction">
              {career?.current_role || "Not available"}
            </ValueRow>
            <ValueRow label="Target role">
              {career?.dream_role || "Not available"}
            </ValueRow>
            <ValueRow label="Career goal">
              {data?.person?.career_goal || "Not available"}
            </ValueRow>
            <ValueRow label="Experience">
              {known(career?.years_of_experience)
                ? `${career.years_of_experience} years`
                : "Not available"}
            </ValueRow>
            <ValueRow label="Expected salary · user-entered">
              {amount(career?.expected_salary)}
            </ValueRow>
            <p className="dt-muted">
              {career?.prediction_note ||
                "Salary and opportunity prediction models are not connected."}
            </p>
            <ValueRow label="Salary prediction">Not available</ValueRow>
            <ValueRow label="Predicted opportunities">Not available</ValueRow>
            <h3>
              Career readiness <DataKind kind="heuristic">Heuristic</DataKind>
            </h3>
            <Progress
              value={career?.readiness?.value}
              label="Existing career profile score"
            />
            <p className="dt-muted">
              {career?.readiness?.basis ||
                "Add a career profile to see its descriptive score."}
            </p>
            <h3>Improvement areas</h3>
            <p className="dt-muted">
              Personalized improvement recommendations are not available from
              the current backend. Add your target role and skills to prepare
              for a future analysis.
            </p>
            {profileButton("career", "Manage career")}
          </>
        )}
        {module === "skills" && (
          <>
            <DataKind>Saved profile</DataKind>
            <h3>Existing technical skills</h3>
            <div className="dt-skill-tags">
              {data?.skills?.existing?.length ? (
                data.skills.existing.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))
              ) : (
                <p>No skills have been saved yet.</p>
              )}
            </div>
            <ValueRow label="Skill-gap analysis">Not available</ValueRow>
            <ValueRow label="Career skill alignment">Not available</ValueRow>
            <ValueRow label="Suggested learning priorities">
              Not available
            </ValueRow>
            <p className="dt-muted">
              {data?.skills?.note ||
                "Add technical skills or sync your GitHub profile."}
            </p>
            {profileButton("career", "Manage skills / GitHub sync")}
          </>
        )}
        {module === "goals" && (
          <>
            <h3>
              Personal direction <DataKind>Saved profile</DataKind>
            </h3>
            <ValueRow label="Career goal">
              {data?.person?.career_goal || "Not available"}
            </ValueRow>
            <ValueRow label="Dream role">
              {career?.dream_role || "Not available"}
            </ValueRow>
            <ValueRow label="Dream country">
              {data?.person?.dream_country || "Not available"}
            </ValueRow>
            <h3>Financial goals</h3>
            {data?.goals?.financial?.length ? (
              data.goals.financial.map((goal) => (
                <article className="dt-goal-detail" key={goal.id}>
                  <h4>{goal.title}</h4>
                  <ValueRow label="Saved target">
                    {amount(goal.target_amount, goal.currency)}
                  </ValueRow>
                  <Progress
                    value={goal.progress_pct}
                    label="Current savings / target"
                  />
                  <p className="dt-muted">{goal.progress_basis}</p>
                  <ValueRow label="Projected goal achievement">
                    {typeof goal.goal_met === "boolean"
                      ? goal.goal_met
                        ? "Reached in saved scenario"
                        : "Below target in saved scenario"
                      : "Not available"}
                  </ValueRow>
                  <p className="dt-muted">
                    Projection through {dateLabel(goal.period_end)}, saved{" "}
                    {dateLabel(goal.created_at)}. Based on the original
                    assumptions.
                  </p>
                  <button
                    className="dt-button"
                    onClick={() => onSimulations(goal.id)}
                  >
                    Open this simulation <ArrowUpRight size={16} />
                  </button>
                </article>
              ))
            ) : (
              <p className="dt-muted">
                No savings targets yet. Save a savings goal in Simulations.
              </p>
            )}
            <p className="dt-muted">
              {data?.goals?.note ||
                "Milestone progress and personal goal predictions are not available yet."}
            </p>
            <div className="dt-detail-actions">
              {profileButton("identity", "Edit personal goals")}
              <button className="dt-button" onClick={() => onSimulations()}>
                Create savings simulation
              </button>
            </div>
          </>
        )}
        {module === "health" && (
          <>
            <DataKind>Self-reported</DataKind>
            {[
              ["Height", "height", "cm"],
              ["Weight", "weight", "kg"],
              ["Sleep per night", "sleep_hours", "hours"],
              ["Exercise frequency", "exercise_days", "days / week"],
            ].map(([label, key, unit]) => (
              <ValueRow key={key} label={label}>
                {known(health?.[key])
                  ? `${health[key]} ${unit}`
                  : "Not available"}
              </ValueRow>
            ))}
            <h3>Available insights</h3>
            <p className="dt-muted">
              This view shows the health indicators entered in your profile.
              Live wearable measurements, medical assessments and predicted
              health outcomes are not connected.
            </p>
            {profileButton("health", "Manage health profile")}
          </>
        )}
        {module === "decisions" && (
          <>
            {decision ? (
              <>
                <DataKind kind="projection">Saved projection</DataKind>
                <h3>{decision.title}</h3>
                <p className="dt-muted">
                  Saved {dateLabel(decision.created_at, true)} ·{" "}
                  {decision.months} full future months · {decision.currency}
                </p>
                <ValueRow label="Current plan">
                  {amount(decision.baseline_savings, decision.currency)}
                </ValueRow>
                <ValueRow label="Proposed change">
                  {amount(decision.alternative_savings, decision.currency)}
                </ValueRow>
                <ValueRow label="Difference in projected savings">
                  {amount(decision.difference, decision.currency)}
                </ValueRow>
                {detail.error ? (
                  <p role="alert">
                    {detail.error}{" "}
                    <button className="dt-button" onClick={detail.retry}>
                      Retry simulation
                    </button>
                  </p>
                ) : !result ? (
                  <p role="status">Loading saved explanation…</p>
                ) : (
                  <>
                    <Projection result={result} branch={branch} />
                    <h3>Why the outcome changes</h3>
                    {result.contributions
                      ?.filter((item) => item.amount !== 0)
                      .map((item) => (
                        <ValueRow key={item.factor} label={item.factor}>
                          {amount(item.amount, result.currency)}
                        </ValueRow>
                      ))}
                    <p className="dt-muted">
                      Expense forecast:{" "}
                      {result.forecast?.method?.replaceAll("_", " ") ||
                        "Not available"}
                      . These are the engine's saved factors, not newly
                      generated reasoning.
                    </p>
                    {result.recommendations?.map((item, i) => (
                      <div className="dt-explanation" key={i}>
                        <strong>{item.action}</strong>
                        <p>{item.reason}</p>
                      </div>
                    ))}
                    <details className="dt-assumptions">
                      <summary>Saved assumptions and limitations</summary>
                      <ul>
                        {result.warnings?.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </details>
                  </>
                )}
                <button
                  className="dt-button dt-primary"
                  onClick={() => onSimulations(decision.id)}
                >
                  Open full simulation <ArrowUpRight size={16} />
                </button>
              </>
            ) : (
              <>
                <p className="dt-muted">
                  No saved simulations yet. Compare a financial, career or
                  lifestyle decision to explore a possible future.
                </p>
                <button
                  className="dt-button dt-primary"
                  onClick={() => onSimulations()}
                >
                  Run your first simulation
                </button>
              </>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
