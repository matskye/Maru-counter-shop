let gameData = null;
let currentRequest = null;
let challengeMode = false;
let challengeScore = 0;
let challengeRounds = 0;
let correctStreak = 0;

const MAX_CHALLENGE_ROUNDS = 10;

// Load preferences from localStorage
let showFurigana = localStorage.getItem("showFurigana") === "true";
let voiceEnabled = localStorage.getItem("voiceEnabled") !== "false"; // default true

const customerDiv = document.getElementById("customer");
const shelfDiv = document.getElementById("shelf");
const counterDiv = document.getElementById("counter");
const reactionDiv = document.getElementById("maruReaction");
const feedbackDiv = document.getElementById("feedback");
const counterHintDiv = document.getElementById("counterHint");
const hintToggleBtn = document.getElementById("toggleHintBtn");
const replayVoiceBtn = document.getElementById("replayVoiceBtn");
const modeStatusDiv = document.getElementById("modeStatus");
const challengeStatusDiv = document.getElementById("challengeStatus");
const challengeRoundSpan = document.getElementById("challengeRound");
const challengeScoreSpan = document.getElementById("challengeScore");
const streakCountSpan = document.getElementById("streakCount");
const COUNTER_HINT_HTML = '<span class="drop-hint">Drag or click items to add</span>';
const SCALE_EPSILON = 0.005;
const counterModal = document.getElementById("counterPage");
const counterList = document.getElementById("counterList");
const counterSummaryDiv = document.getElementById("counterSummary");
const openCounterPageBtn = document.getElementById("openCounterPage");
const closeCounterPageBtn = document.getElementById("closeCounterPage");
const selectAllCountersBtn = document.getElementById("selectAllCounters");
const drawerOverlay = document.getElementById("drawerOverlay");
const drawerContainer = document.getElementById("drawerContainer");
const drawerPanels = {
  clock: document.getElementById("clockDrawer"),
  calendar: document.getElementById("calendarDrawer"),
  house: document.getElementById("houseDrawer")
};
const drawerLaunchers = document.querySelectorAll("[data-drawer-toggle]");
const clockFaceEl = document.getElementById("clockFace");
const clockMarkersEl = document.getElementById("clockMarkers");
const clockValueEl = document.getElementById("clockValue");
const clockDoneBtn = document.getElementById("clockDoneBtn");
const calendarDrawerEl = document.getElementById("calendarDrawer");
const calendarGridEl = document.getElementById("calendarGrid");
const calendarModeLabel = document.getElementById("calendarModeLabel");
const calendarTarget = document.getElementById("calendarTarget");
const calendarSelectionCount = document.getElementById("calendarSelectionCount");
const calendarDoneBtn = document.getElementById("calendarDoneBtn");
const calendarTearBtn = document.getElementById("calendarTearBtn");
const houseDrawerEl = document.getElementById("houseDrawer");
const houseFloorPlanEl = document.getElementById("houseFloorPlan");
const houseSideViewEl = document.getElementById("houseSideView");
const houseOutdoorEl = document.getElementById("houseOutdoor");
const houseSelectionSummaryEl = document.getElementById("houseSelectionSummary");
const houseDoneBtn = document.getElementById("houseDoneBtn");

let hintVisible = false;
let counterStats = loadCounterStats();
let enabledCounters = loadEnabledCounters();

const HINT_SHOW_LABEL = "💡 Show hint";
const HINT_HIDE_LABEL = "🙈 Hide hint";

let reopenSettingsAfterCounter = false;

const CLOCK_HAND_LABELS = {
  hours: "hour hand",
  minutes: "minute hand",
  seconds: "second hand"
};

function getCounterPractice(counterObj) {
  if (!counterObj || typeof counterObj !== "object") return null;
  if (!counterObj.practice || typeof counterObj.practice !== "object") return null;
  return counterObj.practice;
}

function isClockCounter(counterObj) {
  const practice = getCounterPractice(counterObj);
  return Boolean(practice && practice.type === "clock");
}

function isCalendarCounter(counterObj) {
  const practice = getCounterPractice(counterObj);
  return Boolean(practice && practice.type === "calendar");
}

function isHouseCounter(counterObj) {
  const practice = getCounterPractice(counterObj);
  return Boolean(practice && practice.type === "house");
}

function randomInt(min, max) {
  const lower = Number.isFinite(min) ? Math.floor(min) : 0;
  const upper = Number.isFinite(max) ? Math.floor(max) : lower;
  if (upper < lower) return lower;
  return lower + Math.floor(Math.random() * (upper - lower + 1));
}

function getClockHandLabel(handKey) {
  return CLOCK_HAND_LABELS[handKey] || "clock hand";
}

function formatClockDisplayValue(handKey, value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (handKey === "hours") {
    const remainder = ((numeric % 12) + 12) % 12;
    return remainder === 0 ? 12 : remainder;
  }
  const remainder = ((numeric % 60) + 60) % 60;
  return remainder;
}

function safeParseJSON(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed;
  } catch (err) {
    return fallback;
  }
}

function loadCounterStats() {
  const parsed = safeParseJSON(localStorage.getItem("counterStats"), {});
  if (!parsed || typeof parsed !== "object") {
    return {};
  }
  const stats = {};
  Object.entries(parsed).forEach(([key, value]) => {
    if (!value || typeof value !== "object") {
      stats[key] = { correct: 0, incorrect: 0 };
      return;
    }
    const correct = Number.isFinite(value.correct) ? value.correct : 0;
    const incorrect = Number.isFinite(value.incorrect) ? value.incorrect : 0;
    stats[key] = { correct, incorrect };
  });
  return stats;
}

function saveCounterStats() {
  localStorage.setItem("counterStats", JSON.stringify(counterStats));
}

function loadEnabledCounters() {
  const parsed = safeParseJSON(localStorage.getItem("enabledCounters"), null);
  if (!Array.isArray(parsed)) {
    return null;
  }
  return parsed.filter(item => typeof item === "string");
}

function saveEnabledCounters() {
  if (enabledCounters === null) {
    localStorage.removeItem("enabledCounters");
    return;
  }
  if (!Array.isArray(enabledCounters)) return;
  localStorage.setItem("enabledCounters", JSON.stringify(enabledCounters));
}

function ensureCounterStats() {
  if (!gameData || !Array.isArray(gameData.counters)) return;
  const availableKeys = new Set(gameData.counters.map(counter => counter.counter));
  const nextStats = {};
  Object.entries(counterStats).forEach(([key, value]) => {
    if (!availableKeys.has(key)) return;
    if (!value || typeof value !== "object") {
      nextStats[key] = { correct: 0, incorrect: 0 };
      return;
    }
    const correct = Number.isFinite(value.correct) ? value.correct : 0;
    const incorrect = Number.isFinite(value.incorrect) ? value.incorrect : 0;
    nextStats[key] = { correct, incorrect };
  });
  availableKeys.forEach(key => {
    if (!nextStats[key]) {
      nextStats[key] = { correct: 0, incorrect: 0 };
    }
  });
  counterStats = nextStats;
  saveCounterStats();
}

function ensureEnabledCounters() {
  if (!gameData || !Array.isArray(gameData.counters)) return;
  if (enabledCounters === null) return;
  if (!Array.isArray(enabledCounters)) {
    enabledCounters = null;
    saveEnabledCounters();
    return;
  }
  const availableKeys = gameData.counters.map(counter => counter.counter);
  const previous = enabledCounters;
  const next = Array.from(new Set(previous.filter(key => availableKeys.includes(key))));
  const hasChanged = previous.length !== next.length || next.some((key, index) => previous[index] !== key);
  enabledCounters = next;
  if (hasChanged) {
    saveEnabledCounters();
  }
}

function areAllCountersSelected() {
  if (!gameData || !Array.isArray(gameData.counters)) return true;
  if (!gameData.counters.length) return true;
  if (enabledCounters === null) return true;
  if (!Array.isArray(enabledCounters)) return true;
  if (enabledCounters.length !== gameData.counters.length) return false;
  const enabledSet = new Set(enabledCounters);
  return gameData.counters.every(counter => enabledSet.has(counter.counter));
}

function updateSelectAllCountersButton() {
  if (!selectAllCountersBtn) return;
  if (!gameData || !Array.isArray(gameData.counters) || !gameData.counters.length) {
    selectAllCountersBtn.textContent = "Select all counters";
    selectAllCountersBtn.setAttribute("aria-pressed", "false");
    return;
  }
  const allSelected = areAllCountersSelected();
  selectAllCountersBtn.textContent = allSelected ? "Deselect all counters" : "Select all counters";
  selectAllCountersBtn.setAttribute("aria-pressed", allSelected ? "true" : "false");
}

function getActiveCounters() {
  if (!gameData || !Array.isArray(gameData.counters)) return [];
  if (enabledCounters === null) {
    return gameData.counters;
  }
  if (!Array.isArray(enabledCounters)) {
    return gameData.counters;
  }
  const enabledSet = new Set(enabledCounters);
  const filtered = gameData.counters.filter(counter => enabledSet.has(counter.counter));
  if (enabledCounters.length > 0 && filtered.length === 0) {
    return gameData.counters;
  }
  return filtered;
}

function getCounterStats(counterKey) {
  if (!counterKey) return { correct: 0, incorrect: 0 };
  if (!counterStats[counterKey]) {
    counterStats[counterKey] = { correct: 0, incorrect: 0 };
  }
  return counterStats[counterKey];
}

function calculateAccuracy(correct, incorrect) {
  const total = correct + incorrect;
  if (!total) return null;
  return Math.round((correct / total) * 100);
}

function isCounterModalOpen() {
  return Boolean(counterModal && counterModal.style.display === "flex");
}

function updateCounterSummary() {
  if (!counterSummaryDiv) return;
  if (!gameData || !Array.isArray(gameData.counters)) {
    counterSummaryDiv.textContent = "Loading counters…";
    return;
  }
  const total = gameData.counters.length;
  if (enabledCounters === null) {
    counterSummaryDiv.textContent = `All ${total} counters are selected for practice.`;
    return;
  }
  const selectedCount = enabledCounters.length;
  if (!selectedCount) {
    counterSummaryDiv.textContent = "Select at least one counter to keep practicing.";
    return;
  }
  if (selectedCount === total) {
    counterSummaryDiv.textContent = `All ${total} counters are selected for practice.`;
    return;
  }
  counterSummaryDiv.textContent = `${selectedCount} of ${total} counters selected for practice.`;
}

function renderCounterPreferences() {
  if (!counterList) return;
  counterList.innerHTML = "";
  if (!gameData || !Array.isArray(gameData.counters)) {
    const loading = document.createElement("div");
    loading.textContent = "Counters are loading…";
    loading.className = "counter-row";
    loading.setAttribute("role", "listitem");
    counterList.appendChild(loading);
    updateCounterSummary();
    updateSelectAllCountersButton();
    return;
  }

  ensureCounterStats();
  ensureEnabledCounters();

  const treatAllSelected = enabledCounters === null;
  const enabledSet = new Set(Array.isArray(enabledCounters) ? enabledCounters : []);
  const counters = [...gameData.counters];
  counters.sort((a, b) => a.counter.localeCompare(b.counter, "ja"));

  counters.forEach(counter => {
    const key = counter.counter;
    const stats = getCounterStats(key);
    const accuracy = calculateAccuracy(stats.correct, stats.incorrect);

    const row = document.createElement("div");
    row.className = "counter-row";
    row.setAttribute("role", "listitem");

    const header = document.createElement("div");
    header.className = "counter-row__header";

    const labelWrapper = document.createElement("div");
    labelWrapper.className = "counter-row__label";

    const title = document.createElement("strong");
    title.textContent = `${counter.counter} ・ ${counter.reading}`;
    labelWrapper.appendChild(title);

    const category = document.createElement("span");
    category.textContent = counter.category;
    labelWrapper.appendChild(category);

    const toggleId = `counterToggle-${key}`;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = toggleId;
    checkbox.checked = treatAllSelected ? true : enabledSet.has(key);
    checkbox.title = "Include this counter in practice";
    checkbox.addEventListener("change", () => {
      toggleCounterSelection(key, checkbox.checked, checkbox);
    });

    const label = document.createElement("label");
    label.setAttribute("for", toggleId);
    label.appendChild(labelWrapper);

    header.appendChild(label);
    header.appendChild(checkbox);
    row.appendChild(header);

    const statsRow = document.createElement("div");
    statsRow.className = "counter-row__stats";

    const correctSpan = document.createElement("span");
    correctSpan.textContent = `✅ ${stats.correct}`;
    statsRow.appendChild(correctSpan);

    const incorrectSpan = document.createElement("span");
    incorrectSpan.textContent = `❌ ${stats.incorrect}`;
    statsRow.appendChild(incorrectSpan);

    const accuracySpan = document.createElement("span");
    accuracySpan.textContent = accuracy === null ? "Accuracy: —" : `Accuracy: ${accuracy}%`;
    statsRow.appendChild(accuracySpan);

    row.appendChild(statsRow);
    counterList.appendChild(row);
  });

  updateCounterSummary();
  updateSelectAllCountersButton();
}

