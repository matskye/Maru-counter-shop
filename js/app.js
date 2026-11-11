import {
  prepareData, naiveReading, primaryReading, readingsFor, isIrregular, acceptedReadingsForItem, amountText,
  itemAccepts, pickRound, buildShelf, checkServe, buildChoices, romajiToHiragana, normalizeTypedAnswer,
  checkTypedAnswer, normalizeStats, recordResult, accuracy,
  cardIds, cardForRound, emptyProgress, normalizeProgress, lockedCounters, nextNewCard, dueCards, nextDueTime,
  buildShift, gradeCard, counterStars, roundForCard, updateDayStreak,
  isForced, roundReadings, maxNumber, bigNumbers, specialNumbers
} from "./logic.js";

const CHALLENGE_ROUNDS = 10;
const SHELF_SIZE = 8;
const AUTO_ADVANCE_MS = 1700;
const REVIEW_DELAY_ROUNDS = 3;
const SHIFT_MAX_QUESTIONS = 20;
const SHIFT_MAX_NEW_COUNTERS = 3;
const MARU_OK = "data/assets/ui/maru_ok.png";
const MARU_WRONG = "data/assets/ui/maru_wrong.png";
const CUSTOMERS = ["👵", "👴", "👩", "👨", "🧑", "👧", "👦", "👩‍🍳", "👨‍🎓", "👩‍💼", "🧑‍🎨", "👨‍🔧", "🧕", "👩‍🏫", "🧑‍🌾"];
const NUMBERS = Array.from({ length: 10 }, (_, i) => i + 1);

const $ = id => document.getElementById(id);
const els = {
  home: $("home"), game: $("game"), homeBtn: $("homeBtn"),
  homeMessage: $("homeMessage"), dayStreak: $("dayStreak"), learnedCount: $("learnedCount"), dueCount: $("dueCount"),
  startShiftBtn: $("startShiftBtn"), shiftPlan: $("shiftPlan"), freePracticeBtn: $("freePracticeBtn"),
  homeChallengeBtn: $("homeChallengeBtn"), counterGrid: $("counterGrid"),
  shiftProgress: $("shiftProgress"), shiftLabel: $("shiftLabel"), shiftBar: $("shiftBar"),
  modeSwitch: $("modeSwitch"), modeButtons: [...document.querySelectorAll(".segmented button")],
  streakStatus: $("streakStatus"), streakCount: $("streakCount"), bestStreak: $("bestStreak"),
  challengeStatus: $("challengeStatus"), challengeRound: $("challengeRound"),
  challengeTotal: $("challengeTotal"), challengeScore: $("challengeScore"), challengeBtn: $("challengeBtn"),
  lessonArea: $("lessonArea"), lessonCard: $("lessonCard"), lessonDoneBtn: $("lessonDoneBtn"),
  promptCard: $("promptCard"), taskLabel: $("taskLabel"), speaker: $("speaker"), prompt: $("prompt"),
  replayBtn: $("replayVoiceBtn"), slowBtn: $("slowVoiceBtn"), hintBtn: $("toggleHintBtn"), hint: $("counterHint"),
  serveArea: $("serveArea"), shelf: $("shelf"), tray: $("counter"), trayTotal: $("trayTotal"), clearTrayBtn: $("clearTrayBtn"),
  countArea: $("countArea"), countTray: $("countTray"), countLabel: $("countLabel"), choices: $("choices"),
  typeForm: $("typeForm"), typeInput: $("typeInput"), typePreview: $("typePreview"),
  resultRow: $("resultRow"), result: $("result"), resultImg: $("resultImg"), resultText: $("resultText"),
  doneBtn: $("doneBtn"), nextBtn: $("nextBtn"),
  settingsDialog: $("settingsDialog"), guideDialog: $("guideDialog"), resultsDialog: $("resultsDialog"), summaryDialog: $("summaryDialog"),
  furigana: $("furiganaCheckbox"), voice: $("voiceCheckbox"), listening: $("listeningCheckbox"), sfx: $("sfxCheckbox"),
  labelSelect: $("labelSelect"), maxNumberSelect: $("maxNumberSelect"), answerStyleSelect: $("answerStyleSelect"),
  voiceNote: $("voiceNote"),
  counterSummary: $("counterSummary"), counterList: $("counterList"), selectAllBtn: $("selectAllCounters"),
  resultsImg: $("resultsImg"), resultsTitle: $("resultsTitle"), resultsScore: $("resultsScore"),
  resultsBest: $("resultsBest"), resultsReview: $("resultsReview"),
  summaryTitle: $("summaryTitle"), summaryScore: $("summaryScore"), summaryLines: $("summaryLines")
};

/* ---------- Storage ---------- */

const store = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (err) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* storage unavailable (private mode etc.): the game still works, it just forgets */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) { /* ignore */ }
  }
};

const DEFAULT_SETTINGS = {
  furigana: false, voice: true, listening: false, sfx: true,
  labels: "ja", maxNumber: 10, answerStyle: "choice", gameMode: "mix"
};

function loadSettings() {
  const saved = store.get("maruSettings", null);
  const settings = { ...DEFAULT_SETTINGS };
  if (saved && typeof saved === "object") {
    Object.keys(DEFAULT_SETTINGS).forEach(key => {
      if (typeof saved[key] === typeof DEFAULT_SETTINGS[key]) settings[key] = saved[key];
    });
  } else {
    // Carry over preferences from the first version of the game.
    settings.furigana = store.get("showFurigana", false) === true;
    settings.voice = store.get("voiceEnabled", true) !== false;
  }
  if (!["serve", "count", "mix"].includes(settings.gameMode)) settings.gameMode = "mix";
  if (!["ja", "en", "off"].includes(settings.labels)) settings.labels = "ja";
  if (![5, 10, 20].includes(settings.maxNumber)) settings.maxNumber = 10;
  if (!["choice", "type"].includes(settings.answerStyle)) settings.answerStyle = "choice";
  return settings;
}

const state = {
  data: null,
  stats: {},
  progress: emptyProgress(), // lesson path + spaced repetition
  enabled: null, // counters ticked for free practice; null = all
  settings: loadSettings(),
  best: store.get("maruBest", {}) || {},
  shift: null, // a guided session in progress
  challenge: null, // { round, score, misses } while a challenge is running
  streak: 0,
  round: null,
  phase: "loading", // loading | home | lesson | asking | answered
  lessonStep: null,
  tray: new Map(),
  shelf: [],
  choices: [],
  hintVisible: false,
  reviewQueue: [],
  lastCounterKey: null,
  advanceTimer: null
};

const saveSettings = () => store.set("maruSettings", state.settings);
const saveStats = () => store.set("counterStats", state.stats);
const saveProgress = () => store.set("maruProgress", state.progress);

/* ---------- DOM helpers ---------- */

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === "class") el.className = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else if (key in el && key !== "list") el[key] = value;
    else el.setAttribute(key, value);
  });
  children.flat().forEach(child => {
    if (child === null || child === undefined || child === false) return;
    el.append(child);
  });
  return el;
}

const ja = (text, cls) => h("span", { lang: "ja", class: cls }, text);
const ruby = (base, reading, cls) => h("ruby", { lang: "ja", class: cls }, base, h("rt", {}, reading));
const counterName = counter => h("strong", { lang: "ja" }, `「${counter.counter}」`);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function itemName(item, { withRuby = state.settings.furigana } = {}) {
  return withRuby && item.label_ja !== item.kana ? ruby(item.label_ja, item.kana) : ja(item.label_ja);
}

/** An item's picture: artwork where we have it, an emoji otherwise. */
function picture(item, attrs = {}) {
  return item.image
    ? h("img", { src: item.image, alt: "", draggable: false, ...attrs })
    : h("span", { class: "emoji", role: "img", "aria-label": attrs.alt || null, style: attrs.style }, item.emoji);
}

