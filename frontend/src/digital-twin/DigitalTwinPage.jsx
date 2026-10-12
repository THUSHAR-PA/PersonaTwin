import React, { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BriefcaseBusiness,
  CircleAlert,
  Cpu,
  HeartPulse,
  Layers3,
  Orbit,
  RefreshCw,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import SceneViewport from "./SceneViewport";
import TwinPanels, { DataKind, HealthPanel } from "./TwinPanels";
import TwinDetails from "./TwinDetails";
import { useDecisionDetail, useTwinDashboard } from "./useTwinDashboard";
import { amount, dateLabel, known } from "./format";
import "./digital-twin.css";

const views = [
  ["all", "All systems", Orbit, "#4ce1ff"],
  ["financial", "Finance", Wallet, "#45efda"],
  ["career", "Career", BriefcaseBusiness, "#68b5ff"],
  ["skills", "Skills", Layers3, "#a9a3ff"],
  ["goals", "Goals", Target, "#8fbbff"],
  ["health", "Health", HeartPulse, "#61e8c1"],
];

export default function DigitalTwinPage({
  userId,
  token,
  name,
  walletRevision,
  onOpenProfile,
  onOpenSimulations,
  onSignIn,
}) {
  const { data, loading, error, refresh } = useTwinDashboard(
    userId,
    token,
    walletRevision,
  );
  const [view, setView] = useState("all"),
    [expanded, setExpanded] = useState(null);
  const [selectedId, setSelectedId] = useState(""),
    [branch, setBranch] = useState("baseline");
  const decision =
    data?.decisions?.find((item) => item.id === selectedId) ||
    data?.decisions?.[0];
  const detail = useDecisionDetail(userId, token, decision?.id);
  const selectedView = views.find((item) => item[0] === view);
  const profileCount = Object.values(data?.profiles_present || {}).filter(
    Boolean,
  ).length;
  const projectedValue =
    decision?.[
      branch === "baseline" ? "baseline_savings" : "alternative_savings"
    ];
  const open = (module) => {
    setExpanded(module);
    if (module !== "decisions") setView(module);
  };
  return (
    <div className="digital-twin">
      <header className="dt-header">
        <div>
          <span className="dt-eyebrow">
            <span /> PERSONA INTELLIGENCE
          </span>
          <h1>
            Digital Twin<span className="dt-title-dot">.</span>
          </h1>
          <p>Your life, connected. Your future, in perspective.</p>
        </div>
        <div className="dt-header-actions">
          <span className={`dt-status-chip${error ? " is-stale" : ""}`}>
            <span className="dt-dot" />
            {loading
              ? "Reading profiles"
              : error
                ? data
                  ? "Last saved view"
                  : "Connection unavailable"
                : "Profile data loaded"}
          </span>
          <button
            className="dt-icon-button"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh digital twin"
            title="Read latest profile data"
          >
            <RefreshCw size={17} className={loading ? "dt-spin" : ""} />
          </button>
          <button
            className="dt-button dt-primary"
            onClick={() => onOpenSimulations()}
          >
            <Sparkles size={16} />
            Explore a decision
            <ArrowUpRight size={15} />
          </button>
        </div>
      </header>
      {error && (
        <div className="dt-error" role="alert">
          <CircleAlert size={18} />
          <span>
            {error.message}
            {data
              ? ` Showing data read ${dateLabel(data.refreshed_at, true)}.`
              : ""}
          </span>
          <button
            className="dt-button"
            onClick={error.unauthorized ? onSignIn : refresh}
            disabled={loading}
          >
            {error.unauthorized ? "Sign in again" : "Try again"}
          </button>
        </div>
      )}
      <div className="dt-view-bar">
        <div className="dt-view-switcher" role="group" aria-label="Twin views">
          {views.map(([id, label, Icon]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
        <span className="dt-view-hint">
          <span className="dt-dot" />
          {data
            ? `${profileCount} / 3 profiles saved`
            : "Connecting your profile"}
        </span>
      </div>
      <section
        className={`dt-stage dt-focus-${view}`}
        aria-label="Your digital twin overview"
        aria-busy={loading && !data}
      >
        <div className="dt-stage-grid" aria-hidden="true" />
        <svg
          className="dt-connectors"
          viewBox="0 0 1000 660"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="twin-link">
              <stop stopColor="#2b8da6" stopOpacity=".08" />
              <stop offset=".5" stopColor="#58dfff" stopOpacity=".65" />
              <stop offset="1" stopColor="#2b8da6" stopOpacity=".08" />
            </linearGradient>
          </defs>
          {[
            "M235 173 H300 L352 231 H448",
            "M235 442 H310 L369 395 H459",
            "M765 174 H700 L650 231 H552",
            "M765 442 H688 L635 360 H545",
          ].map((path) => (
            <path
              key={path}
              d={path}
              fill="none"
              stroke="url(#twin-link)"
              strokeWidth="1"
            />
          ))}
          {[
            [448, 231],
            [459, 395],
            [552, 231],
            [545, 360],
          ].map(([cx, cy]) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r="3"
              fill="#66e8ff"
              fillOpacity=".65"
            />
          ))}
        </svg>
        <TwinPanels data={data} loading={loading} active={view} onOpen={open} />
        <SceneViewport
          accent={
            branch === "alternative" && decision ? "#a6a5ff" : selectedView[3]
          }
          name={data?.person?.full_name || name}
          viewLabel={selectedView[1]}
        />
        {view !== "all" && (
          <div className="dt-view-focus">
            <span>{selectedView[1]} view</span>
            <button onClick={() => open(view)}>
              Explore details <ArrowUpRight size={14} />
            </button>
          </div>
        )}
      </section>
      <section
        className="dt-bottom-grid"
        aria-label="Health and decision intelligence"
      >
        <HealthPanel
          health={data?.health}
          active={view === "health"}
          loading={loading && !data}
          onOpen={open}
        />
        <article className="dt-decision-panel">
          <div className="dt-bottom-heading">
            <Cpu size={20} strokeWidth={1.5} />
            <h2>Decision intelligence</h2>
            <DataKind kind="projection">Saved scenarios</DataKind>
            <button
              className="dt-icon-button"
              aria-label="Open Decision intelligence"
              aria-haspopup="dialog"
              onClick={() => open("decisions")}
            >
              <ArrowUpRight size={17} />
            </button>
          </div>
          {decision ? (
            <>
              <div className="dt-decision-body">
                <div>
                  <label className="dt-small-label" htmlFor="twin-scenario">
                    Explore a saved decision
                  </label>
                  <select
                    id="twin-scenario"
                    value={decision.id}
                    onChange={(event) => setSelectedId(event.target.value)}
                  >
                    {data.decisions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                  <p className="dt-data-note">
                    Through {dateLabel(decision.period_end)} · saved{" "}
                    {dateLabel(decision.created_at)}
                  </p>
                </div>
                <div className="dt-preview-result">
                  <span>
                    Projected savings{" "}
                    <DataKind kind="projection">Prediction</DataKind>
                  </span>
                  <strong>{amount(projectedValue, decision.currency)}</strong>
                  <small>
                    {branch === "baseline"
                      ? "Under the original plan"
                      : known(decision.difference)
                        ? `${decision.difference >= 0 ? "+" : ""}${amount(decision.difference, decision.currency)} vs current plan`
                        : "Under the proposed change"}
                  </small>
                </div>
              </div>
              <div className="dt-decision-footer">
                <div
                  className="dt-branch-switch"
                  role="group"
                  aria-label="Scenario preview"
                >
                  <button
                    aria-pressed={branch === "baseline"}
                    onClick={() => setBranch("baseline")}
                  >
                    Current plan
                  </button>
                  <button
                    aria-pressed={branch === "alternative"}
                    onClick={() => setBranch("alternative")}
                  >
                    Proposed change
                  </button>
                </div>
                <button
                  className="dt-text-button"
                  onClick={() => open("decisions")}
                >
                  See why <ArrowUpRight size={14} />
                </button>
              </div>
            </>
          ) : (
            <div className="dt-decision-empty">
              <div>
                <strong>A decision today. A different tomorrow.</strong>
                <p>
                  Save a simulation to compare outcomes and explore the
                  reasoning behind them.
                </p>
              </div>
              <button className="dt-button" onClick={() => onOpenSimulations()}>
                Create simulation
                <ArrowUpRight size={15} />
              </button>
            </div>
          )}
        </article>
      </section>
      <footer className="dt-footer">
        <span>
          <Activity size={14} />
          {data
            ? `Last read ${dateLabel(data.refreshed_at, true)}`
            : "Waiting for profile data"}
        </span>
        <span>
          Saved data<span className="dt-footer-dot">·</span>Calculated metrics
          <span className="dt-footer-dot">·</span>Labeled predictions
        </span>
        <span>Auto-refresh every 30s while visible</span>
      </footer>
      {expanded && (
        <TwinDetails
          module={expanded}
          data={data}
          decision={decision}
          detail={detail}
          branch={branch}
          onClose={() => setExpanded(null)}
          onProfile={onOpenProfile}
          onSimulations={onOpenSimulations}
        />
      )}
    </div>
  );
}