function toggleCounterSelection(counterKey, shouldEnable, checkboxElement) {
  if (!gameData || !Array.isArray(gameData.counters)) return;
  const allKeys = gameData.counters.map(counter => counter.counter);
  const current = new Set(
    enabledCounters === null
      ? allKeys
      : Array.isArray(enabledCounters)
        ? enabledCounters
        : []
  );

  if (!shouldEnable) {
    if (current.has(counterKey) && current.size === 1) {
      if (checkboxElement) {
        checkboxElement.checked = true;
      }
      if (counterSummaryDiv) {
        counterSummaryDiv.textContent = "At least one counter must remain selected.";
        window.setTimeout(updateCounterSummary, 1600);
      }
      return;
    }
    current.delete(counterKey);
  } else {
    current.add(counterKey);
  }

  if (current.size === allKeys.length) {
    enabledCounters = null;
  } else {
    enabledCounters = allKeys.filter(key => current.has(key));
  }

  const hadRequest = Boolean(currentRequest);

  saveEnabledCounters();
  renderCounterPreferences();

  if (!hadRequest && getActiveCounters().length > 0) {
    newCustomer();
  }
}

function recordCounterResult(counterObj, wasCorrect) {
  if (!counterObj) return;
  const key = counterObj.counter;
  const stats = getCounterStats(key);
  if (wasCorrect) {
    stats.correct += 1;
  } else {
    stats.incorrect += 1;
  }
  saveCounterStats();
  if (isCounterModalOpen()) {
    renderCounterPreferences();
  }
}

function openCounterPreferences() {
  if (!counterModal) return;
  counterModal.style.display = "flex";
  renderCounterPreferences();
}

function closeCounterPreferences() {
  if (!counterModal) return;
  counterModal.style.display = "none";
  if (reopenSettingsAfterCounter && settingsModal) {
    settingsModal.style.display = "flex";
    reopenSettingsAfterCounter = false;
  }
}

function applyScaleToFit() {
  const shell = document.querySelector(".app-shell");
  const bodyEl = document.body;
  if (!shell || !bodyEl) return;

  shell.style.removeProperty("transform");
  shell.style.removeProperty("transform-origin");
  bodyEl.classList.remove("is-scaled");

  const rect = shell.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const bodyStyles = window.getComputedStyle(bodyEl);
  const paddingX = parseFloat(bodyStyles.paddingLeft || "0") + parseFloat(bodyStyles.paddingRight || "0");
  const paddingY = parseFloat(bodyStyles.paddingTop || "0") + parseFloat(bodyStyles.paddingBottom || "0");
  const availableWidth = window.innerWidth - paddingX;
  const availableHeight = window.innerHeight - paddingY;

  if (availableWidth <= 0 || availableHeight <= 0) {
    return;
  }

  const scale = Math.min(1, availableWidth / rect.width, availableHeight / rect.height);

  if (scale < 1 - SCALE_EPSILON) {
    shell.style.transform = `scale(${scale})`;
    shell.style.transformOrigin = "top center";
    bodyEl.classList.add("is-scaled");
  }
}

const scheduleScaleToFit = () => window.requestAnimationFrame(applyScaleToFit);

document.addEventListener("DOMContentLoaded", () => {
  applyScaleToFit();
  window.setTimeout(applyScaleToFit, 150);
});

window.addEventListener("load", applyScaleToFit);
window.addEventListener("resize", scheduleScaleToFit);
window.addEventListener("orientationchange", scheduleScaleToFit);

function setHintVisibility(visible) {
  const canShow = counterHintDiv && counterHintDiv.innerHTML.trim().length > 0;
  hintVisible = Boolean(visible && canShow);
  if (counterHintDiv) {
    counterHintDiv.hidden = !hintVisible;
  }
  if (hintToggleBtn) {
    hintToggleBtn.textContent = hintVisible ? HINT_HIDE_LABEL : HINT_SHOW_LABEL;
    hintToggleBtn.setAttribute("aria-expanded", hintVisible ? "true" : "false");
  }
}

function updateHintButtonState() {
  if (!hintToggleBtn) return;
  const hasHint = Boolean(currentRequest);
  hintToggleBtn.disabled = !hasHint;
}

let japaneseVoice = null;
let fallbackVoiceEnabled = localStorage.getItem("fallbackVoiceEnabled") !== "false";
let lastVoiceEngine = ("speechSynthesis" in window) ? "browser" : "none";
const FALLBACK_TTS_ENDPOINT = "https://translate.googleapis.com/translate_tts";
const FALLBACK_CACHE_LIMIT = 20;
const fallbackAudioCache = new Map();
let fallbackAudioElement = null;
let fallbackAudioController = null;

const JAPANESE_NUMBER_READINGS = {
  0: "れい",
  1: "いち",
  2: "に",
  3: "さん",
  4: "よん",
  5: "ご",
  6: "ろく",
  7: "なな",
  8: "はち",
  9: "きゅう",
  10: "じゅう"
};

function getJapaneseNumberReading(number) {
  if (!Number.isFinite(number)) return "";

  const rounded = Math.floor(number);
  if (rounded <= 10) {
    return JAPANESE_NUMBER_READINGS.hasOwnProperty(rounded)
      ? JAPANESE_NUMBER_READINGS[rounded]
      : String(rounded);
  }

  const tens = Math.floor(rounded / 10);
  const ones = rounded % 10;
  let reading = "";

  if (tens > 0) {
    if (tens === 1) {
      reading += JAPANESE_NUMBER_READINGS[10];
    } else {
      const tensReading = JAPANESE_NUMBER_READINGS[tens] || String(tens);
      reading += `${tensReading}${JAPANESE_NUMBER_READINGS[10]}`;
    }
  }

  if (ones !== 0) {
    reading += JAPANESE_NUMBER_READINGS[ones] || String(ones);
  }

  return reading || String(rounded);
}

function initVoices() {
  if (!('speechSynthesis' in window)) return;

  const setVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    japaneseVoice = voices.find(voice => voice.lang && voice.lang.toLowerCase().startsWith('ja')) || null;
  };

  setVoice();
  window.speechSynthesis.addEventListener('voiceschanged', setVoice);
}

initVoices();

// Load JSON
fetch("data/counters.json")
  .then(res => res.json())
  .then(data => {
    gameData = data;
    ensureCounterStats();
    ensureEnabledCounters();
    updateCounterSummary();
    updateSelectAllCountersButton();
    if (isCounterModalOpen()) {
      renderCounterPreferences();
    }
    if (!currentRequest) {
      newCustomer();
    }
  });

// Speak Japanese if voice enabled
function shouldUseFallbackVoice() {
  return Boolean(
    fallbackVoiceEnabled &&
    typeof fetch === "function" &&
    typeof Audio !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function"
  );
}

if (lastVoiceEngine === "none" && shouldUseFallbackVoice()) {
  lastVoiceEngine = "fallback";
}

function setLastVoiceEngine(engine) {
  if (lastVoiceEngine === engine) return;
  lastVoiceEngine = engine;
  updateReplayButtonState();
}

