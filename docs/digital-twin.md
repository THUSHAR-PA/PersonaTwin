# Digital Twin dashboard

Implemented on `feature/digital-twin-dashboard`, based on `main` at `8ff5340`.
The page is available after signing in through **Digital Twin** in the existing
navigation. It uses the application's existing state-based navigation; it does not
add a separate router or change the default Chat workspace.

## Implementation

1. Aggregate live saved profiles and recent decisions through an owned, read-only
   `GET /users/{user_id}/twin/dashboard` endpoint.
2. Present those values in a lazy-loaded React page, with source labels, missing
   values and detailed dialogs. Keep current profile values separate from saved
   projections.
3. Render an original procedural humanoid with Three.js, React Three Fiber and
   Drei, independently of API/data handling.
4. Reuse profile editing, Wallet/GitHub sync and the saved simulation workspace.
   A simulation opened from a Twin dialog loads its exact saved decision ID.

The endpoint reuses `current_state_data` and the existing `DigitalTwin` career
heuristic. It performs no writes, training, Wallet requests or model calls. It
returns a whitelisted presentation of the user's data, without tokens, password
hashes, email addresses, account statements or raw Wallet payloads. No database
migration is added.

## Data meaning

| Module | Available source | Explicit limits |
| --- | --- | --- |
| Financial | Saved financial profile, including its last Wallet sync; monthly income/expenses, savings, investments and debts | Savings rate is calculated. Zero income gives an unavailable rate. Risk classification is unavailable because the risk model is not connected. |
| Career | Current/target role, experience, entered salary expectation and existing career score | Score is a descriptive heuristic. Expected salary is not a prediction; the profile does not record its currency or pay period. Learned salary/opportunity predictions are unavailable. |
| Skills | Saved skill list, including any prior GitHub sync | No invented gaps, alignment scores or learning recommendations. Their models are not connected. |
| Goals | Profile career goal, dream role/country and the latest four saved savings-goal simulations | Savings/target progress uses current savings in the same confirmed currency. It is not earmarked money, and goals may overlap. Personal deadlines and milestone tracking are not implemented by the existing backend. |
| Health | Entered height, weight, sleep and exercise frequency | Self-reported indicators; no wearable feed or medical predictions. The avatar is a visual representation, not a body scan. |
| Decisions | Latest six saved runs; original full results through the existing decision-detail endpoint | Projections retain the original inputs and date. Changing the preview branch does not modify profiles or rerun the engine. New simulations use the existing workspace. |

INR data uses Indian number grouping and the rupee symbol. Other confirmed
currencies retain their own currency; no conversion is invented. Unconfirmed
amounts have no currency symbol. Aggregate mixed-currency amounts are hidden and
goal progress is unavailable. Manual edits to a Wallet-derived profile are labeled
as an edited wallet profile.

Dashboard refresh reads the latest persisted data. It runs on mount, manually,
on return to a visible tab, every 30 seconds while visible, and after a successful
Wallet sync changes the parent's sync timestamp. Existing Wallet polling remains
responsible for fetching new Wallet data. Requests are single-flight, time out
after 15 seconds and are aborted on unmount/account change. Transient failures
retain a dated last view; authentication failures clear private dashboard values.
Dashboard data is not written to browser storage.

## 3D and accessibility

- Original, parametric full-body geometry: torso, head, nose, limbs, hands and
  fingers. No external model, texture, font, CDN or model license is required.
- Cyan/blue translucent Fresnel shader, geometric wireframe, vertical scan band,
  energy paths, internal points, illuminated joints, subtle breathing and idle pose.
- Concentric platform rings, moving halo, atmospheric points and floor grid.
- Drag rotation, wheel/pinch zoom, named rotation/zoom/reset buttons, arrow-key
  rotation, `+`/`−` zoom and `Home` reset when the scene is focused.
- Canvas uses demand rendering for reduced motion, manual pause, hidden tabs and
  offscreen scenes. DPR is capped at 1.5 and can fall to 1 under load. Geometry is
  merged, joints are instanced, buffers are reused and resources are disposed.
- Page and 3D code are loaded separately; the Three.js payload is not loaded for
  Chat, Profiles, Overview or Simulations. The lazy 3D bundle is approximately
  231 KB gzipped; Vite reports its normal 500 KB uncompressed chunk warning.
- Data is readable HTML, independent of WebGL. A capability check, scene error
  boundary and context-loss handler provide a retryable fallback. Native dialogs
  support keyboard focus and Escape. Projection values also have an exact table.
