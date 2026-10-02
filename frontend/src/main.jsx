import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, Banknote, BriefcaseBusiness, Check, CircleAlert,
  Github, HeartPulse, LogOut, Play, RefreshCw, Save, Sparkles, UserRound, ArrowRight,
  Minus, Pencil, Plus, Upload, X
} from "lucide-react";
import { TwinMark, IconOverview, IconProfiles, IconSimulations } from "./icons";
import "./styles.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const emptyUser = { age: "", gender: "", country: "", education: "", university: "", cgpa: "", career_goal: "", dream_country: "", risk_tolerance: "Medium" };
const emptyProfiles = { financial: { monthly_income: "", monthly_expense: "", current_savings: "", investments: "", debts: "" }, career: { current_role: "", years_of_experience: "", expected_salary: "", dream_role: "", skills: "", certifications: "" }, health: { height: "", weight: "", sleep_hours: "", exercise_days: "" } };
const scenarioGroups = { financial: [ { label: "Vehicle Purchase", value: "vehicle_purchase", fields: [ ["vehicle_price", "Vehicle price", "number", 24000], ["down_payment", "Down payment", "number", 4000], ["interest_rate", "Interest rate", "number", 7], ["tenure_months", "Tenure months", "number", 60], ], }, { label: "Home Loan", value: "home_loan", fields: [ ["home_price", "Home price", "number", 250000], ["down_payment", "Down payment", "number", 50000], ["interest_rate", "Interest rate", "number", 7], ["tenure_months", "Tenure months", "number", 240], ], }, { label: "Investment", value: "investment", fields: [ ["principal", "Initial investment", "number", 5000], ["annual_rate", "Annual return", "number", 9], ["years", "Years", "number", 10], ["monthly_contribution", "Monthly contribution", "number", 300], ], }, ], career: [ { label: "Higher Studies", value: "higher_studies", fields: [ ["education_cost", "Education cost", "number", 40000], ["expected_salary_gain", "Expected salary gain", "number", 20000], ["years_to_recover", "Years to recover", "number", 3], ], }, { label: "Job Switch", value: "job_switch", fields: [ ["target_salary", "Target salary", "number", 120000], ["switching_cost", "Switching cost", "number", 2500], ["expected_years", "Expected years", "number", 2], ], }, { label: "Startup", value: "startup", fields: [ ["initial_investment", "Initial investment", "number", 15000], ["expected_annual_revenue", "Annual revenue", "number", 90000], ["expected_annual_cost", "Annual cost", "number", 50000], ["risk_multiplier", "Risk multiplier", "number", 0.8], ], }, ], health: [ { label: "Fitness", value: "fitness", fields: [ ["weekly_workouts", "Weekly workouts", "number", 4], ["average_sleep_hours", "Average sleep", "number", 7], ["stress_level", "Stress level", "number", 5], ], }, { label: "Sleep", value: "sleep", fields: [ ["sleep_hours", "Sleep hours", "number", 7], ["caffeine_intake", "Caffeine intake", "number", 1], ["screen_time_hours", "Screen time", "number", 3], ], }, ], };

const COUNTRIES = [ "United States", "United Kingdom", "India", "Canada", "Australia", "Germany", "France", "Singapore", "United Arab Emirates", "Ireland", "Netherlands", "New Zealand", "Japan", "South Africa", "Brazil" ];

const IMPORT_LABELS = { financial: "Connect Persona Wallet", career: "Sync GitHub", health: "Sync health app" };

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function formatNumber(value) { const n = Number(value); return Number.isFinite(n) ? n.toLocaleString() : value; }

/**
 * Renders the right input widget for a value's data type instead of a
 * generic text box, so most profile fields need clicking/dragging rather
 * than typing:
 *   - "slider"        numeric range (income, height…)
 *   - "stepper"       small counts (age, years of experience…)
 *   - "chips"         a fixed set of options, single choice (gender…)
 *   - "chip-presets"  common numeric values as one-click shortcuts,
 *                      with the underlying number field still editable
 *   - "tags"          multi-value lists (skills, certifications) as
 *                      removable chips with one-click suggestions
 *   - anything else falls back to a plain text/number input
 */
