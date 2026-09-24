/**
 * Runs in the page's own JS context (MAIN world), not the extension's
 * isolated world. It patches HTMLMediaElement.prototype.playbackRate so that
 * the page's own scripts (analytics, players, progress trackers) read back
 * whatever value VideoController tells us to show, instead of the real
 * native rate.
 *
 * The isolated-world content script (VideoController) keeps using the
 * untouched native accessor - isolated worlds and the main world each get
 * their own copy of built-in prototypes in Chrome, so this override never
 * loops back on the extension's own reads/writes, only on the page's.
 *
 * Caveat: this only fakes the `playbackRate` property. A page comparing
 * `currentTime` deltas against wall-clock time, or reading raw frame/audio
 * timing, can still notice the real speed. There is no way to hide that
 * from JS without also faking time itself, which this does not attempt.
 */
(function () {
  const proto = HTMLMediaElement.prototype;
  const native = Object.getOwnPropertyDescriptor(proto, "playbackRate");
  if (!native || !native.get || !native.set) return;

  const nativeGet = native.get;
  const nativeSet = native.set;

  // Value the page believes it set/read.
  const shown = new WeakMap<HTMLMediaElement, number>();
  // Real rate the extension wants enforced, regardless of what the page sets.
  const locked = new WeakMap<HTMLMediaElement, number>();

  Object.defineProperty(proto, "playbackRate", {
    configurable: true,
    enumerable: native.enumerable,
    get(this: HTMLMediaElement) {
      return shown.has(this) ? (shown.get(this) as number) : nativeGet.call(this);
    },
    set(this: HTMLMediaElement, value: number) {
      shown.set(this, value);
      const forced = locked.get(this);
      nativeSet.call(this, forced !== undefined ? forced : value);
    },
  });

  const CHANNEL = "video-master:rate";
  const ID_ATTR = "data-vm-id";

  interface RateMessage {
    channel: string;
    action: "lock" | "unlock";
    id: string;
    realRate: number;
    fakeRate?: number;
  }

  function isRateMessage(data: unknown): data is RateMessage {
    return (
      !!data &&
      typeof data === "object" &&
      (data as RateMessage).channel === CHANNEL &&
      typeof (data as RateMessage).id === "string" &&
      typeof (data as RateMessage).realRate === "number"
    );
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!isRateMessage(event.data)) return;
    const data = event.data;

    let video: HTMLMediaElement | null = null;
    try {
      video = document.querySelector<HTMLMediaElement>(
        `[${ID_ATTR}="${CSS.escape(data.id)}"]`
      );
    } catch {
      video = null;
    }
    if (!video) return;

    if (data.action === "lock") {
      locked.set(video, data.realRate);
      shown.set(video, data.fakeRate ?? 1);
      nativeSet.call(video, data.realRate);
    } else {
      locked.delete(video);
      shown.delete(video);
      nativeSet.call(video, data.realRate);
    }
  });
})();