function enforceFallbackCacheLimit() {
  while (fallbackAudioCache.size > FALLBACK_CACHE_LIMIT) {
    const oldestKey = fallbackAudioCache.keys().next().value;
    if (!oldestKey) break;
    const objectUrl = fallbackAudioCache.get(oldestKey);
    fallbackAudioCache.delete(oldestKey);
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

async function getFallbackAudioUrl(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  if (fallbackAudioCache.has(trimmed)) {
    return fallbackAudioCache.get(trimmed);
  }
  if (!shouldUseFallbackVoice()) return null;

  if (fallbackAudioController && typeof fallbackAudioController.abort === "function") {
    try {
      fallbackAudioController.abort();
    } catch (err) {
      // Ignore abort errors.
    }
  }

  const supportsAbort = typeof AbortController === "function";
  const controller = supportsAbort ? new AbortController() : null;
  fallbackAudioController = controller;

  const url = new URL(FALLBACK_TTS_ENDPOINT);
  url.searchParams.set("ie", "UTF-8");
  url.searchParams.set("client", "tw-ob");
  url.searchParams.set("tl", "ja");
  url.searchParams.set("q", trimmed);

  try {
    const response = await fetch(
      url.toString(),
      controller ? { signal: controller.signal } : undefined
    );
    if (!response.ok) {
      throw new Error(`Fallback TTS request failed: ${response.status}`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    fallbackAudioCache.set(trimmed, objectUrl);
    enforceFallbackCacheLimit();
    return objectUrl;
  } catch (error) {
    if (error.name === "AbortError") {
      return null;
    }
    console.warn("Unable to fetch fallback TTS audio", error);
    return null;
  } finally {
    if (fallbackAudioController === controller) {
      fallbackAudioController = null;
    }
  }
}

async function playFallbackAudio(text) {
  if (!shouldUseFallbackVoice()) {
    setLastVoiceEngine(("speechSynthesis" in window) ? "browser" : "none");
    return;
  }

  const source = await getFallbackAudioUrl(text);
  if (!source) {
    return;
  }

  if (!fallbackAudioElement) {
    fallbackAudioElement = new Audio();
  }

  try {
    fallbackAudioElement.pause();
    fallbackAudioElement.currentTime = 0;
  } catch (err) {
    // Ignore reset errors.
  }

  fallbackAudioElement.src = source;
  try {
    setLastVoiceEngine("fallback");
    await fallbackAudioElement.play();
  } catch (error) {
    console.warn("Unable to play fallback TTS audio", error);
  }
}

window.addEventListener("beforeunload", () => {
  if (fallbackAudioController) {
    if (typeof fallbackAudioController.abort === "function") {
      try {
        fallbackAudioController.abort();
      } catch (err) {
        // Ignore abort errors on unload.
      }
    }
  }
  fallbackAudioCache.forEach(objectUrl => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  });
  fallbackAudioCache.clear();
});

function speakJapanese(text) {
  if (!voiceEnabled) return;

  const phrase = typeof text === "string" ? text.trim() : "";
  if (!phrase) return;

  let fallbackTriggered = false;
  const triggerFallback = () => {
    if (fallbackTriggered) return;
    fallbackTriggered = true;
    if (shouldUseFallbackVoice()) {
      void playFallbackAudio(phrase);
    } else {
      setLastVoiceEngine(("speechSynthesis" in window) ? "browser" : "none");
    }
  };

  if ("speechSynthesis" in window) {
    try {
      if (typeof SpeechSynthesisUtterance !== "function") {
        throw new Error("SpeechSynthesisUtterance is not available");
      }
      const utter = new SpeechSynthesisUtterance(phrase);
      if (japaneseVoice) {
        utter.voice = japaneseVoice;
      }
      utter.lang = "ja-JP";
      let fallbackTimeout = null;
      const clearFallbackTimeout = () => {
        if (fallbackTimeout !== null) {
          clearTimeout(fallbackTimeout);
          fallbackTimeout = null;
        }
      };
      fallbackTimeout = window.setTimeout(() => {
        fallbackTimeout = null;
        triggerFallback();
      }, 1200);
      utter.onstart = () => {
        clearFallbackTimeout();
        setLastVoiceEngine("browser");
      };
      utter.onerror = () => {
        clearFallbackTimeout();
        triggerFallback();
      };
      utter.onend = () => {
        clearFallbackTimeout();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
      return;
    } catch (error) {
      console.warn("Speech synthesis failed, attempting fallback", error);
      triggerFallback();
      return;
    }
  }

  triggerFallback();
}

function getPromptSpeechText(request) {
  if (!request) return "";
  const { counterObj, number } = request;
  return getCounterReading(counterObj, number) + "ください。";
}

function updateReplayButtonState() {
  if (!replayVoiceBtn) return;
  const webSpeechSupported = 'speechSynthesis' in window;
  const fallbackAvailable = shouldUseFallbackVoice();
  const hasRequest = Boolean(currentRequest);
  const voiceAvailable = voiceEnabled && (webSpeechSupported || fallbackAvailable);

  replayVoiceBtn.disabled = !(voiceAvailable && hasRequest);

  let title;
  if (!voiceEnabled) {
    title = "Enable voice in settings to listen to Maru's request again.";
  } else if (!voiceAvailable) {
    title = "Voice playback isn't available in this browser.";
  } else if (lastVoiceEngine === "fallback" && fallbackAvailable) {
    title = "Stream audio using the fallback voice service.";
  } else if (webSpeechSupported) {
    title = "Hear Maru repeat the current request.";
  } else if (fallbackAvailable) {
    title = "Stream audio using the fallback voice service.";
  } else {
    title = "Voice playback isn't available in this browser.";
  }

  replayVoiceBtn.title = title;
}

function updateModeStatus() {
  if (!modeStatusDiv) return;
  if (challengeMode) {
    const currentRound = Math.min(challengeRounds + 1, MAX_CHALLENGE_ROUNDS);
    modeStatusDiv.textContent = `Challenge mode – round ${currentRound} of ${MAX_CHALLENGE_ROUNDS}`;
  } else {
    modeStatusDiv.textContent = "Practice mode";
  }
}

function updateChallengeStatus() {
  if (!challengeStatusDiv) return;
  challengeStatusDiv.hidden = !challengeMode;
  if (!challengeMode) return;
  const currentRound = Math.min(challengeRounds + 1, MAX_CHALLENGE_ROUNDS);
  if (challengeRoundSpan) {
    challengeRoundSpan.textContent = String(currentRound);
  }
  if (challengeScoreSpan) {
    challengeScoreSpan.textContent = String(challengeScore);
  }
}

function updateStreakStatus() {
  if (!streakCountSpan) return;
  streakCountSpan.textContent = String(correctStreak);
}

function updateCounterHint() {
  if (!counterHintDiv) return;
  if (!currentRequest) {
    counterHintDiv.textContent = "";
    setHintVisibility(false);
    updateHintButtonState();
    return;
  }
  const { counterObj } = currentRequest;
  const practice = getCounterPractice(counterObj);
  let hintHTML = "";

  if (practice && practice.type === "clock") {
    const handLabel = getClockHandLabel(practice.hand);
    const displayValue = formatClockDisplayValue(practice.hand, currentRequest.number);
    hintHTML = `Use the clock drawer to set the <strong>${handLabel}</strong> to <strong>${displayValue}</strong>.`;
  } else if (practice && practice.type === "calendar") {
    const label = formatCalendarLabel(practice.mode, currentRequest.number);
    hintHTML = `Use the calendar drawer to mark <strong>${currentRequest.number} ${label}</strong>.`;
  } else if (practice && practice.type === "house") {
    const targetKey = getHousePracticeTarget(counterObj);
    const label = formatHouseTargetLabel(targetKey, currentRequest.number);
    const targetTitle = getHouseTargetTitle(targetKey);
    hintHTML = `Use the house drawer to select <strong>${currentRequest.number} ${label}</strong> (${targetTitle.toLowerCase()}).`;
  } else {
    const examples = Array.isArray(counterObj.items)
      ? counterObj.items
          .slice(0, 3)
          .map(item => item && item.label_en)
          .filter(Boolean)
      : [];
    const examplesText = examples.length ? ` Try things like ${examples.join(", ")}.` : "";
    hintHTML = `Counter <strong>「${counterObj.counter}」</strong> is used for <strong>${counterObj.category}</strong>.${examplesText}`;
  }

  counterHintDiv.innerHTML = hintHTML;
  updateHintButtonState();
  if (!hintVisible) {
    counterHintDiv.hidden = true;
  }
}

// Get correct reading (handles irregular)
function getCounterReading(counterObj, number) {
  const numberReading = getJapaneseNumberReading(number);

  if (counterObj.irregular) {
    if (counterObj.irregular[number]) {
      return counterObj.irregular[number];
    }

    if (counterObj.irregular["default"]) {
      return counterObj.irregular["default"].replace("{n}", numberReading);
    }
  }

  return `${numberReading}${counterObj.reading}`;
}

// Random request
function randomRequest() {
  if (!gameData || !Array.isArray(gameData.counters)) return null;
  const counters = getActiveCounters();
  if (!counters.length) return null;
  const counterObj = counters[Math.floor(Math.random() * counters.length)];
  const practice = getCounterPractice(counterObj);

  if (practice && practice.type === "clock") {
    const min = Number.isFinite(practice.min) ? practice.min : 1;
    const max = Number.isFinite(practice.max) ? practice.max : min;
    const value = randomInt(min, max);
    const target = { hours: 0, minutes: 0, seconds: 0 };
    if (practice.hand === "hours") {
      target.hours = ((value % 12) + 12) % 12;
    } else if (practice.hand === "minutes") {
      target.minutes = ((value % 60) + 60) % 60;
    } else if (practice.hand === "seconds") {
      target.seconds = ((value % 60) + 60) % 60;
    }
    return {
      counterObj,
      number: value,
      item: null,
      clockTarget: target
    };
  }

  if (practice && practice.type === "calendar") {
    const min = Number.isFinite(practice.min) ? practice.min : 1;
    const max = Number.isFinite(practice.max) ? practice.max : min;
    const value = randomInt(min, max);
    return {
      counterObj,
      number: value,
      item: null,
      calendarTarget: {
        mode: practice.mode || "days",
        count: value
      }
    };
  }

  if (practice && practice.type === "house") {
    const min = Number.isFinite(practice.min) ? practice.min : 1;
    const max = Number.isFinite(practice.max) ? practice.max : min;
    const value = randomInt(min, max);
    return {
      counterObj,
      number: value,
      item: null,
      houseTarget: getHousePracticeTarget(counterObj)
    };
  }

  const number = Math.ceil(Math.random() * 5); // up to 5 items for demo
  const item = counterObj.items[Math.floor(Math.random() * counterObj.items.length)];
  return { counterObj, number, item };
}

function newCustomer() {
  if (!gameData || !gameData.counters) return;
  const nextRequest = randomRequest();
  if (!nextRequest) {
    currentRequest = null;
    if (customerDiv) {
      customerDiv.textContent = "Select at least one counter in settings to keep practicing.";
    }
    clearCounter();
    renderShelf([]);
    reactionDiv.innerHTML = "";
    if (feedbackDiv) {
      feedbackDiv.textContent = "";
    }
    updateCounterHint();
    setHintVisibility(false);
    updateReplayButtonState();
    updateModeStatus();
    updateChallengeStatus();
    updateStreakStatus();
    return;
  }
  currentRequest = nextRequest;
  updateCustomerText();
  clearCounter();
  reactionDiv.innerHTML = "";
  if (feedbackDiv) {
    feedbackDiv.textContent = "";
  }
  populateShelfForRequest(currentRequest);
  speakJapanese(getPromptSpeechText(currentRequest));
  updateCounterHint();
  setHintVisibility(false);
  updateReplayButtonState();
  updateModeStatus();
  updateChallengeStatus();
  updateStreakStatus();

  if (drawerState.currentType === "clock") {
    initClockDrawer();
    resetClockHands();
  } else if (drawerState.currentType === "calendar") {
    initCalendarDrawer();
    refreshCalendarMode();
  } else if (drawerState.currentType === "house") {
    initHouseDrawer();
    prepareHouseDrawerForRequest();
  }
}

function updateCustomerText() {
  if (!currentRequest) {
    customerDiv.textContent = "「---」";
    return;
  }
  const { counterObj, number } = currentRequest;
  const reading = getCounterReading(counterObj, number);

  if (showFurigana) {
    customerDiv.innerHTML = `「<ruby>${number}${counterObj.counter}<rt>${reading}</rt></ruby>ください。」`;
  } else {
    customerDiv.textContent = `「${number}${counterObj.counter}ください。」`;
  }
}

if (replayVoiceBtn) {
  replayVoiceBtn.addEventListener("click", () => {
    if (!currentRequest) return;
    speakJapanese(getPromptSpeechText(currentRequest));
  });
}

if (hintToggleBtn && counterHintDiv) {
  hintToggleBtn.addEventListener("click", () => {
    if (!currentRequest) return;
    setHintVisibility(!hintVisible);
  });
  hintToggleBtn.textContent = HINT_SHOW_LABEL;
  hintToggleBtn.setAttribute("aria-controls", "counterHint");
}

function renderShelf(items) {
  shelfDiv.innerHTML = "";
  items.forEach(({ item, counter }) => {
    const div = document.createElement("div");
    div.className = "item";
    div.style.backgroundImage = `url(${item.image})`;
    div.dataset.itemId = item.id;
    div.dataset.counter = counter.counter;
    div.draggable = true;
    div.title = "Click or drag to add to the counter";
    div.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", JSON.stringify({
        id: item.id,
        counter: counter.counter
      }));
    });
    div.addEventListener("click", () => {
      addItemToCounter(item, counter);
    });
    shelfDiv.appendChild(div);
  });

  syncCounterItemSize();
}

function populateShelfForRequest(request) {
  if (!gameData || !request) return;

  const practice = getCounterPractice(request.counterObj);
  if (practice && (practice.type === "clock" || practice.type === "calendar" || practice.type === "house")) {
    renderShelf([]);
    return;
  }

  if (!request.item || !Array.isArray(request.counterObj.items) || !request.counterObj.items.length) {
    renderShelf([]);
    return;
  }

  const allItems = [];
  gameData.counters.forEach(counter => {
    counter.items.forEach(item => {
      allItems.push({ item, counter });
    });
  });

  const selectedItems = [{ item: request.item, counter: request.counterObj }];

  const remainingItems = allItems.filter(({ item, counter }) => {
    return !(counter.counter === request.counterObj.counter && item.id === request.item.id);
  });

  while (selectedItems.length < 6 && remainingItems.length) {
    const index = Math.floor(Math.random() * remainingItems.length);
    selectedItems.push(remainingItems.splice(index, 1)[0]);
  }

  for (let i = selectedItems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [selectedItems[i], selectedItems[j]] = [selectedItems[j], selectedItems[i]];
  }

  renderShelf(selectedItems);
}

// Dropzone logic
counterDiv.addEventListener("dragover", e => e.preventDefault());
counterDiv.addEventListener("drop", e => {
  e.preventDefault();
  if (!gameData) return;
  const rawData = e.dataTransfer.getData("text/plain");
  if (!rawData) return;
  let data;
  try {
    data = JSON.parse(rawData);
  } catch (err) {
    return;
  }
  const counterObj = gameData.counters.find(c => c.counter === data.counter);
  if (!counterObj) return;
  const item = counterObj.items.find(i => i.id === data.id);
  if (!item) return;
  addItemToCounter(item, counterObj);
});

function getCounterDropHintHTML() {
  if (!currentRequest || !currentRequest.counterObj) {
    return COUNTER_HINT_HTML;
  }
  const practice = getCounterPractice(currentRequest.counterObj);
  if (practice && practice.type === "clock") {
    const handLabel = getClockHandLabel(practice.hand);
    const displayValue = formatClockDisplayValue(practice.hand, currentRequest.number);
    return `<span class="drop-hint">Use the clock drawer to set the ${handLabel} to ${displayValue}.</span>`;
  }
  if (practice && practice.type === "calendar") {
    const label = formatCalendarLabel(practice.mode, currentRequest.number);
    return `<span class="drop-hint">Use the calendar drawer to mark ${currentRequest.number} ${label}.</span>`;
  }
  if (practice && practice.type === "house") {
    const targetKey = getHousePracticeTarget(currentRequest.counterObj);
    const label = formatHouseTargetLabel(targetKey, currentRequest.number);
    return `<span class="drop-hint">Use the house drawer to select ${currentRequest.number} ${label}.</span>`;
  }
  return COUNTER_HINT_HTML;
}

function clearCounter() {
  counterDiv.innerHTML = getCounterDropHintHTML();
  counterDiv.classList.remove("has-items");
}

