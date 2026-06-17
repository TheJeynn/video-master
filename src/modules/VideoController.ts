/**
 * VideoController: the core engine that manipulates the target video.
 *
 * Volume boost uses the Web Audio API. AudioContext is started only after a
 * user gesture. Because createMediaElementSource can be called only ONCE for
 * the same <video> element, created audio nodes are stored per element in a
 * WeakMap. When the element leaves the DOM, it can be garbage-collected.
 */
export class VideoController {
  private video: HTMLVideoElement | null = null;
  private audioContext: AudioContext | null = null;
  private nodes = new WeakMap<
    HTMLVideoElement,
    { source: MediaElementAudioSourceNode; gain: GainNode }
  >();

  setVideo(video: HTMLVideoElement | null): void {
    this.video = video;
  }

  getVideo(): HTMLVideoElement | null {
    return this.resolveVideo();
  }

  /** Is the active video still in the DOM? SPA transitions can detach it. */
  hasVideo(): boolean {
    return this.resolveVideo() !== null;
  }

  // --- Speed control ------------------------------------------------------

  speedUp(step: number, max: number): number | undefined {
    const video = this.resolveVideo();
    if (!video) return;
    video.playbackRate = this.round(
      Math.min(video.playbackRate + step, max)
    );
    return video.playbackRate;
  }

  speedDown(step: number, min: number): number | undefined {
    const video = this.resolveVideo();
    if (!video) return;
    video.playbackRate = this.round(
      Math.max(video.playbackRate - step, min)
    );
    return video.playbackRate;
  }

  resetSpeed(): number | undefined {
    const video = this.resolveVideo();
    if (!video) return;
    video.playbackRate = 1;
    return 1;
  }

  // --- Time control -------------------------------------------------------

  skip(seconds: number): boolean {
    const video = this.resolveVideo();
    if (!video) return false;
    const duration = isFinite(video.duration) ? video.duration : Infinity;
    video.currentTime = Math.max(
      0,
      Math.min(video.currentTime + seconds, duration)
    );
    return true;
  }

  toggleMute(): boolean | undefined {
    const video = this.resolveVideo();
    if (!video) return;
    video.muted = !video.muted;
    return video.muted;
  }

  // --- Volume boost (Web Audio API) --------------------------------------

