// Pure game logic for Maru's Counter Shop.
// Nothing in here touches the DOM, so it can be unit-tested with `node --test`.

const NUMBER_READINGS = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう", "じゅう"];

// Numbers whose stem can contract to a small っ before certain sounds.
const GEMINATED_STEMS = { 1: "いっ", 6: "ろっ", 8: "はっ", 10: "じゅっ" };

// Voiced / half-voiced variants of the first kana of a counter (rendaku candidates).
const SOUND_VARIANTS = {
  は: ["ば", "ぱ"], ひ: ["び", "ぴ"], ふ: ["ぶ", "ぷ"], へ: ["べ", "ぺ"], ほ: ["ぼ", "ぽ"],
  か: ["が"], き: ["ぎ"], く: ["ぐ"], け: ["げ"], こ: ["ご"],
  さ: ["ざ"], し: ["じ"], す: ["ず"], せ: ["ぜ"], そ: ["ぞ"],
  た: ["だ"], と: ["ど"]
};

// Kana that a small っ can naturally precede.
const CAN_FOLLOW_SOKUON = new Set([..."かきくけこさしすせそたちつてとぱぴぷぺぽ"]);

/* ---------- Data helpers ---------- */

/** Validate and index the raw JSON. Returns { counters, byKey, allItems }. */
export function prepareData(raw) {
  const counters = (raw && Array.isArray(raw.counters) ? raw.counters : []).filter(
    c => c && c.counter && c.readings && Array.isArray(c.items) && c.items.length
  );
  const byKey = new Map(counters.map(c => [c.counter, c]));
  const allItems = [];
  counters.forEach(counter => {
    counter.items.forEach(item => allItems.push({ item, counter }));
  });
  return { counters, byKey, allItems };
}

/** The reading a beginner would guess: plain number + plain counter (e.g. いちほん). */
export function naiveReading(counter, number) {
  return NUMBER_READINGS[number] + counter.reading;
}

/** All accepted readings for a number, standard reading first. */
export function readingsFor(counter, number) {
  const list = counter.readings[String(number)];
  return Array.isArray(list) && list.length ? list : [naiveReading(counter, number)];
}

/** The standard reading (e.g. さんぼん). */
export function primaryReading(counter, number) {
  return readingsFor(counter, number)[0];
}

/** True when the standard reading is not simply number + counter. */
export function isIrregular(counter, number) {
  return primaryReading(counter, number) !== naiveReading(counter, number);
}

/** Counter keys that are acceptable for an item: its home counter plus any alternatives. */
export function acceptedCounterKeys(entry) {
  return [entry.counter.counter, ...(entry.item.also || [])];
}

export function itemAccepts(entry, counterKey) {
  return acceptedCounterKeys(entry).includes(counterKey);
}

/** Every reading that is a correct way to count `number` of this item. */
export function acceptedReadingsForItem(data, entry, number) {
  const out = [];
  acceptedCounterKeys(entry).forEach(key => {
    const counter = data.byKey.get(key);
    if (!counter) return;
    readingsFor(counter, number).forEach(r => {
      if (!out.includes(r)) out.push(r);
    });
  });
  return out;
}

/* ---------- Randomness helpers ---------- */

