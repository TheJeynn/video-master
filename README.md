# Video Master - Chrome Extension

Control videos on any website with keyboard shortcuts:
speed control, volume boost (Web Audio API), forward/backward seek, screenshot,
caption toggle, and YouTube chapter skipping. Built in a modular structure with
TypeScript + React + Vite.

---

## Default Shortcuts

| Key | Action |
|-----|--------|
| `D` | Increase speed |
| `S` | Decrease speed |
| `R` | Reset speed (1x) |
| `A` | Seek forward 10 seconds |
| `Z` | Seek backward 10 seconds |
| `M` | Mute / unmute |
| `E` | Boost volume (up to 300%) |
| `Q` | Lower boosted volume |
| `C` | Toggle captions |
| `P` | Download screenshot (.png) |
| `N` | Next chapter (YouTube only) |

> All shortcuts can be changed from the extension popup.
> Click a keycap, press the new key - that's it.

---

## Requirements For VS Code

### 1. Install Node.js (required)
Download and install the **LTS** version from https://nodejs.org.
Check it in the terminal:
```bash
node --version   # should be v18 or newer
npm --version
```

### 2. Recommended VS Code Extensions
In VS Code, open Extensions (Ctrl+Shift+X):
- **ESLint** (Microsoft) - shows code issues immediately
- **Prettier** - code formatting
- **ES7+ React/Redux snippets** - shortcuts for React

(Not required, only useful for development.)

---

## Running The Project

Open the folder in VS Code, open the terminal (Ctrl+`) and run:

```bash
# 1. Install dependencies (once)
npm install

# 2. Build the production version
npm run build
```

This command creates the `dist/` folder. This is the folder you load as the
extension.

> For hot reload during development: `npm run dev`
> (In this mode, you still load the `dist/` folder in Chrome. It refreshes automatically when the code changes.)

---

## Loading In Chrome

1. Go to `chrome://extensions` in Chrome
2. Enable **Developer mode** in the top-right corner
3. Click **Load unpacked**
4. Select the **`dist`** folder in this project

The extension is loaded. Open a video (YouTube, a streaming site, or any other
site), click the page, and use the shortcuts.

> The prebuilt `dist/` folder is included in the package; you can skip
> `npm install` / `npm run build` and load it directly if you want. If you change
> the code, run `npm run build` again.

---

## Loading In Brave

1. Go to `brave://extensions` in Brave
2. Enable **Developer mode** in the top-right corner
3. Click **Load unpacked**
4. Select the **`dist`** folder in this project

Brave is Chromium-based, so the extension works the same way as it does in
Chrome.

---

## Loading In Edge

1. Go to `edge://extensions` in Edge
2. Enable **Developer mode** from the left menu or the bottom area
3. Click **Load unpacked**
4. Select the **`dist`** folder in this project

Edge is also Chromium-based, so you can use the same `dist/` folder as Chrome
and Brave.

---

## Running In Firefox

1. Go to `about:debugging#/runtime/this-firefox` in Firefox
2. Click **Load Temporary Add-on**
3. Select the **`dist/manifest.json`** file in this project

Firefox loads the extension temporarily with this method. You need to load it
again after closing and reopening the browser.

> This project targets Manifest V3 and Chromium-based browsers. It may work in
> Firefox through basic WebExtension support, but permanent packaging and store
> distribution require separate Firefox compatibility testing.

---

## Project Structure

```
video-master/
├── manifest.config.ts      # Extension manifest (Manifest V3)
├── vite.config.ts          # Build configuration
├── tsconfig.json
├── package.json
├── index.html              # Popup entry point
├── public/icons/           # Extension icons
└── src/
    ├── types.ts            # Type definitions
    ├── background.ts        # Service worker
    ├── content.ts          # Content script + Action Dispatcher + toast
    ├── popup.tsx           # React settings panel
    ├── popup.css
    └── modules/
        ├── ConfigManager.ts    # Settings management (chrome.storage.sync)
        ├── DOMObserver.ts      # Video detection + SPA tracking (MutationObserver)
        ├── InputHandler.ts     # Keyboard filtering (input sanitization)
        └── VideoController.ts  # Core engine (speed, volume, captions, screenshot)
```

---

## Notes

- **Volume boost** starts only after the first key press because browsers require
  AudioContext to be started by a user gesture. This is expected behavior.
- **Screenshots** cannot be taken from protected cross-origin (CORS) videos. In
  that case, the extension does not crash and shows a "CORS blocked" warning.
- **Shortcuts are disabled automatically** while typing in comment/search boxes.
- **Caption toggling** uses the YouTube player captions button on YouTube; on
  other sites it toggles native video text tracks when available.
- **YouTube chapter skipping** is calculated from progress bar segments; it does
  nothing on videos without chapters.
