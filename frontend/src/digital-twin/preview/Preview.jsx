import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowUpRight, Orbit, X } from "lucide-react";
import DigitalTwinPage from "../DigitalTwinPage";
import { DemoContext } from "./demoHooks";
import "../../styles.css";
import "./preview.css";

const guide = "https://github.com/THUSHAR-PA/PersonaTwin/blob/feature/digital-twin-dashboard/docs/digital-twin.md";
function ConnectedAppInfo({ onClose }) {
  const dialog = useRef();
  useEffect(() => {
    dialog.current.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="dt-dialog" onClose={onClose} aria-labelledby="preview-info-title">
      <div className="dt-dialog-inner">
        <header>
          <div><span className="dt-eyebrow">CONNECTED APPLICATION</span><h2 id="preview-info-title">Bring your own twin to life</h2></div>
          <button className="dt-icon-button" aria-label="Close preview information" autoFocus onClick={() => dialog.current.close()}><X size={20} /></button>
        </header>
        <p>This preview runs the actual Digital Twin interface and 3D scene with a fictional example profile.</p>
        <p>Profile editing, new simulations and sign-in are available in PersonaTwin with its FastAPI backend running. Your account, Wallet and personal data are not connected to this preview.</p>
        <p>You can explore every data panel, switch the saved demo scenario between current plan and proposed change, and rotate or zoom the hologram here.</p>
        <a className="dt-button dt-primary" href={guide} target="_blank" rel="noreferrer">Open full application setup <ArrowUpRight size={16} /></a>
      </div>
    </dialog>
  );
}
function Preview() {
  const [empty, setEmpty] = useState(false);
  const [info, setInfo] = useState(false);
  return (
    <DemoContext.Provider value={empty}>
      <div className="preview-shell">
        <nav className="preview-nav" aria-label="Preview navigation">
          <a className="preview-brand" href="#main"><Orbit size={24} />PersonaTwin<span> / DIGITAL TWIN</span></a>
          <a href="https://github.com/THUSHAR-PA/PersonaTwin/pull/3" target="_blank" rel="noreferrer">View implementation <ArrowUpRight size={14} /></a>
        </nav>
        <aside className="preview-notice" aria-label="Demo data notice">
          <div><strong>Interactive preview · demo data</strong><span>Fictional example profile. Your account and backend are not connected.</span></div>
          <div className="preview-mode" role="group" aria-label="Demo profile">
            <button aria-pressed={!empty} onClick={() => setEmpty(false)}>Example profile</button>
            <button aria-pressed={empty} onClick={() => setEmpty(true)}>Empty profile</button>
          </div>
        </aside>
        <main id="main">
          <DigitalTwinPage userId="demo" token="" name="Demo persona" onOpenProfile={() => setInfo(true)} onOpenSimulations={() => setInfo(true)} onSignIn={() => setInfo(true)} />
        </main>
        {info && <ConnectedAppInfo onClose={() => setInfo(false)} />}
      </div>
    </DemoContext.Provider>
  );
}
createRoot(document.getElementById("root")).render(<Preview />);