export function shuffle(list, rng = Math.random) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function weightedPick(list, weightFn, rng = Math.random) {
  if (!list.length) return undefined;
  const weights = list.map(x => Math.max(0, weightFn(x)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return list[Math.floor(rng() * list.length)];
  let roll = rng() * total;
  for (let i = 0; i < list.length; i++) {
    roll -= weights[i];
    if (roll < 0) return list[i];
  }
  return list[list.length - 1];
}

/* ---------- Progress tracking ---------- */

export function emptyStat() {
  return { correct: 0, incorrect: 0, nums: {} };
}

/** Clean up whatever was in localStorage (including the old {correct, incorrect} format). */
export function normalizeStats(saved, counterKeys) {
  const stats = {};
  const source = saved && typeof saved === "object" ? saved : {};
  const count = v => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  counterKeys.forEach(key => {
    const old = source[key];
    const stat = emptyStat();
    if (old && typeof old === "object") {
      stat.correct = count(old.correct);
      stat.incorrect = count(old.incorrect);
      if (old.nums && typeof old.nums === "object") {
        Object.entries(old.nums).forEach(([n, v]) => {
          if (v && typeof v === "object") {
            stat.nums[n] = { correct: count(v.correct), incorrect: count(v.incorrect) };
          }
        });
      }
    }
    stats[key] = stat;
  });
  return stats;
}

export function recordResult(stats, counterKey, number, wasCorrect) {
  const stat = stats[counterKey] || (stats[counterKey] = emptyStat());
  const num = stat.nums[number] || (stat.nums[number] = { correct: 0, incorrect: 0 });
  const field = wasCorrect ? "correct" : "incorrect";
  stat[field] += 1;
  num[field] += 1;
}

export function accuracy(stat) {
  const total = stat ? stat.correct + stat.incorrect : 0;
  return total ? stat.correct / total : null;
}

/** A label for how well a counter is known. */
export function masteryLevel(stat) {
  const total = stat ? stat.correct + stat.incorrect : 0;
  if (!total) return "new";
  const acc = stat.correct / total;
  if (total >= 12 && acc >= 0.9) return "mastered";
  if (total >= 5 && acc >= 0.75) return "strong";
  return "learning";
}

/** Counters that are new or often missed come up more often. */
export function counterWeight(stat) {
  const correct = stat ? stat.correct : 0;
  const total = stat ? stat.correct + stat.incorrect : 0;
  const smoothed = (correct + 1) / (total + 2);
  return 1 + 3 * (1 - smoothed) + (total < 3 ? 1 : 0);
}

/** Numbers with a sound change, and numbers missed before, come up more often. */
export function numberWeight(counter, number, stat, mode) {
  let weight = 1;
  if (isIrregular(counter, number)) weight *= mode === "count" ? 2.5 : 1.5;
  const num = stat && stat.nums ? stat.nums[number] : null;
  if (num && num.incorrect) {
    weight *= 1 + (2 * num.incorrect) / (num.correct + num.incorrect);
  }
  return weight;
}

/* ---------- Round generation ---------- */

/**
 * Choose what to ask next.
 * @returns {{mode, counter, number, entry}|null}
 */
export function pickRound({ data, activeCounters, stats, mode, maxNumber = 10, lastCounterKey = null, rng = Math.random }) {
  if (!activeCounters || !activeCounters.length) return null;
  let pool = activeCounters;
  if (pool.length > 1 && lastCounterKey) {
    pool = pool.filter(c => c.counter !== lastCounterKey);
  }
  const counter = weightedPick(pool, c => counterWeight(stats[c.counter]), rng);
  const numbers = Array.from({ length: maxNumber }, (_, i) => i + 1);
  const number = weightedPick(numbers, n => numberWeight(counter, n, stats[counter.counter], mode), rng);
  const item = counter.items[Math.floor(rng() * counter.items.length)];
  return { mode, counter, number, entry: { item, counter } };
}

/**
 * Build the shelf for a "serve" round: at least one correct item, a few tempting
 * look-alikes from easily confused counters, and random filler.
 */
export function buildShelf({ data, round, activeCounters, size = 8, rng = Math.random }) {
  const key = round.counter.counter;
  const sameId = (a, b) => a.item.id === b.item.id;
  const shelf = [round.entry];

  // One more correct option when available, so the answer is not always a single tile.
  const otherCorrect = shuffle(
    data.allItems.filter(e => itemAccepts(e, key) && !sameId(e, round.entry)),
    rng
  );
  if (otherCorrect.length && rng() < 0.7) shelf.push(otherCorrect[0]);

  const activeKeys = new Set((activeCounters || data.counters).map(c => c.counter));
  const wrong = data.allItems.filter(e => !itemAccepts(e, key));
  const confusable = new Set(round.counter.confusable || []);
  const tiers = [
    wrong.filter(e => confusable.has(e.counter.counter) && activeKeys.has(e.counter.counter)),
    wrong.filter(e => activeKeys.has(e.counter.counter)),
    wrong
  ];
  const limits = [3, size, size];
  tiers.forEach((tier, i) => {
    let added = 0;
    for (const entry of shuffle(tier, rng)) {
      if (shelf.length >= size || added >= limits[i]) break;
      if (shelf.some(e => sameId(e, entry))) continue;
      shelf.push(entry);
      added++;
    }
  });
  return shuffle(shelf, rng);
}

/**
 * Check a "serve" answer.
 * @param tray list of { entry, count }
 */
export function checkServe(round, tray) {
  const key = round.counter.counter;
  const total = tray.reduce((sum, t) => sum + t.count, 0);
  const wrongItems = tray.filter(t => !itemAccepts(t.entry, key)).map(t => t.entry);
  const numberOk = total === round.number;
  const itemsOk = wrongItems.length === 0;
  return { correct: numberOk && itemsOk && total > 0, numberOk, itemsOk, total, wrongItems };
}

/** Plausible-but-wrong readings produced by mis-applying sound changes (e.g. さんほん, さんぽん). */
export function soundAlikeDistractors(counter, number) {
  const base = counter.reading;
  const first = base[0];
  const rest = base.slice(1);
  const plainStem = NUMBER_READINGS[number];
  const tightStem = GEMINATED_STEMS[number];
  const heads = [first, ...(SOUND_VARIANTS[first] || [])];
  const out = [];
  heads.forEach(head => {
    out.push(plainStem + head + rest);
    if (tightStem && CAN_FOLLOW_SOKUON.has(head)) out.push(tightStem + head + rest);
  });
  const accepted = new Set(readingsFor(counter, number));
  return [...new Set(out)].filter(r => !accepted.has(r));
}

/**
 * Multiple-choice options for a "count" round.
 * @returns [{ reading, counterKey, correct }]
 */
export function buildChoices({ data, round, size = 4, rng = Math.random }) {
  const { counter, number, entry } = round;
  const accepted = new Set(acceptedReadingsForItem(data, entry, number));
  const correct = { reading: primaryReading(counter, number), counterKey: counter.counter, correct: true };
  const choices = [correct];
  const used = new Set(accepted);
  const add = (reading, counterKey) => {
    if (choices.length >= size || used.has(reading)) return;
    used.add(reading);
    choices.push({ reading, counterKey, correct: false });
  };

  // Up to two "right counter, wrong sound" options, the beginner's guess first.
  const naive = naiveReading(counter, number);
  const alike = soundAlikeDistractors(counter, number);
  const ordered = [...alike.filter(r => r === naive), ...shuffle(alike.filter(r => r !== naive), rng)];
  ordered.slice(0, Math.min(2, size - 2)).forEach(r => add(r, counter.counter));

  // Fill the rest with "wrong counter" options, easily confused counters first.
  const acceptedKeys = acceptedCounterKeys(entry);
  const others = data.counters.filter(c => !acceptedKeys.includes(c.counter));
  const confusable = new Set(counter.confusable || []);
  const preferred = shuffle(others.filter(c => confusable.has(c.counter)), rng);
  const remaining = shuffle(others.filter(c => !confusable.has(c.counter)), rng);
  [...preferred, ...remaining].forEach(c => add(primaryReading(c, number), c.counter));

  return shuffle(choices, rng);
}

/* ---------- Typed answers ---------- */

const ROMAJI = (() => {
  const table = {
    a: "あ", i: "い", u: "う", e: "え", o: "お",
    shi: "し", chi: "ち", tsu: "つ", fu: "ふ", ji: "じ", di: "ぢ", du: "づ", wo: "を",
    sha: "しゃ", shu: "しゅ", sho: "しょ", she: "しぇ", cha: "ちゃ", chu: "ちゅ", cho: "ちょ", che: "ちぇ",
    ja: "じゃ", ju: "じゅ", jo: "じょ", je: "じぇ", jya: "じゃ", jyu: "じゅ", jyo: "じょ",
    tya: "ちゃ", tyu: "ちゅ", tyo: "ちょ", cya: "ちゃ", cyu: "ちゅ", cyo: "ちょ",
    sya: "しゃ", syu: "しゅ", syo: "しょ", zya: "じゃ", zyu: "じゅ", zyo: "じょ",
    si: "し", ti: "ち", tu: "つ", hu: "ふ", zi: "じ",
    wa: "わ", fa: "ふぁ", fi: "ふぃ", fe: "ふぇ", fo: "ふぉ", "-": "ー"
  };
  const rows = {
    k: "かきくけこ", s: "さしすせそ", t: "たちつてと", n: "なにぬねの", h: "はひふへほ", m: "まみむめも",
    r: "らりるれろ", g: "がぎぐげご", z: "ざじずぜぞ", d: "だぢづでど", b: "ばびぶべぼ", p: "ぱぴぷぺぽ"
  };
  Object.entries(rows).forEach(([c, kana]) => {
    [..."aiueo"].forEach((v, i) => {
      if (!table[c + v]) table[c + v] = kana[i];
    });
    table[c + "ya"] = table[c + "ya"] || kana[1] + "ゃ";
    table[c + "yu"] = table[c + "yu"] || kana[1] + "ゅ";
    table[c + "yo"] = table[c + "yo"] || kana[1] + "ょ";
  });
  Object.assign(table, { ya: "や", yu: "ゆ", yo: "よ" });
  return table;
})();

/**
 * Convert romaji to hiragana. Kana already in the text is left alone.
 * `doubleN` controls how "nn" is read: true = typing style (nn → ん), false = Hepburn (n + n…).
 */
export function romajiToHiragana(text, { doubleN = false, final = true } = {}) {
  const s = String(text || "").toLowerCase();
  let out = "";
  let i = 0;
  const isVowel = ch => "aiueo".includes(ch);
  while (i < s.length) {
    const ch = s[i];
    const next = s[i + 1];
    if (ch === "n") {
      if (next === "'") { out += "ん"; i += 2; continue; }
      if (next === "n" && doubleN) { out += "ん"; i += 2; continue; }
      if (next === undefined) { out += final ? "ん" : "n"; i += 1; continue; }
      if (!isVowel(next) && next !== "y") { out += "ん"; i += 1; continue; }
    }
    // Doubled consonant (or Hepburn "tch") → small っ
    if (/[a-z]/.test(ch) && !isVowel(ch) && ch !== "n" && next && (next === ch || (ch === "t" && next === "c"))) {
      out += "っ";
      i += 1;
      continue;
    }
    let matched = false;
    for (const len of [3, 2, 1]) {
      const chunk = s.slice(i, i + len);
      if (ROMAJI[chunk]) {
        out += ROMAJI[chunk];
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) { out += ch; i += 1; }
  }
  return out;
}

export function katakanaToHiragana(text) {
  return String(text || "").replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/** Normalise typed input (romaji, katakana, stray spaces/punctuation) to plain hiragana candidates. */
export function normalizeTypedAnswer(text) {
  const cleaned = katakanaToHiragana(String(text || "").normalize("NFKC")).replace(/[\s。、.,!?！？「」]/g, "");
  const candidates = new Set([
    romajiToHiragana(cleaned, { doubleN: false }),
    romajiToHiragana(cleaned, { doubleN: true })
  ]);
  return [...candidates];
}

export function checkTypedAnswer(text, acceptedReadings) {
  const accepted = new Set(acceptedReadings);
  return normalizeTypedAnswer(text).some(candidate => accepted.has(candidate));
}