function tileLabel(item) {
  if (state.settings.labels === "off") return null;
  if (state.settings.labels === "en") return h("span", { class: "item-label" }, item.label_en);
  return h("span", { class: "item-label", lang: "ja" }, itemName(item));
}

function amountRuby(counter, number) {
  return h("strong", { lang: "ja" }, ruby(amountText(counter, number), primaryReading(counter, number)));
}

/* ---------- Sound ---------- */

const speech = {
  supported: "speechSynthesis" in window,
  voice: null,
  init() {
    if (!this.supported) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().replace("_", "-").startsWith("ja"));
      this.voice = voices.find(v => v.localService) || voices[0] || null;
      updateVoiceUi();
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
  },
  say(text, { slow = false, force = false } = {}) {
    if (!this.supported || !text || (!state.settings.voice && !force)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) utterance.voice = this.voice;
    utterance.lang = "ja-JP";
    utterance.rate = slow ? 0.55 : 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  },
  stop() {
    if (this.supported) window.speechSynthesis.cancel();
  }
};

let audioContext = null;
function playTone(kind) {
  if (!state.settings.sfx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    audioContext = audioContext || new Ctx();
    if (audioContext.state === "suspended") audioContext.resume();
    const notes = { good: [660, 880], bad: [300, 220], tap: [520], fanfare: [523, 659, 784, 1047] }[kind] || [520];
    const length = kind === "tap" ? 0.05 : 0.12;
    notes.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = audioContext.currentTime + i * length;
      osc.type = kind === "bad" ? "triangle" : "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(kind === "tap" ? 0.04 : 0.09, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(start);
      osc.stop(start + length + 0.02);
    });
  } catch (err) { /* audio is a nicety; never let it break the game */ }
}

/* ---------- Free-practice counter selection ---------- */

function activeCounters() {
  const all = state.data.counters;
  if (!Array.isArray(state.enabled)) return all;
  const enabled = new Set(state.enabled);
  const filtered = all.filter(c => enabled.has(c.counter));
  return filtered.length ? filtered : all;
}

function saveEnabled() {
  if (state.enabled === null) store.remove("enabledCounters");
  else store.set("enabledCounters", state.enabled);
}

/* ---------- Screens ---------- */

function showHome() {
  window.clearTimeout(state.advanceTimer);
  speech.stop();
  state.shift = null;
  state.challenge = null;
  state.round = null;
  state.phase = "home";
  els.game.hidden = true;
  els.home.hidden = false;
  els.homeBtn.hidden = true;
  renderHome();
  window.scrollTo(0, 0);
}

function showPlay() {
  els.home.hidden = true;
  els.game.hidden = false;
  els.homeBtn.hidden = false;
  window.scrollTo(0, 0);
}

function describeWait(ms) {
  const hours = ms / 3600000;
  if (hours < 1) return "in under an hour";
  if (hours < 20) return `in about ${plural(Math.round(hours), "hour")}`;
  if (hours < 36) return "tomorrow";
  return `in ${Math.round(hours / 24)} days`;
}

function starText(stars) {
  return "★".repeat(stars) + "☆".repeat(3 - stars);
}

function renderHome() {
  if (!state.data) return;
  const { data, progress } = state;
  const now = Date.now();
  const due = dueCards(progress, now);
  const plan = buildShift({ data, progress, now });
  const lessons = plan.filter(s => s.kind === "lesson").map(s => s.counterKey);
  const fresh = plan.filter(s => s.kind === "card" && s.isNew).length;
  const reviews = plan.filter(s => s.kind === "card" && !s.isNew && !s.early).length;
  const firstTime = progress.shifts === 0 && !Object.keys(progress.cards).length;

  els.dayStreak.textContent = String(currentDayStreak());
  els.learnedCount.textContent = `${progress.unlocked.length}/${data.counters.length}`;
  els.dueCount.textContent = String(due.length);

  els.startShiftBtn.disabled = false;
  els.freePracticeBtn.disabled = false;
  els.homeChallengeBtn.disabled = false;
  els.startShiftBtn.textContent = firstTime ? "▶ Start your first shift" : "▶ Start a shift";

  if (firstTime) {
    els.homeMessage.textContent = "Welcome! I'm Maru. Work a short shift in my shop each day and I'll teach you the Japanese counters one at a time, then bring each one back just before you forget it.";
  } else if (due.length) {
    els.homeMessage.textContent = `Welcome back! ${plural(due.length, "thing")} you learned ${due.length === 1 ? "is" : "are"} ready for review.`;
  } else if (fresh) {
    els.homeMessage.textContent = "You're all caught up on reviews, so it's a good time to learn something new.";
  } else {
    els.homeMessage.textContent = "You're all caught up! A shift now is extra practice.";
  }

  const parts = [];
  if (reviews) parts.push(plural(reviews, "review"));
  if (fresh) parts.push(`${fresh} new`);
  const planLine = [parts.length ? `This shift: ${parts.join(" + ")}.` : "This shift: extra practice."];
  if (lessons.length) planLine.push(" New counter", lessons.length > 1 ? "s" : "", ": ", ja(lessons.join("・")), ".");
  const wait = nextDueTime(progress, now);
  if (!reviews && !fresh && wait) planLine.push(` Next reviews ${describeWait(wait - now)}.`);
  planLine.push(" About 3 minutes.");
  els.shiftPlan.replaceChildren(...planLine);

  const dueKeys = new Set(due.map(id => id.split(":")[1]));
  const nextUp = lockedCounters(data, progress)[0];
  const tile = counter => {
    const stars = counterStars(counter, progress);
    const locked = stars === null;
    return h("button", {
      class: `counter-tile${locked ? " locked" : ""}`, type: "button",
      title: locked ? `${counter.category} (not started yet)` : counter.category,
      "aria-label": `${counter.counter}, ${counter.category}, ${locked ? "not started" : `${stars} of 3 stars`}`,
      onclick: () => openGuide(counter.counter)
    },
      h("span", { class: "kanji" }, counter.counter),
      h("span", { class: "kana" }, counter.reading),
      h("span", { class: "stars" }, locked ? (counter === nextUp ? "next up" : "🔒") : starText(stars)),
      dueKeys.has(counter.counter) ? h("span", { class: "due-dot", title: "Reviews ready" }) : null
    );
  };
  els.counterGrid.replaceChildren(...chapters(data.counters).map(([name, counters]) => {
    const started = counters.filter(c => progress.unlocked.includes(c.counter)).length;
    return h("section", { class: "chapter" },
      h("h3", {}, name, h("small", {}, `${started}/${counters.length}`)),
      h("div", { class: "counter-grid" }, counters.map(tile)));
  }));
}

/** Counters grouped by chapter, in teaching order: [[name, counters], …]. */
function chapters(counters) {
  const groups = new Map();
  counters.forEach(counter => {
    const name = counter.group || "Counters";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(counter);
  });
  return [...groups.entries()];
}

/* ---------- Day streak ---------- */

function dateString(date) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayAndYesterday() {
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return [dateString(now), dateString(yesterday)];
}

/** The streak as it stands now: it lapses if neither today nor yesterday had a shift. */
function currentDayStreak() {
  const [today, yesterday] = todayAndYesterday();
  const { last, streak } = state.progress.day;
  return last === today || last === yesterday ? streak : 0;
}

/* ---------- Shifts (guided sessions) ---------- */

function startShift() {
  const steps = buildShift({ data: state.data, progress: state.progress, now: Date.now() });
  state.challenge = null;
  state.streak = 0;
  state.shift = { steps, asked: 0, firstTry: { correct: 0, total: 0 }, newCounters: [], requeues: new Map() };
  showPlay();
  nextShiftStep();
}