function updateCounterItemCount(counterItem, count) {
  const badge = counterItem.querySelector('.item-count');
  if (badge) {
    badge.textContent = `x${count}`;
  }
  counterItem.title = count > 1
    ? `Click to remove one (x${count})`
    : "Click to remove";
}

function addItemToCounter(item, counterObj) {
  if (!item || !counterObj) return;
  const hint = counterDiv.querySelector(".drop-hint");
  if (hint) hint.remove();
  counterDiv.classList.add("has-items");
  const existingItem = counterDiv.querySelector(`.item[data-item-id="${item.id}"][data-counter="${counterObj.counter}"]`);
  if (existingItem) {
    const newCount = parseInt(existingItem.dataset.count || "1", 10) + 1;
    existingItem.dataset.count = String(newCount);
    updateCounterItemCount(existingItem, newCount);
    return;
  }

  const div = document.createElement("div");
  div.className = "item";
  div.style.backgroundImage = `url(${item.image})`;
  div.dataset.itemId = item.id;
  div.dataset.counter = counterObj.counter;
  div.dataset.count = "1";

  const countBadge = document.createElement("span");
  countBadge.className = "item-count";
  countBadge.textContent = "x1";
  div.appendChild(countBadge);

  div.addEventListener("click", () => {
    const currentCount = parseInt(div.dataset.count || "1", 10);
    if (currentCount <= 1) {
      div.remove();
      if (!counterDiv.querySelector(".item")) {
        clearCounter();
      }
      return;
    }
    const nextCount = currentCount - 1;
    div.dataset.count = String(nextCount);
    updateCounterItemCount(div, nextCount);
  });

  counterDiv.appendChild(div);
  updateCounterItemCount(div, 1);
  syncCounterItemSize();
}

function proceedToNextRound() {
  if (challengeMode) {
    challengeRounds++;
    updateChallengeStatus();
    if (challengeRounds >= MAX_CHALLENGE_ROUNDS) {
      setTimeout(() => {
        alert(`Challenge over! Score: ${challengeScore}/${MAX_CHALLENGE_ROUNDS}`);
        challengeMode = false;
        challengeRounds = 0;
        challengeScore = 0;
        correctStreak = 0;
        updateModeStatus();
        updateChallengeStatus();
        updateStreakStatus();
      }, 500);
      return;
    }
    setTimeout(newCustomer, 1600);
    return;
  }
  setTimeout(newCustomer, 1600);
}

function handleAnswerFeedback(wasCorrect, { successHTML, failureHTML, clearCounterOnFailure = true } = {}) {
  if (wasCorrect) {
    reactionDiv.innerHTML = `<img src="data/assets/ui/maru_ok.png" alt="OK" height="80">`;
    if (feedbackDiv) {
      feedbackDiv.innerHTML = successHTML || "<strong>Nice!</strong> Great job!";
    }
    correctStreak++;
    if (challengeMode) challengeScore++;
  } else {
    reactionDiv.innerHTML = `<img src="data/assets/ui/maru_wrong.png" alt="Wrong" height="80">`;
    if (feedbackDiv) {
      feedbackDiv.innerHTML = failureHTML || "<strong>Almost!</strong> Keep practicing!";
    }
    if (clearCounterOnFailure) {
      clearCounter();
    }
    correctStreak = 0;
  }

  updateStreakStatus();
  proceedToNextRound();
}

// Done button
const doneBtn = document.getElementById("doneBtn");
if (doneBtn) {
  doneBtn.addEventListener("click", () => {
    if (!currentRequest) return;

    const { counterObj } = currentRequest;
    if (isClockCounter(counterObj)) {
      openDrawer("clock");
      return;
    }
    if (isCalendarCounter(counterObj)) {
      openDrawer("calendar");
      return;
    }

    const items = [...counterDiv.querySelectorAll(".item")];
    const totalCount = items.reduce((sum, el) => sum + parseInt(el.dataset.count || "1", 10), 0);
    const correctNumber = totalCount === currentRequest.number;
    const correctCategory = items.every(p => p.dataset.counter === counterObj.counter);

    const wasCorrect = correctNumber && correctCategory;

    recordCounterResult(counterObj, wasCorrect);

    const successHTML = `<strong>Nice!</strong> 「${currentRequest.number}${counterObj.counter}」 is perfect for ${counterObj.category}.`;
    const failureMessages = [];
    if (!correctNumber) {
      failureMessages.push(`You need ${currentRequest.number} in total.`);
    }
    if (!correctCategory) {
      failureMessages.push(`Choose items that use 「${counterObj.counter}」 (${counterObj.category}).`);
    }
    const failureHTML = `<strong>Almost!</strong> ${failureMessages.join(" ")}`;

    handleAnswerFeedback(wasCorrect, {
      successHTML,
      failureHTML,
      clearCounterOnFailure: true
    });
  });
}

// Practice / Challenge buttons
document.getElementById("startPractice").addEventListener("click", () => {
  challengeMode = false;
  challengeRounds = 0;
  challengeScore = 0;
  correctStreak = 0;
  updateModeStatus();
  updateChallengeStatus();
  updateStreakStatus();
  newCustomer();
});

document.getElementById("startChallenge").addEventListener("click", () => {
  challengeMode = true;
  challengeRounds = 0;
  challengeScore = 0;
  correctStreak = 0;
  updateModeStatus();
  updateChallengeStatus();
  updateStreakStatus();
  newCustomer();
});

// Settings modal
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const furiganaCheckbox = document.getElementById("furiganaCheckbox");
const voiceCheckbox = document.getElementById("voiceCheckbox");
const fallbackVoiceCheckbox = document.getElementById("fallbackVoiceCheckbox");
const closeSettings = document.getElementById("closeSettings");

settingsBtn.addEventListener("click", () => {
  settingsModal.style.display = "flex";
  furiganaCheckbox.checked = showFurigana;
  voiceCheckbox.checked = voiceEnabled;
  if (fallbackVoiceCheckbox) {
    fallbackVoiceCheckbox.checked = fallbackVoiceEnabled;
  }
  reopenSettingsAfterCounter = false;
});

closeSettings.addEventListener("click", () => {
  settingsModal.style.display = "none";
  reopenSettingsAfterCounter = false;
});

if (openCounterPageBtn) {
  openCounterPageBtn.addEventListener("click", () => {
    reopenSettingsAfterCounter = Boolean(settingsModal && settingsModal.style.display !== "none");
    if (settingsModal) {
      settingsModal.style.display = "none";
    }
    openCounterPreferences();
  });
}

if (closeCounterPageBtn) {
  closeCounterPageBtn.addEventListener("click", () => {
    closeCounterPreferences();
  });
}

if (selectAllCountersBtn) {
  selectAllCountersBtn.addEventListener("click", () => {
    if (!gameData || !Array.isArray(gameData.counters)) return;
    if (areAllCountersSelected()) {
      enabledCounters = [];
    } else {
      enabledCounters = null;
    }
    saveEnabledCounters();
    renderCounterPreferences();
  });
}

furiganaCheckbox.addEventListener("change", () => {
  showFurigana = furiganaCheckbox.checked;
  localStorage.setItem("showFurigana", showFurigana);
  if (currentRequest) updateCustomerText();
  updateReplayButtonState();
});

voiceCheckbox.addEventListener("change", () => {
  voiceEnabled = voiceCheckbox.checked;
  localStorage.setItem("voiceEnabled", voiceEnabled);
  if (!voiceEnabled && fallbackAudioElement) {
    try {
      fallbackAudioElement.pause();
    } catch (err) {
      // Ignore pause errors.
    }
  }
  if (voiceEnabled && currentRequest) {
    speakJapanese(getPromptSpeechText(currentRequest));
  }
  updateReplayButtonState();
});

if (fallbackVoiceCheckbox) {
  fallbackVoiceCheckbox.addEventListener("change", () => {
    fallbackVoiceEnabled = fallbackVoiceCheckbox.checked;
    localStorage.setItem("fallbackVoiceEnabled", fallbackVoiceEnabled);
    if (!fallbackVoiceEnabled && fallbackAudioElement) {
      try {
        fallbackAudioElement.pause();
      } catch (err) {
        // Ignore pause errors.
      }
      setLastVoiceEngine(("speechSynthesis" in window) ? "browser" : "none");
    } else if (fallbackVoiceEnabled && !('speechSynthesis' in window)) {
      setLastVoiceEngine("fallback");
    }
    updateReplayButtonState();
  });
}

window.addEventListener("click", (event) => {
  if (event.target === settingsModal) {
    settingsModal.style.display = "none";
  }
  if (event.target === counterModal) {
    reopenSettingsAfterCounter = false;
    closeCounterPreferences();
  }
});

function getShelfItemSize() {
  const shelfItem = shelfDiv.querySelector('.item');
  if (!shelfItem) return null;
  return shelfItem.getBoundingClientRect().width;
}

function syncCounterItemSize() {
  const size = getShelfItemSize();
  if (!size) return;
  counterDiv.querySelectorAll('.item').forEach(item => {
    item.style.width = `${size}px`;
    item.style.height = `${size}px`;
  });
}

const drawerState = {
  currentType: null,
  clock: {
    initialized: false,
    activeHand: null,
    activePointerId: null,
    expectedHand: null,
    values: { hours: 0, minutes: 0, seconds: 0 },
    config: {
      hours: { steps: 12, element: null, degPerStep: 360 / 12, baseZIndex: 2 },
      minutes: { steps: 60, element: null, degPerStep: 360 / 60, baseZIndex: 3 },
      seconds: { steps: 60, element: null, degPerStep: 360 / 60, baseZIndex: 4 }
    }
  },
  calendar: {
    initialized: false,
    mode: "days",
    selectedDays: new Set(),
    selectedWeeks: new Set(),
    selectedMonths: new Set(),
    lastDayAnchor: null,
    lastMonthAnchor: null,
    yearTorn: false,
    weekDragActive: false,
    weekDragPointerId: null,
    weekDragIntent: true,
    listenersAttached: false,
    lastCount: 0,
    elements: {
      months: [],
      weeks: [],
      days: [],
      monthMap: new Map(),
      weekMap: new Map(),
      dayMap: new Map()
    }
  },
  house: {
    initialized: false,
    loading: false,
    assetPromise: null,
    svgSources: null,
    activeTarget: null,
    selected: {
      floors: new Set(),
      rooms: new Set(),
      tatami: new Set(),
      cars: new Set(),
      trees: new Set(),
      windows: new Set()
    },
    elements: {
      floors: [],
      rooms: [],
      tatami: [],
      cars: [],
      trees: [],
      windows: []
    }
  }
};

const CLOCK_HAND_KEYS = ["hours", "minutes", "seconds"];
const CALENDAR_MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

const CALENDAR_MODE_DESCRIPTIONS = {
  days: "Click individual days to cross them out.",
  weeks: "Drag across a row to mark full weeks.",
  months: "Click any month card to highlight it.",
  years: "Tear off the page when you're done."
};

const CALENDAR_MODE_TARGET_LABELS = {
  days: "day(s)",
  weeks: "week(s)",
  months: "month(s)",
  years: "year(s)"
};

const HOUSE_SELECTION_KEYS = ["floors", "rooms", "tatami", "cars", "trees", "windows"];
const SVG_NS = "http://www.w3.org/2000/svg";
const HOUSE_FLOOR_ORDER = [3, 2, 1];

const HOUSE_TARGET_LABELS = {
  floors: "floor(s)",
  rooms: "room(s)",
  tatami: "tatami mat(s)",
  cars: "car(s)",
  trees: "tree(s)",
  windows: "window(s)"
};

const HOUSE_TARGET_TITLES = {
  floors: "Floors",
  rooms: "Rooms",
  tatami: "Tatami",
  cars: "Cars",
  trees: "Trees",
  windows: "Windows"
};

const HOUSE_COUNTER_TARGET_MAP = {
  "階": "floors",
  "フロア": "floors",
  "部屋": "rooms",
  "ルーム": "rooms",
  "畳": "tatami",
  "枚": "windows",
  "台": "cars",
  "車": "cars",
  "本": "trees"
};

function formatCalendarLabel(mode, count) {
  const base = CALENDAR_MODE_TARGET_LABELS[mode] || "item(s)";
  if (!base.includes("(s)")) {
    return base;
  }
  return base.replace("(s)", count === 1 ? "" : "s");
}

