import React, {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Focus,
  Minus,
  Pause,
  Play,
  Plus,
} from "lucide-react";

const HologramScene = lazy(() => import("./HologramScene"));

class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export default function SceneViewport({ accent, name, viewLabel }) {
  const [supported, setSupported] = useState(supportsWebGL);
  const [failed, setFailed] = useState(false),
    [ready, setReady] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [paused, setPaused] = useState(false),
    [reduced, setReduced] = useState(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  const [visible, setVisible] = useState(true),
    [inView, setInView] = useState(true),
    [command, setCommand] = useState(null);
  const container = useRef();
  const send = (action) =>
    setCommand((previous) => ({
      action,
      sequence: (previous?.sequence || 0) + 1,
    }));
  const onReady = useCallback(() => setReady(true), []);
  const onLost = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const preference = () => setReduced(query.matches);
    const visibility = () => setVisible(document.visibilityState === "visible");
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.05 },
    );
    observer.observe(container.current);
    query.addEventListener("change", preference);
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => {
      observer.disconnect();
      query.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const fallback = !supported || failed;
  const keyboard = (event) => {
    if (event.target !== event.currentTarget || fallback) return;
    const key = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
      "+": "in",
      "=": "in",
      "-": "out",
      Home: "reset",
    }[event.key];
    if (key) {
      event.preventDefault();
      send(key);
    }
  };
  return (
    <div className="dt-avatar-column" ref={container}>
      <div className="dt-scene-kicker" aria-hidden="true">
        <span className="dt-dot" />{" "}
        {viewLabel === "All systems"
          ? "PERSONAL TWIN"
          : viewLabel.toUpperCase()}{" "}
        <span className="dt-scene-index">PT / 01</span>
      </div>
      <div
        className="dt-scene"
        data-testid="hologram"
        data-render-state={fallback ? "fallback" : ready ? "ready" : "loading"}
        data-motion={reduced || paused ? "paused" : "active"}
        role="group"
        aria-label="Interactive holographic human"
        tabIndex={fallback ? -1 : 0}
        aria-describedby="twin-control-help"
        onKeyDown={keyboard}
      >
        {!fallback && (
          <SceneBoundary key={attempt} onError={onLost}>
            <Suspense fallback={null}>
              <HologramScene
                animate={!paused && !reduced && visible && inView}
                accent={accent}
                command={command}
                onReady={onReady}
                onLost={onLost}
              />
            </Suspense>
          </SceneBoundary>
        )}
        {!fallback && !ready && (
          <div className="dt-scene-loading" role="status">
            <Box size={28} />
            <span>Initializing your hologram…</span>
          </div>
        )}
        {fallback && (
          <div className="dt-scene-fallback" role="status">
            <Box size={48} strokeWidth={1} />
            <h3>3D view unavailable</h3>
            <p>
              Your data panels are ready to explore. A WebGL 2 capable browser
              is needed for the hologram.
            </p>
            <button
              className="dt-button"
              onClick={() => {
                setSupported(supportsWebGL());
                setFailed(false);
                setReady(false);
                setAttempt((value) => value + 1);
              }}
            >
              Retry 3D view
            </button>
          </div>
        )}
      </div>
      <div className="dt-avatar-caption">
        <span className="dt-bracket" aria-hidden="true">
          ⌖
        </span>
        <div>
          <strong>{name || "Your digital counterpart"}</strong>
          <small>PERSONAL DIGITAL TWIN</small>
        </div>
        <span className="dt-bracket" aria-hidden="true">
          ⌖
        </span>
      </div>
      <div
        className="dt-scene-controls"
        role="group"
        aria-label="Avatar controls"
      >
        {[
          ["left", "Rotate left", ChevronLeft],
          ["right", "Rotate right", ChevronRight],
          ["out", "Zoom out", Minus],
          ["in", "Zoom in", Plus],
          ["reset", "Reset view", Focus],
        ].map(([action, label, Icon]) => (
          <button
            key={action}
            type="button"
            title={label}
            aria-label={label}
            disabled={fallback || !ready}
            onClick={() => send(action)}
          >
            <Icon size={16} />
          </button>
        ))}
        <span />
        <button
          type="button"
          title={
            reduced
              ? "Reduced motion enabled"
              : paused
                ? "Resume animation"
                : "Pause animation"
          }
          aria-label={
            reduced
              ? "Reduced motion enabled"
              : paused
                ? "Resume animation"
                : "Pause animation"
          }
          aria-pressed={paused || reduced}
          disabled={fallback || reduced}
          onClick={() => setPaused((value) => !value)}
        >
          {paused || reduced ? <Play size={15} /> : <Pause size={15} />}
        </button>
      </div>
      <p id="twin-control-help" className="dt-control-help">
        {reduced ? "Reduced motion · " : ""}Drag to rotate · scroll to zoom
        <br />
        <span>Keyboard: arrows, + / −, Home to reset</span>
      </p>
    </div>
  );
}