function nextShiftStep() {
  window.clearTimeout(state.advanceTimer);
  const shift = state.shift;
  const step = shift.steps.shift();
  if (!step) {
    finishShift();
    return;
  }
  if (step.kind === "lesson") {
    showLesson(step);
    return;
  }
  const round = roundForCard(state.data, step.cardId);
  if (!round) {
    nextShiftStep();
    return;
  }
  round.step = step;
  presentRound(round);
}

function showLesson(step) {
  const counter = state.data.byKey.get(step.counterKey);
  state.phase = "lesson";
  state.lessonStep = step;
  state.round = null;
  els.lessonCard.replaceChildren(
    h("div", { class: "lesson-head" },
      h("span", { class: "counter-kanji", lang: "ja" }, counter.counter),
      h("div", {}, h("h2", {}, ja(counter.reading), ` — ${counter.category}`), h("p", {}, counter.note))),
    counterDetail(counter, { withNote: false })
  );
  render();
  speech.say(counter.reading);
  els.lessonDoneBtn.focus({ preventScroll: true });
}

function finishLesson() {
  if (state.phase !== "lesson" || !state.shift) return;
  const key = state.lessonStep.counterKey;
  const progress = state.progress;
  if (!progress.unlocked.includes(key)) progress.unlocked.push(key);
  progress.priority = progress.priority.filter(k => k !== key);
  saveProgress();
  state.shift.newCounters.push(key);
  state.lessonStep = null;
  nextShiftStep();
}

function gradeShiftAnswer(round, correct) {
  const shift = state.shift;
  const step = round.step;
  const id = step.cardId;
  gradeCard(state.progress, id, correct, Date.now(), { retry: Boolean(step.retry) });
  shift.asked += 1;
  if (!step.retry) {
    shift.firstTry.total += 1;
    if (correct) shift.firstTry.correct += 1;
  }
  if (!correct) {
    // Ask again a little later in this shift, so it ends on a success.
    const tries = shift.requeues.get(id) || 0;
    if (tries < 2) {
      shift.requeues.set(id, tries + 1);
      shift.steps.splice(Math.min(3, shift.steps.length), 0, { kind: "card", cardId: id, retry: true });
    }
  } else if (step.isNew && !step.retry) {
    // Already knew it: keep the pace up by bringing in the next new thing.
    const queued = shift.steps.filter(s => s.kind === "card").length;
    const pendingUnlocks = shift.steps.filter(s => s.kind === "lesson").map(s => s.counterKey);
    const pending = new Set(shift.steps.filter(s => s.kind === "card").map(s => s.cardId));
    const next = nextNewCard(state.data, state.progress, { pending, pendingUnlocks });
    const roomForCounter = shift.newCounters.length + pendingUnlocks.length < SHIFT_MAX_NEW_COUNTERS;
    if (next && shift.asked + queued < SHIFT_MAX_QUESTIONS && (!next.unlock || roomForCounter)) {
      if (next.unlock) shift.steps.push({ kind: "lesson", counterKey: next.unlock });
      shift.steps.push({ kind: "card", cardId: next.cardId, isNew: true });
    }
  }
  saveProgress();
}

function finishShift() {
  const shift = state.shift;
  const progress = state.progress;
  const [today, yesterday] = todayAndYesterday();
  progress.day = updateDayStreak(progress.day, today, yesterday);
  progress.shifts += 1;
  saveProgress();

  const { correct, total } = shift.firstTry;
  const now = Date.now();
  const lines = [];
  if (shift.newCounters.length) {
    lines.push(h("p", {}, "📖 New: ", ja(shift.newCounters.join("・"))));
  }
  lines.push(h("p", {}, `🔥 ${plural(progress.day.streak, "day")} in a row`));
  const dueNow = dueCards(progress, now).length;
  const wait = nextDueTime(progress, now);
  const moreToLearn = Boolean(nextNewCard(state.data, progress));
  if (dueNow) lines.push(h("p", {}, `📚 ${plural(dueNow, "review")} still waiting. Another shift will clear them.`));
  else if (wait) lines.push(h("p", {}, `📚 Next reviews ${describeWait(wait - now)}.`));
  if (!dueNow && moreToLearn) lines.push(h("p", {}, "There is more to learn whenever you are ready."));
  if (!moreToLearn && !dueNow) lines.push(h("p", {}, "You have met every counter in the shop. Keep up the reviews to make them stick!"));

  els.summaryTitle.textContent = total && correct === total ? "Perfect shift!" : "Shift complete!";
  els.summaryScore.textContent = total ? `${correct} / ${total}` : "";
  els.summaryLines.replaceChildren(total ? h("p", { class: "note" }, "right first time") : null, ...lines);
  state.shift = null;
  state.round = null;
  state.phase = "home";
  playTone("fanfare");
  els.summaryDialog.showModal();
}

/* ---------- Rounds ---------- */

function roundSpeech(round, phase) {
  const reading = primaryReading(round.counter, round.number);
  const item = round.entry.item;
  if (round.mode === "serve") return `${reading}ください。`;
  if (round.mode === "order") return `${item.kana}を${reading}ください。`;
  if (round.counter.abstract) return phase === "answered" ? `${reading}です。` : "";
  return phase === "answered" ? `${item.kana}、${reading}ですね。` : item.kana;
}

function isListeningRound() {
  return state.round && state.round.mode !== "count" && state.phase === "asking" &&
    state.settings.listening && state.settings.voice && speech.supported;
}

function nextFromReviewQueue(mode) {
  if (state.challenge) return null;
  const activeKeys = new Set(activeCounters().map(c => c.counter));
  state.reviewQueue.forEach(entry => { entry.due -= 1; });
  const fits = entry => mode === "mix" || entry.mode === mode || (entry.mode === "order" && mode === "serve");
  const index = state.reviewQueue.findIndex(entry =>
    entry.due <= 0 && activeKeys.has(entry.counterKey) && fits(entry) &&
    entry.number <= state.settings.maxNumber && entry.counterKey !== state.lastCounterKey
  );
  if (index < 0) return null;
  const [entry] = state.reviewQueue.splice(index, 1);
  const counter = state.data.byKey.get(entry.counterKey);
  const itemEntry = counter.entries.find(e => e.item.id === entry.itemId) || counter.entries[0];
  return { mode: entry.mode, counter, number: entry.number, entry: itemEntry, isReview: true };
}

/** Free practice and challenge: pick the next question adaptively. */
function startRound() {
  if (!state.data) return;
  window.clearTimeout(state.advanceTimer);
  const gameMode = state.settings.gameMode;
  const round = nextFromReviewQueue(gameMode) || pickRound({
    data: state.data, activeCounters: activeCounters(), stats: state.stats, mode: gameMode,
    maxNumber: state.settings.maxNumber, lastCounterKey: state.lastCounterKey
  });
  if (round) presentRound(round);
}

function presentRound(round) {
  round.customer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
  state.round = round;
  state.lastCounterKey = round.counter.counter;
  state.phase = "asking";
  state.tray = new Map();
  state.hintVisible = false;
  state.shelf = round.mode === "count"
    ? []
    : buildShelf({ data: state.data, round, activeCounters: state.shift ? unlockedCounters() : activeCounters(), size: SHELF_SIZE });
  state.choices = round.mode === "count" ? buildChoices({ data: state.data, round }) : [];

  els.result.hidden = true;
  els.typeInput.value = "";
  els.typePreview.textContent = "";
  render();
  updateVoiceUi();
  speech.say(roundSpeech(round, "asking"));
  if (round.mode === "count" && state.settings.answerStyle === "type" && !isTouchDevice()) {
    els.typeInput.focus();
  }
}

