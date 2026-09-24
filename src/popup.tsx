import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConfigManager, DEFAULT_CONFIG } from "./modules/ConfigManager";
import { Config, KeyConfig } from "./types";
import "./popup.css";

const configManager = new ConfigManager();

// Labels shown to the user (action -> English label).
const KEY_LABELS: Record<keyof KeyConfig, string> = {
  speedUp: "Increase speed",
  speedDown: "Decrease speed",
  resetSpeed: "Reset speed (1x)",
  skipForward: "Seek forward",
  skipBack: "Seek backward",
  mute: "Mute / unmute",
  boost: "Boost volume",
  boostDown: "Lower volume",
  captions: "Toggle captions",
  screenshot: "Screenshot",
  nextChapter: "Next chapter (YouTube)",
};

/** Display the key name in a readable way on the keycap, such as ArrowUp -> Up. */
function displayKey(key: string): string {
  const map: Record<string, string> = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    " ": "Space",
  };
  if (map[key]) return map[key];
  return key.length === 1 ? key.toUpperCase() : key;
}

function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [listening, setListening] = useState<keyof KeyConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<number>();

  useEffect(() => {
    configManager.load().then(setConfig);
  }, []);

  // Rebinding: while listening, capture the next pressed key.
  useEffect(() => {
    if (!listening || !config) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === "Escape") {
        setListening(null);
        return;
      }
      const value = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      update({ keys: { ...config.keys, [listening]: value } });
      setListening(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listening, config]);

  function update(patch: Partial<Config>) {
    if (!config) return;
    const next: Config = {
      keys: { ...config.keys, ...(patch.keys ?? {}) },
      limits: { ...config.limits, ...(patch.limits ?? {}) },
      steps: { ...config.steps, ...(patch.steps ?? {}) },
      hideSpeedFromSite: patch.hideSpeedFromSite ?? config.hideSpeedFromSite,
    };
    setConfig(next);
    void configManager.save(next);
    flashSaved();
  }

  function flashSaved() {
    setSaved(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 1200);
  }

  function resetAll() {
    setConfig(DEFAULT_CONFIG);
    void configManager.reset();
    flashSaved();
  }

  if (!config) {
    return <div className="app">Loading...</div>;
  }

  const numField = (
    label: string,
    value: number,
    onChange: (n: number) => void,
    step = 0.1
  ) => (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
      />
    </div>
  );

  return (
    <div className="app">
      <div className="header">
        <h1>
          <span className="dot" />
          Video Master
        </h1>
        <span className="ver">v1.0</span>
      </div>

      <div className="section-label">Shortcuts - click to change</div>
      {(Object.keys(KEY_LABELS) as (keyof KeyConfig)[]).map((action) => (
        <div className="row" key={action}>
          <span className="name">{KEY_LABELS[action]}</span>
          <button
            className={`keycap ${listening === action ? "listening" : ""}`}
            onClick={() => setListening(action)}
          >
            {listening === action ? "press..." : displayKey(config.keys[action])}
          </button>
        </div>
      ))}

      <div className="section-label">Limits</div>
      <div className="grid">
        {numField("Max speed", config.limits.maxSpeed, (n) =>
          update({ limits: { ...config.limits, maxSpeed: n } })
        )}
        {numField("Max volume", config.limits.maxGain, (n) =>
          update({ limits: { ...config.limits, maxGain: n } })
        )}
      </div>

      <div className="section-label">Step amounts</div>
      <div className="grid">
        {numField("Speed step", config.steps.speed, (n) =>
          update({ steps: { ...config.steps, speed: n } })
        )}
        {numField(
          "Seek (sec)",
          config.steps.skip,
          (n) => update({ steps: { ...config.steps, skip: n } }),
          1
        )}
      </div>

      <div className="section-label">Privacy</div>
      <div className="row">
        <span className="name">Hide speed from site (site sees 1x)</span>
        <input
          type="checkbox"
          checked={config.hideSpeedFromSite}
          onChange={(e) => update({ hideSpeedFromSite: e.target.checked })}
        />
      </div>

      <div className="footer">
        <span className={`saved ${saved ? "show" : ""}`}>Saved</span>
        <button className="reset" onClick={resetAll}>
          Reset
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
