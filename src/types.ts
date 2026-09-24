// Type definitions used across the app.

export interface KeyConfig {
  speedUp: string;     // Increase speed
  speedDown: string;   // Decrease speed
  resetSpeed: string;  // Reset speed to 1x
  skipForward: string; // Seek forward
  skipBack: string;    // Seek backward
  mute: string;        // Mute / unmute
  boost: string;       // Boost volume (AudioContext gain)
  boostDown: string;   // Reduce boost
  captions: string;    // Toggle captions
  screenshot: string;  // Take screenshot
  nextChapter: string; // Next chapter (YouTube only)
}

export interface Limits {
  maxSpeed: number;
  minSpeed: number;
  maxGain: number;
}

export interface Steps {
  speed: number;
  skip: number;
  gain: number;
}

export interface Config {
  keys: KeyConfig;
  limits: Limits;
  steps: Steps;
  hideSpeedFromSite: boolean; // Report 1x to the site's own JS while playing faster
}