function formatHouseTargetLabel(targetKey, count) {
  const base = HOUSE_TARGET_LABELS[targetKey];
  if (!base) return "item(s)";
  if (!base.includes("(s)")) {
    return base;
  }
  return base.replace("(s)", count === 1 ? "" : "s");
}

function getHouseTargetTitle(targetKey) {
  return HOUSE_TARGET_TITLES[targetKey] || "Items";
}

function getHousePracticeTarget(counterObj) {
  if (!counterObj) return null;
  const practice = getCounterPractice(counterObj);
  if (practice && practice.type === "house") {
    if (practice.target) {
      const normalized = practice.target
        .toString()
        .trim()
        .toLowerCase();
      if (HOUSE_SELECTION_KEYS.includes(normalized)) {
        return normalized;
      }
    }
  }
  const counterKey = counterObj.counter;
  if (counterKey && HOUSE_COUNTER_TARGET_MAP[counterKey]) {
    return HOUSE_COUNTER_TARGET_MAP[counterKey];
  }
  return null;
}

function normalizeCalendarKey(value) {
  if (!value) return "";
  return value
    .toString()
    .trim()
    .replace(/\s+/g, "")
    .normalize("NFKC")
    .toLowerCase();
}

const CALENDAR_MODE_LOOKUP = (() => {
  const pairs = [
    ["日", "days"],
    ["日間", "days"],
    ["日目", "days"],
    ["日数", "days"],
    ["にち", "days"],
    ["ニチ", "days"],
    ["ひ", "days"],
    ["週", "weeks"],
    ["週間", "weeks"],
    ["週刊", "weeks"],
    ["しゅう", "weeks"],
    ["しゅうかん", "weeks"],
    ["シュウ", "weeks"],
    ["月", "months"],
    ["ヶ月", "months"],
    ["か月", "months"],
    ["カ月", "months"],
    ["かげつ", "months"],
    ["がつ", "months"],
    ["年", "years"],
    ["年間", "years"],
    ["ねん", "years"],
    ["ネン", "years"]
  ];
  const lookup = new Map();
  pairs.forEach(([key, mode]) => {
    lookup.set(normalizeCalendarKey(key), mode);
  });
  return lookup;
})();

function setupDrawerLaunchers() {
  if (drawerLaunchers && drawerLaunchers.length) {
    drawerLaunchers.forEach(button => {
      button.addEventListener("click", () => {
        const type = button.getAttribute("data-drawer-toggle");
        if (!type) return;
        openDrawer(type);
      });
    });
  }

  if (drawerOverlay) {
    drawerOverlay.addEventListener("click", () => {
      closeDrawer();
    });
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" || event.key === "Esc") {
      closeDrawer();
    }
  });
}

function updateLauncherState(activeType) {
  if (!drawerLaunchers || !drawerLaunchers.length) return;
  drawerLaunchers.forEach(button => {
    const type = button.getAttribute("data-drawer-toggle");
    const isActive = Boolean(activeType && type === activeType);
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-expanded", isActive ? "true" : "false");
  });
}

function openDrawer(type) {
  if (!drawerContainer) return;
  const allowedTypes = ["clock", "calendar", "house"];
  const normalizedType = allowedTypes.includes(type) ? type : null;
  if (!normalizedType || !drawerPanels[normalizedType]) return;

  const isActive = drawerContainer.classList.contains("is-active");
  if (drawerState.currentType === normalizedType && isActive) {
    closeDrawer();
    return;
  }

  drawerState.currentType = normalizedType;

  Object.entries(drawerPanels).forEach(([key, panel]) => {
    if (!panel) return;
    const shouldShow = key === normalizedType;
    panel.hidden = !shouldShow;
    panel.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  });

  drawerContainer.dataset.drawer = normalizedType;
  drawerContainer.setAttribute("aria-hidden", "false");
  updateLauncherState(normalizedType);

  if (!isActive) {
    drawerContainer.classList.add("is-open");
    requestAnimationFrame(() => {
      drawerContainer.classList.add("is-active");
    });
    if (drawerOverlay) {
      drawerOverlay.hidden = false;
      requestAnimationFrame(() => {
        drawerOverlay.classList.add("is-visible");
      });
    }
  }

  if (normalizedType === "clock") {
    initClockDrawer();
    resetClockHands();
  } else if (normalizedType === "calendar") {
    initCalendarDrawer();
    refreshCalendarMode();
  } else if (normalizedType === "house") {
    initHouseDrawer();
    prepareHouseDrawerForRequest();
  }
}

function closeDrawer() {
  if (!drawerContainer || !drawerContainer.classList.contains("is-active")) {
    updateLauncherState(null);
    return;
  }

  drawerContainer.classList.remove("is-active");
  drawerContainer.setAttribute("aria-hidden", "true");
  drawerContainer.dataset.drawer = "";
  updateLauncherState(null);

  const handleDrawerTransitionEnd = () => {
    drawerContainer.classList.remove("is-open");
    Object.values(drawerPanels).forEach(panel => {
      if (!panel) return;
      panel.hidden = true;
      panel.setAttribute("aria-hidden", "true");
    });
  };

  drawerContainer.addEventListener("transitionend", handleDrawerTransitionEnd, { once: true });
  drawerState.currentType = null;

  if (drawerOverlay) {
    drawerOverlay.classList.remove("is-visible");
    const handleOverlayTransitionEnd = () => {
      drawerOverlay.hidden = true;
    };
    drawerOverlay.addEventListener("transitionend", handleOverlayTransitionEnd, { once: true });
  }

  if (drawerState.clock.activeHand) {
    handleClockHandPointerEnd(drawerState.clock.activeHand);
  }
  drawerState.clock.activeHand = null;
  drawerState.clock.activePointerId = null;
  drawerState.calendar.weekDragActive = false;
  drawerState.calendar.weekDragPointerId = null;
}

function initClockDrawer() {
  const clockState = drawerState.clock;
  if (clockState.initialized) return;
  if (!clockFaceEl) return;

  if (clockMarkersEl && !clockMarkersEl.childElementCount) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 12; i++) {
      const marker = document.createElement("span");
      marker.className = "clock-marker";
      marker.style.setProperty("--marker-rotation", `${i * 30}deg`);
      marker.textContent = i === 0 ? "12" : String(i);
      fragment.appendChild(marker);
    }
    clockMarkersEl.appendChild(fragment);
  }

  CLOCK_HAND_KEYS.forEach(handKey => {
    const config = clockState.config[handKey];
    if (!config) return;
    const element = clockFaceEl.querySelector(`[data-hand="${handKey}"]`);
    if (!element) return;
    config.element = element;
    element.dataset.value = "0";
    element.style.setProperty("--rotation", "0deg");
    element.addEventListener("pointerdown", event => handleClockHandPointerDown(handKey, event));
    element.addEventListener("pointermove", event => handleClockHandPointerMove(handKey, event));
    element.addEventListener("pointerup", () => handleClockHandPointerEnd(handKey));
    element.addEventListener("pointercancel", () => handleClockHandPointerEnd(handKey));
    element.addEventListener("lostpointercapture", () => handleClockHandPointerEnd(handKey));
  });

  clockState.initialized = true;
  refreshClockHandPriority();
  updateClockValue();
}

function handleClockHandPointerDown(handKey, event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const clockState = drawerState.clock;
  const config = clockState.config[handKey];
  if (!config || !config.element) return;
  event.preventDefault();
  clockState.activeHand = handKey;
  clockState.activePointerId = event.pointerId;
  config.element.classList.add("is-active");
  config.element.setPointerCapture(event.pointerId);
  updateClockHandFromEvent(handKey, event);
}

function handleClockHandPointerMove(handKey, event) {
  const clockState = drawerState.clock;
  if (clockState.activeHand !== handKey || clockState.activePointerId !== event.pointerId) return;
  updateClockHandFromEvent(handKey, event);
}

function handleClockHandPointerEnd(handKey) {
  if (!handKey) return;
  const clockState = drawerState.clock;
  const config = clockState.config[handKey];
  if (config && config.element) {
    config.element.classList.remove("is-active");
  }
  if (clockState.activeHand === handKey) {
    clockState.activeHand = null;
    clockState.activePointerId = null;
  }
}

function updateClockHandFromEvent(handKey, event) {
  const config = drawerState.clock.config[handKey];
  if (!config || !config.element || !clockFaceEl) return;
  const rect = clockFaceEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const adjusted = (angle + 450) % 360;
  const value = Math.round(adjusted / config.degPerStep) % config.steps;
  updateClockHand(handKey, value);
}

function updateClockHand(handKey, value) {
  const clockState = drawerState.clock;
  const config = clockState.config[handKey];
  if (!config || !config.element) return;
  const normalized = ((value % config.steps) + config.steps) % config.steps;
  clockState.values[handKey] = normalized;
  config.element.dataset.value = String(normalized);
  config.element.style.setProperty("--rotation", `${normalized * config.degPerStep}deg`);
  config.element.setAttribute("aria-valuenow", String(normalized));
  const ariaLabel =
    handKey === "hours"
      ? `${normalized} hour${normalized === 1 ? "" : "s"}`
      : `${normalized} ${handKey.slice(0, -1)}${normalized === 1 ? "" : "s"}`;
  config.element.setAttribute("aria-valuetext", ariaLabel);
  updateClockValue();
}

function getExpectedClockHandKey() {
  if (!currentRequest || !currentRequest.counterObj) return null;
  const practice = getCounterPractice(currentRequest.counterObj);
  if (!practice || practice.type !== "clock") return null;
  const { hand } = practice;
  return CLOCK_HAND_KEYS.includes(hand) ? hand : null;
}

function refreshClockHandPriority() {
  const clockState = drawerState.clock;
  if (!clockState || !clockState.config) return;
  const expectedHand = getExpectedClockHandKey();
  clockState.expectedHand = expectedHand;

  CLOCK_HAND_KEYS.forEach(handKey => {
    const config = clockState.config[handKey];
    if (!config || !config.element) return;
    const baseZ = Number.isFinite(config.baseZIndex) ? config.baseZIndex : 1;
    const zIndex = handKey === expectedHand ? baseZ + 20 : baseZ;
    config.element.style.zIndex = String(zIndex);
  });
}

function resetClockHands() {
  CLOCK_HAND_KEYS.forEach(handKey => {
    updateClockHand(handKey, 0);
  });
  refreshClockHandPriority();
}

function updateClockValue() {
  if (!clockValueEl) return;
  const { hours, minutes, seconds } = drawerState.clock.values;
  const pad = value => String(value).padStart(2, "0");
  const formatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (clockValueEl instanceof HTMLInputElement) {
    clockValueEl.value = formatted;
  } else {
    clockValueEl.textContent = formatted;
  }
}

function parseClockInputValue(rawValue) {
  if (typeof rawValue !== "string") return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length > 3) return null;
  const normalizedParts = parts.map(part => part.trim());
  if (normalizedParts.some(part => part && !/^\d{1,2}$/.test(part))) {
    return null;
  }

  while (normalizedParts.length < 3) {
    normalizedParts.push("");
  }

  const [hoursPart, minutesPart, secondsPart] = normalizedParts;
  const toNumber = part => {
    if (!part) return 0;
    const numeric = Number(part);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const rawHours = toNumber(hoursPart);
  const rawMinutes = toNumber(minutesPart);
  const rawSeconds = toNumber(secondsPart);

  return {
    hours: ((rawHours % 12) + 12) % 12,
    minutes: ((rawMinutes % 60) + 60) % 60,
    seconds: ((rawSeconds % 60) + 60) % 60
  };
}

function commitClockInputFromField() {
  if (!clockValueEl || !(clockValueEl instanceof HTMLInputElement)) return;
  const parsed = parseClockInputValue(clockValueEl.value);
  if (!parsed) {
    updateClockValue();
    return;
  }

  CLOCK_HAND_KEYS.forEach(handKey => {
    const nextValue = parsed[handKey];
    if (Number.isFinite(nextValue)) {
      updateClockHand(handKey, nextValue);
    }
  });
}

function getClockSelectedTime() {
  const { hours, minutes, seconds } = drawerState.clock.values;
  return { hours, minutes, seconds };
}

function emitClockAnswer() {
  const selectedTime = getClockSelectedTime();
  dispatchClockAnswer(selectedTime);
  closeDrawer();
}

