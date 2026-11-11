import {
  prepareData, naiveReading, primaryReading, readingsFor, isIrregular, acceptedReadingsForItem,
  itemAccepts, pickRound, buildShelf, checkServe, buildChoices, romajiToHiragana, normalizeTypedAnswer,
  checkTypedAnswer, normalizeStats, recordResult, accuracy, masteryLevel
} from "./logic.js";

const CHALLENGE_ROUNDS = 10;
const SHELF_SIZE = 8;
const AUTO_ADVANCE_MS = 1700;
const REVIEW_DELAY_ROUNDS = 3;
const MARU_OK = "data/assets/ui/maru_ok.png";
const MARU_WRONG = "data/assets/ui/maru_wrong.png";
const LEVEL_LABELS = { new: "New", learning: "Learning", strong: "Strong", mastered: "Mastered" };

const $ = id => document.getElementById(id);
const els = {
  modeButtons: [...document.querySelectorAll(".segmented button")],
  streakCount: $("streakCount"), bestStreak: $("bestStreak"),
  challengeStatus: $("challengeStatus"), challengeRound: $("challengeRound"),
  challengeTotal: $("challengeTotal"), challengeScore: $("challengeScore"), challengeBtn: $("challengeBtn"),
  taskLabel: $("taskLabel"), prompt: $("prompt"),
  replayBtn: $("replayVoiceBtn"), slowBtn: $("slowVoiceBtn"), hintBtn: $("toggleHintBtn"), hint: $("counterHint"),
  serveArea: $("serveArea"), shelf: $("shelf"), tray: $("counter"), trayTotal: $("trayTotal"), clearTrayBtn: $("clearTrayBtn"),
  countArea: $("countArea"), countTray: $("countTray"), countLabel: $("countLabel"), choices: $("choices"),
  typeForm: $("typeForm"), typeInput: $("typeInput"), typePreview: $("typePreview"),
  result: $("result"), resultImg: $("resultImg"), resultText: $("resultText"),
  doneBtn: $("doneBtn"), nextBtn: $("nextBtn"),
  settingsDialog: $("settingsDialog"), guideDialog: $("guideDialog"), resultsDialog: $("resultsDialog"),
  furigana: $("furiganaCheckbox"), voice: $("voiceCheckbox"), listening: $("listeningCheckbox"), sfx: $("sfxCheckbox"),
  labelSelect: $("labelSelect"), maxNumberSelect: $("maxNumberSelect"), answerStyleSelect: $("answerStyleSelect"),
  voiceNote: $("voiceNote"),
  counterSummary: $("counterSummary"), counterList: $("counterList"), selectAllBtn: $("selectAllCounters"),
  resultsImg: $("resultsImg"), resultsTitle: $("resultsTitle"), resultsScore: $("resultsScore"),
  resultsBest: $("resultsBest"), resultsReview: $("resultsReview")
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
  if (![5, 10].includes(settings.maxNumber)) settings.maxNumber = 10;
  if (!["choice", "type"].includes(settings.answerStyle)) settings.answerStyle = "choice";
  return settings;
}