function unlockedCounters() {
  const open = new Set(state.progress.unlocked);
  const list = state.data.counters.filter(c => open.has(c.counter));
  return list.length >= 3 ? list : state.data.counters;
}

const isTouchDevice = () => window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

function advance() {
  window.clearTimeout(state.advanceTimer);
  if (state.phase !== "answered") return;
  if (state.shift) {
    nextShiftStep();
  } else if (state.challenge && state.challenge.round >= CHALLENGE_ROUNDS) {
    showChallengeResults();
  } else {
    startRound();
  }
}

/* ---------- Rendering ---------- */

function render() {
  renderStatus();
  const lesson = state.phase === "lesson";
  const round = state.round;
  els.lessonArea.hidden = !lesson;
  els.promptCard.hidden = lesson;
  els.resultRow.hidden = lesson;
  if (lesson || !round) {
    els.serveArea.hidden = true;
    els.countArea.hidden = true;
    return;
  }
  renderPrompt();
  renderHint();
  const counting = round.mode === "count";
  els.serveArea.hidden = counting;
  els.countArea.hidden = !counting;
  if (counting) {
    renderCountArea();
  } else {
    renderShelf();
    renderTray();
  }
  const asking = state.phase === "asking";
  els.doneBtn.hidden = !(asking && !counting);
  els.nextBtn.hidden = asking;
}

function renderStatus() {
  const shift = state.shift;
  els.shiftProgress.hidden = !shift;
  els.modeSwitch.hidden = Boolean(shift);
  els.challengeBtn.hidden = Boolean(shift);
  if (shift) {
    const remaining = shift.steps.filter(s => s.kind === "card").length;
    const current = state.phase === "asking" ? 1 : 0;
    const total = shift.asked + current + remaining;
    els.shiftLabel.textContent = state.phase === "lesson"
      ? "New counter"
      : `Customer ${Math.min(shift.asked + 1, total)} of ${total}`;
    const percent = total ? Math.round((shift.asked / total) * 100) : 0;
    els.shiftBar.style.width = `${percent}%`;
    els.shiftBar.parentElement.setAttribute("aria-valuenow", String(percent));
  }
  els.modeButtons.forEach(btn => {
    btn.setAttribute("aria-pressed", String(btn.dataset.mode === state.settings.gameMode));
    btn.disabled = Boolean(state.challenge);
  });
  els.streakCount.textContent = String(state.streak);
  const bestStreak = state.best.streak || 0;
  els.bestStreak.textContent = bestStreak ? `(best ${bestStreak})` : "";
  els.challengeStatus.hidden = !state.challenge;
  if (state.challenge) {
    els.challengeRound.textContent = String(Math.min(state.challenge.round + (state.phase === "asking" ? 1 : 0), CHALLENGE_ROUNDS));
    els.challengeTotal.textContent = String(CHALLENGE_ROUNDS);
    els.challengeScore.textContent = String(state.challenge.score);
  }
  els.challengeBtn.textContent = state.challenge ? "✕ End challenge" : "🏁 Challenge";
  els.challengeBtn.classList.toggle("ghost", Boolean(state.challenge));
}

function renderPrompt() {
  const round = state.round;
  const { counter, number, entry } = round;
  const reading = primaryReading(counter, number);
  const answered = state.phase === "answered";
  const amount = amountText(counter, number);
  const retry = round.isReview || (round.step && round.step.retry);
  els.prompt.replaceChildren();

  if (round.mode === "count") {
    els.speaker.replaceChildren(h("img", { src: MARU_OK, alt: "" }));
    if (counter.abstract) {
      els.taskLabel.textContent = `${retry ? "One more try at one you missed. " : ""}How do you read this? (${entry.item.label_en})`;
      els.prompt.append("「", answered ? ruby(amount, reading, "answer") : ja(amount, "answer"), "です。」");
      return;
    }
    const useCounter = isForced(round)
      ? [counter.generic ? " Use the general counter " : " Use ", ja(`「${counter.counter}」`), "."] : [];
    els.taskLabel.replaceChildren(
      retry ? "One more try at one you missed. How do you say how many there are?"
        : "Confirm the customer's items. How do you say how many there are?",
      ...useCounter);
    const blank = answered ? ruby(amount, reading, "answer") : h("span", { class: "blank" }, "？");
    els.prompt.append("「", itemName(entry.item), "、", blank, "ですね。」");
    return;
  }

  els.speaker.textContent = round.customer;
  const listenButton = () => h("button", {
    class: "listen-only", type: "button", title: "Play the order again",
    onclick: () => speech.say(roundSpeech(round, "asking"))
  }, "🔊 ？？？");

  if (round.mode === "serve") {
    els.taskLabel.textContent = retry
      ? "One more try at an order you missed. Put the right items on the counter."
      : "A customer is ordering. Which items are counted this way? Put the right number on the counter.";
    const amountNode = answered || state.settings.furigana ? ruby(amount, reading, answered ? "answer" : "") : amount;
    els.prompt.append("「", isListeningRound() ? listenButton() : amountNode, isListeningRound() ? "」" : "ください。」");
  } else {
    // "order": the item is named, the amount is given only as a reading.
    els.taskLabel.textContent = retry
      ? "One more try at an order you missed. Put exactly what they ask for on the counter."
      : "A customer is ordering. How many do they want? Put exactly that on the counter.";
    if (isListeningRound()) {
      els.prompt.append("「", listenButton(), "」");
    } else {
      const amountNode = answered ? ruby(amount, reading, "answer") : ja(reading, "answer");
      els.prompt.append("「", itemName(entry.item), "を", amountNode, "ください。」");
    }
  }
}

function renderHint() {
  const round = state.round;
  const available = Boolean(round) && state.phase === "asking" && !state.challenge;
  els.hintBtn.disabled = !available;
  els.hintBtn.title = state.challenge ? "No hints during a challenge" : "";
  const visible = available && state.hintVisible;
  els.hint.hidden = !visible;
  els.hintBtn.setAttribute("aria-expanded", String(visible));
  els.hintBtn.textContent = visible ? "🙈 Hide hint" : "💡 Hint";
  if (!visible) return;
  const { counter, entry } = round;
  if (round.mode === "serve") {
    els.hint.replaceChildren(counterName(counter), ` (${counter.reading}) counts `, h("strong", {}, counter.category), ". ", counter.note);
  } else if (round.mode === "order") {
    els.hint.replaceChildren(counterName(counter), " from 1 to 10: ",
      ja(NUMBERS.map(n => primaryReading(counter, n)).join("、")), ".");
  } else if (counter.generic) {
    els.hint.replaceChildren(counterName(counter), " uses the native Japanese numbers, which do not sound like いち, に, さん. ", counter.note);
  } else if (isForced(round)) {
    els.hint.replaceChildren(counterName(counter), ` (${counter.reading}): `, counter.note);
  } else {
    els.hint.replaceChildren(
      itemName(entry.item, { withRuby: true }), ` (${entry.item.label_en}) belongs with `, h("strong", {}, counter.category),
      ", so use ", counterName(counter), ` (${counter.reading}). Careful: the reading can change with the number.`
    );
  }
}

function updateVoiceUi() {
  const canSpeak = speech.supported && state.settings.voice && Boolean(state.round);
  [els.replayBtn, els.slowBtn].forEach(btn => {
    btn.disabled = !canSpeak;
    btn.title = canSpeak ? "" : speech.supported ? "Turn on Voice in Settings to hear this." : "Your browser does not support speech.";
  });
  let note = "";
  if (!speech.supported) note = "This browser has no text-to-speech, so voice features are unavailable.";
  else if (!speech.voice) note = "No Japanese voice was found on this device, so speech may sound wrong or be silent. Installing a Japanese voice in your system settings fixes this.";
  els.voiceNote.textContent = note;
  els.voiceNote.hidden = !note;
}

