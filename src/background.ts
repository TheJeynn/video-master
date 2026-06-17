/**
 * Background service worker (Manifest V3).
 * For now, it logs installation information. It can later be extended for
 * notifications, tab management, or chrome.commands bridges.
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.info("[VideoMaster] Installed. You can customize shortcuts from the popup.");
  }
});
