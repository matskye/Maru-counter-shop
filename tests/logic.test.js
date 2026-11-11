import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  prepareData, naiveReading, primaryReading, readingsFor, isIrregular, acceptedReadingsForItem,
  itemAccepts, pickRound, buildShelf, checkServe, buildChoices, soundAlikeDistractors,
  romajiToHiragana, checkTypedAnswer, normalizeStats, recordResult, counterWeight, masteryLevel
} from "../js/logic.js";

const raw = JSON.parse(readFileSync(new URL("../data/counters.json", import.meta.url), "utf8"));
const data = prepareData(raw);
const C = key => data.byKey.get(key);
const entryOf = id => data.allItems.find(e => e.item.id === id);

// Small deterministic PRNG so failures are reproducible.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("data: every counter has readings 1-10, hiragana only, and existing images", () => {
  assert.ok(data.counters.length >= 10);
  const ids = new Set();
  for (const c of data.counters) {
    for (let n = 1; n <= 10; n++) {
      const list = c.readings[String(n)];
      assert.ok(Array.isArray(list) && list.length, `${c.counter} ${n}`);
      for (const r of list) assert.match(r, /^[ぁ-ゖ]+$/, `${c.counter} ${n}: ${r}`);
      assert.equal(new Set(list).size, list.length, `${c.counter} ${n} has duplicates`);
    }
    for (const key of c.confusable || []) assert.ok(C(key), `${c.counter} confusable ${key}`);
    for (const item of c.items) {
      assert.ok(!ids.has(item.id), `duplicate item id ${item.id}`);
      ids.add(item.id);
      assert.ok(item.label_en && item.label_ja && item.kana, item.id);
      assert.ok(existsSync(new URL("../" + item.image, import.meta.url)), `missing image ${item.image}`);
      for (const key of item.also || []) assert.ok(C(key), `${item.id} also ${key}`);
    }
  }
});

test("readings: well-known irregular forms", () => {
  const expect = {
    本: { 1: "いっぽん", 2: "にほん", 3: "さんぼん", 6: "ろっぽん", 8: "はっぽん", 10: "じゅっぽん" },
    匹: { 1: "いっぴき", 3: "さんびき", 4: "よんひき", 6: "ろっぴき" },
    人: { 1: "ひとり", 2: "ふたり", 3: "さんにん", 4: "よにん" },
    個: { 1: "いっこ", 6: "ろっこ", 10: "じゅっこ" },
    杯: { 1: "いっぱい", 3: "さんばい" },
    冊: { 1: "いっさつ", 8: "はっさつ" },
    枚: { 1: "いちまい", 4: "よんまい" },
    軒: { 3: "さんげん" },
    頭: { 1: "いっとう" }
  };
  for (const [key, table] of Object.entries(expect)) {
    for (const [n, reading] of Object.entries(table)) {
      assert.equal(primaryReading(C(key), Number(n)), reading);
    }
  }
  assert.equal(naiveReading(C("本"), 3), "さんほん");
  assert.ok(isIrregular(C("本"), 3));
  assert.ok(!isIrregular(C("本"), 2));
  assert.ok(readingsFor(C("本"), 10).includes("じっぽん"));
});

test("items can be counted with more than one counter", () => {
  assert.ok(itemAccepts(entryOf("shirt"), "枚"));
  assert.ok(itemAccepts(entryOf("shirt"), "着"));
  assert.ok(!itemAccepts(entryOf("shirt"), "本"));
  const readings = acceptedReadingsForItem(data, entryOf("soda_can"), 1);
  assert.deepEqual(new Set(readings), new Set(["いっかん", "いっぽん", "いっこ"]));
});

test("sound-alike distractors are never an accepted reading", () => {
  for (const c of data.counters) {
    for (let n = 1; n <= 10; n++) {
      const accepted = new Set(readingsFor(c, n));
      for (const d of soundAlikeDistractors(c, n)) {
        assert.ok(!accepted.has(d), `${c.counter} ${n}: ${d}`);
        assert.doesNotMatch(d, /っ[はひふへほまみむめもなにぬねのわ]/, `${d} is not pronounceable`);
      }
    }
  }
  assert.ok(soundAlikeDistractors(C("本"), 3).includes("さんほん"));
  assert.ok(soundAlikeDistractors(C("本"), 3).includes("さんぽん"));
  assert.ok(soundAlikeDistractors(C("人"), 4).includes("よんにん"));
});