function makeTile(entry, { onClick, draggable = false, count = 0, title }) {
  const tile = h("button", {
    class: "item", type: "button", title,
    "aria-label": `${entry.item.label_en}${count ? `, ${count} on the counter` : ""}`,
    onclick: onClick
  },
    picture(entry.item),
    tileLabel(entry.item),
    count ? h("span", { class: "item-count" }, `×${count}`) : null
  );
  tile.dataset.itemId = entry.item.id;
  if (draggable) {
    tile.draggable = true;
    tile.addEventListener("dragstart", event => {
      event.dataTransfer.setData("text/plain", entry.item.id);
      event.dataTransfer.effectAllowed = "copy";
    });
  }
  return tile;
}

/** Is this shelf/tray item a right answer for the current round? */
function fitsRound(entry) {
  const round = state.round;
  return round.mode === "order" ? entry.item.id === round.entry.item.id : itemAccepts(entry, round.counter.counter);
}

function renderShelf() {
  const asking = state.phase === "asking";
  els.shelf.replaceChildren(...state.shelf.map(entry => {
    const tile = makeTile(entry, {
      draggable: asking,
      title: asking ? "Click or drag to add to the counter" : `${entry.item.label_en}: ${entry.counter.counter}`,
      onClick: () => addToTray(entry.item.id)
    });
    tile.disabled = !asking;
    if (!asking && fitsRound(entry)) tile.classList.add("is-right");
    return tile;
  }));
}

function renderTray(poppedId) {
  const asking = state.phase === "asking";
  const entries = [...state.tray.values()];
  const total = entries.reduce((sum, t) => sum + t.count, 0);
  els.tray.classList.toggle("has-items", entries.length > 0);
  els.trayTotal.textContent = total ? `· ${plural(total, "item")}` : "";
  els.clearTrayBtn.hidden = !(asking && total);
  if (!entries.length) {
    els.tray.replaceChildren(h("span", { class: "drop-hint" }, "Click, tap or drag items here"));
    return;
  }
  els.tray.replaceChildren(...entries.map(({ entry, count }) => {
    const tile = makeTile(entry, {
      count,
      title: asking ? "Click to take one off the counter" : "",
      onClick: () => removeFromTray(entry.item.id)
    });
    tile.disabled = !asking;
    if (!asking) tile.classList.add(fitsRound(entry) ? "is-right" : "is-wrong");
    if (entry.item.id === poppedId) tile.classList.add("pop");
    return tile;
  }));
}

function addToTray(itemId) {
  if (state.phase !== "asking" || !state.round || state.round.mode === "count") return;
  const entry = state.shelf.find(e => e.item.id === itemId);
  if (!entry) return;
  const slot = state.tray.get(itemId) || { entry, count: 0 };
  if (slot.count >= 99) return;
  slot.count += 1;
  state.tray.set(itemId, slot);
  els.result.hidden = true;
  playTone("tap");
  renderTray(itemId);
}

function removeFromTray(itemId) {
  if (state.phase !== "asking") return;
  const slot = state.tray.get(itemId);
  if (!slot) return;
  slot.count -= 1;
  if (slot.count <= 0) state.tray.delete(itemId);
  renderTray();
}

/** The small "3本" tag under a choice: which amount, if any, that reading really means. */
function choiceTag(choice) {
  const counter = state.data.byKey.get(choice.counterKey);
  const candidates = [state.round.number, ...Array.from({ length: Math.min(40, maxNumber(counter)) }, (_, i) => i + 1)];
  const number = candidates.find(n => readingsFor(counter, n).includes(choice.reading));
  return number ? amountText(counter, number) : "✕";
}

function renderCountArea() {
  const round = state.round;
  const { entry, number } = round;
  const asking = state.phase === "asking";
  const description = `${number} × ${entry.item.label_en}`;
  els.countTray.classList.toggle("many", number > 10 && number <= 20);
  if (round.counter.abstract || number > 20) {
    // Nothing to count one by one: show the number itself.
    els.countTray.replaceChildren(picture(entry.item, { alt: description }),
      h("span", { class: "big-number", lang: "ja" }, round.counter.abstract ? amountText(round.counter, number) : `× ${number}`));
  } else {
    els.countTray.replaceChildren(...Array.from({ length: number }, (_, i) =>
      picture(entry.item, { alt: i === 0 ? description : "", style: `animation-delay:${Math.min(i, 12) * 35}ms` })));
  }
  els.countLabel.replaceChildren(itemName(entry.item), h("small", {}, entry.item.label_en));
  els.countLabel.dataset.itemId = entry.item.id;

  const typing = state.settings.answerStyle === "type";
  els.choices.hidden = typing;
  els.typeForm.hidden = !typing;
  els.typeInput.disabled = !asking;
  els.typeForm.querySelector("button").disabled = !asking;
  if (typing) return;

  els.choices.replaceChildren(...state.choices.map((choice, index) => {
    const button = h("button", {
      class: "choice", type: "button", lang: "ja", disabled: !asking,
      onclick: () => submitChoice(choice)
    },
      h("span", { class: "choice-key", "aria-hidden": "true" }, String(index + 1)),
      h("span", {}, choice.reading),
      h("span", { class: "choice-kanji" }, asking ? "" : choiceTag(choice))
    );
    if (!asking) {
      if (choice.correct) button.classList.add("is-right");
      else if (choice === state.round.chosen) button.classList.add("is-wrong");
      else button.classList.add("is-dim");
    }
    return button;
  }));
}

/* ---------- Answers ---------- */

function readingNote(counter, number) {
  if (!isIrregular(counter, number)) return null;
  return h("p", {}, "Watch the reading: ", h("strong", { lang: "ja" }, primaryReading(counter, number)),
    ", not ", ja(naiveReading(counter, number)), ".");
}

function submitServe() {
  if (state.phase !== "asking" || !state.round || state.round.mode === "count") return;
  const round = state.round;
  const tray = [...state.tray.values()];
  if (!tray.length) {
    showResult(false, [h("p", { class: "headline" }, "The counter is empty!"),
      h("p", {}, "Click, tap or drag items from the shelf first.")], { soft: true });
    return;
  }
  const outcome = checkServe(round, tray);
  const { counter, number, entry } = round;
  const ordered = round.mode === "order";
  const lines = [];
  if (outcome.correct) {
    lines.push(h("p", { class: "headline" }, ja("正解！"), " Correct!"));
    lines.push(ordered
      ? h("p", {}, ja(primaryReading(counter, number)), " = ", amountRuby(counter, number), ".")
      : h("p", {}, amountRuby(counter, number), " — ", ja(`「${counter.counter}」`), ` counts ${counter.category}.`));
  } else {
    lines.push(h("p", { class: "headline" }, ja("ざんねん…"), " Not quite."));
    lines.push(ordered
      ? h("p", {}, "The order was ", itemName(entry.item, { withRuby: true }), ` (${entry.item.label_en}) × ${number}: `,
        ja(primaryReading(counter, number)), " = ", amountRuby(counter, number), ".")
      : h("p", {}, "The order was ", amountRuby(counter, number), " — ", ja(`「${counter.counter}」`), ` counts ${counter.category}.`));
    if (!outcome.numberOk) lines.push(h("p", {}, `You put ${outcome.total} on the counter.`));
    outcome.wrongItems.slice(0, 3).forEach(wrong => {
      lines.push(ordered
        ? h("p", {}, itemName(wrong.item, { withRuby: true }), ` (${wrong.item.label_en}) was not part of the order.`)
        : h("p", {}, itemName(wrong.item, { withRuby: true }), ` (${wrong.item.label_en}) is counted with `,
          counterName(wrong.counter), ` (${wrong.counter.category}).`));
    });
  }
  const note = ordered ? null : readingNote(counter, number);
  if (note) lines.push(note);
  finishRound(outcome.correct, lines);
}