function dispatchClockAnswer(selectedTime) {
  if (typeof window.checkClockAnswer === "function") {
    window.checkClockAnswer(selectedTime);
  } else {
    console.info("[Clock drawer] Selected time:", selectedTime);
  }
}

function initCalendarDrawer() {
  const calendarState = drawerState.calendar;
  if (calendarState.initialized) return;
  if (!calendarGridEl) return;

  calendarGridEl.innerHTML = "";
  calendarState.elements.months = [];
  calendarState.elements.weeks = [];
  calendarState.elements.days = [];
  calendarState.elements.monthMap.clear();
  calendarState.elements.weekMap.clear();
  calendarState.elements.dayMap.clear();

  CALENDAR_MONTH_LABELS.forEach((label, monthIndex) => {
    const monthEl = document.createElement("div");
    monthEl.className = "calendar-month";
    monthEl.dataset.month = String(monthIndex);

    const nameEl = document.createElement("div");
    nameEl.className = "calendar-month__name";
    nameEl.textContent = label;
    monthEl.appendChild(nameEl);

    for (let weekIndex = 0; weekIndex < 4; weekIndex++) {
      const weekEl = document.createElement("div");
      weekEl.className = "calendar-week";
      const weekId = `${monthIndex}:${weekIndex}`;
      weekEl.dataset.weekId = weekId;
      weekEl.addEventListener("pointerdown", handleCalendarWeekPointerDown);
      weekEl.addEventListener("pointerenter", handleCalendarWeekPointerEnter);

      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const dayEl = document.createElement("div");
        dayEl.className = "calendar-day";
        const dayId = `${monthIndex}:${weekIndex}:${dayIndex}`;
        dayEl.dataset.dayId = dayId;
        dayEl.textContent = String(weekIndex * 7 + dayIndex + 1).padStart(2, "0");
        dayEl.addEventListener("click", handleCalendarDayClick);
        weekEl.appendChild(dayEl);
        calendarState.elements.days.push(dayEl);
        calendarState.elements.dayMap.set(dayId, dayEl);
      }

      monthEl.appendChild(weekEl);
      calendarState.elements.weeks.push(weekEl);
      calendarState.elements.weekMap.set(weekId, weekEl);
    }

    monthEl.addEventListener("click", handleCalendarMonthClick);
    calendarGridEl.appendChild(monthEl);
    calendarState.elements.months.push(monthEl);
    calendarState.elements.monthMap.set(String(monthIndex), monthEl);
  });

  if (!calendarState.listenersAttached) {
    document.addEventListener("pointerup", handleCalendarWeekPointerEnd, true);
    document.addEventListener("pointercancel", handleCalendarWeekPointerEnd, true);
    calendarState.listenersAttached = true;
  }

  calendarState.initialized = true;
}

function handleCalendarDayClick(event) {
  if (drawerState.calendar.mode !== "days") return;
  const dayEl = event.currentTarget;
  const dayId = dayEl.dataset.dayId;
  if (!dayId) return;
  const calendarState = drawerState.calendar;

  if (event.shiftKey) {
    let anchorId = calendarState.lastDayAnchor;
    if (!anchorId && calendarState.elements.days.length) {
      const firstDay = calendarState.elements.days[0];
      anchorId = firstDay ? firstDay.dataset.dayId : null;
    }
    if (anchorId) {
      selectCalendarDayRange(anchorId, dayId);
      updateCalendarSummary();
    }
    return;
  }

  const isSelected = calendarState.selectedDays.has(dayId);
  if (isSelected) {
    calendarState.selectedDays.delete(dayId);
  } else {
    calendarState.selectedDays.add(dayId);
  }
  dayEl.classList.toggle("is-selected", !isSelected);
  calendarState.lastDayAnchor = dayId;
  updateCalendarSummary();
}

function handleCalendarMonthClick(event) {
  if (drawerState.calendar.mode !== "months") return;
  const monthEl = event.currentTarget;
  const monthIndex = Number(monthEl.dataset.month);
  if (!Number.isFinite(monthIndex)) return;
  const calendarState = drawerState.calendar;

  if (event.shiftKey) {
    let anchorIndex = calendarState.lastMonthAnchor;
    if (!Number.isFinite(anchorIndex)) {
      anchorIndex = 0;
    }
    selectCalendarMonthRange(anchorIndex, monthIndex);
    updateCalendarSummary();
    return;
  }

  const isSelected = calendarState.selectedMonths.has(monthIndex);
  if (isSelected) {
    calendarState.selectedMonths.delete(monthIndex);
  } else {
    calendarState.selectedMonths.add(monthIndex);
  }
  monthEl.classList.toggle("is-selected", !isSelected);
  calendarState.lastMonthAnchor = monthIndex;
  updateCalendarSummary();
}

function handleCalendarWeekPointerDown(event) {
  if (drawerState.calendar.mode !== "weeks") return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const weekEl = event.currentTarget;
  const weekId = weekEl.dataset.weekId;
  if (!weekId) return;
  event.preventDefault();
  const shouldSelect = !drawerState.calendar.selectedWeeks.has(weekId);
  drawerState.calendar.weekDragActive = true;
  drawerState.calendar.weekDragPointerId = event.pointerId;
  drawerState.calendar.weekDragIntent = shouldSelect;
  setWeekSelection(weekId, shouldSelect);
  updateCalendarSummary();
}

function handleCalendarWeekPointerEnter(event) {
  if (drawerState.calendar.mode !== "weeks") return;
  if (!drawerState.calendar.weekDragActive) return;
  if (drawerState.calendar.weekDragPointerId !== event.pointerId) return;
  const weekEl = event.currentTarget;
  const weekId = weekEl.dataset.weekId;
  if (!weekId) return;
  setWeekSelection(weekId, drawerState.calendar.weekDragIntent);
  updateCalendarSummary();
}

function handleCalendarWeekPointerEnd(event) {
  if (!drawerState.calendar.weekDragActive) return;
  if (drawerState.calendar.weekDragPointerId !== event.pointerId) return;
  drawerState.calendar.weekDragActive = false;
  drawerState.calendar.weekDragPointerId = null;
}

function setWeekSelection(weekId, shouldSelect) {
  const weekEl = drawerState.calendar.elements.weekMap.get(weekId);
  if (!weekEl) return;
  if (shouldSelect) {
    drawerState.calendar.selectedWeeks.add(weekId);
  } else {
    drawerState.calendar.selectedWeeks.delete(weekId);
  }
  weekEl.classList.toggle("is-selected", shouldSelect);
  weekEl.querySelectorAll(".calendar-day").forEach(dayEl => {
    dayEl.classList.toggle("is-selected", shouldSelect);
  });
}

function determineCalendarMode() {
  const defaultMode = "days";
  if (!currentRequest || !currentRequest.counterObj) {
    return defaultMode;
  }
  const { counterObj } = currentRequest;
  const candidates = [counterObj.counter, counterObj.reading];
  for (const candidate of candidates) {
    const mode = CALENDAR_MODE_LOOKUP.get(normalizeCalendarKey(candidate));
    if (mode) return mode;
  }
  const category = (counterObj.category || "").toLowerCase();
  if (category.includes("week")) return "weeks";
  if (category.includes("month")) return "months";
  if (category.includes("year")) return "years";
  if (category.includes("day")) return "days";
  return defaultMode;
}

function refreshCalendarMode() {
  setCalendarMode(determineCalendarMode());
}

function setCalendarMode(mode) {
  const calendarState = drawerState.calendar;
  calendarState.mode = mode;
  calendarState.selectedDays.clear();
  calendarState.selectedWeeks.clear();
  calendarState.selectedMonths.clear();
  calendarState.lastDayAnchor = null;
  calendarState.lastMonthAnchor = null;
  calendarState.yearTorn = false;
  calendarState.weekDragActive = false;
  calendarState.weekDragPointerId = null;
  calendarState.lastCount = 0;

  calendarState.elements.days.forEach(dayEl => dayEl.classList.remove("is-selected"));
  calendarState.elements.weeks.forEach(weekEl => weekEl.classList.remove("is-selected"));
  calendarState.elements.months.forEach(monthEl => monthEl.classList.remove("is-selected"));

  if (calendarGridEl) {
    calendarGridEl.classList.remove("is-torn");
  }

  if (calendarDrawerEl) {
    calendarDrawerEl.classList.remove(
      "calendar-drawer--mode-days",
      "calendar-drawer--mode-weeks",
      "calendar-drawer--mode-months",
      "calendar-drawer--mode-years"
    );
    calendarDrawerEl.classList.add(`calendar-drawer--mode-${mode}`);
  }

  if (calendarTearBtn) {
    calendarTearBtn.hidden = mode !== "years";
    calendarTearBtn.textContent = "🗓️ Tear off page";
  }

  updateCalendarModeDetails();
  updateCalendarSummary();
}

function updateCalendarModeDetails() {
  const mode = drawerState.calendar.mode;
  if (calendarModeLabel) {
    calendarModeLabel.textContent = CALENDAR_MODE_DESCRIPTIONS[mode] || "";
  }
  if (calendarTarget) {
    if (currentRequest && Number.isFinite(currentRequest.number)) {
      const label = CALENDAR_MODE_TARGET_LABELS[mode] || "item(s)";
      const counterText = currentRequest.counterObj && currentRequest.counterObj.counter
        ? ` 「${currentRequest.counterObj.counter}」`
        : "";
      calendarTarget.textContent = `Target: ${currentRequest.number} ${label}${counterText}`;
    } else {
      calendarTarget.textContent = "";
    }
  }
}

function updateCalendarSummary() {
  const calendarState = drawerState.calendar;
  let count = 0;
  if (calendarState.mode === "days") {
    count = calendarState.selectedDays.size;
  } else if (calendarState.mode === "weeks") {
    count = calendarState.selectedWeeks.size;
  } else if (calendarState.mode === "months") {
    count = calendarState.selectedMonths.size;
  } else if (calendarState.mode === "years") {
    count = calendarState.yearTorn ? 1 : 0;
  }
  calendarState.lastCount = count;
  if (calendarSelectionCount) {
    calendarSelectionCount.textContent = `Marked: ${count}`;
  }
}

function toggleCalendarTear() {
  if (drawerState.calendar.mode !== "years") return;
  drawerState.calendar.yearTorn = !drawerState.calendar.yearTorn;
  if (calendarGridEl) {
    calendarGridEl.classList.toggle("is-torn", drawerState.calendar.yearTorn);
  }
  if (calendarTearBtn) {
    calendarTearBtn.textContent = drawerState.calendar.yearTorn ? "↩️ Undo tear" : "🗓️ Tear off page";
  }
  updateCalendarSummary();
}

function parseCalendarDayId(id) {
  const [month, week, day] = id.split(":").map(value => Number(value));
  return {
    month: Number.isFinite(month) ? month : 0,
    week: Number.isFinite(week) ? week : 0,
    day: Number.isFinite(day) ? day : 0
  };
}

function parseCalendarWeekId(id) {
  const [month, week] = id.split(":").map(value => Number(value));
  return {
    month: Number.isFinite(month) ? month : 0,
    week: Number.isFinite(week) ? week : 0
  };
}

function getCalendarDayDetails(dayId) {
  if (typeof dayId !== "string") return null;
  const parts = dayId.split(":");
  if (parts.length !== 3) return null;
  const [month, week, day] = parts.map(part => Number(part));
  if (!Number.isFinite(month) || !Number.isFinite(week) || !Number.isFinite(day)) {
    return null;
  }
  return {
    month,
    week,
    day,
    index: month * 28 + week * 7 + day
  };
}

function selectCalendarDayRange(startDayId, endDayId) {
  const startDetails = getCalendarDayDetails(startDayId);
  const endDetails = getCalendarDayDetails(endDayId);
  if (!startDetails || !endDetails) return;
  const [minIndex, maxIndex] = startDetails.index <= endDetails.index
    ? [startDetails.index, endDetails.index]
    : [endDetails.index, startDetails.index];
  const calendarState = drawerState.calendar;
  calendarState.selectedDays.clear();
  calendarState.elements.days.forEach(dayEl => {
    const id = dayEl.dataset.dayId;
    const details = getCalendarDayDetails(id);
    const shouldSelect = Boolean(details && details.index >= minIndex && details.index <= maxIndex);
    dayEl.classList.toggle("is-selected", shouldSelect);
    if (shouldSelect && id) {
      calendarState.selectedDays.add(id);
    }
  });
}