- Dark styling is scoped to this page. Desktop panels flank the avatar; smaller
  screens move the avatar above the panels. All controls have accessible names.

## Run locally

Use the existing configured PersonaTwin database and authentication environment.
Restart the backend so it includes the new route. From `backend`, with the existing
virtual environment activated:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

From `frontend`:

```bash
npm ci
npm run dev
```

Sign in and select **Digital Twin**. Add missing data through Profiles; use the
existing Wallet/GitHub connections as needed. Save a simulation to populate goal
targets, scenario previews and explanations. No demo profile is injected into the
application. Test fixtures use explicitly synthetic disposable accounts.

## Interactive preview

Open https://personatwin-digital-twin-preview.soundglade128.chatgpt.site.
This private preview reuses the actual page, dialogs and interactive 3D scene.
Its prominent notice identifies all sample data as fictional. No account, Wallet
or backend is connected; profile editing and new simulations require the full app.
The example/empty toggle demonstrates populated and unavailable-data states.

The preview has a separate entry point and build configuration. Demo hooks are
aliased only by `vite.twin-preview.config.js`; the normal authenticated build uses
the real API and includes no demo profile. Run `npm run build:preview` to reproduce
the preview in `frontend/dist-preview`. Feature code is pushed in draft PR #3;
main has not been merged.

## Verification

Verified locally on October 12, 2026:

- **86 backend tests passed**, including ownership, read-only aggregation, real
  zero versus missing data, currency handling, Wallet provenance, private-field
  exclusion and unchanged saved predictions after profile updates.
- **11 frontend component/geometry tests passed**. These cover data loading,
  refresh/recovery, session expiry, account-switch races, visible-tab polling,
  view/detail interactions, saved-decision navigation, honest number formatting
  and bounded finite humanoid geometry. Component tests deliberately use jsdom's
  no-WebGL environment; they do not establish GPU rendering or visual quality.
- Production build and whitespace checks passed.
- Playwright journeys were added for desktop/mobile data flows, actual WebGL
  rendering, mouse/keyboard controls, reduced motion, context loss, fallback,
  responsive widths and API failures. **They could not run here:** Chromium's
  required local socket is blocked, and the environment's approval policy rejected
  an out-of-sandbox run. Browser launch stopped before product assertions.
- GitHub Actions subsequently passed for feature commit `587a6fb`: backend tests,
  PostgreSQL migration round trip, API smoke checks, component tests, build and
  desktop/mobile browser journeys. Actual WebGL interaction and fallback checks
  ran on the remote runner. Desktop, 320px and WebGL screenshots were inspected.
- The private demo preview is deployed. Full app production deployment, live
  Wallet acceptance and real-model quality remain unverified.

Repeat the checks:

```bash
# backend (activated environment)
python -m pytest tests -q

# frontend
npm test
npm run build
npx playwright install chromium
npm run test:e2e -- tests/digital-twin.spec.js
```

The browser suite needs the backend running on port 8000 and starts its own Vite
server on port 5174. It creates and deletes disposable accounts. The existing CI
workflow runs the full browser suite and now also runs the component tests. Remote
CI results should be checked on the feature branch before merging.

Before merging, confirm the latest branch's checks and verify the hologram's
appearance and interaction on the target laptop.

## Source map

| File | Responsibility |
| --- | --- |
| `backend/app/services/twin_dashboard_service.py` | Read-only profile/decision presentation and provenance |
| `backend/app/api/twin.py` | Owned dashboard endpoint alongside existing APIs |
| `frontend/src/digital-twin/useTwinDashboard.js` | Refresh, cancellation and saved-decision retrieval |
| `frontend/src/digital-twin/DigitalTwinPage.jsx` | Page, domain focus and scenario preview |
| `frontend/src/digital-twin/TwinPanels.jsx` | Readable floating panels |
| `frontend/src/digital-twin/TwinDetails.jsx` | Detail dialogs and existing-feature navigation |
| `frontend/src/digital-twin/Projection.jsx` | Exact saved trajectory chart and table |
| `frontend/src/digital-twin/SceneViewport.jsx` | Capability/failure handling and accessible controls |
| `frontend/src/digital-twin/HologramScene.jsx` | Scene, animations, camera and performance |
| `frontend/src/digital-twin/humanoid.js` | Original geometry and hologram shader |
| `frontend/src/digital-twin/digital-twin.css` | Scoped dark theme and responsive layout |
| `frontend/src/main.jsx`, `DecisionWorkspace.jsx` | Existing navigation integration and saved-run handoff |