function submitChoice(choice) {
  if (state.phase !== "asking" || !state.round || state.round.mode !== "count") return;
  state.round.chosen = choice;
  finishCount(choice.correct, choice.reading, choice.counterKey);
}

function softRetry(lines) {
  showResult(false, lines, { soft: true });
  els.typeInput.select();
}

function submitTyped() {
  if (state.phase !== "asking" || !state.round || state.round.mode !== "count") return;
  const text = els.typeInput.value.trim();
  if (!text) {
    els.typeInput.focus();
    return;
  }
  const round = state.round;
  const { counter, number, entry } = round;
  const everyReading = acceptedReadingsForItem(state.data, entry, number);
  const accepted = roundReadings(state.data, round);
  const typed = normalizeTypedAnswer(text);
  const correct = checkTypedAnswer(text, accepted);

  if (!correct && !counter.abstract) {
    // Good Japanese, but not the counter this question is practising: let them try again, no penalty.
    if (isForced(round) && checkTypedAnswer(text, everyReading)) {
      softRetry([h("p", { class: "headline" }, "That works too!"),
        h("p", {}, "But this question is practising ", counterName(counter), ". Try again with that one.")]);
      return;
    }
    const generic = state.data.counters.find(c => c.generic && c !== counter && !(c.notFor || []).includes(entry.counter.counter) &&
      checkTypedAnswer(text, readingsFor(c, number)));
    if (generic) {
      softRetry([h("p", { class: "headline" }, "You would be understood!"),
        h("p", {}, counterName(generic), " works for most things, but ", itemName(entry.item, { withRuby: true }),
          " has a more specific counter. Try again with that one.")]);
      return;
    }
  }

  // If the answer is wrong, see whether it is the right reading for some other counter.
  const sameCounter = !correct && Array.from({ length: Math.min(40, maxNumber(counter)) }, (_, i) => i + 1)
    .some(n => readingsFor(counter, n).some(r => typed.includes(r)));
  const otherCounter = correct ? null : sameCounter ? counter : state.data.counters.find(c =>
    !c.abstract && readingsFor(c, number).some(r => typed.includes(r)));
  // "nn" can mean ん (typing style) or ん + n… (Hepburn); show whichever reading the player most likely meant.
  const known = typed.find(t => state.data.counters.some(c => readingsFor(c, number).includes(t)));
  const shown = known || (/nn(?![aiueoy])/i.test(text) ? typed[typed.length - 1] : typed[0]);
  finishCount(correct, shown, otherCounter ? otherCounter.counter : null);
}

function finishCount(correct, givenReading, givenCounterKey) {
  const round = state.round;
  const { counter, number, entry } = round;
  const name = () => itemName(entry.item, { withRuby: true });
  const lines = [];
  if (correct) {
    lines.push(h("p", { class: "headline" }, ja("正解！"), " Correct!"));
    lines.push(counter.abstract
      ? h("p", {}, amountRuby(counter, number), ` (${entry.item.label_en})`)
      : h("p", {}, name(), ` × ${number} = `, amountRuby(counter, number)));
    const others = counter.abstract ? [] : acceptedReadingsForItem(state.data, entry, number).filter(r => !readingsFor(counter, number).includes(r));
    const same = readingsFor(counter, number).slice(1);
    const also = [...same, ...others];
    if (also.length) lines.push(h("p", {}, "Other ways to say it: ", ja(also.slice(0, 4).join("、")), "."));
  } else {
    lines.push(h("p", { class: "headline" }, ja("ざんねん…"), " Not quite."));
    lines.push(h("p", {}, "You answered ", ja(givenReading), ". The answer is ", amountRuby(counter, number), "."));
    const given = givenCounterKey ? state.data.byKey.get(givenCounterKey) : null;
    if (given && given.counter !== counter.counter) {
      lines.push(h("p", {}, counterName(given), ` is for ${given.category}; `, name(),
        " takes ", counterName(counter), ` (${counter.category}).`));
    } else if (given) {
      const meant = Array.from({ length: Math.min(40, maxNumber(counter)) }, (_, i) => i + 1)
        .find(n => readingsFor(counter, n).includes(givenReading));
      lines.push(h("p", {}, meant && meant !== number
        ? ["Right counter, but ", ja(givenReading), ` means ${meant}.`]
        : "Right counter, but the reading is different for this number."));
    }
  }
  const note = readingNote(counter, number);
  if (note && !correct && !counter.generic) lines.push(note);
  finishRound(correct, lines);
}

function showResult(correct, lines, { soft = false } = {}) {
  els.result.hidden = false;
  els.result.classList.toggle("is-wrong", !correct && !soft);
  els.result.classList.toggle("is-soft", soft);
  els.resultImg.src = correct ? MARU_OK : MARU_WRONG;
  els.resultImg.hidden = soft;
  els.resultText.replaceChildren(...lines);
  // Restart the entrance animation.
  els.result.style.animation = "none";
  void els.result.offsetWidth;
  els.result.style.animation = "";
}

function finishRound(correct, lines) {
  const round = state.round;
  state.phase = "answered";
  recordResult(state.stats, round.counter.counter, round.number, correct);
  saveStats();

  if (correct) {
    state.streak += 1;
    if (state.streak > (state.best.streak || 0)) {
      state.best.streak = state.streak;
      store.set("maruBest", state.best);
    }
  } else {
    state.streak = 0;
  }

  if (state.shift) {
    gradeShiftAnswer(round, correct);
  } else {
    if (!correct) {
      // A slip in free practice sends that card back for review in the next shift.
      const cardId = cardForRound(round);
      if (state.progress.cards[cardId]) {
        gradeCard(state.progress, cardId, false, Date.now());
        saveProgress();
      }
      if (!state.challenge) {
        state.reviewQueue.push({
          mode: round.mode, counterKey: round.counter.counter, number: round.number,
          itemId: round.entry.item.id, due: REVIEW_DELAY_ROUNDS
        });
        if (state.reviewQueue.length > 8) state.reviewQueue.shift();
      }
    }
    if (state.challenge) {
      state.challenge.round += 1;
      if (correct) state.challenge.score += 1;
      else state.challenge.misses.push(round);
    }
  }

  playTone(correct ? "good" : "bad");
  showResult(correct, lines);
  render();
  updateVoiceUi();
  speech.say(roundSpeech(round, "answered"));

  const challengeOver = state.challenge && state.challenge.round >= CHALLENGE_ROUNDS;
  const shiftOver = state.shift && !state.shift.steps.length;
  els.nextBtn.textContent = challengeOver ? "See results ▶" : shiftOver ? "Finish shift ▶" : "Next ▶";
  els.nextBtn.focus({ preventScroll: true });
  if (correct) {
    state.advanceTimer = window.setTimeout(advance, AUTO_ADVANCE_MS);
  }
}

/* ---------- Free practice & challenge ---------- */

function startFreePractice() {
  state.shift = null;
  state.challenge = null;
  state.streak = 0;
  showPlay();
  startRound();
}

function startChallenge() {
  state.shift = null;
  state.challenge = { round: 0, score: 0, misses: [] };
  state.streak = 0;
  state.reviewQueue = [];
  showPlay();
  startRound();
}

