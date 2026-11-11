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
    c => c && c.counter && c.readings && Array.isArray(c.items)
  );
  const byKey = new Map(counters.map(c => [c.counter, c]));
  const allItems = [];
  counters.forEach(counter => {
    counter.items.forEach(item => allItems.push({ item, counter }));
  });
  // `entries` = the things a counter can be asked about. A counter with no items of its
  // own (つ, 名) borrows every item that lists it under "also".
  counters.forEach(counter => {
    counter.entries = counter.items.length
      ? counter.items.map(item => ({ item, counter }))
      : allItems.filter(e => (e.item.also || []).includes(counter.counter));
  });
  // Abstract counters (時, 歳, 円…) have no objects to put on a shelf.
  const shelfItems = allItems.filter(e => !e.counter.abstract);
  return { counters: counters.filter(c => c.entries.length), byKey, allItems, shelfItems };
}

/** Highest number a counter is used with (つ stops at ten, 時 at twelve…). */
export function maxNumber(counter) {
  return Number.isFinite(counter.max) ? counter.max : 99;
}

/** Plain Sino-Japanese number, 1-99: じゅういち, にじゅう, さんじゅうご. */
export function sinoNumber(number) {
  if (number <= 10) return NUMBER_READINGS[number] || "";
  const tens = Math.floor(number / 10);
  const units = number % 10;
  return (tens > 1 ? NUMBER_READINGS[tens] : "") + "じゅう" + (units ? NUMBER_READINGS[units] : "");
}

/** The part of a number above ten that the last digit's reading attaches to: 13 → じゅう, 20 → に, 24 → にじゅう. */
function tensPrefix(number) {
  const tens = Math.floor(number / 10);
  const head = tens > 1 ? NUMBER_READINGS[tens] : "";
  return number % 10 ? head + "じゅう" : head;
}

/** The reading a beginner would guess: plain number + plain counter (e.g. いちほん). */
export function naiveReading(counter, number) {
  return sinoNumber(number) + counter.reading;
}

/**
 * All accepted readings for a number, standard reading first.
 * Above ten the last digit decides the reading (13本 = じゅう + さんぼん, 20本 = に + じゅっぽん);
 * `compound` overrides the digit's reading where the stand-alone one is not used (11人 = じゅう + いちにん).
 */
export function readingsFor(counter, number) {
  const explicit = counter.readings[String(number)];
  if (Array.isArray(explicit) && explicit.length) {
    const rare = counter.rare && counter.rare[String(number)];
    return rare ? [...explicit, ...rare] : explicit;
  }
  if (number <= 10 || number > maxNumber(counter)) return [];
  const digit = String(number % 10 || 10);
  const tails = (counter.compound && counter.compound[digit]) || counter.readings[digit] || [];
  const prefix = tensPrefix(number);
  return tails.map(tail => prefix + tail);
}

/**
 * The readings worth showing a learner. `rare` holds dated or disputed variants (さんば, みはこ…):
 * they are accepted when typed and never offered as wrong answers, but they are not taught.
 */
export function commonReadingsFor(counter, number) {
  const explicit = counter.readings[String(number)];
  return Array.isArray(explicit) && explicit.length ? explicit : readingsFor(counter, number);
}

/** The standard reading (e.g. さんぼん). */
export function primaryReading(counter, number) {
  return readingsFor(counter, number)[0];
}

/** True when the standard reading is not simply number + counter. */
export function isIrregular(counter, number) {
  return primaryReading(counter, number) !== naiveReading(counter, number);
}

const SINO_STEMS = ["いち", "いっ", "に", "さん", "よん", "ご", "ろく", "ろっ", "なな", "しち", "はち", "はっ", "きゅう", "じゅう", "じゅっ", "じっ"];

/** True for readings built on native numbers (ひとり, みっつ, とお…), where even recognising the number takes practice. */
export function hasNativeStem(counter, number) {
  const reading = primaryReading(counter, number);
  return !SINO_STEMS.some(stem => reading.startsWith(stem));
}

/** How to write an amount: 3本, 2人, 3つ, but 10 on its own for とお. */
export function amountText(counter, number) {
  const bare = counter.generic && !primaryReading(counter, number).endsWith(counter.reading);
  return bare ? String(number) : `${number}${counter.counter}`;
}

/**
 * True when the question itself says which counter to use, so only that counter's readings count:
 * the general counter つ, abstract counters, and counters practised on borrowed items (名 on people).
 */
export function isForced(round) {
  return Boolean(round.counter.generic || round.counter.abstract || round.counter !== round.entry.counter);
}