function selectCalendarMonthRange(startMonthIndex, endMonthIndex) {
  if (!Number.isFinite(startMonthIndex) || !Number.isFinite(endMonthIndex)) return;
  const [minIndex, maxIndex] = startMonthIndex <= endMonthIndex
    ? [startMonthIndex, endMonthIndex]
    : [endMonthIndex, startMonthIndex];
  const calendarState = drawerState.calendar;
  calendarState.selectedMonths.clear();
  calendarState.elements.months.forEach(monthEl => {
    const index = Number(monthEl.dataset.month);
    const shouldSelect = Number.isFinite(index) && index >= minIndex && index <= maxIndex;
    monthEl.classList.toggle("is-selected", shouldSelect);
    if (shouldSelect) {
      calendarState.selectedMonths.add(index);
    }
  });
}

function getCalendarSelection() {
  const calendarState = drawerState.calendar;
  const mode = calendarState.mode;
  const selection = {
    mode,
    count: calendarState.lastCount,
    target: currentRequest ? currentRequest.number : null,
    counter: currentRequest && currentRequest.counterObj ? currentRequest.counterObj.counter : null,
    days: [],
    weeks: [],
    months: [],
    yearTorn: calendarState.yearTorn
  };

  if (mode === "days") {
    selection.days = Array.from(calendarState.selectedDays).map(parseCalendarDayId);
    selection.count = calendarState.selectedDays.size;
  } else if (mode === "weeks") {
    selection.weeks = Array.from(calendarState.selectedWeeks).map(parseCalendarWeekId);
    selection.count = calendarState.selectedWeeks.size;
  } else if (mode === "months") {
    selection.months = Array.from(calendarState.selectedMonths);
    selection.count = calendarState.selectedMonths.size;
  } else if (mode === "years") {
    selection.count = calendarState.yearTorn ? 1 : 0;
  }

  return selection;
}

function emitCalendarAnswer() {
  const selection = getCalendarSelection();
  dispatchCalendarAnswer(selection);
  closeDrawer();
}

function dispatchCalendarAnswer(selection) {
  if (typeof window.checkCalendarAnswer === "function") {
    window.checkCalendarAnswer(selection);
  } else {
    console.info("[Calendar drawer] Selected period:", selection);
  }
}

function registerHouseSelectable(element, type, { stopPropagation = false, onActivate = null } = {}) {
  if (!element || !HOUSE_SELECTION_KEYS.includes(type)) return;
  const houseState = drawerState.house;
  if (!element.classList.contains("house-selectable")) {
    element.classList.add("house-selectable");
  }
  if (!element.hasAttribute("tabindex")) {
    element.setAttribute("tabindex", "0");
  }
  if (!element.hasAttribute("role")) {
    element.setAttribute("role", "button");
  }
  if (element.namespaceURI === SVG_NS) {
    element.setAttribute("focusable", "true");
  }
  element.dataset.selectionType = type;
  if (!element.dataset.selectionId) {
    element.dataset.selectionId = `${type}-${houseState.elements[type].length + 1}`;
  }
  element.setAttribute("aria-pressed", "false");
  const activateElement = event => {
    if (typeof onActivate === "function") {
      onActivate(event, element);
    } else {
      toggleSelection(element);
    }
  };
  const activate = event => {
    if (stopPropagation) {
      event.stopPropagation();
    }
    activateElement(event);
  };
  element.addEventListener("click", activate);
  element.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      if (stopPropagation) {
        event.stopPropagation();
      }
      activateElement(event);
    }
  });
  houseState.elements[type].push(element);
}

function toggleSelection(element, forceState) {
  if (!element) return false;
  const type = element.dataset.selectionType;
  if (!HOUSE_SELECTION_KEYS.includes(type)) return false;
  const id = element.dataset.selectionId || `${type}-${Date.now()}`;
  element.dataset.selectionId = id;
  const houseState = drawerState.house;
  if (!(houseState.selected[type] instanceof Set)) {
    houseState.selected[type] = new Set();
  }
  const selectedSet = houseState.selected[type];
  const shouldSelect = typeof forceState === "boolean" ? forceState : !selectedSet.has(id);
  if (shouldSelect) {
    selectedSet.add(id);
  } else {
    selectedSet.delete(id);
  }
  element.classList.toggle("is-selected", shouldSelect);
  element.setAttribute("aria-pressed", shouldSelect ? "true" : "false");
  updateHouseSelectionSummary();
  return shouldSelect;
}

function incrementHouseSelection(type) {
  if (!HOUSE_SELECTION_KEYS.includes(type)) return false;
  const houseState = drawerState.house;
  const elements = houseState.elements[type];
  if (!Array.isArray(elements) || elements.length === 0) {
    return false;
  }
  const selectedSet = houseState.selected[type] instanceof Set ? houseState.selected[type] : null;
  const nextElement = elements.find(element => {
    if (!element) return false;
    const id = element.dataset ? element.dataset.selectionId : null;
    if (!id) return false;
    return !selectedSet || !selectedSet.has(id);
  });
  if (!nextElement) {
    return false;
  }
  toggleSelection(nextElement, true);
  return true;
}

function resetHouseSelections() {
  const houseState = drawerState.house;
  HOUSE_SELECTION_KEYS.forEach(key => {
    if (!(houseState.selected[key] instanceof Set)) {
      houseState.selected[key] = new Set();
    } else {
      houseState.selected[key].clear();
    }
    houseState.elements[key].forEach(element => {
      element.classList.remove("is-selected");
      element.setAttribute("aria-pressed", "false");
    });
  });
  updateHouseSelectionSummary();
}

function getHouseSelectionSnapshot() {
  const snapshot = {};
  const houseState = drawerState.house;
  HOUSE_SELECTION_KEYS.forEach(key => {
    const set = houseState.selected[key];
    snapshot[key] = set instanceof Set ? set.size : 0;
  });
  return snapshot;
}

function updateHouseSelectionSummary() {
  if (!houseSelectionSummaryEl) return;
  const fragment = document.createDocumentFragment();
  const snapshot = getHouseSelectionSnapshot();
  const activeTarget = drawerState.house.activeTarget;
  HOUSE_SELECTION_KEYS.forEach(key => {
    const item = document.createElement("div");
    item.className = "house-summary-item";
    item.dataset.selectionType = key;
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    if (key === activeTarget) {
      item.classList.add("is-target");
    }
    const title = getHouseTargetTitle(key);
    const normalizedTitle = typeof title === "string" ? title.toLowerCase() : "items";
    const label = document.createElement("span");
    label.textContent = title;
    const count = document.createElement("strong");
    count.textContent = snapshot[key];
    const ariaLabel = `Increase ${normalizedTitle} selection (currently ${snapshot[key]})`;
    item.setAttribute("aria-label", ariaLabel);
    item.title = `Click to add more ${normalizedTitle}`;
    const increment = () => {
      incrementHouseSelection(key);
    };
    item.addEventListener("click", increment);
    item.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        increment();
      }
    });
    item.append(label, count);
    fragment.appendChild(item);
  });
  houseSelectionSummaryEl.innerHTML = "";
  houseSelectionSummaryEl.appendChild(fragment);
}

function renderHouseView(counterObj) {
  if (!houseDrawerEl) return;
  const targetKey = counterObj ? getHousePracticeTarget(counterObj) : null;
  const validTarget = HOUSE_SELECTION_KEYS.includes(targetKey) ? targetKey : null;
  drawerState.house.activeTarget = validTarget;
  houseDrawerEl.classList.toggle("house-drawer--windows", validTarget === "windows");
  HOUSE_SELECTION_KEYS.forEach(key => {
    const elements = drawerState.house.elements[key];
    const isTarget = key === validTarget;
    elements.forEach(element => {
      element.classList.toggle("is-target", isTarget);
    });
  });
  updateHouseSelectionSummary();
}

function prepareHouseDrawerForRequest() {
  if (!houseDrawerEl) return;
  resetHouseSelections();
  const counterObj = currentRequest ? currentRequest.counterObj : null;
  renderHouseView(counterObj);
}