function showChallengeResults() {
  const { score, misses } = state.challenge;
  const mode = state.settings.gameMode;
  const bestKey = `challenge_${mode}`;
  const previous = state.best[bestKey];
  const isRecord = previous === undefined || score > previous;
  if (isRecord) {
    state.best[bestKey] = score;
    store.set("maruBest", state.best);
  }
  els.resultsImg.src = score >= CHALLENGE_ROUNDS * 0.7 ? MARU_OK : MARU_WRONG;
  els.resultsTitle.textContent = score === CHALLENGE_ROUNDS ? "Perfect score!" : score >= CHALLENGE_ROUNDS * 0.7 ? "Great work!" : "Challenge complete";
  els.resultsScore.textContent = `${score} / ${CHALLENGE_ROUNDS}`;
  els.resultsBest.textContent = previous === undefined
    ? "Your first score in this mode. Now try to beat it!"
    : isRecord ? `New best! Your previous best was ${previous}.` : `Your best in this mode is ${previous}.`;
  if (misses.length) {
    els.resultsReview.replaceChildren(
      h("strong", {}, "Worth reviewing:"),
      h("ul", {}, misses.map(round => h("li", {},
        round.mode === "serve" ? null : [itemName(round.entry.item, { withRuby: true }), " × ", String(round.number), " → "],
        amountRuby(round.counter, round.number), ` (${round.counter.category})`
      )))
    );
  } else {
    els.resultsReview.replaceChildren();
  }
  state.challenge = null;
  state.phase = "home";
  renderStatus();
  els.resultsDialog.showModal();
}

/* ---------- Counter guide ---------- */

/** A few readings above ten, where the counter goes that far and anything about it is irregular. */
function aboveTen(counter) {
  const special = specialNumbers(counter);
  const pool = bigNumbers(counter);
  if (!pool.length || !(special.length || NUMBERS.some(n => isIrregular(counter, n)))) return null;
  const irregular = pool.filter(n => isIrregular(counter, n));
  const picks = [...new Set([...special, ...irregular, ...pool])].slice(0, 5).sort((a, b) => a - b);
  return [
    h("p", { class: "above-ten" }, "Above ten, the last digit decides the reading:"),
    h("div", { class: "reading-grid" }, picks.map(n => {
      const readings = readingsFor(counter, n);
      return h("button", {
        class: `reading-cell${isIrregular(counter, n) ? " irregular" : ""}`, type: "button", lang: "ja",
        title: readings.length > 1 ? `Also: ${readings.slice(1).join("、")}` : "Tap to hear",
        onclick: () => speech.say(readings[0], { force: true })
      }, h("small", {}, amountText(counter, n)), readings[0]);
    }))
  ];
}

/** Reading table and example items: used in the guide and in lessons. */
function counterDetail(counter, { withNote = true } = {}) {
  const key = counter.counter;
  return h("div", { class: "counter-detail" },
    withNote ? h("p", {}, counter.note) : null,
    h("div", { class: "reading-grid" }, NUMBERS.map(n => {
      const readings = readingsFor(counter, n);
      return h("button", {
        class: `reading-cell${isIrregular(counter, n) ? " irregular" : ""}`, type: "button", lang: "ja",
        title: readings.length > 1 ? `Also: ${readings.slice(1).join("、")}` : "Tap to hear",
        onclick: () => speech.say(readings[0], { force: true })
      }, h("small", {}, amountText(counter, n)), readings[0]);
    })),
    aboveTen(counter),
    h("div", { class: "guide-items" }, counter.entries.map(({ item, counter: home }) => {
      const others = [home.counter, ...(item.also || [])].filter(k => k !== key && !state.data.byKey.get(k).generic);
      return h("span", {}, picture(item, { loading: "lazy" }), itemName(item, { withRuby: true }),
        ` ${item.label_en}`, !counter.generic && !counter.abstract && others.length ? ja(`（${others.join("・")}も）`) : null);
    }))
  );
}

function renderGuide(openKey) {
  const all = state.data.counters;
  const progress = state.progress;
  const enabled = Array.isArray(state.enabled) ? new Set(state.enabled) : null;
  const selected = enabled ? all.filter(c => enabled.has(c.counter)).length : all.length;
  els.counterSummary.textContent = selected === 0
    ? "Nothing ticked, so free practice will use every counter."
    : selected === all.length ? `All ${all.length} counters ticked for free practice.` : `${selected} of ${all.length} ticked for free practice.`;
  els.selectAllBtn.textContent = selected === all.length ? "Untick all" : "Tick all";

  const openKeys = new Set([...els.counterList.querySelectorAll("details[open]")].map(d => d.dataset.key));
  if (openKey) openKeys.add(openKey);
  const upNext = lockedCounters(state.data, progress)[0];
  const row = counter => {
    const key = counter.counter;
    const stat = state.stats[key];
    const acc = accuracy(stat);
    const stars = counterStars(counter, progress);
    const locked = stars === null;
    const isOn = enabled ? enabled.has(key) : true;

    const checkbox = h("input", {
      type: "checkbox", checked: isOn, "aria-label": `Use ${key} in free practice`, title: "Use in free practice",
      onchange: event => toggleCounter(key, event.target.checked)
    });
    const detail = counterDetail(counter);
    if (locked) {
      detail.append(counter === upNext
        ? h("p", { class: "learn-next" }, "✓ Maru will teach this one next.")
        : h("button", {
          class: "ghost small learn-next", type: "button",
          onclick: () => {
            progress.priority = [key, ...progress.priority.filter(k => k !== key)];
            saveProgress();
            renderGuide();
          }
        }, "Learn this one next"));
    }
    const details = h("details", { open: openKeys.has(key) },
      h("summary", {},
        h("span", { class: "counter-kanji", lang: "ja" }, key),
        h("span", { class: "counter-meta" },
          h("strong", { lang: "ja" }, counter.reading),
          h("span", {}, counter.category)),
        h("span", { class: "counter-progress" },
          locked ? h("span", { class: "level" }, counter === upNext ? "Next up" : "🔒 Not started")
            : h("span", { class: `level ${["learning", "learning", "strong", "mastered"][stars]}` }, starText(stars)),
          h("br"),
          h("small", {}, acc === null ? "not practiced yet" : `${Math.round(acc * 100)}% of ${stat.correct + stat.incorrect}`))
      ),
      detail
    );
    details.dataset.key = key;
    return h("div", { class: `counter-row${isOn ? "" : " is-off"}`, role: "listitem" },
      h("div", { class: "counter-row__head" }, checkbox, details));
  };
  els.counterList.replaceChildren(...chapters(all).flatMap(([name, counters]) =>
    [h("h3", { class: "chapter-title" }, name), ...counters.map(row)]));
}

function openGuide(openKey) {
  if (!state.data) return;
  renderGuide(openKey);
  els.guideDialog.showModal();
  const target = openKey && els.counterList.querySelector(`details[data-key="${openKey}"]`);
  if (target) target.scrollIntoView({ block: "start" });
  else els.counterList.scrollTop = 0;
}

function toggleCounter(key, on) {
  const allKeys = state.data.counters.map(c => c.counter);
  const current = new Set(Array.isArray(state.enabled) ? state.enabled : allKeys);
  if (on) current.add(key);
  else current.delete(key);
  state.enabled = current.size === allKeys.length ? null : allKeys.filter(k => current.has(k));
  saveEnabled();
  renderGuide();
}

function closeGuide() {
  if (Array.isArray(state.enabled) && state.enabled.length === 0) {
    state.enabled = null;
    saveEnabled();
  }
  if (state.phase === "home") {
    renderHome();
    return;
  }
  // Free practice: if the counter being asked about was just switched off, move on.
  const stillActive = state.round && activeCounters().includes(state.round.counter);
  if (state.phase === "asking" && !state.shift && !stillActive) startRound();
}

/* ---------- Settings ---------- */