const state = {
  data: null,
  stats: {},
  enabled: null, // null = every counter, otherwise a list of counter keys
  settings: loadSettings(),
  best: store.get("maruBest", {}) || {},
  challenge: null, // { round, score, misses } while a challenge is running
  streak: 0,
  round: null,
  phase: "loading", // loading | asking | answered
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

function itemName(item, { withRuby = state.settings.furigana } = {}) {
  return withRuby && item.label_ja !== item.kana ? ruby(item.label_ja, item.kana) : ja(item.label_ja);
}

function tileLabel(item) {
  if (state.settings.labels === "off") return null;
  if (state.settings.labels === "en") return h("span", { class: "item-label" }, item.label_en);
  return h("span", { class: "item-label", lang: "ja" }, itemName(item));
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
    const notes = { good: [660, 880], bad: [300, 220], tap: [520] }[kind] || [520];
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

/* ---------- Counter selection ---------- */

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

/* ---------- Rounds ---------- */

function roundSpeech(round, phase) {
  const reading = primaryReading(round.counter, round.number);
  if (round.mode === "serve") return `${reading}ください。`;
  return phase === "answered" ? `${round.entry.item.kana}、${reading}ですね。` : round.entry.item.kana;
}

function isListeningRound() {
  return state.round && state.round.mode === "serve" && state.phase === "asking" &&
    state.settings.listening && state.settings.voice && speech.supported;
}

function nextFromReviewQueue(mode) {
  if (state.challenge) return null;
  const activeKeys = new Set(activeCounters().map(c => c.counter));
  state.reviewQueue.forEach(entry => { entry.due -= 1; });
  const index = state.reviewQueue.findIndex(entry =>
    entry.due <= 0 && activeKeys.has(entry.counterKey) && (mode === "mix" || entry.mode === mode) &&
    entry.number <= state.settings.maxNumber && entry.counterKey !== state.lastCounterKey
  );
  if (index < 0) return null;
  const [entry] = state.reviewQueue.splice(index, 1);
  const counter = state.data.byKey.get(entry.counterKey);
  const item = counter.items.find(i => i.id === entry.itemId) || counter.items[0];
  return { mode: entry.mode, counter, number: entry.number, entry: { item, counter }, isReview: true };
}

function startRound() {
  if (!state.data) return;
  window.clearTimeout(state.advanceTimer);
  const gameMode = state.settings.gameMode;
  let round = nextFromReviewQueue(gameMode);
  if (!round) {
    const mode = gameMode === "mix" ? (Math.random() < 0.5 ? "serve" : "count") : gameMode;
    round = pickRound({
      data: state.data, activeCounters: activeCounters(), stats: state.stats, mode,
      maxNumber: state.settings.maxNumber, lastCounterKey: state.lastCounterKey
    });
  }
  if (!round) return;

  state.round = round;
  state.lastCounterKey = round.counter.counter;
  state.phase = "asking";
  state.tray = new Map();
  state.hintVisible = false;
  state.shelf = round.mode === "serve"
    ? buildShelf({ data: state.data, round, activeCounters: activeCounters(), size: SHELF_SIZE })
    : [];
  state.choices = round.mode === "count" ? buildChoices({ data: state.data, round }) : [];

  els.result.hidden = true;
  els.typeInput.value = "";
  els.typePreview.textContent = "";
  render();
  speech.say(roundSpeech(round, "asking"));
  if (round.mode === "count" && state.settings.answerStyle === "type" && !isTouchDevice()) {
    els.typeInput.focus();
  }
}

const isTouchDevice = () => window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

/* ---------- Rendering ---------- */

function render() {
  renderStatus();
  renderPrompt();
  renderHint();
  const round = state.round;
  if (!round) return;
  const serve = round.mode === "serve";
  els.serveArea.hidden = !serve;
  els.countArea.hidden = serve;
  if (serve) {
    renderShelf();
    renderTray();
  } else {
    renderCountArea();
  }
  const asking = state.phase === "asking";
  els.doneBtn.hidden = !(asking && serve);
  els.nextBtn.hidden = asking;
}

function renderStatus() {
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
  if (!round) return;
  const { counter, number, entry } = round;
  const reading = primaryReading(counter, number);
  const answered = state.phase === "answered";
  const amount = `${number}${counter.counter}`;
  const amountNode = answered || state.settings.furigana ? ruby(amount, reading, answered ? "answer" : "") : amount;
  els.prompt.replaceChildren();

  if (round.mode === "serve") {
    els.taskLabel.textContent = round.isReview
      ? "One more try at an order you missed. Put the right items on the counter."
      : "A customer is ordering. Put the right items on the counter.";
    if (isListeningRound()) {
      els.prompt.append("「", h("button", {
        class: "listen-only", type: "button", title: "Play the order again",
        onclick: () => speech.say(roundSpeech(round, "asking"))
      }, "🔊 ？？？"), "」");
    } else {
      els.prompt.append("「", amountNode, "ください。」");
    }
  } else {
    els.taskLabel.textContent = round.isReview
      ? "One more try at one you missed. How do you say how many there are?"
      : "Confirm the customer's items. How do you say how many there are?";
    const blank = answered ? amountNode : h("span", { class: "blank" }, "？");
    els.prompt.append("「", itemName(entry.item), "、", blank, "ですね。」");
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
  const name = h("strong", { lang: "ja" }, `「${counter.counter}」`);
  if (round.mode === "serve") {
    els.hint.replaceChildren(name, ` (${counter.reading}) counts `, h("strong", {}, counter.category), ". ", counter.note);
  } else {
    els.hint.replaceChildren(
      itemName(entry.item, { withRuby: true }), ` (${entry.item.label_en}) belongs with `, h("strong", {}, counter.category),
      ", so use ", name, ` (${counter.reading}). Careful: the reading can change with the number.`
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
    h("img", { src: entry.item.image, alt: "", draggable: false }),
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

function renderShelf() {
  const asking = state.phase === "asking";
  const key = state.round.counter.counter;
  els.shelf.replaceChildren(...state.shelf.map(entry => {
    const tile = makeTile(entry, {
      draggable: asking,
      title: asking ? "Click or drag to add to the counter" : `${entry.item.label_en}: ${entry.counter.counter}`,
      onClick: () => addToTray(entry.item.id)
    });
    tile.disabled = !asking;
    if (!asking && itemAccepts(entry, key)) tile.classList.add("is-right");
    return tile;
  }));
}

function renderTray(poppedId) {
  const asking = state.phase === "asking";
  const key = state.round.counter.counter;
  const entries = [...state.tray.values()];
  const total = entries.reduce((sum, t) => sum + t.count, 0);
  els.tray.classList.toggle("has-items", entries.length > 0);
  els.trayTotal.textContent = total ? `· ${total} item${total === 1 ? "" : "s"}` : "";
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
    if (!asking) tile.classList.add(itemAccepts(entry, key) ? "is-right" : "is-wrong");
    if (entry.item.id === poppedId) tile.classList.add("pop");
    return tile;
  }));
}

function addToTray(itemId) {
  if (state.phase !== "asking" || !state.round || state.round.mode !== "serve") return;
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

function renderCountArea() {
  const round = state.round;
  const { entry, number } = round;
  const asking = state.phase === "asking";
  els.countTray.replaceChildren(...Array.from({ length: number }, (_, i) =>
    h("img", { src: entry.item.image, alt: i === 0 ? `${number} × ${entry.item.label_en}` : "", style: `animation-delay:${i * 35}ms` })
  ));
  els.countLabel.replaceChildren(itemName(entry.item), h("small", {}, entry.item.label_en));

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
      h("span", { class: "choice-kanji" }, asking ? "" : `${number}${choice.counterKey}`)
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

function amountRuby(counter, number) {
  return h("strong", { lang: "ja" }, ruby(`${number}${counter.counter}`, primaryReading(counter, number)));
}

function submitServe() {
  if (state.phase !== "asking" || !state.round || state.round.mode !== "serve") return;
  const round = state.round;
  const tray = [...state.tray.values()];
  if (!tray.length) {
    showResult(false, [h("p", { class: "headline" }, "The counter is empty!"),
      h("p", {}, "Click, tap or drag items from the shelf first.")], { soft: true });
    return;
  }
  const outcome = checkServe(round, tray);
  const { counter, number } = round;
  const lines = [];
  if (outcome.correct) {
    lines.push(h("p", { class: "headline" }, ja("正解！"), " Correct!"));
    lines.push(h("p", {}, amountRuby(counter, number), " — ", ja(`「${counter.counter}」`), ` counts ${counter.category}.`));
  } else {
    lines.push(h("p", { class: "headline" }, ja("ざんねん…"), " Not quite."));
    lines.push(h("p", {}, "The order was ", amountRuby(counter, number), " — ", ja(`「${counter.counter}」`), ` counts ${counter.category}.`));
    if (!outcome.numberOk) lines.push(h("p", {}, `You put ${outcome.total} on the counter.`));
    outcome.wrongItems.slice(0, 3).forEach(entry => {
      lines.push(h("p", {}, itemName(entry.item, { withRuby: true }), ` (${entry.item.label_en}) is counted with `,
        h("strong", { lang: "ja" }, `「${entry.counter.counter}」`), ` (${entry.counter.category}).`));
    });
  }
  const note = readingNote(counter, number);
  if (note) lines.push(note);
  finishRound(outcome.correct, lines);
}

function submitChoice(choice) {
  if (state.phase !== "asking" || !state.round || state.round.mode !== "count") return;
  state.round.chosen = choice;
  finishCount(choice.correct, choice.reading, choice.counterKey);
}

function submitTyped() {
  if (state.phase !== "asking" || !state.round || state.round.mode !== "count") return;
  const text = els.typeInput.value.trim();
  if (!text) {
    els.typeInput.focus();
    return;
  }
  const round = state.round;
  const accepted = acceptedReadingsForItem(state.data, round.entry, round.number);
  const typed = normalizeTypedAnswer(text);
  const correct = checkTypedAnswer(text, accepted);
  // If the answer is wrong, see whether it is the right reading for some other counter.
  const otherCounter = correct ? null : state.data.counters.find(c =>
    readingsFor(c, round.number).some(r => typed.includes(r)));
  // "nn" can mean ん (typing style) or ん + n… (Hepburn); show whichever reading the player most likely meant.
  const known = typed.find(t => state.data.counters.some(c => readingsFor(c, round.number).includes(t)));
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
    lines.push(h("p", {}, name(), ` × ${number} = `, amountRuby(counter, number)));
    const others = acceptedReadingsForItem(state.data, entry, number).filter(r => r !== primaryReading(counter, number));
    if (others.length) lines.push(h("p", {}, "Also accepted: ", ja(others.slice(0, 4).join("、")), "."));
  } else {
    lines.push(h("p", { class: "headline" }, ja("ざんねん…"), " Not quite."));
    lines.push(h("p", {}, "You answered ", ja(givenReading), ". The answer is ", amountRuby(counter, number), "."));
    const given = givenCounterKey ? state.data.byKey.get(givenCounterKey) : null;
    if (given && given.counter !== counter.counter) {
      lines.push(h("p", {}, h("strong", { lang: "ja" }, `「${given.counter}」`), ` is for ${given.category}; `, name(),
        " takes ", h("strong", { lang: "ja" }, `「${counter.counter}」`), ` (${counter.category}).`));
    } else if (given || givenCounterKey === counter.counter) {
      lines.push(h("p", {}, "Right counter, but the reading is different for this number."));
    }
  }
  const note = readingNote(counter, number);
  if (note && !correct) lines.push(note);
  finishRound(correct, lines);
}

function showResult(correct, lines, { soft = false } = {}) {
  els.result.hidden = false;
  els.result.classList.toggle("is-wrong", !correct);
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

  playTone(correct ? "good" : "bad");
  showResult(correct, lines);
  render();
  updateVoiceUi();
  speech.say(roundSpeech(round, "answered"));

  const challengeOver = state.challenge && state.challenge.round >= CHALLENGE_ROUNDS;
  els.nextBtn.textContent = challengeOver ? "See results ▶" : "Next ▶";
  els.nextBtn.focus({ preventScroll: true });
  if (correct) {
    state.advanceTimer = window.setTimeout(advance, AUTO_ADVANCE_MS);
  }
}

function advance() {
  window.clearTimeout(state.advanceTimer);
  if (state.phase !== "answered") return;
  if (state.challenge && state.challenge.round >= CHALLENGE_ROUNDS) {
    showChallengeResults();
    return;
  }
  startRound();
  updateVoiceUi();
}

/* ---------- Challenge ---------- */

function startChallenge() {
  state.challenge = { round: 0, score: 0, misses: [] };
  state.streak = 0;
  state.reviewQueue = [];
  startRound();
}

function endChallenge() {
  state.challenge = null;
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
        round.mode === "count" ? [itemName(round.entry.item, { withRuby: true }), " × ", String(round.number), " → "] : null,
        amountRuby(round.counter, round.number), ` (${round.counter.category})`
      )))
    );
  } else {
    els.resultsReview.replaceChildren();
  }
  state.challenge = null;
  state.phase = "loading";
  renderStatus();
  els.resultsDialog.showModal();
}

