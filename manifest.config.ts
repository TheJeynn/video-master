import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Video Master - Speed and Volume Control",
  version: "1.0.0",
  description:
    "Control videos on any website with keyboard shortcuts: speed, volume boost, seek, screenshot, and YouTube chapter skipping.",
  // Required to store settings with chrome.storage.sync.
  permissions: ["storage"],
  action: {
    default_popup: "index.html",
    default_title: "Video Master",
    default_icon: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
  },
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/inject/rateSpoof.ts"],
      run_at: "document_start",
      all_frames: true,
      world: "MAIN",
    },
    {
      matches: ["<all_urls>"],
      js: ["src/content.ts"],
      run_at: "document_idle",
      all_frames: true,
    },
  ],
});