/** The readings that answer a round. */
export function roundReadings(data, round) {
  return isForced(round) ? readingsFor(round.counter, round.number) : acceptedReadingsForItem(data, round.entry, round.number);
}

/** Counter keys that are acceptable for an item: its home counter plus any alternatives. */
export function acceptedCounterKeys(entry) {
  return [entry.counter.counter, ...(entry.item.also || [])];
}

export function itemAccepts(entry, counterKey) {
  return acceptedCounterKeys(entry).includes(counterKey);
}

/** The readings to mention as "other ways to say it": common ones only, across the item's counters. */
export function commonReadingsForItem(data, entry, number) {
  const out = [];
  acceptedCounterKeys(entry).forEach(key => {
    const counter = data.byKey.get(key);
    if (!counter) return;
    commonReadingsFor(counter, number).forEach(r => {
      if (!out.includes(r)) out.push(r);
    });
  });
  return out;
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
export function pickRound({ data, activeCounters, stats, mode, maxNumber: limit = 10, lastCounterKey = null, rng = Math.random }) {
  if (!activeCounters || !activeCounters.length) return null;
  let pool = activeCounters;
  if (pool.length > 1 && lastCounterKey) {
    pool = pool.filter(c => c.counter !== lastCounterKey);
  }
  const counter = weightedPick(pool, c => counterWeight(stats[c.counter]), rng);
  let roundMode = mode === "mix" ? (rng() < 0.45 ? "serve" : "count") : mode;
  // A generic counter fits anything, so "which items take it?" has no answer: ask for a named item instead.
  if (counter.generic && roundMode === "serve") roundMode = mode === "mix" && rng() < 0.5 ? "count" : "order";
  // Abstract counters have nothing to put on the counter: they are always "how do you read this?".
  if (counter.abstract) roundMode = "count";
  // Nobody wants to click fourteen times: big numbers are for reading practice only.
  const top = Math.min(roundMode === "count" ? limit : Math.min(limit, 10), maxNumber(counter));
  const numbers = Array.from({ length: top }, (_, i) => i + 1);
  const number = weightedPick(numbers, n => numberWeight(counter, n, stats[counter.counter], roundMode), rng);
  if (mode === "mix" && roundMode === "count" && !counter.abstract && number <= 10 && hasNativeStem(counter, number) && rng() < 0.35) roundMode = "order";
  const entry = counter.entries[Math.floor(rng() * counter.entries.length)];
  return { mode: roundMode, counter, number, entry };
}

/**
 * Build the shelf for a "serve" round: at least one correct item, a few tempting
 * look-alikes from easily confused counters, and random filler.
 */
export function buildShelf({ data, round, activeCounters, size = 8, rng = Math.random }) {
  const key = round.counter.counter;
  const sameId = (a, b) => a.item.id === b.item.id;
  const shelf = [round.entry];

  if (round.mode === "order") {
    // The customer names the item, so the shelf just needs other things to choose from.
    for (const entry of shuffle(data.shelfItems, rng)) {
      if (shelf.length >= size) break;
      if (!shelf.some(e => sameId(e, entry))) shelf.push(entry);
    }
    return shuffle(shelf, rng);
  }

  // One more correct option when available, so the answer is not always a single tile.
  const otherCorrect = shuffle(
    data.shelfItems.filter(e => itemAccepts(e, key) && !sameId(e, round.entry)),
    rng
  );
  if (otherCorrect.length && rng() < 0.7) shelf.push(otherCorrect[0]);

  const activeKeys = new Set((activeCounters || data.counters).map(c => c.counter));
  const wrong = data.shelfItems.filter(e => !itemAccepts(e, key));
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
  const wrongItems = tray
    .filter(t => (round.mode === "order" ? t.entry.item.id !== round.entry.item.id : !itemAccepts(t.entry, key)))
    .map(t => t.entry);
  const numberOk = total === round.number;
  const itemsOk = wrongItems.length === 0;
  return { correct: numberOk && itemsOk && total > 0, numberOk, itemsOk, total, wrongItems };
}

/** Plausible-but-wrong readings produced by mis-applying sound changes (e.g. さんほん, さんぽん). */
export function soundAlikeDistractors(counter, number) {
  if (number > 10) {
    // Above ten, the mistakes are the last digit's mistakes (じゅうさんほん), plus keeping
    // a stand-alone reading where it no longer applies (じゅうひとり).
    const digit = number % 10 || 10;
    const prefix = tensPrefix(number);
    const accepted = new Set(readingsFor(counter, number));
    const tails = [...soundAlikeDistractors(counter, digit), primaryReading(counter, digit)];
    return [...new Set([naiveReading(counter, number), ...tails.map(tail => prefix + tail)])].filter(r => !accepted.has(r));
  }
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
  const forced = isForced(round); // the question says which counter to use
  const accepted = new Set(roundReadings(data, round));
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
  ordered.slice(0, forced ? 1 : Math.min(2, size - 2)).forEach(r => add(r, counter.counter));

  // Native readings (ひとつ/ふたつ, みっつ/むっつ, ひとり/ふたり) are easy to mix up with each other.
  const sameCounterOnly = counter.generic || counter.abstract;
  if (sameCounterOnly || hasNativeStem(counter, number)) {
    const native = Array.from({ length: 10 }, (_, i) => i + 1).filter(n => n !== number && hasNativeStem(counter, n));
    shuffle(native, rng).slice(0, sameCounterOnly ? 2 : 1).forEach(n => add(primaryReading(counter, n), counter.counter));
  }
  if (sameCounterOnly) {
    // No other counter makes sense here, so fill up with this counter's readings for nearby numbers.
    const top = maxNumber(counter);
    const nearby = shuffle([-3, -2, -1, 1, 2, 3].map(d => number + d).filter(n => n >= 1 && n <= top), rng);
    const rest = shuffle(Array.from({ length: Math.min(top, 20) }, (_, i) => i + 1).filter(n => n !== number), rng);
    [...nearby, ...rest].forEach(n => add(primaryReading(counter, n), counter.counter));
  }

  // Fill the rest with "wrong counter" options, easily confused counters first.
  const acceptedKeys = acceptedCounterKeys(entry);
  const others = data.counters.filter(c => !c.generic && !c.abstract && !acceptedKeys.includes(c.counter) && number <= maxNumber(c));
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

/* ---------- Lesson path and spaced repetition ---------- */

// Each "card" is one thing worth remembering:
//   use:本       what the counter is used for
//   read:本:reg  its regular readings (にほん, よんほん…): one card, a random number each time
//   read:本:3    one card per irregular reading (さんぼん)
// Cards live in Leitner boxes; a card in box n comes back after BOX_HOURS[n].
export const BOX_HOURS = [0, 4, 24, 96, 240, 600, 1440, 3600];
const HOUR = 3600 * 1000;
const NUMBERS = Array.from({ length: 10 }, (_, i) => i + 1);

//   read:本:teens  numbers above ten (じゅういっぽん, にじゅっぽん): one card, a random number each time
//   read:歳:20     one card per special reading above ten (はたち)
// The last two are "advanced": they only appear once the counter's basic cards have stuck.

/** Numbers above ten with a reading of their own in the data (20日 はつか, 20歳 はたち). */
export function specialNumbers(counter) {
  return Object.keys(counter.readings).map(Number).filter(n => n > 10).sort((a, b) => a - b);
}

/** Numbers used to practise "above ten": the teens, 20, and a few bigger ones. */
export function bigNumbers(counter) {
  const special = new Set(specialNumbers(counter));
  return [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 24, 30, 40].filter(n => n <= maxNumber(counter) && !special.has(n));
}

export function basicCardIds(counter) {
  const key = counter.counter;
  const ids = [];
  if (!counter.generic && !counter.abstract) ids.push(`use:${key}`);
  if (NUMBERS.some(n => !isIrregular(counter, n))) ids.push(`read:${key}:reg`);
  NUMBERS.filter(n => isIrregular(counter, n)).forEach(n => ids.push(`read:${key}:${n}`));
  return ids;
}

export function advancedCardIds(counter) {
  const key = counter.counter;
  const ids = [];
  // Above ten is only worth a card where the reading changes somewhere (じゅういちまい is no surprise).
  if (bigNumbers(counter).length && NUMBERS.some(n => isIrregular(counter, n))) ids.push(`read:${key}:teens`);
  specialNumbers(counter).forEach(n => ids.push(`read:${key}:${n}`));
  return ids;
}

export function cardIds(counter) {
  return [...basicCardIds(counter), ...advancedCardIds(counter)];
}

/** Advanced cards open up once every basic card of the counter has been recalled at least once. */
export function advancedReady(counter, progress) {
  return basicCardIds(counter).every(id => progress.cards[id] && progress.cards[id].box >= 2);
}

export function parseCard(id) {
  const [type, counterKey, which] = String(id).split(":");
  return { type, counterKey, which };
}

/** The card a finished round was testing. */
export function cardForRound(round) {
  const key = round.counter.counter;
  if (round.mode === "serve") return `use:${key}`;
  if (round.number > 10) {
    return specialNumbers(round.counter).includes(round.number) ? `read:${key}:${round.number}` : `read:${key}:teens`;
  }
  return isIrregular(round.counter, round.number) ? `read:${key}:${round.number}` : `read:${key}:reg`;
}

export function emptyProgress() {
  return { cards: {}, unlocked: [], priority: [], day: { last: null, streak: 0 }, shifts: 0 };
}

export function normalizeProgress(saved, data) {
  const progress = emptyProgress();
  if (!saved || typeof saved !== "object") return progress;
  const valid = new Set(data.counters.flatMap(cardIds));
  Object.entries(saved.cards && typeof saved.cards === "object" ? saved.cards : {}).forEach(([id, card]) => {
    if (!valid.has(id) || !card || typeof card !== "object") return;
    const box = Number.isFinite(card.box) ? Math.min(BOX_HOURS.length - 1, Math.max(0, Math.floor(card.box))) : 0;
    progress.cards[id] = { box, due: Number.isFinite(card.due) ? card.due : 0 };
  });
  const keys = list => (Array.isArray(list) ? [...new Set(list)].filter(k => data.byKey.has(k) && data.counters.includes(data.byKey.get(k))) : []);
  progress.unlocked = keys(saved.unlocked);
  // A counter with cards must be unlocked, whatever the saved list says.
  Object.keys(progress.cards).forEach(id => {
    const key = parseCard(id).counterKey;
    if (!progress.unlocked.includes(key)) progress.unlocked.push(key);
  });
  progress.priority = keys(saved.priority).filter(k => !progress.unlocked.includes(k));
  if (saved.day && typeof saved.day === "object") {
    progress.day = {
      last: typeof saved.day.last === "string" ? saved.day.last : null,
      streak: Number.isFinite(saved.day.streak) ? Math.max(0, Math.floor(saved.day.streak)) : 0
    };
  }
  progress.shifts = Number.isFinite(saved.shifts) ? Math.max(0, Math.floor(saved.shifts)) : 0;
  return progress;
}

/** Counters not yet introduced, in the order they will be taught. */
export function lockedCounters(data, progress, alsoUnlocked = []) {
  const open = new Set([...progress.unlocked, ...alsoUnlocked]);
  const locked = data.counters.filter(c => !open.has(c.counter));
  const priority = progress.priority || [];
  const rank = c => (priority.includes(c.counter) ? priority.indexOf(c.counter) : priority.length);
  return locked.map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i).map(x => x.c);
}

/**
 * The next never-seen card: from a counter already being learned if there is one,
 * otherwise the first card of the next counter (which then needs a lesson first).
 * @returns {{cardId, unlock: string|null}|null}
 */
export function nextNewCard(data, progress, { pending = new Set(), pendingUnlocks = [] } = {}) {
  for (const key of [...progress.unlocked, ...pendingUnlocks]) {
    const counter = data.byKey.get(key);
    if (!counter) continue;
    const cardId = basicCardIds(counter).find(id => !progress.cards[id] && !pending.has(id));
    if (cardId) return { cardId, unlock: null };
  }
  // Nothing basic left in the counters under way: deepen one that has stuck…
  for (const key of progress.unlocked) {
    const counter = data.byKey.get(key);
    if (!counter || !advancedReady(counter, progress)) continue;
    const cardId = advancedCardIds(counter).find(id => !progress.cards[id] && !pending.has(id));
    if (cardId) return { cardId, unlock: null };
  }
  // …or start the next counter.
  const next = lockedCounters(data, progress, pendingUnlocks)[0];
  return next ? { cardId: cardIds(next)[0], unlock: next.counter } : null;
}

export function dueCards(progress, now) {
  return Object.entries(progress.cards).filter(([, card]) => card.due <= now).sort((a, b) => a[1].due - b[1].due).map(([id]) => id);
}

/** When the next review comes due (null if nothing is scheduled). */
export function nextDueTime(progress, now) {
  const later = Object.values(progress.cards).map(c => c.due).filter(due => due > now);
  return later.length ? Math.min(...later) : null;
}

/**
 * Plan a shift: reviews that are due, then a little new material, then extra practice to fill up.
 * @returns [{kind: "lesson", counterKey} | {kind: "card", cardId, isNew, early}]
 */
export function buildShift({ data, progress, now, size = 12, maxNew = 5, minNew = 3, maxUnlocks = 2, rng = Math.random }) {
  const allDue = dueCards(progress, now);
  const due = shuffle(allDue.slice(0, size), rng);
  const steps = due.map(cardId => ({ kind: "card", cardId, isNew: false, early: false }));

  // Don't pile new material onto a learner who is still shaky on what they have, or far behind
  // on reviews. Otherwise every shift moves forward a little, even on a busy review day.
  const shaky = Object.values(progress.cards).filter(card => card.box <= 1).length;
  const behind = allDue.length > 2 * size;
  let budget = shaky > 10 || behind ? 0 : Math.max(minNew, Math.min(maxNew, size - due.length));
  const pending = new Set();
  const pendingUnlocks = [];
  while (budget > 0) {
    const next = nextNewCard(data, progress, { pending, pendingUnlocks });
    if (!next) break;
    if (next.unlock) {
      if (pendingUnlocks.length >= maxUnlocks) break;
      pendingUnlocks.push(next.unlock);
      steps.push({ kind: "lesson", counterKey: next.unlock });
    }
    pending.add(next.cardId);
    steps.push({ kind: "card", cardId: next.cardId, isNew: true, early: false });
    budget -= 1;
  }

  const planned = new Set(steps.filter(s => s.kind === "card").map(s => s.cardId));
  const extras = Object.entries(progress.cards)
    .filter(([id]) => !planned.has(id))
    .sort((a, b) => a[1].box - b[1].box || a[1].due - b[1].due)
    .slice(0, Math.max(0, size - planned.size))
    .map(([cardId]) => ({ kind: "card", cardId, isNew: false, early: true }));
  return [...steps, ...shuffle(extras, rng)];
}

/**
 * Move a card between boxes after an answer.
 * `retry` = the card was already missed earlier in this shift.
 */
export function gradeCard(progress, cardId, correct, now, { retry = false } = {}) {
  const existing = progress.cards[cardId];
  const card = existing || { box: 0, due: now };
  const top = BOX_HOURS.length - 1;
  if (!correct) {
    card.box = Math.max(1, Math.floor(card.box / 2));
    card.due = now;
  } else if (!existing) {
    card.box = 3; // known at first sight: no need to drill it today
    card.due = now + BOX_HOURS[3] * HOUR;
  } else if (retry) {
    card.box = Math.max(1, card.box);
    card.due = now + BOX_HOURS[1] * HOUR;
  } else if (card.due <= now) {
    card.box = Math.min(top, card.box + 1);
    card.due = now + BOX_HOURS[card.box] * HOUR;
  } // answered correctly before it was due: leave the schedule alone
  progress.cards[cardId] = card;
  return card;
}

/** 0-3 stars for a counter; null while it is still locked. */
export function counterStars(counter, progress) {
  if (!progress.unlocked.includes(counter.counter)) return null;
  const ids = cardIds(counter);
  const boxes = ids.map(id => (progress.cards[id] ? progress.cards[id].box : 0));
  const seen = ids.filter(id => progress.cards[id]).length;
  if (!seen) return 0;
  const average = boxes.reduce((a, b) => a + b, 0) / ids.length;
  if (seen === ids.length && average >= 4) return 3;
  if (seen === ids.length && average >= 2.5) return 2;
  return 1;
}

/** Turn a card into a concrete question. */
export function roundForCard(data, cardId, rng = Math.random) {
  const { type, counterKey, which } = parseCard(cardId);
  const counter = data.byKey.get(counterKey);
  if (!counter || !counter.entries || !counter.entries.length) return null;
  const entry = counter.entries[Math.floor(rng() * counter.entries.length)];
  if (type === "use") {
    return { mode: "serve", counter, number: 1 + Math.floor(rng() * 6), entry, cardId };
  }
  let number = Number(which);
  if (which === "reg") {
    const regular = NUMBERS.filter(n => !isIrregular(counter, n));
    number = regular[Math.floor(rng() * regular.length)];
  } else if (which === "teens") {
    number = weightedPick(bigNumbers(counter), n => (isIrregular(counter, n) ? 3 : 1), rng);
  }
  const canOrder = !counter.abstract && number <= 10 && hasNativeStem(counter, number);
  const mode = canOrder && rng() < 0.4 ? "order" : "count";
  return { mode, counter, number, entry, cardId };
}

/** Days-in-a-row counter. Dates are local "YYYY-MM-DD" strings. */
export function updateDayStreak(day, today, yesterday) {
  if (day.last === today) return { last: today, streak: Math.max(1, day.streak) };
  return { last: today, streak: day.last === yesterday ? day.streak + 1 : 1 };
}
