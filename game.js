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

// Load JSON
fetch("data/counters.json")
  .then(res => res.json())
  .then(data => {
    gameData = data;
    populateShelf();
  });

// Speak Japanese if voice enabled
function speakJapanese(text) {
  if (!voiceEnabled) return;
  if ('speechSynthesis' in window) {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ja-JP';
    speechSynthesis.speak(utter);
  }
}

// Get correct reading (handles irregular)
function getCounterReading(counterObj, number) {
  if (!counterObj.irregular) return `${number}${counterObj.reading}`;
  return counterObj.irregular[number] || counterObj.irregular["default"].replace("{n}", number);
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
  currentRequest = randomRequest();
  updateCustomerText();
  clearCounter();
  reactionDiv.innerHTML = "";
  speakJapanese(getCounterReading(currentRequest.counterObj, currentRequest.number) + "ください。");
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

function populateShelf() {
  shelfDiv.innerHTML = "";
  gameData.counters.forEach(c => {
    c.items.forEach(item => {
      const div = document.createElement("div");
      div.className = "item";
      div.style.backgroundImage = `url(${item.image})`;
      div.dataset.itemId = item.id;
      div.dataset.counter = c.counter;
      div.draggable = true;
      div.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/plain", JSON.stringify({
          id: item.id,
          counter: c.counter
        }));
      });
      shelfDiv.appendChild(div);
    });
  });
}

// Dropzone logic
counterDiv.addEventListener("dragover", e => e.preventDefault());
counterDiv.addEventListener("drop", e => {
  e.preventDefault();
  const data = JSON.parse(e.dataTransfer.getData("text/plain"));
  const div = document.createElement("div");
  div.className = "item";
  const item = gameData.counters
    .find(c => c.counter === data.counter)
    .items.find(i => i.id === data.id);
  div.style.backgroundImage = `url(${item.image})`;
  div.dataset.itemId = data.id;
  div.dataset.counter = data.counter;
  counterDiv.appendChild(div);
});

function clearCounter() {
  counterDiv.innerHTML = "<p>Drop items here</p>";
}

// Done button
document.getElementById("doneBtn").addEventListener("click", () => {
  if (!currentRequest) return;

  const items = [...counterDiv.querySelectorAll(".item")];
  const correctNumber = items.length === currentRequest.number;
  const correctCategory = items.every(p => p.dataset.counter === currentRequest.counterObj.counter);

  if (correctNumber && correctCategory) {
    reactionDiv.innerHTML = `<img src="data/assets/ui/maru_ok.png" alt="OK" height="80">`;
    if (challengeMode) challengeScore++;
  } else {
    reactionDiv.innerHTML = `<img src="data/assets/ui/maru_wrong.png" alt="Wrong" height="80">`;
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
      setTimeout(newCustomer, 800);
    }
  } else {
    setTimeout(newCustomer, 800);
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
  settingsModal.style.display = "block";
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
});

voiceCheckbox.addEventListener("change", () => {
  voiceEnabled = voiceCheckbox.checked;
  localStorage.setItem("voiceEnabled", voiceEnabled);
});

window.addEventListener("click", (event) => {
  if (event.target === settingsModal) {
    settingsModal.style.display = "none";
  }
});