test("rounds, shelves and choices are always solvable and unambiguous", () => {
  const rng = seeded(42);
  const stats = normalizeStats({}, data.counters.map(c => c.counter));
  let last = null;
  for (let i = 0; i < 3000; i++) {
    const mode = i % 2 ? "serve" : "count";
    const round = pickRound({ data, activeCounters: data.counters, stats, mode, maxNumber: 10, lastCounterKey: last, rng });
    assert.ok(round.number >= 1 && round.number <= 10);
    assert.notEqual(round.counter.counter, last);
    last = round.counter.counter;

    const shelf = buildShelf({ data, round, activeCounters: data.counters, size: 8, rng });
    assert.equal(shelf.length, 8);
    assert.equal(new Set(shelf.map(e => e.item.id)).size, 8);
    assert.ok(shelf.some(e => e.item.id === round.entry.item.id));
    assert.ok(shelf.some(e => !itemAccepts(e, round.counter.counter)));

    const choices = buildChoices({ data, round, size: 4, rng });
    assert.equal(choices.length, 4);
    assert.equal(choices.filter(c => c.correct).length, 1);
    assert.equal(new Set(choices.map(c => c.reading)).size, 4);
    const accepted = new Set(acceptedReadingsForItem(data, round.entry, round.number));
    for (const choice of choices) {
      assert.equal(accepted.has(choice.reading), choice.correct, `${round.entry.item.id} x${round.number}: ${choice.reading}`);
    }
  }
});

test("a single enabled counter still produces rounds", () => {
  const stats = {};
  const round = pickRound({ data, activeCounters: [C("人")], stats, mode: "serve", lastCounterKey: "人", rng: seeded(1) });
  assert.equal(round.counter.counter, "人");
  assert.equal(pickRound({ data, activeCounters: [], stats, mode: "serve" }), null);
});

test("checkServe", () => {
  const round = { counter: C("本"), number: 3, entry: entryOf("pencil") };
  const ok = checkServe(round, [{ entry: entryOf("pencil"), count: 2 }, { entry: entryOf("soda_can"), count: 1 }]);
  assert.ok(ok.correct);
  const wrongNumber = checkServe(round, [{ entry: entryOf("pencil"), count: 2 }]);
  assert.deepEqual([wrongNumber.correct, wrongNumber.numberOk, wrongNumber.itemsOk], [false, false, true]);
  const wrongItem = checkServe(round, [{ entry: entryOf("pencil"), count: 2 }, { entry: entryOf("cat"), count: 1 }]);
  assert.deepEqual([wrongItem.correct, wrongItem.numberOk, wrongItem.itemsOk], [false, true, false]);
  assert.equal(wrongItem.wrongItems[0].item.id, "cat");
  assert.equal(checkServe(round, []).correct, false);
});

test("romaji conversion and typed answers", () => {
  const cases = {
    sanbon: "さんぼん", ippon: "いっぽん", roppiki: "ろっぴき", juppon: "じゅっぽん", jippon: "じっぽん",
    hitori: "ひとり", futari: "ふたり", hutari: "ふたり", yonin: "よにん", sannin: "さんにん",
    icchaku: "いっちゃく", itchaku: "いっちゃく", kyuuhon: "きゅうほん", shichinin: "しちにん",
    hassatsu: "はっさつ", sanzoku: "さんぞく", hitofukuro: "ひとふくろ", nihon: "にほん", "san'en": "さんえん"
  };
  for (const [romaji, kana] of Object.entries(cases)) assert.equal(romajiToHiragana(romaji), kana, romaji);
  assert.equal(romajiToHiragana("san", { final: false }), "さn");

  assert.ok(checkTypedAnswer("sanbon", ["さんぼん"]));
  assert.ok(checkTypedAnswer(" SANBON ", ["さんぼん"]));
  assert.ok(checkTypedAnswer("サンボン", ["さんぼん"]));
  assert.ok(checkTypedAnswer("さんぼん。", ["さんぼん"]));
  assert.ok(checkTypedAnswer("sannin", ["さんにん"]));
  assert.ok(checkTypedAnswer("sannnin", ["さんにん"]), "IME-style double n");
  assert.ok(checkTypedAnswer("yonnhonn", ["よんほん"]));
  assert.ok(checkTypedAnswer("jippon", ["じゅっぽん", "じっぽん"]));
  assert.ok(!checkTypedAnswer("sanhon", ["さんぼん"]));
  assert.ok(!checkTypedAnswer("", ["さんぼん"]));
});

test("stats: migration from the old format, recording and weighting", () => {
  const stats = normalizeStats({ 本: { correct: 3, incorrect: 1 }, 球: { correct: 9, incorrect: 9 }, 枚: "junk" }, ["本", "枚"]);
  assert.deepEqual(stats, { 本: { correct: 3, incorrect: 1, nums: {} }, 枚: { correct: 0, incorrect: 0, nums: {} } });
  recordResult(stats, "本", 3, false);
  assert.deepEqual(stats["本"].nums[3], { correct: 0, incorrect: 1 });
  assert.equal(stats["本"].incorrect, 2);
  assert.ok(counterWeight({ correct: 0, incorrect: 5 }) > counterWeight({ correct: 5, incorrect: 0 }));
  assert.ok(counterWeight(undefined) > counterWeight({ correct: 20, incorrect: 0 }));
  assert.equal(masteryLevel({ correct: 0, incorrect: 0 }), "new");
  assert.equal(masteryLevel({ correct: 12, incorrect: 1 }), "mastered");
});