function SmartField({ label, value, onChange, type = "text", config = {} }) {
  if (type === "slider") {
    const { min = 0, max = 100, step = 1, prefix = "", suffix = "" } = config;
    const numeric = Number(value) || 0;
    return (
      <label className="field-slider">
        <span className="field-slider-label">
          {label}
          <span className="field-slider-value">{prefix}{formatNumber(numeric)}{suffix}</span>
        </span>
        <input type="range" min={min} max={max} step={step} value={numeric} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }

  if (type === "stepper") {
    const { min = 0, max = 999, step = 1 } = config;
    const numeric = Number(value) || 0;
    return (
      <div className="field-stepper">
        <span>{label}</span>
        <div className="stepper-control">
          <button type="button" onClick={() => onChange(String(clamp(numeric - step, min, max)))}><Minus size={14} /></button>
          <span>{numeric}</span>
          <button type="button" onClick={() => onChange(String(clamp(numeric + step, min, max)))}><Plus size={14} /></button>
        </div>
      </div>
    );
  }

  if (type === "chips") {
    const { options = [] } = config;
    return (
      <div className="field-chips">
        <span>{label}</span>
        <div className="chip-row">
          {options.map((option) => (
            <button key={option} type="button" className={"chip" + (value === option ? " active" : "")} onClick={() => onChange(option)}>{option}</button>
          ))}
        </div>
      </div>
    );
  }

  if (type === "chip-presets") {
    const { options = [], prefix = "", suffix = "" } = config;
    return (
      <div className="field-chip-presets">
        <span>{label}</span>
        <div className="chip-row">
          {options.map((option) => (
            <button key={option} type="button" className={"chip" + (value === String(option) ? " active" : "")} onClick={() => onChange(String(option))}>
              {prefix}{formatNumber(option)}{suffix}
            </button>
          ))}
        </div>
        <input type="number" placeholder="Custom amount" value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    );
  }

  if (type === "tags") {
    return <TagsField label={label} value={value} onChange={onChange} suggestions={config.suggestions || []} />;
  }

  return (
    <label>
      {label}
      <input type={type} step={type === "number" ? "any" : undefined} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TagsField({ label, value, onChange, suggestions }) {
  const [draft, setDraft] = useState("");
  const tags = splitList(value);

  function addTag(tag) {
    const clean = tag.trim();
    if (!clean || tags.includes(clean)) return;
    onChange([...tags, clean].join(", "));
  }
  function removeTag(tag) {
    onChange(tags.filter((item) => item !== tag).join(", "));
  }

  const remainingSuggestions = suggestions.filter((s) => !tags.includes(s));

  return (
    <div className="field-tags">
      <span>{label}</span>
      <div className="tag-box">
        {tags.map((tag) => (
          <span key={tag} className="tag-chip">{tag}<button type="button" onClick={() => removeTag(tag)}><X size={11} /></button></span>
        ))}
        <input
          className="tag-input"
          placeholder={tags.length ? "" : "Type and press Enter…"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); addTag(draft); setDraft(""); }
          }}
        />
      </div>
      {remainingSuggestions.length > 0 && (
        <div className="tag-suggestions">
          {remainingSuggestions.map((s) => (
            <button key={s} type="button" className="tag-suggest" onClick={() => addTag(s)}>+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function AutoField({ label, value, onChange, options }) {
  const listId = `list-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label>
      {label}
      <input list={listId} value={value} onChange={(event) => onChange(event.target.value)} />
      <datalist id={listId}>
        {options.map((option) => <option key={option} value={option} />)}
      </datalist>
    </label>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("pt_token"));
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState(emptyProfiles);
  const [profileExists, setProfileExists] = useState({ financial: false, career: false, health: false });
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ full_name: "", email: "", password: "" });
  const [userForm, setUserForm] = useState(emptyUser);

  const [currentView, setCurrentView] = useState("overview");
  const [activeProfileTab, setActiveProfileTab] = useState("identity");
  const [editingProfile, setEditingProfile] = useState(false);
  const [twinData, setTwinData] = useState(null);

  const [activeDomain, setActiveDomain] = useState("financial");
  const [scenario, setScenario] = useState(scenarioGroups.financial[0].value);
  const [scenarioParams, setScenarioParams] = useState({});
  const [simulationResult, setSimulationResult] = useState(null);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletAuthMode, setWalletAuthMode] = useState("login");
  const [walletAuthForm, setWalletAuthForm] = useState({ username: "", email: "", password: "" });
  const [walletToken, setWalletToken] = useState(() => sessionStorage.getItem("pt_wallet_token") || "");
  const [walletSnapshot, setWalletSnapshot] = useState(null);
  const [walletSyncedAt, setWalletSyncedAt] = useState(null);
  const walletSyncBusy = useRef(false);
  const [walletAccountModalOpen, setWalletAccountModalOpen] = useState(false);
  const [walletAccountForm, setWalletAccountForm] = useState({ name: "", balance: "", currency: "INR" });
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [githubForm, setGithubForm] = useState({ username: sessionStorage.getItem("pt_github_username") || "", token: sessionStorage.getItem("pt_github_token") || "" });

  const authHeaders = useMemo(() => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => { if (token) loadTwinData(token); }, [token]);

  useEffect(() => {
    const next = scenarioGroups[activeDomain][0].value;
    setScenario(next);
    setScenarioParams(defaultParams(scenarioGroups[activeDomain][0]));
    setSimulationResult(null);
  }, [activeDomain]);

  useEffect(() => {
    const selected = scenarioGroups[activeDomain].find((item) => item.value === scenario);
    if (selected) setScenarioParams(defaultParams(selected));
  }, [scenario, activeDomain]);

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, { signal: AbortSignal.timeout(90000), ...options });
    if (response.status === 204) return null;
    const text = await response.text();
    let data = null;
    if (text) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try { data = JSON.parse(text); } catch { data = text; }
      } else { data = text; }
    }
    if (!response.ok) {
      const detail = typeof data === "object" && data !== null ? data.detail || data.message || response.statusText : data || response.statusText;
      const error = new Error(Array.isArray(detail) ? detail[0]?.msg : detail);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function loadTwinData(nextToken = token) {
    setLoading(true);
    setStatus({ type: "idle", message: "" });
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${nextToken}` };
    try {
      const currentUser = await request("/auth/me", { headers });
      setUser(currentUser);
      setUserForm({ ...emptyUser, ...nullableToInput(currentUser) });
      const nextProfiles = { ...emptyProfiles };
      const exists = {};
      for (const domain of ["financial", "career", "health"]) {
        try {
          const profile = await request(`/users/${currentUser.id}/${domain}/`, { headers });
          nextProfiles[domain] = profileToForm(domain, profile);
          if (domain === "financial") {
            setWalletSnapshot(profile.wallet_snapshot);
            setWalletSyncedAt(profile.wallet_synced_at);
          }
          exists[domain] = true;
        } catch (error) {
          nextProfiles[domain] = emptyProfiles[domain];
          exists[domain] = false;
          if (!String(error.message).includes("not found")) {
            setStatus({ type: "error", message: `Could not load ${title(domain)} profile: ${error.message}` });
          }
        }
      }
      setProfiles(nextProfiles);
      setProfileExists(exists);

      try {
        const twin = await request(`/users/${currentUser.id}/twin/`, { headers });
        setTwinData(twin);
      } catch (error) {
        setTwinData(null);
      }
    } catch (error) {
      localStorage.removeItem("pt_token");
      setToken(null);
      setStatus({ type: "error", message: error.message });
    } finally { setLoading(false); }
  }

  async function handleAuth(event) {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "idle", message: "" });
    try {
      if (authMode === "register") {
        await request("/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(authForm) });
      }
      const data = await request("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: authForm.email, password: authForm.password }) });
      localStorage.setItem("pt_token", data.access_token);
      setUser(null);
      setUserForm(emptyUser);
      setProfiles(emptyProfiles);
      setProfileExists({ financial: false, career: false, health: false });
      setTwinData(null);
      setSimulationResult(null);
      setWalletToken("");
      sessionStorage.removeItem("pt_wallet_token");
      setGithubForm({ username: "", token: "" });
      sessionStorage.removeItem("pt_github_username");
      sessionStorage.removeItem("pt_github_token");
      setCurrentView("overview");
      setActiveProfileTab("identity");
      setEditingProfile(false);
      setToken(data.access_token);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally { setLoading(false); }
  }

  async function saveUserProfile(event) {
    event.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const payload = cleanPayload(userForm, ["age", "cgpa"]);
      const updated = await request(`/users/${user.id}`, { method: "PUT", headers: authHeaders, body: JSON.stringify(payload) });
      setUser(updated);
      setStatus({ type: "success", message: "Profile saved." });
      return true;
    } catch (error) {
      setStatus({ type: "error", message: error.message });
      return false;
    } finally { setLoading(false); }
  }

  async function saveDomainProfile(domain) {
    if (!user) return;
    setLoading(true);
    try {
      const payload = buildProfilePayload(domain, profiles[domain]);
      const saved = await request(`/users/${user.id}/${domain}/`, { method: profileExists[domain] ? "PUT" : "POST", headers: authHeaders, body: JSON.stringify(payload) });
      setProfiles((current) => ({ ...current, [domain]: profileToForm(domain, saved) }));
      setProfileExists((current) => ({ ...current, [domain]: true }));
      setStatus({ type: "success", message: `${title(domain)} profile saved.` });
      return true;
    } catch (error) {
      setStatus({ type: "error", message: error.message });
      return false;
    } finally { setLoading(false); }
  }

  async function runSimulation(event) {
    event.preventDefault();
    if (!user) return;
    setLoading(true);
    setSimulationResult(null);
    try {
      if (walletToken) await syncWalletData();
      const selected = scenarioGroups[activeDomain].find((item) => item.value === scenario);
      const numericKeys = selected.fields.map(([key]) => key);
      const result = await request(`/simulation/${user.id}`, { method: "POST", headers: authHeaders, body: JSON.stringify({ domain: activeDomain, simulation_type: scenario, parameters: cleanPayload(scenarioParams, numericKeys) }) });
      setSimulationResult(result);
      setStatus({ type: "success", message: "Simulation complete." });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally { setLoading(false); }
  }

  async function syncWalletData(walletAccessToken = walletToken) {
    if (!user || !walletAccessToken || walletSyncBusy.current) return false;
    walletSyncBusy.current = true;
    try {
    const synced = await request(`/users/${user.id}/financial/sync`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ wallet_token: walletAccessToken }),
    });
    setProfiles((current) => ({ ...current, financial: profileToForm("financial", synced) }));
    setProfileExists((current) => ({ ...current, financial: true }));
    setWalletSnapshot(synced.wallet_snapshot);
    setWalletSyncedAt(synced.wallet_synced_at);
    return true;
    } finally { walletSyncBusy.current = false; }
  }

  useEffect(() => {
    if (!user || !token || !walletToken || editingProfile || loading) return;
    let cancelled = false;
    async function refreshBank() {
      if (cancelled || document.visibilityState === "hidden") return;
      try {
        const synced = await syncWalletData(walletToken);
        if (synced && !cancelled) {
          const twin = await request(`/users/${user.id}/twin/`, { headers: authHeaders });
          if (!cancelled) setTwinData(twin);
        }
      } catch (error) {
        if (cancelled) return;
        if (error.status === 401) {
          sessionStorage.removeItem("pt_wallet_token");
          setWalletToken("");
          setStatus({ type: "error", message: "Bank connection expired. Reconnect Persona Wallet; the last synced data is retained." });
        } else {
          setStatus({ type: "error", message: `Bank refresh failed: ${error.message}. Last synced data is retained.` });
        }
      }
    }
    refreshBank();
    const interval = setInterval(refreshBank, 30000);
    window.addEventListener("focus", refreshBank);
    document.addEventListener("visibilitychange", refreshBank);
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener("focus", refreshBank); document.removeEventListener("visibilitychange", refreshBank); };
  }, [user?.id, token, walletToken, editingProfile, loading]);

  async function refreshDashboard() {
    setLoading(true);
    try {
      const activeWalletToken = sessionStorage.getItem("pt_wallet_token") || walletToken;
      if (activeWalletToken) {
        await syncWalletData(activeWalletToken);
      } else if (profileExists.financial) {
        setWalletAuthMode("login");
        setWalletModalOpen(true);
      }
      await loadTwinData();
      setStatus(activeWalletToken
        ? { type: "success", message: "Dashboard and wallet data refreshed." }
        : profileExists.financial
          ? { type: "error", message: "Reconnect Persona Wallet to refresh savings." }
          : { type: "success", message: "Dashboard data refreshed." });
    } catch (error) {
      if (String(error.message).toLowerCase().includes("token is invalid or expired")) {
        sessionStorage.removeItem("pt_wallet_token");
        setWalletToken("");
        setWalletAuthMode("login");
        setWalletModalOpen(true);
        setStatus({ type: "error", message: "Persona Wallet session expired. Log in to refresh savings." });
        return;
      }
      setStatus({ type: "error", message: error.message });
    } finally { setLoading(false); }
  }

  async function handleImport(domain) {
    if (!user || !["financial", "career"].includes(domain)) return;

    if (domain === "financial") {
      setWalletModalOpen(true);
      return;
    }

    if (domain === "career") {
      setGithubModalOpen(true);
      return;
    }
  }

  async function syncGithubProfile(event) {
    event.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const synced = await request(`/users/${user.id}/career/sync-github`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ github_username: githubForm.username, github_token: githubForm.token || null }),
      });
      sessionStorage.setItem("pt_github_username", githubForm.username.trim());
      if (githubForm.token) sessionStorage.setItem("pt_github_token", githubForm.token);
      setProfiles((current) => ({ ...current, career: profileToForm("career", synced) }));
      setProfileExists((current) => ({ ...current, career: true }));
      setGithubModalOpen(false);
      setStatus({ type: "success", message: "Career details synced from GitHub." });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally { setLoading(false); }
  }

  async function authenticateWallet(event) {
    event.preventDefault();
    if (!user) return;
    setLoading(true);
    setStatus({ type: "idle", message: "" });
    try {
      const path = walletAuthMode === "signup" ? "signup" : "login";
      let auth = await request(`/users/${user.id}/financial/wallet/${path}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(walletAuthMode === "signup" ? walletAuthForm : {
          email: walletAuthForm.email,
          password: walletAuthForm.password,
        }),
      });
      let nextToken = auth?.access_token;
      if (!nextToken && walletAuthMode === "signup") {
        auth = await request(`/users/${user.id}/financial/wallet/login`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ email: walletAuthForm.email, password: walletAuthForm.password }),
        });
        nextToken = auth?.access_token;
      }
      if (!nextToken) throw new Error("Persona Wallet did not return a login token.");
      setWalletToken(nextToken);
      sessionStorage.setItem("pt_wallet_token", nextToken);

      if (walletAuthMode === "signup") {
        setWalletModalOpen(false);
        setWalletAccountModalOpen(true);
        setStatus({ type: "success", message: "Wallet account created. Add your first bank account to continue." });
        return;
      }

      const synced = await request(`/users/${user.id}/financial/sync`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ wallet_token: nextToken }),
      });
      setProfiles((current) => ({ ...current, financial: profileToForm("financial", synced) }));
      setWalletSnapshot(synced.wallet_snapshot);
      setWalletSyncedAt(synced.wallet_synced_at);
      setProfileExists((current) => ({ ...current, financial: true }));
      setWalletModalOpen(false);
      setStatus({ type: "success", message: "Financial information synced from Persona Wallet." });
    } catch (error) {
      if (walletAuthMode === "signup" && String(error.message).toLowerCase().includes("already registered")) {
        setWalletAuthMode("login");
        setStatus({ type: "error", message: "This wallet email already exists. Use Login for this account." });
        return;
      }
      setStatus({ type: "error", message: error.message });
    } finally { setLoading(false); }
  }

  async function createWalletAccount(event) {
    event.preventDefault();
    if (!user || !walletToken) return;
    setLoading(true);
    try {
      await request(`/users/${user.id}/financial/wallet/accounts`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          wallet_token: walletToken,
          name: walletAccountForm.name,
          account_type: "PERSONAL",
          balance: Number(walletAccountForm.balance || 0),
          currency: walletAccountForm.currency,
        }),
      });
      const synced = await request(`/users/${user.id}/financial/sync`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ wallet_token: walletToken }),
      });
      setProfiles((current) => ({ ...current, financial: profileToForm("financial", synced) }));
      setWalletSnapshot(synced.wallet_snapshot);
      setWalletSyncedAt(synced.wallet_synced_at);
      setProfileExists((current) => ({ ...current, financial: true }));
      setWalletAccountModalOpen(false);
      setWalletAccountForm({ name: "", balance: "", currency: "INR" });
      setStatus({ type: "success", message: "Bank account added and wallet synced." });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally { setLoading(false); }
  }

  function signOut() {
    setWalletSnapshot(null);
    setWalletSyncedAt(null);
    localStorage.removeItem("pt_token");
    setToken(null);
    setUser(null);
    setUserForm(emptyUser);
    setProfiles(emptyProfiles);
    setProfileExists({ financial: false, career: false, health: false });
    setTwinData(null);
    setSimulationResult(null);
    setWalletToken("");
    sessionStorage.removeItem("pt_wallet_token");
    setWalletModalOpen(false);
    setWalletAccountModalOpen(false);
    setGithubModalOpen(false);
    sessionStorage.removeItem("pt_github_username");
    sessionStorage.removeItem("pt_github_token");
    setCurrentView("overview");
    setActiveProfileTab("identity");
    setEditingProfile(false);
    setStatus({ type: "idle", message: "" });
  }

  const analytics = useMemo(() => calculateAnalytics(userForm, profiles, profileExists), [userForm, profiles, profileExists]);
  const twinSummary = twinData ? {
    career: `${Math.round(twinData.career_score)}%`,
    finance: `${Math.round(twinData.finance_score)}%`,
    learning: `${Math.round(twinData.learning_score)}%`,
  } : null;

  if (!token || !user) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div>
            <div className="brand-lockup">
              <TwinMark size={20} strokeWidth={1.8} />
              <span>PersonaTwin</span>
            </div>
            <h1>Your digital twin command center.</h1>
            <p>Build a cross-domain profile, inspect live analytics, and run explainable what-if simulations.</p>
          </div>
          <form className="auth-form" onSubmit={handleAuth}>
            <div className="segmented">
              <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Login</button>
              <button type="button" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Register</button>
            </div>
            {authMode === "register" && (
              <label>Full name <input required value={authForm.full_name} onChange={(event) => setAuthForm({ ...authForm, full_name: event.target.value }) } /></label>
            )}
            <label>Email <input required type="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value }) } /></label>
            <label>Password <input required type="password" minLength={8} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value }) } /></label>
            <button className="primary-action" type="submit" disabled={loading}>
              {authMode === "register" ? "Create account" : "Sign in"}
              <ArrowRight size={16} strokeWidth={2} />
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
          <TwinMark size={20} strokeWidth={1.8} />
          <span>PersonaTwin</span>
        </div>

        <nav className="sidebar-nav">
          <button className={currentView === 'overview' ? 'active' : ''} onClick={() => setCurrentView('overview')}>
            <IconOverview size={16} strokeWidth={2} /> Overview
          </button>
          <button className={currentView === 'profiles' ? 'active' : ''} onClick={() => setCurrentView('profiles')}>
            <IconProfiles size={16} strokeWidth={2} /> Profiles
          </button>
          <button className={currentView === 'simulations' ? 'active' : ''} onClick={() => setCurrentView('simulations')}>
            <IconSimulations size={16} strokeWidth={2} /> Simulations
          </button>
        </nav>

        <button className="ghost-action" onClick={signOut}>
          <LogOut size={16} strokeWidth={2} />
          Sign out
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Digital Twin Dashboard</span>
            <h1>{user.full_name}</h1>
          </div>
          <button className="secondary-action" type="button" onClick={refreshDashboard} disabled={loading} >
            <RefreshCw size={14} strokeWidth={2} />
            Refresh Data
          </button>
        </header>

        <StatusMessage status={status} />
        {walletModalOpen && (
          <WalletAuthModal
            mode={walletAuthMode}
            form={walletAuthForm}
            loading={loading}
            onModeChange={setWalletAuthMode}
            onChange={(key, value) => setWalletAuthForm((current) => ({ ...current, [key]: value }))}
            onSubmit={authenticateWallet}
            onClose={() => setWalletModalOpen(false)}
          />
        )}
        {walletAccountModalOpen && (
          <WalletAccountModal
            form={walletAccountForm}
            loading={loading}
            onChange={(key, value) => setWalletAccountForm((current) => ({ ...current, [key]: value }))}
            onSubmit={createWalletAccount}
            onClose={() => setWalletAccountModalOpen(false)}
          />
        )}
        {githubModalOpen && (
          <GitHubModal
            form={githubForm}
            loading={loading}
            onChange={(key, value) => setGithubForm((current) => ({ ...current, [key]: value }))}
            onSubmit={syncGithubProfile}
            onClose={() => setGithubModalOpen(false)}
          />
        )}

        {currentView === 'overview' && (
          <div className="view-fade-in">
            <section className="analytics-grid">
              <MetricCard icon={<Banknote size={20} strokeWidth={1.5} />} label="Savings runway" value={analytics.runway} helper="Months covered" />
              <MetricCard icon={<BriefcaseBusiness size={20} strokeWidth={1.5} />} label="Career readiness" value={twinSummary ? twinSummary.career : analytics.careerReadiness} helper="Twin score" />
              <MetricCard icon={<HeartPulse size={20} strokeWidth={1.5} />} label="Health index" value={twinSummary ? twinSummary.learning : analytics.healthIndex} helper="Learning + health" />
              <MetricCard icon={<Activity size={20} strokeWidth={1.5} />} label="Twin completeness" value={analytics.completeness} helper="Profiles saved" />
            </section>

            <div className="panel twin-summary-panel">
              <div className="panel-title">
                <div>
                  <TwinMark size={20} strokeWidth={1.6} />
                  <h2>Digital Twin Summary</h2>
                </div>
              </div>
              <div className="twin-summary-grid">
                <div className="score-box">
                  <span>Career</span>
                  <strong>{twinSummary ? twinSummary.career : "—"}</strong>
                </div>
                <div className="score-box">
                  <span>Finance</span>
                  <strong>{twinSummary ? twinSummary.finance : "—"}</strong>
                </div>
                <div className="score-box">
                  <span>Learning</span>
                  <strong>{twinSummary ? twinSummary.learning : "—"}</strong>
                </div>
              </div>
              <p className="twin-summary-text">
                {twinData?.prediction?.summary || "Complete your profile to unlock a richer personal twin forecast."}
              </p>
            </div>
          </div>
        )}

        {currentView === 'profiles' && (
          <div className="view-fade-in">
            <div className="domain-tabs" style={{ marginBottom: '24px', maxWidth: '600px' }}>
              <button className={activeProfileTab === 'identity' ? 'active' : ''} onClick={() => { setActiveProfileTab('identity'); setEditingProfile(false); }}>Identity</button>
              <button className={activeProfileTab === 'financial' ? 'active' : ''} onClick={() => { setActiveProfileTab('financial'); setEditingProfile(false); }}>Financial</button>
              <button className={activeProfileTab === 'career' ? 'active' : ''} onClick={() => { setActiveProfileTab('career'); setEditingProfile(false); }}>Career</button>
              <button className={activeProfileTab === 'health' ? 'active' : ''} onClick={() => { setActiveProfileTab('health'); setEditingProfile(false); }}>Health</button>
            </div>

            <section className="profile-layout-single">
              {activeProfileTab === 'identity' && (
                editingProfile ? (
                  <form className="panel" onSubmit={async (event) => { if (await saveUserProfile(event)) setEditingProfile(false); }}>
                    <PanelTitle icon={<UserRound size={18} strokeWidth={2} />} title="Core Identity" badge="Editing" />
                    <div className="form-grid">
                      <SmartField label="Age" type="stepper" value={userForm.age} onChange={(value) => updateUserField("age", value)} config={{ min: 0, max: 100, step: 1 }} />
                      <SmartField label="Gender" type="chips" value={userForm.gender} onChange={(value) => updateUserField("gender", value)} config={{ options: ["Male", "Female", "Non-binary", "Prefer not to say"] }} />
                      <AutoField label="Country" value={userForm.country} onChange={(value) => updateUserField("country", value)} options={COUNTRIES} />
                      <SmartField label="Education" type="chips" value={userForm.education} onChange={(value) => updateUserField("education", value)} config={{ options: ["High school", "Bachelor's", "Master's", "PhD"] }} />
                      <Field label="University" value={userForm.university} onChange={(value) => updateUserField("university", value)} />
                      <SmartField label="CGPA (out of 10)" type="slider" value={userForm.cgpa} onChange={(value) => updateUserField("cgpa", value)} config={{ min: 0, max: 10, step: 0.1 }} />
                      <Field label="Career goal" value={userForm.career_goal} onChange={(value) => updateUserField("career_goal", value)} />
                      <AutoField label="Dream country" value={userForm.dream_country} onChange={(value) => updateUserField("dream_country", value)} options={COUNTRIES} />
                      <SmartField label="Risk tolerance" type="chips" value={userForm.risk_tolerance} onChange={(value) => updateUserField("risk_tolerance", value)} config={{ options: ["Low", "Medium", "High"] }} />
                    </div>
                    <div className="profile-actions">
                      <button className="primary-action compact" disabled={loading}><Save size={16} strokeWidth={2} /> Save identity</button>
                      <button className="secondary-action compact" type="button" onClick={() => setEditingProfile(false)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <ProfileDetails icon={<UserRound size={18} strokeWidth={2} />} title="Core Identity" exists={Boolean(userForm.full_name)} values={[
                    ["Full name", userForm.full_name], ["Email", userForm.email], ["Age", userForm.age], ["Gender", userForm.gender], ["Country", userForm.country], ["Education", userForm.education], ["University", userForm.university], ["CGPA", userForm.cgpa], ["Career goal", userForm.career_goal], ["Dream country", userForm.dream_country], ["Risk tolerance", userForm.risk_tolerance],
                  ]} onEdit={() => setEditingProfile(true)} />
                )
              )}

              {activeProfileTab === 'financial' && (
                <>
                <DomainPanel domain="financial" icon={<Banknote size={18} strokeWidth={2} />} profile={profiles.financial} exists={profileExists.financial} editing={editingProfile} loading={loading} onChange={updateProfileField} onSave={saveDomainProfile} onImport={handleImport} onEdit={() => setEditingProfile(true)} onCancel={() => setEditingProfile(false)} onSync={() => handleImport("financial")} />
                <BankSnapshot snapshot={walletSnapshot} syncedAt={walletSyncedAt} connected={Boolean(walletToken)} />
                </>
              )}

              {activeProfileTab === 'career' && (
                <DomainPanel domain="career" icon={<BriefcaseBusiness size={18} strokeWidth={2} />} profile={profiles.career} exists={profileExists.career} editing={editingProfile} loading={loading} onChange={updateProfileField} onSave={saveDomainProfile} onImport={handleImport} onEdit={() => setEditingProfile(true)} onCancel={() => setEditingProfile(false)} onSync={() => handleImport("career")} />
              )}

              {activeProfileTab === 'health' && (
                <DomainPanel domain="health" icon={<HeartPulse size={18} strokeWidth={2} />} profile={profiles.health} exists={profileExists.health} editing={editingProfile} loading={loading} onChange={updateProfileField} onSave={saveDomainProfile} onImport={handleImport} onEdit={() => setEditingProfile(true)} onCancel={() => setEditingProfile(false)} />
              )}
            </section>
          </div>
        )}

        {currentView === 'simulations' && (
          <div className="view-fade-in simulation-layout">
            <form className="panel simulation-form" onSubmit={runSimulation}>
              <PanelTitle icon={<Play size={18} strokeWidth={2} />} title="Scenario Simulator" />
              <div className="domain-tabs">
                {Object.keys(scenarioGroups).map((domain) => (
                  <button key={domain} type="button" className={activeDomain === domain ? "active" : ""} onClick={() => setActiveDomain(domain)}>
                    {title(domain)}
                  </button>
                ))}
              </div>
              <label>Scenario Type
                <select value={scenario} onChange={(event) => setScenario(event.target.value)}>
                  {scenarioGroups[activeDomain].map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                {scenarioGroups[activeDomain].find((item) => item.value === scenario)?.fields.map(([key, label, type]) => (
                    <Field key={key} label={label} type={type} value={scenarioParams[key] ?? ""} onChange={(value) => setScenarioParams((current) => ({ ...current, [key]: value })) } />
                  ))}
              </div>
              <button className="primary-action compact" disabled={loading}><Play size={16} strokeWidth={2} /> Run simulation</button>
            </form>

            <SimulationResult result={simulationResult} />
          </div>
        )}
      </section>
    </main>
  );

  function updateUserField(key, value) { setUserForm((current) => ({ ...current, [key]: value })); }
  function updateProfileField(domain, key, value) { setProfiles((current) => ({ ...current, [domain]: { ...current[domain], [key]: value } })); }
}

const DOMAIN_FIELDS = {
  financial: [
    ["monthly_income", "Monthly income", "slider", { min: 0, max: 20000, step: 100, prefix: "$" }],
    ["monthly_expense", "Monthly expense", "slider", { min: 0, max: 15000, step: 100, prefix: "$" }],
    ["current_savings", "Current savings", "chip-presets", { options: [0, 5000, 10000, 25000, 50000], prefix: "$" }],
    ["investments", "Investments", "slider", { min: 0, max: 100000, step: 500, prefix: "$" }],
    ["debts", "Debts", "slider", { min: 0, max: 100000, step: 500, prefix: "$" }],
  ],
  career: [
    ["current_role", "Current role", "text"],
    ["years_of_experience", "Years of experience", "stepper", { min: 0, max: 40, step: 1 }],
    ["expected_salary", "Expected salary", "slider", { min: 0, max: 300000, step: 1000, prefix: "$" }],
    ["dream_role", "Dream role", "text"],
    ["skills", "Skills", "tags", { suggestions: ["SQL", "Figma", "Python", "Public speaking", "Project management", "Leadership"] }],
    ["certifications", "Certifications", "tags", { suggestions: ["PMP", "AWS Certified", "Scrum Master", "Six Sigma"] }],
  ],
  health: [
    ["height", "Height", "slider", { min: 120, max: 220, step: 1, suffix: " cm" }],
    ["weight", "Weight", "slider", { min: 30, max: 150, step: 1, suffix: " kg" }],
    ["sleep_hours", "Sleep hours", "stepper", { min: 0, max: 12, step: 0.5 }],
    ["exercise_days", "Exercise days", "stepper", { min: 0, max: 7, step: 1 }],
  ],
};

function DomainPanel({ domain, icon, profile, exists, editing, loading, onChange, onSave, onImport, onEdit, onCancel, onSync }) {
  if (!editing) {
    return (
      <ProfileDetails
        icon={icon}
        title={`${title(domain)} Profile`}
        exists={exists}
        values={DOMAIN_FIELDS[domain].map(([key, label]) => [label, profile[key]])}
        onEdit={onEdit}
        syncLabel={domain === "financial" ? "Sync wallet" : domain === "career" ? "Sync GitHub" : null}
        onSync={onSync}
        loading={loading}
      />
    );
  }

  return (
    <div className="panel">
      <PanelTitle
        icon={icon}
        title={`${title(domain)} Profile`}
        badge="Editing"
        action={<button type="button" className="panel-import" onClick={() => onImport(domain)}><Upload size={14} /> {IMPORT_LABELS[domain]}</button>}
      />
      <div className="form-grid">
        {DOMAIN_FIELDS[domain].map(([key, label, type, config]) => (
          <SmartField key={key} label={label} type={type} config={config} value={profile[key] ?? ""} onChange={(value) => onChange(domain, key, value)} />
        ))}
      </div>
      <div className="profile-actions">
        <button className="secondary-action compact" type="button" onClick={async () => { if (await onSave(domain)) onCancel(); }} disabled={loading}>
          <Save size={16} strokeWidth={2} /> Save {title(domain)}
        </button>
        <button className="secondary-action compact" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
function WalletAuthModal({ mode, form, loading, onModeChange, onChange, onSubmit, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="wallet-auth-title">
        <div className="panel-title">
          <div><Banknote size={18} strokeWidth={2} /><h2 id="wallet-auth-title">Persona Wallet</h2></div>
          <button type="button" className="icon-action" onClick={onClose} aria-label="Close wallet login"><X size={16} /></button>
        </div>
        <p className="modal-copy">Sign in to connect the wallet account used for your financial summary.</p>
        <div className="segmented">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => onModeChange("login")}>Login</button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => onModeChange("signup")}>Sign up</button>
        </div>
        <form className="auth-form" onSubmit={onSubmit}>
          {mode === "signup" && <label>Username <input required value={form.username} onChange={(event) => onChange("username", event.target.value)} /></label>}
          <label>Email <input required type="email" value={form.email} onChange={(event) => onChange("email", event.target.value)} /></label>
          <label>Password <input required type="password" minLength={mode === "signup" ? 8 : undefined} value={form.password} onChange={(event) => onChange("password", event.target.value)} /></label>
          <button className="primary-action" type="submit" disabled={loading}>{mode === "signup" ? "Create wallet account" : "Sign in to wallet"}<ArrowRight size={16} /></button>
        </form>
      </section>
    </div>
  );
}
function WalletAccountModal({ form, loading, onChange, onSubmit, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="wallet-account-title">
        <div className="panel-title">
          <div><Banknote size={18} strokeWidth={2} /><h2 id="wallet-account-title">Add bank account</h2></div>
          <button type="button" className="icon-action" onClick={onClose} aria-label="Close bank account form"><X size={16} /></button>
        </div>
        <p className="modal-copy">Add your first personal account so PersonaTwin can calculate your wallet summary.</p>
        <form className="auth-form" onSubmit={onSubmit}>
          <label>Account name <input required placeholder="Main bank account" value={form.name} onChange={(event) => onChange("name", event.target.value)} /></label>
          <label>Current balance <input type="number" min="0" step="0.01" required value={form.balance} onChange={(event) => onChange("balance", event.target.value)} /></label>
          <label>Currency <input required maxLength={3} value={form.currency} onChange={(event) => onChange("currency", event.target.value.toUpperCase())} /></label>
          <button className="primary-action" type="submit" disabled={loading}>Add account and sync<ArrowRight size={16} /></button>
        </form>
      </section>
    </div>
  );
}
function GitHubModal({ form, loading, onChange, onSubmit, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="github-title">
        <div className="panel-title">
          <div><Github size={18} strokeWidth={2} /><h2 id="github-title">Connect GitHub</h2></div>
          <button type="button" className="icon-action" onClick={onClose} aria-label="Close GitHub connection"><X size={16} /></button>
        </div>
        <p className="modal-copy">Authorize GitHub repository access to infer your skills and career profile.</p>
        <form className="auth-form" onSubmit={onSubmit}>
          <label>GitHub username <input required value={form.username} onChange={(event) => onChange("username", event.target.value)} /></label>
          <label>Personal access token <input type="password" placeholder="Optional for public repositories" value={form.token} onChange={(event) => onChange("token", event.target.value)} /></label>
          <button className="primary-action" type="submit" disabled={loading}>Connect and sync<ArrowRight size={16} /></button>
        </form>
      </section>
    </div>
  );
}
function BankSnapshot({ snapshot, syncedAt, connected }) {
  const twin = snapshot?.financial_twin;
  if (!twin) return null;
  const metric = twin.metrics || {};
  const amount = (value) => value == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));
  return <section className="panel bank-snapshot">
    <h2>Persona Wallet bank data</h2>
    <p className="modal-copy">{connected ? "Refreshes every 30 seconds while this tab is active." : "Reconnect your wallet to receive updates."} Last successful sync: {syncedAt ? new Date(syncedAt).toLocaleString() : "not available"}.</p>
    <p className="modal-copy">Income and expenses use {twin.period?.months} months ({twin.period?.start} – {twin.period?.end}). Account balances are current.</p>
    <dl className="bank-metrics">
      {[["Current bank balance", amount(metric.cash_balance)], ["Declared salary", amount(twin.profile?.monthly_salary)], ["Expense / income", metric.expense_to_income_percent == null ? "—" : `${metric.expense_to_income_percent}%`], ["Monthly EMIs", amount(metric.declared_monthly_emi)], ["Mortgage outstanding", amount(metric.mortgage_outstanding)], ["Estimated net worth", amount(metric.estimated_net_worth)]].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}
    </dl>
    <h3>Bank accounts</h3>
    {(twin.accounts || []).map((account) => <p key={account.id}>{account.name} · {account.currency} {Number(account.balance).toLocaleString("en-IN")}</p>)}
    <h3>Loans and mortgages</h3>
    {(twin.liabilities || []).length ? twin.liabilities.map((loan) => <p key={loan.id}>{loan.name} · outstanding {amount(loan.outstanding_amount)} · EMI {amount(loan.monthly_payment)} · {loan.annual_interest_rate}% · {loan.remaining_months} months remaining</p>) : <p>No liabilities recorded in Persona Wallet.</p>}
    <h3>Recent bank activity</h3>
    <div className="bank-table"><table><thead><tr><th>Date</th><th>Description</th><th>Debit / credit</th><th>Balance</th></tr></thead><tbody>{(twin.recent_transactions || []).map((row) => <tr key={`${row.account_id}-${row.source}-${row.id}`}><td>{row.date}</td><td>{row.description}</td><td>{row.direction === "INFLOW" ? "+" : "−"}{amount(row.amount)}</td><td>{amount(row.balance)}</td></tr>)}</tbody></table></div>
    <p className="modal-copy">Import statements and make transfers in Persona Wallet. This twin mirrors the bank; it does not maintain a separate spendable balance.</p>
  </section>;
}

function ProfileDetails({ icon, title: panelTitle, exists, values, onEdit, syncLabel, onSync, loading }) {
  return (
    <div className="panel profile-details">
      <PanelTitle
        icon={icon}
        title={panelTitle}
        badge={exists ? "Saved" : "Not saved"}
        action={<div className="profile-title-actions">
          {syncLabel && <button type="button" className="panel-import" onClick={onSync} disabled={loading}><RefreshCw size={14} /> {syncLabel}</button>}
          <button type="button" className="secondary-action compact edit-profile" onClick={onEdit}><Pencil size={14} /> Edit</button>
        </div>}
      />
      {exists ? (
        <div className="profile-value-grid">
          {values.map(([label, value]) => (
            <div className="profile-value" key={label}>
              <span>{label}</span>
              <strong>{formatProfileValue(value)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="profile-empty-state">
          <strong>No saved details yet.</strong>
          <span>Click Edit to add this profile.</span>
        </div>
      )}
    </div>
  );
}
function Field({ label, value, onChange, type = "text" }) { return ( <label> {label} <input type={type} step={type === "number" ? "any" : undefined} value={value} onChange={(event) => onChange(event.target.value)} /> </label> ); }
function MetricCard({ icon, label, value, helper }) { return ( <article className="metric-card"> <div className="metric-icon">{icon}</div> <div> <span>{label}</span> <strong>{value}</strong> <small>{helper}</small> </div> </article> ); }
function PanelTitle({ icon, title: panelTitle, badge, action }) { return ( <div className="panel-title"> <div> {icon} <h2>{panelTitle}</h2> </div> <div style={{ display: "flex", alignItems: "center", gap: 10 }}> {badge && <span className="badge">{badge}</span>} {action} </div> </div> ); }
function SimulationResult({ result }) { if (!result) { return ( <div className="panel result-panel empty-result"> <CircleAlert size={32} strokeWidth={1.5} /> <h2>Awaiting Simulation</h2> <p>Choose a domain on the left, tune the assumptions, and run a scenario to see your Twin's projection.</p> </div> ); } return ( <div className="panel result-panel"> <div className="score-ring" style={{ "--score": result.score }}> <span>{Math.round(result.score)}</span> </div> <div className="result-heading"> <span className={`risk ${result.risk_level.toLowerCase()}`}> {result.risk_level} risk </span> <h2>{result.simulation_name}</h2> <p>{result.summary}</p> </div> <div className="metrics-list"> {Object.entries(result.metrics || {}).map(([key, value]) => ( <div key={key}> <span>{readable(key)}</span> <strong>{formatValue(value)}</strong> </div> ))} </div> <div className="recommendations"> <h3>Actionable Next Steps</h3> {result.recommendations.map((item) => ( <p key={item}> <Check size={16} /> {item} </p> ))} </div> </div> ); }
function StatusMessage({ status }) { if (!status.message) return null; return <div className={`status ${status.type}`}>{status.message}</div>; }
function defaultParams(scenarioConfig) { return Object.fromEntries( scenarioConfig.fields.map(([key, , , fallback]) => [key, fallback]), ); }
function nullableToInput(record) { return Object.fromEntries( Object.entries(record).map(([key, value]) => [key, value ?? ""]), ); }
function cleanPayload(form, numericKeys = []) { const payload = {}; for (const [key, value] of Object.entries(form)) { if (value === "" || value === null || value === undefined) continue; payload[key] = numericKeys.includes(key) ? Number(value) : value; } return payload; }
function buildProfilePayload(domain, form) { if (domain === "career") { return { current_role: form.current_role, years_of_experience: Number(form.years_of_experience), expected_salary: Number(form.expected_salary), dream_role: form.dream_role, skills: splitList(form.skills), certifications: splitList(form.certifications), }; } const numericKeys = Object.keys(emptyProfiles[domain]); return cleanPayload(form, numericKeys); }
function profileToForm(domain, profile) { const form = nullableToInput(profile); if (domain === "career") { form.skills = Array.isArray(profile.skills) ? profile.skills.join(", ") : ""; form.certifications = Array.isArray(profile.certifications) ? profile.certifications.join(", ") : ""; } return form; }
function splitList(value) { return String(value || "") .split(",") .map((item) => item.trim()) .filter(Boolean); }
function calculateAnalytics(userForm, profiles, profileExists) { const income = Number(profiles.financial.monthly_income) || 0; const expense = Number(profiles.financial.monthly_expense) || 0; const savings = Number(profiles.financial.current_savings) || 0; const runwayValue = expense > 0 ? savings / expense : 0; const runway = runwayValue > 0 ? `${runwayValue.toFixed(1)} mo` : "0 mo"; const skills = splitList(profiles.career.skills).length; const certs = splitList(profiles.career.certifications).length; const years = Number(profiles.career.years_of_experience) || 0; const careerScore = profileExists.career ? Math.min(100, Math.round(years * 8 + skills * 8 + certs * 6)) : 0; const sleep = Number(profiles.health.sleep_hours) || 0; const exercise = Number(profiles.health.exercise_days) || 0; const sleepScore = Math.max(0, 100 - Math.abs(7.5 - sleep) * 18); const activityScore = Math.min(100, exercise * 18); const healthScore = profileExists.health ? Math.round((sleepScore + activityScore) / 2) : 0; const savedDomains = Object.values(profileExists).filter(Boolean).length; const completeness = `${Math.round((savedDomains / 3) * 100)}%`; return { runway, careerReadiness: `${careerScore}%`, healthIndex: `${healthScore}%`, completeness, }; }
function formatValue(value) { if (typeof value === "number") { return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2); } return String(value); }
function formatProfileValue(value) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not set";
  if (value === "" || value === null || value === undefined) return "Not set";
  return formatValue(value);
}
function readable(key) { return key.replaceAll("_", " "); }
function title(value) { return value.charAt(0).toUpperCase() + value.slice(1); }

createRoot(document.getElementById("root")).render(<App />);