  /**
   * Prepares the gain node for the active video. AudioContext is created only
   * here, after a key press, so the browser's user gesture rule is respected.
   */
  private ensureGain(): GainNode | null {
    const video = this.resolveVideo();
    if (!video) return null;
    try {
      if (!this.audioContext) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        this.audioContext = new Ctx();
      }
      if (this.audioContext.state === "suspended") {
        void this.audioContext.resume();
      }

      let entry = this.nodes.get(video);
      if (!entry) {
        const source = this.audioContext.createMediaElementSource(video);
        const gain = this.audioContext.createGain();
        source.connect(gain);
        gain.connect(this.audioContext.destination);
        entry = { source, gain };
        this.nodes.set(video, entry);
      }
      return entry.gain;
    } catch (err) {
      console.warn("[VideoMaster] AudioContext could not be started.", err);
      return null;
    }
  }

  boost(step: number, maxGain: number): number | undefined {
    const gain = this.ensureGain();
    if (!gain) return;
    gain.gain.value = this.round(Math.min(gain.gain.value + step, maxGain));
    return gain.gain.value;
  }

  boostDown(step: number): number | undefined {
    const gain = this.ensureGain();
    if (!gain) return;
    gain.gain.value = this.round(Math.max(gain.gain.value - step, 0));
    return gain.gain.value;
  }

  // --- Caption control ----------------------------------------------------

  toggleCaptions(): boolean | undefined {
    const youtubeState = this.toggleYouTubeCaptions();
    if (youtubeState != null) return youtubeState;
    return this.toggleNativeCaptions();
  }

  private toggleYouTubeCaptions(): boolean | undefined {
    if (!location.hostname.includes("youtube.com")) return;

    const button = this.findYouTubeCaptionsButton();
    if (!button) return;

    // Read the previous state from the most reliable source, click, then invert.
    const wasOn = this.readCaptionsState(button);
    button.click();
    return !wasOn;
  }

  /**
   * Reads whether the button is currently on. The classic player has
   * aria-pressed; the Shorts button usually does not, so aria-label hints such
   * as "turn off" or "disable" are used. The label describes the next action,
   * so "turn off captions" means captions are currently ON.
   */
  private readCaptionsState(button: HTMLElement): boolean {
    const pressed = button.getAttribute("aria-pressed");
    if (pressed === "true") return true;
    if (pressed === "false") return false;

    const label = (button.getAttribute("aria-label") ?? "").toLowerCase();
    if (/\u006b\u0061\u0070\u0061\u0074|turn off|disable|\u0067\u0069\u007a\u006c\u0065|hide/.test(label)) return true;
    if (/\u0061\u00e7|turn on|enable|g\u00f6ster|show/.test(label)) return false;

    return false; // Unknown state is treated as off.
  }

  private findYouTubeCaptionsButton(): HTMLButtonElement | null {
    const isShorts = location.pathname.startsWith("/shorts");

    // Shorts can include a hidden classic-player CC button in the background;
    // clicking it does not change visible captions, so skip it on Shorts.
    if (!isShorts) {
      const playerButton = document.querySelector<HTMLButtonElement>(
        ".ytp-subtitles-button"
      );
      if (playerButton) return playerButton;
    }

    const labelPattern = /altyaz|subtitle|caption|\bcc\b/i;
    const labelled = Array.from(document.querySelectorAll<HTMLElement>("[aria-label]"));
    for (const element of labelled) {
      const label = element.getAttribute("aria-label") ?? "";
      if (!labelPattern.test(label)) continue;

      const button = this.closestButton(element);
      // Skip hidden buttons, including background classic-player buttons.
      if (button && this.isVisible(button)) return button;
    }

    const iconPath = 'path[d^="M21 3H3a2 2"]';
    const icon = document.querySelector<SVGElement>(iconPath);
    if (!icon) return null;

    return this.closestButton(icon);
  }

  /** Is the element actually visible on screen? Filters hidden background buttons. */
  private isVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  private closestButton(element: Element): HTMLButtonElement | null {
    const target = element.closest(
      'button, [role="button"], ytd-toggle-button-renderer, tp-yt-paper-icon-button'
    );
    if (!target) return null;

    if (target instanceof HTMLButtonElement) return target;
    const nestedButton = target.querySelector<HTMLButtonElement>("button");
    if (nestedButton) return nestedButton;

    return target instanceof HTMLElement ? (target as HTMLButtonElement) : null;
  }

  private toggleNativeCaptions(): boolean | undefined {
    const video = this.resolveVideo();
    if (!video || video.textTracks.length === 0) return;

    const tracks = Array.from(video.textTracks).filter(
      (track) => track.kind === "subtitles" || track.kind === "captions"
    );
    if (tracks.length === 0) return;

    const hasShowing = tracks.some((track) => track.mode === "showing");
    tracks.forEach((track, index) => {
      track.mode = hasShowing || index > 0 ? "disabled" : "showing";
    });
    return !hasShowing;
  }

  // --- Screenshot ---------------------------------------------------------

  screenshot(): boolean {
    const video = this.resolveVideo();
    if (!video) return false;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Protected cross-origin videos make toDataURL throw a "tainted canvas"
      // error, so this stays inside try/catch.
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `screenshot-${Date.now()}.png`;
      a.click();
      return true;
    } catch (err) {
      console.error(
        "[VideoMaster] Screenshot could not be captured, likely due to CORS protection.",
        err
      );
      return false;
    }
  }

  // --- YouTube chapter skipping ------------------------------------------

  /**
   * Jumps to the next YouTube chapter. Chapter boundaries are calculated from
   * progress bar segment widths; because YouTube does not provide an official
   * API for this, this is the most reliable DOM-based approach.
   */
  nextChapter(): boolean {
    if (!location.hostname.includes("youtube.com")) return false;
    const video = this.resolveVideo();
    if (!video || !isFinite(video.duration)) return false;

    const containers = document.querySelectorAll<HTMLElement>(
      ".ytp-chapter-hover-container"
    );
    const bar = document.querySelector<HTMLElement>(".ytp-progress-bar");
    if (!containers.length || !bar) return false;

    const barWidth = bar.clientWidth;
    if (!barWidth) return false;

    const total = video.duration;
    const boundaries: number[] = [0];
    let cumulative = 0;
    containers.forEach((c) => {
      cumulative += c.clientWidth;
      boundaries.push((cumulative / barWidth) * total);
    });

    const now = video.currentTime;
    const next = boundaries.find((b) => b > now + 0.5);
    if (next != null) {
      video.currentTime = next;
      return true;
    }
    return false;
  }

  // --- Helpers ------------------------------------------------------------

  private resolveVideo(): HTMLVideoElement | null {
    const videos = Array.from(
      document.querySelectorAll<HTMLVideoElement>("video")
    );
    const best = this.pickBest(videos);
    if (best) {
      this.video = best;
      return best;
    }

    if (this.video && document.contains(this.video)) {
      return this.video;
    }
    this.video = null;
    return null;
  }

  private pickBest(videos: HTMLVideoElement[]): HTMLVideoElement | null {
    if (videos.length === 0) return null;

    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const viewportW = window.innerWidth || document.documentElement.clientWidth;

    let best: HTMLVideoElement | null = null;
    let bestScore = -1;

    for (const video of videos) {
      if (!this.isVideoVisible(video)) continue;

      const rect = video.getBoundingClientRect();
      const area = rect.width * rect.height;
      const onScreen =
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < viewportH &&
        rect.left < viewportW;
      const playing = !video.paused && !video.ended && video.readyState > 2;

      // Puanlama: oynayan video > ekrandaki video > en büyük alan.
      // Böylece Shorts'taki gizli/duran arka plan oynatıcısı asla seçilmez.
      let score = area;
      if (onScreen) score += 1e7;
      if (playing) score += 1e9;

      if (score > bestScore) {
        bestScore = score;
        best = video;
      }
    }

    // Görünür hiçbiri yoksa, en azından sayfadaki bir videoyu döndür.
    if (!best) {
      best = videos.find((v) => document.contains(v)) ?? videos[0];
    }
    return best;
  }

  private isVideoVisible(video: HTMLVideoElement): boolean {
    const rect = video.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = getComputedStyle(video);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  /** Round to avoid floating-point artifacts such as 0.30000000004. */
  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