/* ---------- Counter guide ---------- */

function renderGuide() {
  const all = state.data.counters;
  const enabled = Array.isArray(state.enabled) ? new Set(state.enabled) : null;
  const selected = enabled ? all.filter(c => enabled.has(c.counter)).length : all.length;
  els.counterSummary.textContent = selected === 0
    ? "Nothing selected, so every counter will be used."
    : selected === all.length ? `All ${all.length} counters selected.` : `${selected} of ${all.length} counters selected.`;
  els.selectAllBtn.textContent = selected === all.length ? "Deselect all" : "Select all";

  const openKeys = new Set([...els.counterList.querySelectorAll("details[open]")].map(d => d.dataset.key));
  els.counterList.replaceChildren(...all.map(counter => {
    const key = counter.counter;
    const stat = state.stats[key];
    const acc = accuracy(stat);
    const level = masteryLevel(stat);
    const isOn = enabled ? enabled.has(key) : true;

    const checkbox = h("input", {
      type: "checkbox", checked: isOn, "aria-label": `Practice ${key}`,
      onchange: event => toggleCounter(key, event.target.checked)
    });
    const details = h("details", { open: openKeys.has(key) },
      h("summary", {},
        h("span", { class: "counter-kanji", lang: "ja" }, key),
        h("span", { class: "counter-meta" },
          h("strong", { lang: "ja" }, `${counter.reading}`),
          h("span", {}, counter.category)),
        h("span", { class: "counter-progress" },
          h("span", { class: `level ${level}` }, LEVEL_LABELS[level]),
          h("br"),
          h("small", {}, acc === null ? "not practiced yet" : `${Math.round(acc * 100)}% of ${stat.correct + stat.incorrect}`))
      ),
      h("div", { class: "counter-detail" },
        h("p", {}, counter.note),
        h("div", { class: "reading-grid" }, Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const readings = readingsFor(counter, n);
          return h("button", {
            class: `reading-cell${isIrregular(counter, n) ? " irregular" : ""}`, type: "button", lang: "ja",
            title: readings.length > 1 ? `Also: ${readings.slice(1).join("、")}` : "Tap to hear",
            onclick: () => speech.say(readings[0], { force: true })
          }, h("small", {}, `${n}${key}`), readings[0]);
        })),
        h("div", { class: "guide-items" }, counter.items.map(item =>
          h("span", {}, h("img", { src: item.image, alt: "", loading: "lazy" }), itemName(item, { withRuby: true }),
            ` ${item.label_en}`, item.also ? ja(`（${item.also.join("・")}も）`) : null)))
      )
    );
    details.dataset.key = key;
    return h("div", { class: `counter-row${isOn ? "" : " is-off"}`, role: "listitem" },
      h("div", { class: "counter-row__head" }, checkbox, details));
  }));
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
  // If the counter being asked about was just switched off, move on.
  const stillActive = state.round && activeCounters().includes(state.round.counter);
  if (state.phase === "asking" && !stillActive) startRound();
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
  els.modeButtons.forEach(btn => btn.addEventListener("click", () => {
    if (state.challenge || btn.dataset.mode === state.settings.gameMode) return;
    changeSetting("gameMode", btn.dataset.mode, { rerender: false });
    startRound();
  }));

  els.challengeBtn.addEventListener("click", () => (state.challenge ? endChallenge() : startChallenge()));
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
    else if (speech.supported) window.speechSynthesis.cancel();
  });
  els.listening.addEventListener("change", () => changeSetting("listening", els.listening.checked));
  els.sfx.addEventListener("change", () => changeSetting("sfx", els.sfx.checked));
  els.labelSelect.addEventListener("change", () => changeSetting("labels", els.labelSelect.value));
  els.maxNumberSelect.addEventListener("change", () => changeSetting("maxNumber", Number(els.maxNumberSelect.value), { rerender: false }));
  els.answerStyleSelect.addEventListener("change", () => changeSetting("answerStyle", els.answerStyleSelect.value));
  $("resetProgressBtn").addEventListener("click", () => {
    if (!window.confirm("Reset all progress, best scores and streaks? Your settings are kept.")) return;
    state.stats = normalizeStats({}, state.data.counters.map(c => c.counter));
    state.best = {};
    state.streak = 0;
    state.reviewQueue = [];
    saveStats();
    store.set("maruBest", state.best);
    renderStatus();
  });

  // Guide
  $("openGuideBtn").addEventListener("click", () => {
    if (!state.data) return;
    renderGuide();
    els.guideDialog.showModal();
    els.counterList.scrollTop = 0;
  });
  $("closeGuideBtn").addEventListener("click", () => els.guideDialog.close());
  els.guideDialog.addEventListener("close", closeGuide);
  els.selectAllBtn.addEventListener("click", () => {
    const allSelected = !Array.isArray(state.enabled);
    state.enabled = allSelected ? [] : null;
    saveEnabled();
    renderGuide();
  });

  // Results
  $("resultsAgainBtn").addEventListener("click", () => {
    els.resultsDialog.close("again");
  });
  $("resultsPracticeBtn").addEventListener("click", () => els.resultsDialog.close("practice"));
  els.resultsDialog.addEventListener("close", () => {
    if (els.resultsDialog.returnValue === "again") startChallenge();
    else startRound();
    els.resultsDialog.returnValue = "";
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
      else if (state.round.mode === "serve") submitServe();
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
}

/* ---------- Start ---------- */

async function init() {
  bindEvents();
  speech.init();
  syncSettingsForm();
  renderStatus();
  updateVoiceUi();
  try {
    const response = await fetch("data/counters.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = prepareData(await response.json());
    if (!state.data.counters.length) throw new Error("no counters in data file");
  } catch (err) {
    els.taskLabel.textContent = "Could not load the counter data. If you opened index.html directly, run a local web server instead (see the README).";
    els.prompt.textContent = "「ごめんなさい…」";
    console.error(err);
    return;
  }
  const keys = state.data.counters.map(c => c.counter);
  state.stats = normalizeStats(store.get("counterStats", {}), keys);
  const savedEnabled = store.get("enabledCounters", null);
  if (Array.isArray(savedEnabled)) {
    const valid = keys.filter(k => savedEnabled.includes(k));
    state.enabled = valid.length && valid.length < keys.length ? valid : null;
  }
  startRound();
  updateVoiceUi();
}

init();
