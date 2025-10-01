let gameData = null;
let currentRequest = null;
let challengeMode = false;
let challengeScore = 0;
let challengeRounds = 0;

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
const COUNTER_HINT_HTML = '<span class="drop-hint">Drag or click items to add</span>';

let hintVisible = false;

const HINT_SHOW_LABEL = "💡 Show hint";
const HINT_HIDE_LABEL = "🙈 Hide hint";

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
  const counters = gameData.counters;
  const counterObj = counters[Math.floor(Math.random() * counters.length)];
  const number = Math.ceil(Math.random() * 5); // up to 5 items for demo
  const item = counterObj.items[Math.floor(Math.random() * counterObj.items.length)];
  return { counterObj, number, item };
}

function newCustomer() {
  if (!gameData || !gameData.counters) return;
  currentRequest = randomRequest();
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
}

function updateCustomerText() {
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
  if (!gameData) return;

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

  if (correctNumber && correctCategory) {
    reactionDiv.innerHTML = `<img src="data/assets/ui/maru_ok.png" alt="OK" height="80">`;
    if (feedbackDiv) {
      feedbackDiv.innerHTML = `<strong>Nice!</strong> 「${currentRequest.number}${currentRequest.counterObj.counter}」 is perfect for ${currentRequest.counterObj.category}.`;
    }
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
  }

  if (challengeMode) {
    challengeRounds++;
    if (challengeRounds >= 10) {
      setTimeout(() => {
        alert(`Challenge over! Score: ${challengeScore}/10`);
        challengeMode = false;
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
  newCustomer();
});

document.getElementById("startChallenge").addEventListener("click", () => {
  challengeMode = true;
  challengeRounds = 0;
  challengeScore = 0;
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
});

closeSettings.addEventListener("click", () => {
  settingsModal.style.display = "none";
});

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
