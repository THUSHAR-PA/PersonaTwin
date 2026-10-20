import React from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  HeartPulse,
  Layers3,
  Target,
  Wallet,
} from "lucide-react";
import { amount, known, percent, sourceLabel } from "./format";

export function DataKind({ children, kind = "saved" }) {
  return <span className={`dt-kind dt-kind-${kind}`}>{children}</span>;
}
export function ValueRow({ label, children }) {
  return (
    <div className="dt-value-row">
      <span>{label}</span>
      <strong>{children ?? "Not available"}</strong>
    </div>
  );
}
export function Progress({ value, label }) {
  return (
    <div className="dt-progress">
      <div>
        <span>{label}</span>
        <strong>{percent(value)}</strong>
      </div>
      {known(value) && (
        <progress
          max="100"
          value={Math.max(0, Math.min(100, value))}
          aria-label={label}
        />
      )}
    </div>
  );
}

function Panel({ id, index, title, Icon, children, active, onOpen, footer }) {
  return (
    <button
      type="button"
      className={`dt-holo-panel dt-panel-${id}${active ? " is-focused" : ""}`}
      aria-label={`Open ${title}`}
      aria-haspopup={id === "financial" ? undefined : "dialog"}
      onClick={() => onOpen(id)}
    >
      <span className="dt-panel-heading">
        <span className="dt-panel-icon">
          <Icon size={18} strokeWidth={1.5} />
        </span>
        <span>{title}</span>
        <span className="dt-panel-number">{index}</span>
      </span>
      <span className="dt-panel-body">{children}</span>
      <span className="dt-panel-footer">
        <span>{footer}</span>
        <ArrowUpRight size={15} />
      </span>
    </button>
  );
}

export default function TwinPanels({ data, loading, active, onOpen }) {
  const financial = data?.financial,
    career = data?.career,
    skills = data?.skills?.existing || [];
  const goals = data?.goals?.financial || [],
    goal = goals[0];
  const missing = loading && !data ? "Loading your data…" : "Not available";
  return (
    <>
      <div className="dt-panel-stack dt-left-stack">
        <Panel
          id="financial"
          index="01"
          title="Financial twin"
          Icon={Wallet}
          active={active === "financial"}
          onOpen={onOpen}
          footer={
            financial
              ? sourceLabel(financial.source)
              : "Build your financial picture"
          }
        >
          <span className="dt-small-label">
            {financial?.balance_label || "Total cash balance"}
          </span>
          <strong
            className={`dt-hero-value${!financial || financial.mixed_currency ? " is-empty" : ""}`}
          >
            {financial
              ? amount(
                  financial.current_savings,
                  financial.currency,
                  financial.mixed_currency,
                )
              : missing}
          </strong>
          {financial && !financial.currency && (
            <span className="dt-data-note">Currency unconfirmed</span>
          )}
          <span className="dt-mini-grid">
            <span>
              <span>Monthly income</span>
              <strong>
                {financial
                  ? amount(
                      financial.monthly_income,
                      financial.currency,
                      financial.mixed_currency,
                    )
                  : "—"}
              </strong>
            </span>
            <span>
              <span>Monthly expenses</span>
              <strong>
                {financial
                  ? amount(
                      financial.monthly_expense,
                      financial.currency,
                      financial.mixed_currency,
                    )
                  : "—"}
              </strong>
            </span>
          </span>
          <span className="dt-inline-stat">
            <span>
              Savings rate <DataKind kind="calculated">Calculated</DataKind>
            </span>
            <strong>{percent(financial?.savings_rate)}</strong>
          </span>
        </Panel>
        <Panel
          id="goals"
          index="02"
          title="Goals twin"
          Icon={Target}
          active={active === "goals"}
          onOpen={onOpen}
          footer={
            goal ? "Explore saved targets" : "Give your future a direction"
          }
        >
          <span className="dt-small-label">
            {goal ? "Latest savings target" : "Your career goal"}
          </span>
          <strong className="dt-feature-text">
            {goal?.title || data?.person?.career_goal || missing}
          </strong>
          {goal ? (
            <>
              <span className="dt-goal-amount">
                {amount(goal.target_amount, goal.currency)}
              </span>
              <Progress value={goal.progress_pct} label="Savings / target" />
              <span className="dt-data-note">
                Calculated · savings not allocated
              </span>
            </>
          ) : (
            <p className="dt-panel-copy">
              {data?.person?.career_goal
                ? "A direction saved in your profile. Add a savings simulation to explore a financial goal."
                : "Add your career goal or save a savings simulation to bring this view to life."}
            </p>
          )}
        </Panel>
      </div>
      <div className="dt-panel-stack dt-right-stack">
        <Panel
          id="career"
          index="03"
          title="Career twin"
          Icon={BriefcaseBusiness}
          active={active === "career"}
          onOpen={onOpen}
          footer={
            career ? "Explore your career profile" : "Add your career profile"
          }
        >
          <span className="dt-small-label">Current direction</span>
          <strong className="dt-feature-text">
            {career?.current_role || missing}
          </strong>
          <span className="dt-direction">
            <ArrowUpRight size={14} />
            <span>
              {career?.dream_role ||
                data?.person?.career_goal ||
                "Target role not added"}
            </span>
          </span>
          <Progress
            value={career?.readiness?.value}
            label="Career profile score"
          />
          <span className="dt-data-note">
            Existing heuristic · not a prediction
          </span>
        </Panel>
        <Panel
          id="skills"
          index="04"
          title="Skills twin"
          Icon={Layers3}
          active={active === "skills"}
          onOpen={onOpen}
          footer={
            skills.length
              ? `${skills.length} saved skill${skills.length === 1 ? "" : "s"}`
              : "Discover your skill profile"
          }
        >
          <span className="dt-small-label">Your skill constellation</span>
          {skills.length ? (
            <span className="dt-skill-tags">
              {skills.slice(0, 6).map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
              {skills.length > 6 && <span>+{skills.length - 6}</span>}
            </span>
          ) : (
            <p className="dt-panel-copy">
              {loading && !data
                ? missing
                : "Add technical skills to your profile or sync them from GitHub."}
            </p>
          )}
          <span className="dt-inline-stat dt-alignment">
            <span>Role alignment</span>
            <span className="dt-muted">Not available</span>
          </span>
        </Panel>
      </div>
    </>
  );
}

export function HealthPanel({ health, onOpen, active, loading }) {
  return (
    <button
      type="button"
      className={`dt-health-panel${active ? " is-focused" : ""}`}
      onClick={() => onOpen("health")}
      aria-label="Open Health twin"
      aria-haspopup="dialog"
    >
      <span className="dt-bottom-heading">
        <HeartPulse size={20} strokeWidth={1.5} />
        <strong>Health twin</strong>
        <DataKind>Self-reported</DataKind>
        <ArrowUpRight size={15} />
      </span>
      {health ? (
        <span className="dt-health-values">
          <span>
            <strong>
              {known(health.sleep_hours) ? health.sleep_hours : "—"}
              <small> h</small>
            </strong>
            <span>Sleep per night</span>
          </span>
          <span>
            <strong>
              {known(health.exercise_days) ? health.exercise_days : "—"}
              <small> / 7</small>
            </strong>
            <span>Exercise days</span>
          </span>
        </span>
      ) : (
        <span className="dt-panel-copy">
          {loading
            ? "Loading your health profile…"
            : "No health profile yet. Add sleep and activity to complete your picture."}
        </span>
      )}
      <span className="dt-data-note">
        Wearable data and health predictions unavailable
      </span>
    </button>
  );
}
