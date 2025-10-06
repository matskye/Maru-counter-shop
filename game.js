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

let hintVisible = false;
let counterStats = loadCounterStats();
let enabledCounters = loadEnabledCounters();

const HINT_SHOW_LABEL = "💡 Show hint";
const HINT_HIDE_LABEL = "🙈 Hide hint";

let reopenSettingsAfterCounter = false;

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

  saveEnabledCounters();
  renderCounterPreferences();
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
function speakJapanese(text) {
  if (!voiceEnabled) return;
  if ('speechSynthesis' in window) {
    const utter = new SpeechSynthesisUtterance(text);
    if (japaneseVoice) {
      utter.voice = japaneseVoice;
    }
    utter.lang = 'ja-JP';
    window.speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  }
}

function getPromptSpeechText(request) {
  if (!request) return "";
  const { counterObj, number } = request;
  return getCounterReading(counterObj, number) + "ください。";
}

function updateReplayButtonState() {
  if (!replayVoiceBtn) return;
  const supported = 'speechSynthesis' in window;
  const hasRequest = Boolean(currentRequest);
  replayVoiceBtn.disabled = !(voiceEnabled && supported && hasRequest);
  replayVoiceBtn.title = replayVoiceBtn.disabled
    ? "Enable voice in settings to listen to Maru's request again."
    : "Hear Maru repeat the current request.";
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
  const examples = counterObj.items
    .slice(0, 3)
    .map(item => item.label_en)
    .join(", ");
  counterHintDiv.innerHTML = `Counter <strong>「${counterObj.counter}」</strong> is used for <strong>${counterObj.category}</strong>. Try things like ${examples}.`;
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
  const number = Math.ceil(Math.random() * 5); // up to 5 items for demo
  const item = counterObj.items[Math.floor(Math.random() * counterObj.items.length)];
  return { counterObj, number, item };
}

function newCustomer() {
  if (!gameData || !gameData.counters) return;
  const nextRequest = randomRequest();
  if (!nextRequest) return;
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

function clearCounter() {
  counterDiv.innerHTML = COUNTER_HINT_HTML;
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

// Done button
document.getElementById("doneBtn").addEventListener("click", () => {
  if (!currentRequest) return;

  const items = [...counterDiv.querySelectorAll(".item")];
  const totalCount = items.reduce((sum, el) => sum + parseInt(el.dataset.count || "1", 10), 0);
  const correctNumber = totalCount === currentRequest.number;
  const correctCategory = items.every(p => p.dataset.counter === currentRequest.counterObj.counter);

  const wasCorrect = correctNumber && correctCategory;

  recordCounterResult(currentRequest.counterObj, wasCorrect);

  if (wasCorrect) {
    reactionDiv.innerHTML = `<img src="data/assets/ui/maru_ok.png" alt="OK" height="80">`;
    if (feedbackDiv) {
      feedbackDiv.innerHTML = `<strong>Nice!</strong> 「${currentRequest.number}${currentRequest.counterObj.counter}」 is perfect for ${currentRequest.counterObj.category}.`;
    }
    correctStreak++;
    if (challengeMode) challengeScore++;
  } else {
    reactionDiv.innerHTML = `<img src="data/assets/ui/maru_wrong.png" alt="Wrong" height="80">`;
    const messages = [];
    if (!correctNumber) {
      messages.push(`You need ${currentRequest.number} in total.`);
    }
    if (!correctCategory) {
      messages.push(`Choose items that use 「${currentRequest.counterObj.counter}」 (${currentRequest.counterObj.category}).`);
    }
    if (feedbackDiv) {
      feedbackDiv.innerHTML = `<strong>Almost!</strong> ${messages.join(" ")}`;
    }
    clearCounter();
    correctStreak = 0;
  }

  updateStreakStatus();

  if (challengeMode) {
    challengeRounds++;
    updateChallengeStatus();
    if (challengeRounds >= MAX_CHALLENGE_ROUNDS) {
      setTimeout(() => {
        alert(`Challenge over! Score: ${challengeScore}/10`);
        challengeMode = false;
        challengeRounds = 0;
        challengeScore = 0;
        correctStreak = 0;
        updateModeStatus();
        updateChallengeStatus();
        updateStreakStatus();
      }, 500);
    } else {
      setTimeout(newCustomer, 1600);
    }
  } else {
    setTimeout(newCustomer, 1600);
  }
});

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
const closeSettings = document.getElementById("closeSettings");

settingsBtn.addEventListener("click", () => {
  settingsModal.style.display = "flex";
  furiganaCheckbox.checked = showFurigana;
  voiceCheckbox.checked = voiceEnabled;
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
  if (voiceEnabled && currentRequest) {
    speakJapanese(getPromptSpeechText(currentRequest));
  }
  updateReplayButtonState();
});

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

window.addEventListener('resize', syncCounterItemSize);

updateReplayButtonState();
updateCounterHint();
updateCounterSummary();
