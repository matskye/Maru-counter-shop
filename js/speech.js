// Text-to-speech through the browser's Web Speech API, with honest detection.
//
// A browser can expose the API and still have no Japanese voice (common on Linux and
// in some privacy-focused browsers), in which case speaking does nothing or reads kana
// with an English voice. So "available" here means: the API exists AND a Japanese voice
// is installed. Voices load asynchronously, and not every browser announces when they
// arrive, so we listen for the event and also poll for a short while.

const synth = typeof window !== "undefined" && "speechSynthesis" in window &&
  typeof window.SpeechSynthesisUtterance === "function" ? window.speechSynthesis : null;

const CHECK_EVERY_MS = 250;
const GIVE_UP_AFTER_MS = 3000;

/** Pick the best Japanese voice from a list of SpeechSynthesisVoice-like objects. */
export function pickJapaneseVoice(voices) {
  const japanese = (voices || []).filter(v => v && v.lang && v.lang.toLowerCase().replace("_", "-").startsWith("ja"));
  return japanese.find(v => v.default) || japanese.find(v => v.localService) || japanese[0] || null;
}

export const speech = {
  /** "unsupported" (no API) | "checking" | "ready" | "no-voice" (API, but nothing to speak Japanese with) */
  status: synth ? "checking" : "unsupported",
  voice: null,
  forced: false,
  onChange: null,
  isEnabled: () => true,
  current: null, // keeps the utterance alive: some browsers drop it mid-sentence if it is garbage-collected
  timer: null,

  get ready() {
    return this.status === "ready";
  },

  /** True when the API exists, whether or not a Japanese voice was found. */
  get hasApi() {
    return Boolean(synth);
  },

  init({ onChange, isEnabled, forced = false } = {}) {
    this.onChange = onChange || null;
    if (isEnabled) this.isEnabled = isEnabled;
    this.forced = forced;
    if (!synth) {
      this.notify();
      return;
    }
    const refresh = () => this.refresh();
    if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", refresh);
    else synth.onvoiceschanged = refresh;
    this.refresh();
    const started = Date.now();
    const poll = window.setInterval(() => {
      this.refresh();
      const timedOut = Date.now() - started >= GIVE_UP_AFTER_MS;
      if (this.voice || timedOut) window.clearInterval(poll);
      if (timedOut && this.status === "checking") this.setStatus("no-voice");
    }, CHECK_EVERY_MS);
  },

  refresh() {
    if (!synth) return;
    this.voice = pickJapaneseVoice(synth.getVoices());
    if (this.voice || this.forced) this.setStatus("ready");
    else if (this.status === "ready") this.setStatus("no-voice");
  },

  /** The player says speech works on this device even though no Japanese voice is listed. */
  force() {
    if (!synth) return;
    this.forced = true;
    this.setStatus("ready");
  },

  setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.notify();
  },

  notify() {
    if (this.onChange) this.onChange(this.status);
  },

  /**
   * Speak Japanese text. `force` speaks even when the Voice setting is off
   * (used when the player explicitly taps something to hear it).
   */
  say(text, { slow = false, force = false } = {}) {
    if (!this.ready || !text || (!force && !this.isEnabled())) return;
    const utterance = new window.SpeechSynthesisUtterance(text);
    if (this.voice) utterance.voice = this.voice;
    utterance.lang = "ja-JP";
    utterance.rate = slow ? 0.55 : 0.95;
    utterance.onend = utterance.onerror = () => {
      if (this.current === utterance) this.current = null;
    };
    window.clearTimeout(this.timer);
    const busy = synth.speaking || synth.pending;
    this.current = utterance;
    const speak = () => {
      if (synth.paused) synth.resume();
      synth.speak(utterance);
    };
    if (busy) {
      // Chrome can swallow an utterance queued in the same tick as cancel().
      synth.cancel();
      this.timer = window.setTimeout(speak, 80);
    } else {
      speak(); // synchronous, so the first utterance still counts as started by the tap (needed on iOS)
    }
  },

  stop() {
    if (!synth) return;
    window.clearTimeout(this.timer);
    this.current = null;
    if (synth.speaking || synth.pending) synth.cancel();
  }
};
