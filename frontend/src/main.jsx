import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Banknote,
  BriefcaseBusiness,
  Check,
  CircleAlert,
  CircleGauge,
  HeartPulse,
  LogOut,
  Play,
  RefreshCw,
  Save,
  Sparkles,
  UserRound,
} from "lucide-react";
import "./styles.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const emptyUser = {
  age: "",
  gender: "",
  country: "",
  education: "",
  university: "",
  cgpa: "",
  career_goal: "",
  dream_country: "",
  risk_tolerance: "Medium",
};

const emptyProfiles = {
  financial: {
    monthly_income: "",
    monthly_expense: "",
    current_savings: "",
    investments: "",
    debts: "",
  },
  career: {
    current_role: "",
    years_of_experience: "",
    expected_salary: "",
    dream_role: "",
    skills: "",
    certifications: "",
  },
  health: {
    height: "",
    weight: "",
    sleep_hours: "",
    exercise_days: "",
  },
};

const scenarioGroups = {
  financial: [
    {
      label: "Vehicle Purchase",
      value: "vehicle_purchase",
      fields: [
        ["vehicle_price", "Vehicle price", "number", 24000],
        ["down_payment", "Down payment", "number", 4000],
        ["interest_rate", "Interest rate", "number", 7],
        ["tenure_months", "Tenure months", "number", 60],
      ],
    },
    {
      label: "Home Loan",
      value: "home_loan",
      fields: [
        ["home_price", "Home price", "number", 250000],
        ["down_payment", "Down payment", "number", 50000],
        ["interest_rate", "Interest rate", "number", 7],
        ["tenure_months", "Tenure months", "number", 240],
      ],
    },
    {
      label: "Investment",
      value: "investment",
      fields: [
        ["principal", "Initial investment", "number", 5000],
        ["annual_rate", "Annual return", "number", 9],
        ["years", "Years", "number", 10],
        ["monthly_contribution", "Monthly contribution", "number", 300],
      ],
    },
  ],
  career: [
    {
      label: "Higher Studies",
      value: "higher_studies",
      fields: [
        ["education_cost", "Education cost", "number", 40000],
        ["expected_salary_gain", "Expected salary gain", "number", 20000],
        ["years_to_recover", "Years to recover", "number", 3],
      ],
    },
    {
      label: "Job Switch",
      value: "job_switch",
      fields: [
        ["target_salary", "Target salary", "number", 120000],
        ["switching_cost", "Switching cost", "number", 2500],
        ["expected_years", "Expected years", "number", 2],
      ],
    },
    {
      label: "Startup",
      value: "startup",
      fields: [
        ["initial_investment", "Initial investment", "number", 15000],
        ["expected_annual_revenue", "Annual revenue", "number", 90000],
        ["expected_annual_cost", "Annual cost", "number", 50000],
        ["risk_multiplier", "Risk multiplier", "number", 0.8],
      ],
    },
  ],
  health: [
    {
      label: "Fitness",
      value: "fitness",
      fields: [
        ["weekly_workouts", "Weekly workouts", "number", 4],
        ["average_sleep_hours", "Average sleep", "number", 7],
        ["stress_level", "Stress level", "number", 5],
      ],
    },
    {
      label: "Sleep",
      value: "sleep",
      fields: [
        ["sleep_hours", "Sleep hours", "number", 7],
        ["caffeine_intake", "Caffeine intake", "number", 1],
        ["screen_time_hours", "Screen time", "number", 3],
      ],
    },
  ],
};

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("pt_token"));
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState(emptyProfiles);
  const [profileExists, setProfileExists] = useState({
    financial: false,
    career: false,
    health: false,
  });
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    full_name: "",
    email: "",
    password: "",
  });
  const [userForm, setUserForm] = useState(emptyUser);
  const [activeDomain, setActiveDomain] = useState("financial");
  const [scenario, setScenario] = useState(scenarioGroups.financial[0].value);
  const [scenarioParams, setScenarioParams] = useState({});
  const [simulationResult, setSimulationResult] = useState(null);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  useEffect(() => {
    if (token) {
      loadTwinData(token);
    }
  }, [token]);

  useEffect(() => {
    const next = scenarioGroups[activeDomain][0].value;
    setScenario(next);
    setScenarioParams(defaultParams(scenarioGroups[activeDomain][0]));
    setSimulationResult(null);
  }, [activeDomain]);

  useEffect(() => {
    const selected = scenarioGroups[activeDomain].find(
      (item) => item.value === scenario,
    );
    if (selected) {
      setScenarioParams(defaultParams(selected));
    }
  }, [scenario, activeDomain]);

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    if (response.status === 204) {
      return null;
    }

    const text = await response.text();
    let data = null;

    if (text) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      } else {
        data = text;
      }
    }

    if (!response.ok) {
      const detail =
        typeof data === "object" && data !== null
          ? data.detail || data.message || response.statusText
          : data || response.statusText;
      throw new Error(Array.isArray(detail) ? detail[0]?.msg : detail);
    }

    return data;
  }

  async function loadTwinData(nextToken = token) {
    setLoading(true);
    setStatus({ type: "idle", message: "" });
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${nextToken}`,
    };

    try {
      const currentUser = await request("/auth/me", { headers });
      setUser(currentUser);
      setUserForm({ ...emptyUser, ...nullableToInput(currentUser) });

      const nextProfiles = { ...emptyProfiles };
      const exists = {};

      for (const domain of ["financial", "career", "health"]) {
        try {
          const profile = await request(`/users/${currentUser.id}/${domain}/`, {
            headers,
          });
          nextProfiles[domain] = profileToForm(domain, profile);
          exists[domain] = true;
        } catch (error) {
          nextProfiles[domain] = emptyProfiles[domain];
          exists[domain] = false;
        }
      }

      setProfiles(nextProfiles);
      setProfileExists(exists);
    } catch (error) {
      localStorage.removeItem("pt_token");
      setToken(null);
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(event) {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      if (authMode === "register") {
        await request("/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(authForm),
        });
      }

      const data = await request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authForm.email,
          password: authForm.password,
        }),
      });

      localStorage.setItem("pt_token", data.access_token);
      setToken(data.access_token);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function saveUserProfile(event) {
    event.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const payload = cleanPayload(userForm, ["age", "cgpa"]);
      const updated = await request(`/users/${user.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      setUser(updated);
      setStatus({ type: "success", message: "Profile saved." });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function saveDomainProfile(domain) {
    if (!user) return;

    setLoading(true);
    try {
      const payload = buildProfilePayload(domain, profiles[domain]);
      const saved = await request(`/users/${user.id}/${domain}/`, {
        method: profileExists[domain] ? "PUT" : "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      setProfiles((current) => ({
        ...current,
        [domain]: profileToForm(domain, saved),
      }));
      setProfileExists((current) => ({ ...current, [domain]: true }));
      setStatus({ type: "success", message: `${title(domain)} profile saved.` });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function runSimulation(event) {
    event.preventDefault();
    if (!user) return;

    setLoading(true);
    setSimulationResult(null);
    try {
      const selected = scenarioGroups[activeDomain].find(
        (item) => item.value === scenario,
      );
      const numericKeys = selected.fields.map(([key]) => key);
      const result = await request(`/simulation/${user.id}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          domain: activeDomain,
          simulation_type: scenario,
          parameters: cleanPayload(scenarioParams, numericKeys),
        }),
      });
      setSimulationResult(result);
      setStatus({ type: "success", message: "Simulation complete." });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    localStorage.removeItem("pt_token");
    setToken(null);
    setUser(null);
    setSimulationResult(null);
  }

  const analytics = useMemo(
    () => calculateAnalytics(userForm, profiles, profileExists),
    [userForm, profiles, profileExists],
  );

  if (!token || !user) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div>
            <div className="brand-lockup">
              <Sparkles size={28} />
              <span>PersonaTwin</span>
            </div>
            <h1>Your digital twin command center</h1>
            <p>
              Build a cross-domain profile, inspect live analytics, and run
              explainable what-if simulations.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleAuth}>
            <div className="segmented">
              <button
                type="button"
                className={authMode === "login" ? "active" : ""}
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
              <button
                type="button"
                className={authMode === "register" ? "active" : ""}
                onClick={() => setAuthMode("register")}
              >
                Register
              </button>
            </div>
            {authMode === "register" && (
              <label>
                Full name
                <input
                  required
                  value={authForm.full_name}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, full_name: event.target.value })
                  }
                />
              </label>
            )}
            <label>
              Email
              <input
                required
                type="email"
                value={authForm.email}
                onChange={(event) =>
                  setAuthForm({ ...authForm, email: event.target.value })
                }
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                minLength={8}
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm({ ...authForm, password: event.target.value })
                }
              />
            </label>
            <button className="primary-action" type="submit" disabled={loading}>
              <Check size={18} />
              {authMode === "register" ? "Create account" : "Sign in"}
            </button>
            <StatusMessage status={status} />
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <Sparkles size={24} />
          <span>PersonaTwin</span>
        </div>
        <nav>
          <a href="#overview">
            <CircleGauge size={18} />
            Overview
          </a>
          <a href="#profiles">
            <UserRound size={18} />
            Profiles
          </a>
          <a href="#simulation">
            <Play size={18} />
            Simulations
          </a>
        </nav>
        <button className="ghost-action" onClick={signOut}>
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Digital Twin</span>
            <h1>{user.full_name}</h1>
          </div>
          <button
            className="secondary-action"
            type="button"
            onClick={() => loadTwinData()}
            disabled={loading}
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </header>

        <StatusMessage status={status} />

        <section id="overview" className="analytics-grid">
          <MetricCard
            icon={<Banknote size={20} />}
            label="Savings runway"
            value={analytics.runway}
            helper="Months of expenses covered"
          />
          <MetricCard
            icon={<BriefcaseBusiness size={20} />}
            label="Career readiness"
            value={analytics.careerReadiness}
            helper="Skills, certs, and experience"
          />
          <MetricCard
            icon={<HeartPulse size={20} />}
            label="Health index"
            value={analytics.healthIndex}
            helper="Sleep and weekly activity"
          />
          <MetricCard
            icon={<Activity size={20} />}
            label="Twin completeness"
            value={analytics.completeness}
            helper="Required domain profiles saved"
          />
        </section>

        <section id="profiles" className="content-band profile-layout">
          <form className="panel" onSubmit={saveUserProfile}>
            <PanelTitle icon={<UserRound size={20} />} title="Identity" />
            <div className="form-grid">
              <Field label="Age" type="number" value={userForm.age} onChange={(value) => updateUserField("age", value)} />
              <Field label="Gender" value={userForm.gender} onChange={(value) => updateUserField("gender", value)} />
              <Field label="Country" value={userForm.country} onChange={(value) => updateUserField("country", value)} />
              <Field label="Education" value={userForm.education} onChange={(value) => updateUserField("education", value)} />
              <Field label="University" value={userForm.university} onChange={(value) => updateUserField("university", value)} />
              <Field label="CGPA" type="number" value={userForm.cgpa} onChange={(value) => updateUserField("cgpa", value)} />
              <Field label="Career goal" value={userForm.career_goal} onChange={(value) => updateUserField("career_goal", value)} />
              <Field label="Dream country" value={userForm.dream_country} onChange={(value) => updateUserField("dream_country", value)} />
              <label>
                Risk tolerance
                <select
                  value={userForm.risk_tolerance}
                  onChange={(event) =>
                    updateUserField("risk_tolerance", event.target.value)
                  }
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>
            </div>
            <button className="primary-action compact" disabled={loading}>
              <Save size={17} />
              Save identity
            </button>
          </form>

          <DomainPanel
            domain="financial"
            icon={<Banknote size={20} />}
            profile={profiles.financial}
            exists={profileExists.financial}
            loading={loading}
            onChange={updateProfileField}
            onSave={saveDomainProfile}
          />
          <DomainPanel
            domain="career"
            icon={<BriefcaseBusiness size={20} />}
            profile={profiles.career}
            exists={profileExists.career}
            loading={loading}
            onChange={updateProfileField}
            onSave={saveDomainProfile}
          />
          <DomainPanel
            domain="health"
            icon={<HeartPulse size={20} />}
            profile={profiles.health}
            exists={profileExists.health}
            loading={loading}
            onChange={updateProfileField}
            onSave={saveDomainProfile}
          />
        </section>

        <section id="simulation" className="content-band simulation-layout">
          <form className="panel simulation-form" onSubmit={runSimulation}>
            <PanelTitle icon={<Play size={20} />} title="Scenario Simulator" />
            <div className="domain-tabs">
              {Object.keys(scenarioGroups).map((domain) => (
                <button
                  key={domain}
                  type="button"
                  className={activeDomain === domain ? "active" : ""}
                  onClick={() => setActiveDomain(domain)}
                >
                  {title(domain)}
                </button>
              ))}
            </div>
            <label>
              Scenario
              <select
                value={scenario}
                onChange={(event) => setScenario(event.target.value)}
              >
                {scenarioGroups[activeDomain].map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              {scenarioGroups[activeDomain]
                .find((item) => item.value === scenario)
                ?.fields.map(([key, label, type]) => (
                  <Field
                    key={key}
                    label={label}
                    type={type}
                    value={scenarioParams[key] ?? ""}
                    onChange={(value) =>
                      setScenarioParams((current) => ({
                        ...current,
                        [key]: value,
                      }))
                    }
                  />
                ))}
            </div>
            <button className="primary-action compact" disabled={loading}>
              <Play size={17} />
              Run simulation
            </button>
          </form>

          <SimulationResult result={simulationResult} />
        </section>
      </section>
    </main>
  );

  function updateUserField(key, value) {
    setUserForm((current) => ({ ...current, [key]: value }));
  }

  function updateProfileField(domain, key, value) {
    setProfiles((current) => ({
      ...current,
      [domain]: {
        ...current[domain],
        [key]: value,
      },
    }));
  }
}

function DomainPanel({ domain, icon, profile, exists, loading, onChange, onSave }) {
  const fields = {
    financial: [
      ["monthly_income", "Monthly income", "number"],
      ["monthly_expense", "Monthly expense", "number"],
      ["current_savings", "Current savings", "number"],
      ["investments", "Investments", "number"],
      ["debts", "Debts", "number"],
    ],
    career: [
      ["current_role", "Current role", "text"],
      ["years_of_experience", "Years of experience", "number"],
      ["expected_salary", "Expected salary", "number"],
      ["dream_role", "Dream role", "text"],
      ["skills", "Skills", "text"],
      ["certifications", "Certifications", "text"],
    ],
    health: [
      ["height", "Height", "number"],
      ["weight", "Weight", "number"],
      ["sleep_hours", "Sleep hours", "number"],
      ["exercise_days", "Exercise days", "number"],
    ],
  };

  return (
    <div className="panel">
      <PanelTitle
        icon={icon}
        title={`${title(domain)} Profile`}
        badge={exists ? "Saved" : "New"}
      />
      <div className="form-grid">
        {fields[domain].map(([key, label, type]) => (
          <Field
            key={key}
            label={label}
            type={type}
            value={profile[key] ?? ""}
            onChange={(value) => onChange(domain, key, value)}
          />
        ))}
      </div>
      <button
        className="secondary-action compact"
        type="button"
        onClick={() => onSave(domain)}
        disabled={loading}
      >
        <Save size={17} />
        Save {title(domain)}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label>
      {label}
      <input
        type={type}
        step={type === "number" ? "any" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function MetricCard({ icon, label, value, helper }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>
    </article>
  );
}

function PanelTitle({ icon, title: panelTitle, badge }) {
  return (
    <div className="panel-title">
      <div>
        {icon}
        <h2>{panelTitle}</h2>
      </div>
      {badge && <span className="badge">{badge}</span>}
    </div>
  );
}

function SimulationResult({ result }) {
  if (!result) {
    return (
      <div className="panel result-panel empty-result">
        <CircleAlert size={28} />
        <h2>No simulation selected</h2>
        <p>Choose a domain, tune the assumptions, and run a scenario.</p>
      </div>
    );
  }

  return (
    <div className="panel result-panel">
      <div className="score-ring" style={{ "--score": result.score }}>
        <span>{Math.round(result.score)}</span>
      </div>
      <div className="result-heading">
        <span className={`risk ${result.risk_level.toLowerCase()}`}>
          {result.risk_level} risk
        </span>
        <h2>{result.simulation_name}</h2>
        <p>{result.summary}</p>
      </div>
      <div className="metrics-list">
        {Object.entries(result.metrics || {}).map(([key, value]) => (
          <div key={key}>
            <span>{readable(key)}</span>
            <strong>{formatValue(value)}</strong>
          </div>
        ))}
      </div>
      <div className="recommendations">
        <h3>Recommendations</h3>
        {result.recommendations.map((item) => (
          <p key={item}>
            <Check size={16} />
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function StatusMessage({ status }) {
  if (!status.message) return null;
  return <div className={`status ${status.type}`}>{status.message}</div>;
}

function defaultParams(scenarioConfig) {
  return Object.fromEntries(
    scenarioConfig.fields.map(([key, , , fallback]) => [key, fallback]),
  );
}

function nullableToInput(record) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, value ?? ""]),
  );
}

function cleanPayload(form, numericKeys = []) {
  const payload = {};

  for (const [key, value] of Object.entries(form)) {
    if (value === "" || value === null || value === undefined) continue;
    payload[key] = numericKeys.includes(key) ? Number(value) : value;
  }

  return payload;
}

function buildProfilePayload(domain, form) {
  if (domain === "career") {
    return {
      current_role: form.current_role,
      years_of_experience: Number(form.years_of_experience),
      expected_salary: Number(form.expected_salary),
      dream_role: form.dream_role,
      skills: splitList(form.skills),
      certifications: splitList(form.certifications),
    };
  }

  const numericKeys = Object.keys(emptyProfiles[domain]);
  return cleanPayload(form, numericKeys);
}

function profileToForm(domain, profile) {
  const form = nullableToInput(profile);

  if (domain === "career") {
    form.skills = Array.isArray(profile.skills) ? profile.skills.join(", ") : "";
    form.certifications = Array.isArray(profile.certifications)
      ? profile.certifications.join(", ")
      : "";
  }

  return form;
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function calculateAnalytics(userForm, profiles, profileExists) {
  const income = Number(profiles.financial.monthly_income) || 0;
  const expense = Number(profiles.financial.monthly_expense) || 0;
  const savings = Number(profiles.financial.current_savings) || 0;
  const runwayValue = expense > 0 ? savings / expense : 0;
  const runway = runwayValue > 0 ? `${runwayValue.toFixed(1)} mo` : "0 mo";

  const skills = splitList(profiles.career.skills).length;
  const certs = splitList(profiles.career.certifications).length;
  const years = Number(profiles.career.years_of_experience) || 0;
  const careerScore = profileExists.career
    ? Math.min(100, Math.round(years * 8 + skills * 8 + certs * 6))
    : 0;

  const sleep = Number(profiles.health.sleep_hours) || 0;
  const exercise = Number(profiles.health.exercise_days) || 0;
  const sleepScore = Math.max(0, 100 - Math.abs(7.5 - sleep) * 18);
  const activityScore = Math.min(100, exercise * 18);
  const healthScore = profileExists.health
    ? Math.round((sleepScore + activityScore) / 2)
    : 0;

  const savedDomains = Object.values(profileExists).filter(Boolean).length;
  const completeness = `${Math.round((savedDomains / 3) * 100)}%`;

  return {
    runway,
    careerReadiness: `${careerScore}%`,
    healthIndex: `${healthScore}%`,
    completeness,
  };
}

function formatValue(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  }
  return String(value);
}

function readable(key) {
  return key.replaceAll("_", " ");
}

function title(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

createRoot(document.getElementById("root")).render(<App />);
