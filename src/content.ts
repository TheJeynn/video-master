import { ConfigManager } from "./modules/ConfigManager";
import { DOMObserver } from "./modules/DOMObserver";
import { InputHandler } from "./modules/InputHandler";
import { VideoController } from "./modules/VideoController";
import { Config } from "./types";

/**
 * Content script. Runs on every page, wires modules together, and routes the
 * pressed key to the matching action (Action Dispatcher).
 */
(async function main(): Promise<void> {
  const configManager = new ConfigManager();
  let config: Config = await configManager.load();

  const controller = new VideoController();
  controller.setSpoofEnabled(config.hideSpeedFromSite);
  configManager.onChange((updated) => {
    config = updated;
    controller.setSpoofEnabled(updated.hideSpeedFromSite);
  });

  await controller.init();
  const observer = new DOMObserver((video) => controller.setVideo(video));
  observer.start();

  // YouTube SPA navigasyonu (ana sayfa->video, önerilen->video, arama->video)
  // tamamlandığında hedef hızı yeni video elementine yeniden uygula.
  // yt-navigate-finish YouTube'un kendi olayıdır ve her geçişte tetiklenir.
  if (location.hostname.includes("youtube.com")) {
    const reapplyRate = () => {
      controller.reapplyRateWithRetries();
    };

    document.addEventListener("yt-navigate-start", reapplyRate);
    document.addEventListener("yt-navigate-finish", reapplyRate);
    document.addEventListener("yt-page-data-updated", reapplyRate);
    document.addEventListener("yt-player-updated", reapplyRate);
    window.addEventListener("popstate", reapplyRate);
    window.addEventListener("pageshow", reapplyRate);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) reapplyRate();
    });
  }

  // --- On-screen feedback (toast) ----------------------------------------

  let toastEl: HTMLDivElement | null = null;
  let toastTimer: number | undefined;

  function showToast(text: string): void {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.setAttribute("data-video-master", "toast");
      Object.assign(toastEl.style, {
        position: "fixed",
        top: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "2147483647",
        padding: "10px 18px",
        borderRadius: "10px",
        background: "rgba(17, 17, 19, 0.92)",
        color: "#fafafa",
        font: '600 15px/1.2 ui-monospace, "SF Mono", Menlo, monospace',
        letterSpacing: "0.02em",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        pointerEvents: "none",
        opacity: "0",
        transition: "opacity 120ms ease",
      } as CSSStyleDeclaration);
      document.documentElement.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.style.opacity = "1";
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      if (toastEl) toastEl.style.opacity = "0";
    }, 900);
  }

  // --- Action Dispatcher --------------------------------------------------

  const inputHandler = new InputHandler((key, event) => {
    // Rule 3: do nothing if there is no active video.
    if (!controller.hasVideo()) return;

    const k = config.keys;
    // Lowercase single-character keys; preserve special keys such as "ArrowUp".
    const pressed = key.length === 1 ? key.toLowerCase() : key;
    let handled = true;

    switch (pressed) {
      case k.speedUp: {
        const v = controller.speedUp(config.steps.speed, config.limits.maxSpeed);
        if (v == null) handled = false;
        else showToast(`Speed ${v.toFixed(2)}x`);
        break;
      }
      case k.speedDown: {
        const v = controller.speedDown(config.steps.speed, config.limits.minSpeed);
        if (v == null) handled = false;
        else showToast(`Speed ${v.toFixed(2)}x`);
        break;
      }
      case k.resetSpeed: {
        const v = controller.resetSpeed();
        if (v == null) handled = false;
        else showToast("Speed 1.00x");
        break;
      }
      case k.skipForward: {
        const ok = controller.skip(config.steps.skip);
        if (!ok) handled = false;
        else showToast(`Forward +${config.steps.skip}s`);
        break;
      }
      case k.skipBack: {
        const ok = controller.skip(-config.steps.skip);
        if (!ok) handled = false;
        else showToast(`Back -${config.steps.skip}s`);
        break;
      }
      case k.mute: {
        const muted = controller.toggleMute();
        if (muted == null) handled = false;
        else showToast(muted ? "Muted" : "Unmuted");
        break;
      }
      case k.boost: {
        const g = controller.boost(config.steps.gain, config.limits.maxGain);
        if (g != null) showToast(`Volume ${Math.round(g * 100)}%`);
        break;
      }
      case k.boostDown: {
        const g = controller.boostDown(config.steps.gain);
        if (g != null) showToast(`Volume ${Math.round(g * 100)}%`);
        break;
      }
      case k.captions: {
        const state = controller.toggleCaptions();
        if (state == null) handled = false;
        else showToast(state ? "CC On" : "CC Off");
        break;
      }
      case k.screenshot: {
        const ok = controller.screenshot();
        showToast(ok ? "Screenshot saved" : "CORS blocked");
        break;
      }
      case k.nextChapter: {
        const ok = controller.nextChapter();
        if (!ok) handled = false;
        else showToast("Next chapter");
        break;
      }
      default:
        handled = false;
    }

    // If an action ran, prevent the website from handling the same shortcut.
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  });

  inputHandler.attach();

  console.info(
    "[VideoMaster] v1.3 yüklendi — yapışkan hız + YouTube navigasyon kancası aktif."
  );
})();