function syncSettingsForm() {
  const s = state.settings;
  els.furigana.checked = s.furigana;
  els.voice.checked = s.voice;
  els.listening.checked = s.listening;
  els.listening.disabled = !speech.supported || !s.voice;
  els.sfx.checked = s.sfx;
  els.labelSelect.value = s.labels;
  els.maxNumberSelect.value = String(s.maxNumber);
  els.answerStyleSelect.value = s.answerStyle;
}

function changeSetting(key, value, { rerender = true } = {}) {
  state.settings[key] = value;
  saveSettings();
  syncSettingsForm();
  updateVoiceUi();
  if (rerender && state.round) render();
}

/* ---------- Events ---------- */

function bindEvents() {
  els.homeBtn.addEventListener("click", showHome);
  els.startShiftBtn.addEventListener("click", startShift);
  els.freePracticeBtn.addEventListener("click", startFreePractice);
  els.homeChallengeBtn.addEventListener("click", startChallenge);
  els.lessonDoneBtn.addEventListener("click", finishLesson);

  els.modeButtons.forEach(btn => btn.addEventListener("click", () => {
    if (state.challenge || state.shift || btn.dataset.mode === state.settings.gameMode) return;
    changeSetting("gameMode", btn.dataset.mode, { rerender: false });
    startRound();
  }));

  els.challengeBtn.addEventListener("click", () => (state.challenge ? startFreePractice() : startChallenge()));
  els.doneBtn.addEventListener("click", submitServe);
  els.nextBtn.addEventListener("click", advance);
  els.clearTrayBtn.addEventListener("click", () => {
    if (state.phase !== "asking") return;
    state.tray = new Map();
    renderTray();
  });

  els.replayBtn.addEventListener("click", () => state.round && speech.say(roundSpeech(state.round, state.phase)));
  els.slowBtn.addEventListener("click", () => state.round && speech.say(roundSpeech(state.round, state.phase), { slow: true }));
  els.hintBtn.addEventListener("click", () => {
    state.hintVisible = !state.hintVisible;
    renderHint();
  });

  // Drag & drop (mouse); clicking or tapping always works too.
  els.tray.addEventListener("dragover", event => {
    event.preventDefault();
    els.tray.classList.add("drag-over");
  });
  els.tray.addEventListener("dragleave", () => els.tray.classList.remove("drag-over"));
  els.tray.addEventListener("drop", event => {
    event.preventDefault();
    els.tray.classList.remove("drag-over");
    addToTray(event.dataTransfer.getData("text/plain"));
  });

  els.typeForm.addEventListener("submit", event => {
    event.preventDefault();
    submitTyped();
  });
  els.typeInput.addEventListener("input", () => {
    const value = els.typeInput.value;
    els.typePreview.textContent = /[a-zA-Z]/.test(value) ? `→ ${romajiToHiragana(value, { final: false })}` : "";
  });

  // Settings
  $("openSettingsBtn").addEventListener("click", () => {
    syncSettingsForm();
    els.settingsDialog.showModal();
  });
  $("closeSettingsBtn").addEventListener("click", () => els.settingsDialog.close());
  els.furigana.addEventListener("change", () => changeSetting("furigana", els.furigana.checked));
  els.voice.addEventListener("change", () => {
    changeSetting("voice", els.voice.checked);
    if (els.voice.checked && state.round) speech.say(roundSpeech(state.round, state.phase));
    else speech.stop();
  });
  els.listening.addEventListener("change", () => changeSetting("listening", els.listening.checked));
  els.sfx.addEventListener("change", () => changeSetting("sfx", els.sfx.checked));
  els.labelSelect.addEventListener("change", () => changeSetting("labels", els.labelSelect.value));
  els.maxNumberSelect.addEventListener("change", () => changeSetting("maxNumber", Number(els.maxNumberSelect.value), { rerender: false }));
  els.answerStyleSelect.addEventListener("change", () => changeSetting("answerStyle", els.answerStyleSelect.value));
  $("resetProgressBtn").addEventListener("click", () => {
    if (!state.data) return;
    if (!window.confirm("Reset everything you have learned: lessons, reviews, scores and streaks? Your settings are kept.")) return;
    state.stats = normalizeStats({}, state.data.counters.map(c => c.counter));
    state.progress = emptyProgress();
    state.best = {};
    state.streak = 0;
    state.reviewQueue = [];
    saveStats();
    saveProgress();
    store.set("maruBest", state.best);
    els.settingsDialog.close();
    showHome();
  });

  // Guide
  $("openGuideBtn").addEventListener("click", () => openGuide());
  $("closeGuideBtn").addEventListener("click", () => els.guideDialog.close());
  els.guideDialog.addEventListener("close", closeGuide);
  els.selectAllBtn.addEventListener("click", () => {
    const allSelected = !Array.isArray(state.enabled);
    state.enabled = allSelected ? [] : null;
    saveEnabled();
    renderGuide();
  });

  // Challenge results
  $("resultsAgainBtn").addEventListener("click", () => els.resultsDialog.close("again"));
  $("resultsPracticeBtn").addEventListener("click", () => els.resultsDialog.close("practice"));
  els.resultsDialog.addEventListener("close", () => {
    const again = els.resultsDialog.returnValue === "again";
    els.resultsDialog.returnValue = "";
    if (again) startChallenge();
    else startFreePractice();
  });

  // Shift summary
  $("summaryAgainBtn").addEventListener("click", () => els.summaryDialog.close("again"));
  $("summaryHomeBtn").addEventListener("click", () => els.summaryDialog.close("home"));
  els.summaryDialog.addEventListener("close", () => {
    const again = els.summaryDialog.returnValue === "again";
    els.summaryDialog.returnValue = "";
    if (again) startShift();
    else showHome();
  });

  // Click on the backdrop closes a dialog.
  [els.settingsDialog, els.guideDialog].forEach(dialog => dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  }));

  document.addEventListener("keydown", event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (document.querySelector("dialog[open]") || !state.round) return;
    const tag = event.target && event.target.tagName;
    const typing = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
    if (event.key === "Enter") {
      if (typing || tag === "BUTTON" || tag === "SUMMARY") return; // let the focused control handle it
      event.preventDefault();
      if (state.phase === "answered") advance();
      else if (state.round.mode !== "count") submitServe();
      return;
    }
    if (typing) return;
    const key = event.key.toLowerCase();
    if (key === "r") els.replayBtn.click();
    else if (key === "h") els.hintBtn.click();
    else if (/^[1-9]$/.test(key) && state.phase === "asking" && state.round.mode === "count" && state.settings.answerStyle === "choice") {
      const choice = state.choices[Number(key) - 1];
      if (choice) submitChoice(choice);
    }
  });

  // Coming back to the tab after a while: reviews may have come due.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.phase === "home") renderHome();
  });
}

/* ---------- Start ---------- */

async function init() {
  bindEvents();
  speech.init();
  syncSettingsForm();
  updateVoiceUi();
  try {
    const response = await fetch("data/counters.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = prepareData(await response.json());
    if (!state.data.counters.length) throw new Error("no counters in data file");
  } catch (err) {
    els.homeMessage.textContent = "Could not load the counter data. If you opened index.html directly, run a local web server instead (see the README).";
    console.error(err);
    return;
  }
  const keys = state.data.counters.map(c => c.counter);
  state.stats = normalizeStats(store.get("counterStats", {}), keys);
  state.progress = normalizeProgress(store.get("maruProgress", null), state.data);
  const savedEnabled = store.get("enabledCounters", null);
  if (Array.isArray(savedEnabled)) {
    const valid = keys.filter(k => savedEnabled.includes(k));
    state.enabled = valid.length && valid.length < keys.length ? valid : null;
  }
  showHome();
}

init();
