/**
 * DOMObserver finds videos and tracks SPA (Single Page Application)
 * transitions. It installs a childList + subtree MutationObserver on body.
 * Scans are throttled with requestAnimationFrame for performance.
 */
type VideoCallback = (video: HTMLVideoElement | null) => void;

export class DOMObserver {
  private observer: MutationObserver | null = null;
  private current: HTMLVideoElement | null = null;
  private scheduled = false;
  private readonly onVideoChange: VideoCallback;

  constructor(onVideoChange: VideoCallback) {
    this.onVideoChange = onVideoChange;
  }

  start(): void {
    this.scan();

    this.observer = new MutationObserver(() => this.scheduleScan());
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Back/forward navigation in SPAs triggers this event in the content script context.
    window.addEventListener("popstate", () => this.scheduleScan());
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  /** MutationObserver can fire very often; scan at most once per frame. */
  private scheduleScan(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      this.scan();
    });
  }

  private scan(): void {
    const videos = Array.from(document.querySelectorAll("video"));
    const best = this.pickBest(videos);
    if (best !== this.current) {
      this.current = best;
      this.onVideoChange(best);
    }
  }

  /**
   * Selects the "main" video on the page: first the playing video, otherwise
   * the visible video with the largest area. This targets the primary content
   * instead of ads or preview videos.
   */
  private pickBest(videos: HTMLVideoElement[]): HTMLVideoElement | null {
    if (videos.length === 0) return null;

    const playing = videos.find(
      (v) => !v.paused && !v.ended && v.readyState > 2
    );
    if (playing) return playing;

    let best: HTMLVideoElement | null = null;
    let bestArea = 0;
    for (const v of videos) {
      const rect = v.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        best = v;
      }
    }
    return best ?? videos[0];
  }
}
