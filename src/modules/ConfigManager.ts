import { Config } from "../types";

/**
 * Default settings. Based on the documented GLOBAL_STATE_SCHEMA.
 */
export const DEFAULT_CONFIG: Config = {
  keys: {
    speedUp: "d",
    speedDown: "s",
    resetSpeed: "r",
    skipForward: "a",
    skipBack: "z",
    mute: "m",
    boost: "e",
    boostDown: "q",
    captions: "c",
    screenshot: "p",
    nextChapter: "n",
  },
  limits: {
    maxSpeed: 16,    // Browser playbackRate technical upper limit is around 16.
    minSpeed: 0.1,
    maxGain: 3.0,
  },
  steps: {
    speed: 0.1,
    skip: 10,
    gain: 0.1,
  },
};

/**
 * ConfigManager manages settings.
 * It reads/writes asynchronously through chrome.storage.sync and merges missing
 * fields with defaults for backward compatibility.
 */
export class ConfigManager {
  private config: Config = DEFAULT_CONFIG;

  async load(): Promise<Config> {
    try {
      const stored = await chrome.storage.sync.get("config");
      if (stored && stored.config) {
        this.config = this.merge(DEFAULT_CONFIG, stored.config);
      }
    } catch (err) {
      console.warn("[VideoMaster] Settings could not be loaded; using defaults.", err);
    }
    return this.config;
  }

  get(): Config {
    return this.config;
  }

  async save(config: Config): Promise<void> {
    this.config = config;
    await chrome.storage.sync.set({ config });
  }

  async reset(): Promise<Config> {
    this.config = DEFAULT_CONFIG;
    await chrome.storage.sync.set({ config: DEFAULT_CONFIG });
    return this.config;
  }

  /** Notifies every tab when settings change, for example after saving from the popup. */
  onChange(callback: (config: Config) => void): void {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes.config && changes.config.newValue) {
        this.config = this.merge(DEFAULT_CONFIG, changes.config.newValue);
        callback(this.config);
      }
    });
  }

  /** Safely overlays user settings on top of defaults. */
  private merge(base: Config, override: Partial<Config>): Config {
    const keys = { ...base.keys, ...(override.keys ?? {}) };
    if (keys.boost === "ArrowUp") keys.boost = base.keys.boost;
    if (keys.boostDown === "ArrowDown") keys.boostDown = base.keys.boostDown;

    return {
      keys,
      limits: { ...base.limits, ...(override.limits ?? {}) },
      steps: { ...base.steps, ...(override.steps ?? {}) },
    };
  }
}