function fetchSvgAsset(path) {
  return fetch(path).then(response => {
    if (!response.ok) {
      throw new Error(`Failed to load SVG at ${path}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  });
}

function createSvgElementFromMarkup(markup) {
  if (!markup) return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(markup, "image/svg+xml");
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() === "parsererror") {
      return null;
    }
    const svgNode = root.nodeName.toLowerCase() === "svg" ? root : doc.querySelector("svg");
    if (!svgNode) return null;
    const imported = document.importNode(svgNode, true);
    imported.removeAttribute("width");
    imported.removeAttribute("height");
    imported.setAttribute("preserveAspectRatio", "xMidYMid meet");
    imported.classList.add("house-svg");
    imported.setAttribute("focusable", "false");
    imported.setAttribute("aria-hidden", "true");
    return imported;
  } catch (error) {
    console.error("[House drawer] Could not parse SVG markup:", error);
    return null;
  }
}

function getFloorLabel(floorNumber) {
  switch (floorNumber) {
    case 1:
      return "Ground floor";
    case 2:
      return "Second floor";
    case 3:
      return "Third floor";
    default:
      return `Floor ${floorNumber}`;
  }
}

function ensureHouseElementLabel(element, label) {
  if (!element) return;
  if (label) {
    element.setAttribute("aria-label", label);
  }
}

function registerFloorPlanElements(svgEl, floorNumber, { includeOutdoor = false } = {}) {
  if (!svgEl) return;
  const roomGroups = svgEl.querySelectorAll(".Room_Grouped");
  roomGroups.forEach((group, groupIndex) => {
    const roomRect = group.querySelector(".Room");
    if (roomRect) {
      ensureHouseElementLabel(roomRect, `Room ${groupIndex + 1} on ${getFloorLabel(floorNumber).toLowerCase()}`);
      roomRect.dataset.selectionId = `floor-${floorNumber}-room-${groupIndex + 1}`;
      registerHouseSelectable(roomRect, "rooms");
    }
    const tatamiRects = group.querySelectorAll(".Tatami");
    tatamiRects.forEach((tatamiRect, tatamiIndex) => {
      ensureHouseElementLabel(
        tatamiRect,
        `Tatami ${tatamiIndex + 1} in room ${groupIndex + 1} on ${getFloorLabel(floorNumber).toLowerCase()}`
      );
      tatamiRect.dataset.selectionId = `floor-${floorNumber}-room-${groupIndex + 1}-tatami-${tatamiIndex + 1}`;
      registerHouseSelectable(tatamiRect, "tatami", {
        stopPropagation: true,
        onActivate: (event, element) => {
          const activeTarget = drawerState.house.activeTarget;
          if (activeTarget === "rooms" && roomRect) {
            toggleSelection(roomRect);
          } else {
            toggleSelection(element);
          }
        }
      });
    });
  });

  if (includeOutdoor) {
    const parkingRects = svgEl.querySelectorAll(".ParkingSpot rect");
    parkingRects.forEach((spotRect, index) => {
      ensureHouseElementLabel(spotRect, `Parking spot ${index + 1}`);
      spotRect.dataset.selectionId = `car-${index + 1}`;
      registerHouseSelectable(spotRect, "cars");
    });

    const treeElements = svgEl.querySelectorAll(".Tree");
    treeElements.forEach((treeEl, index) => {
      ensureHouseElementLabel(treeEl, `Tree ${index + 1}`);
      treeEl.dataset.selectionId = `tree-${index + 1}`;
      registerHouseSelectable(treeEl, "trees");
    });
  }
}

function createSideViewWindows(svgEl, floorRect, floorNumber) {
  if (!svgEl || !floorRect) return;
  const bbox = floorRect.getBBox ? floorRect.getBBox() : null;
  if (!bbox || !Number.isFinite(bbox.width) || !Number.isFinite(bbox.height) || bbox.width <= 0 || bbox.height <= 0) {
    return;
  }
  const windowCount = 2;
  const windowWidth = bbox.width * 0.24;
  const windowHeight = bbox.height * 0.55;
  const gap = (bbox.width - windowCount * windowWidth) / (windowCount + 1);
  const baseY = bbox.y + (bbox.height - windowHeight) / 2;

  for (let i = 0; i < windowCount; i += 1) {
    const x = bbox.x + gap * (i + 1) + windowWidth * i;
    const windowRect = document.createElementNS(SVG_NS, "rect");
    windowRect.setAttribute("x", x.toFixed(2));
    windowRect.setAttribute("y", baseY.toFixed(2));
    windowRect.setAttribute("width", windowWidth.toFixed(2));
    windowRect.setAttribute("height", windowHeight.toFixed(2));
    const radius = Math.min(windowWidth, windowHeight) * 0.2;
    windowRect.setAttribute("rx", radius.toFixed(2));
    windowRect.setAttribute("ry", radius.toFixed(2));
    windowRect.classList.add("house-window");
    windowRect.dataset.selectionId = `floor-${floorNumber}-window-${i + 1}`;
    ensureHouseElementLabel(windowRect, `Window ${i + 1} on ${getFloorLabel(floorNumber).toLowerCase()}`);
    floorRect.parentNode.insertBefore(windowRect, floorRect.nextSibling);
    registerHouseSelectable(windowRect, "windows");
  }
}

function registerSideViewElements(svgEl) {
  if (!svgEl) return;
  const floorEntries = Array.from(svgEl.querySelectorAll(".Floor_Sideview")).map(rect => ({
    rect,
    y: rect.getBBox ? rect.getBBox().y : 0
  }));
  if (!floorEntries.length) return;
  floorEntries
    .sort((a, b) => a.y - b.y)
    .forEach((entry, index) => {
      const floorNumber = HOUSE_FLOOR_ORDER[index] || HOUSE_FLOOR_ORDER[HOUSE_FLOOR_ORDER.length - 1] - index;
      ensureHouseElementLabel(entry.rect, getFloorLabel(floorNumber));
      entry.rect.dataset.selectionId = `side-floor-${floorNumber}`;
      entry.rect.dataset.floorNumber = String(floorNumber);
      registerHouseSelectable(entry.rect, "floors");
      createSideViewWindows(svgEl, entry.rect, floorNumber);
    });
}

function initHouseDrawer() {
  const houseState = drawerState.house;
  if (houseState.initialized || houseState.loading) return;
  if (!houseDrawerEl) return;

  HOUSE_SELECTION_KEYS.forEach(key => {
    houseState.elements[key] = [];
    if (!(houseState.selected[key] instanceof Set)) {
      houseState.selected[key] = new Set();
    } else {
      houseState.selected[key].clear();
    }
  });

  if (!houseState.assetPromise) {
    houseState.assetPromise = Promise.all([
      fetchSvgAsset("data/assets/SVGs/Floor_GroundFloor.svg"),
      fetchSvgAsset("data/assets/SVGs/Floor.svg"),
      fetchSvgAsset("data/assets/SVGs/Sideview.svg")
    ]).then(([groundMarkup, floorMarkup, sideMarkup]) => {
      houseState.svgSources = {
        ground: groundMarkup,
        floor: floorMarkup,
        side: sideMarkup
      };
      return houseState.svgSources;
    });
  }

  houseState.loading = true;

  houseState.assetPromise
    .then(svgSources => {
      if (!svgSources) return;

      if (houseFloorPlanEl) {
        houseFloorPlanEl.innerHTML = "";
        const stack = document.createElement("div");
        stack.className = "house-floor-stack";

        HOUSE_FLOOR_ORDER.forEach(floorNumber => {
          const floorCard = document.createElement("article");
          floorCard.className = "house-floor";
          floorCard.dataset.floorNumber = String(floorNumber);

          const label = document.createElement("p");
          label.className = "house-floor__label";
          label.textContent = getFloorLabel(floorNumber);
          floorCard.appendChild(label);

          const markup = floorNumber === 1 ? svgSources.ground : svgSources.floor;
          const svg = createSvgElementFromMarkup(markup);
          if (svg) {
            svg.dataset.floorNumber = String(floorNumber);
            floorCard.appendChild(svg);
            registerFloorPlanElements(svg, floorNumber, { includeOutdoor: floorNumber === 1 });
          }

          stack.appendChild(floorCard);
        });

        houseFloorPlanEl.appendChild(stack);
      }

      if (houseSideViewEl) {
        houseSideViewEl.innerHTML = "";
        const card = document.createElement("article");
        card.className = "house-side-card";

        const label = document.createElement("p");
        label.className = "house-side-card__label";
        label.textContent = "Side view";
        card.appendChild(label);

        const sideSvg = createSvgElementFromMarkup(svgSources.side);
        if (sideSvg) {
          card.appendChild(sideSvg);
          registerSideViewElements(sideSvg);
        }

        houseSideViewEl.appendChild(card);
      }

      if (houseOutdoorEl) {
        houseOutdoorEl.innerHTML = "";
        houseOutdoorEl.hidden = true;
        houseOutdoorEl.setAttribute("aria-hidden", "true");
      }

      houseState.initialized = true;
      resetHouseSelections();
      renderHouseView(currentRequest ? currentRequest.counterObj : null);
    })
    .catch(error => {
      console.error("[House drawer] Failed to load house graphics:", error);
      houseState.svgSources = null;
      houseState.assetPromise = null;
    })
    .finally(() => {
      houseState.loading = false;
    });
}

function emitHouseAnswer() {
  const selection = getHouseSelectionSnapshot();
  if (typeof window.checkHouseAnswer === "function") {
    window.checkHouseAnswer(selection);
  } else {
    console.info("[House drawer] Selected layout:", selection);
  }
  closeDrawer();
}

function computeClockTargetFromPractice(practice, number) {
  const target = { hours: 0, minutes: 0, seconds: 0 };
  if (!practice) return target;
  if (practice.hand === "hours") {
    target.hours = ((Number(number) % 12) + 12) % 12;
  } else if (practice.hand === "minutes") {
    target.minutes = ((Number(number) % 60) + 60) % 60;
  } else if (practice.hand === "seconds") {
    target.seconds = ((Number(number) % 60) + 60) % 60;
  }
  return target;
}

function handleClockPracticeAnswer(selectedTime) {
  if (!currentRequest || !currentRequest.counterObj) return;
  const { counterObj } = currentRequest;
  if (!isClockCounter(counterObj)) {
    console.info("[Clock drawer] Selected time:", selectedTime);
    return;
  }

  const practice = getCounterPractice(counterObj);
  const target = currentRequest.clockTarget || computeClockTargetFromPractice(practice, currentRequest.number);
  currentRequest.clockTarget = target;

  const normalizedSelection = {};
  CLOCK_HAND_KEYS.forEach(hand => {
    const value = selectedTime && Number(selectedTime[hand]);
    normalizedSelection[hand] = Number.isFinite(value) ? value : 0;
  });

  const wasCorrect = CLOCK_HAND_KEYS.every(hand => {
    const expected = Number(target[hand]);
    return normalizedSelection[hand] === (Number.isFinite(expected) ? expected : 0);
  });

  recordCounterResult(counterObj, wasCorrect);

  const handKey = practice ? practice.hand : "seconds";
  const handLabel = getClockHandLabel(handKey);
  const displayValue = formatClockDisplayValue(handKey, currentRequest.number);
  const expectedValue = Number(target[handKey]) || 0;
  const selectedValue = normalizedSelection[handKey];
  const selectedDisplay = formatClockDisplayValue(handKey, selectedValue);

  const failureParts = [];
  if (selectedValue !== expectedValue) {
    failureParts.push(`Set the ${handLabel} to ${displayValue} (you chose ${selectedDisplay}).`);
  }
  const otherHandsWrong = CLOCK_HAND_KEYS.some(hand => {
    if (hand === handKey) return false;
    const expected = Number(target[hand]) || 0;
    return normalizedSelection[hand] !== expected;
  });
  if (otherHandsWrong) {
    failureParts.push("Reset the other hands to 0.");
  }

  const successHTML = `<strong>Nice!</strong> Set the ${handLabel} to ${displayValue}.`;
  const failureHTML = `<strong>Almost!</strong> ${failureParts.join(" ") || `Set the ${handLabel} to ${displayValue}.`}`;

  handleAnswerFeedback(wasCorrect, {
    successHTML,
    failureHTML,
    clearCounterOnFailure: false
  });
}

function handleCalendarPracticeAnswer(selection) {
  if (!currentRequest || !currentRequest.counterObj) return;
  const { counterObj } = currentRequest;
  if (!isCalendarCounter(counterObj)) {
    console.info("[Calendar drawer] Selected period:", selection);
    return;
  }

  const practice = getCounterPractice(counterObj);
  const expectedMode = practice && practice.mode ? practice.mode : determineCalendarMode();
  const expectedCount = Number(currentRequest.number) || 0;
  const selectedMode = selection && selection.mode;
  const selectedCount = Number(selection && selection.count);

  const wasCorrect = selectedMode === expectedMode && selectedCount === expectedCount;

  recordCounterResult(counterObj, wasCorrect);

  const label = formatCalendarLabel(expectedMode, expectedCount);
  const successHTML = `<strong>Nice!</strong> You marked ${expectedCount} ${label}.`;

  const failureParts = [];
  if (selectedMode !== expectedMode) {
    const modeLabel = formatCalendarLabel(expectedMode, expectedCount === 1 ? 1 : 2);
    failureParts.push(`Use the ${modeLabel} view for this counter.`);
  }
  if (selectedCount !== expectedCount) {
    const sanitizedCount = Number.isFinite(selectedCount) ? selectedCount : 0;
    const selectedLabel = formatCalendarLabel(expectedMode, sanitizedCount);
    failureParts.push(`Mark ${expectedCount} ${label} (you chose ${sanitizedCount} ${selectedLabel}).`);
  }

  const failureHTML = `<strong>Almost!</strong> ${failureParts.join(" ") || `Mark ${expectedCount} ${label}.`}`;

  handleAnswerFeedback(wasCorrect, {
    successHTML,
    failureHTML,
    clearCounterOnFailure: false
  });
}

function handleHousePracticeAnswer(selection) {
  if (!currentRequest || !currentRequest.counterObj) return;
  const { counterObj } = currentRequest;
  if (!isHouseCounter(counterObj)) {
    console.info("[House drawer] Selected layout:", selection);
    return;
  }

  const targetKey = getHousePracticeTarget(counterObj);
  const validTarget = HOUSE_SELECTION_KEYS.includes(targetKey) ? targetKey : null;
  const expectedCount = Number(currentRequest.number) || 0;
  const normalizedSelection = selection && typeof selection === "object" ? selection : {};
  const rawSelected = validTarget ? normalizedSelection[validTarget] : 0;
  const selectedCount = Number.isFinite(Number(rawSelected)) ? Number(rawSelected) : 0;

  const wasCorrect = selectedCount === expectedCount;

  recordCounterResult(counterObj, wasCorrect);

  const label = formatHouseTargetLabel(validTarget, expectedCount);
  const successHTML = `<strong>Nice!</strong> You selected ${expectedCount} ${label}.`;

  const failureParts = [];
  if (selectedCount !== expectedCount) {
    failureParts.push(`Select ${expectedCount} ${label} (you chose ${selectedCount}).`);
  }

  const failureHTML = `<strong>Almost!</strong> ${failureParts.join(" ") || `Select ${expectedCount} ${label}.`}`;

  handleAnswerFeedback(wasCorrect, {
    successHTML,
    failureHTML,
    clearCounterOnFailure: false
  });
}

window.checkClockAnswer = handleClockPracticeAnswer;
window.checkCalendarAnswer = handleCalendarPracticeAnswer;
window.checkHouseAnswer = handleHousePracticeAnswer;

setupDrawerLaunchers();

if (clockValueEl && clockValueEl instanceof HTMLInputElement) {
  const handleClockValueChange = () => {
    commitClockInputFromField();
  };

  clockValueEl.addEventListener("change", handleClockValueChange);
  clockValueEl.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitClockInputFromField();
      clockValueEl.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      updateClockValue();
      clockValueEl.blur();
    }
  });
}

if (clockDoneBtn) {
  clockDoneBtn.addEventListener("click", emitClockAnswer);
}

if (calendarDoneBtn) {
  calendarDoneBtn.addEventListener("click", emitCalendarAnswer);
}

if (calendarTearBtn) {
  calendarTearBtn.addEventListener("click", toggleCalendarTear);
}

if (houseDoneBtn) {
  houseDoneBtn.addEventListener("click", emitHouseAnswer);
}

window.addEventListener('resize', syncCounterItemSize);

updateReplayButtonState();
updateCounterHint();
updateCounterSummary();
