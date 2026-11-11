import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  prepareData, naiveReading, primaryReading, readingsFor, isIrregular, acceptedReadingsForItem,
  itemAccepts, pickRound, buildShelf, checkServe, buildChoices, soundAlikeDistractors,
  romajiToHiragana, checkTypedAnswer, normalizeStats, recordResult, counterWeight, masteryLevel,
  hasNativeStem, amountText, cardIds, cardForRound, emptyProgress, normalizeProgress, nextNewCard, buildShift,
  gradeCard, counterStars, roundForCard, updateDayStreak, dueCards, BOX_HOURS
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
  assert.deepEqual(new Set(readings), new Set(["いっかん", "いっぽん", "いっこ", "ひとつ"]));
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
    const mode = ["serve", "count", "mix"][i % 3];
    const round = pickRound({ data, activeCounters: data.counters, stats, mode, maxNumber: 10, lastCounterKey: last, rng });
    assert.ok(round.number >= 1 && round.number <= 10);
    assert.notEqual(round.counter.counter, last);
    last = round.counter.counter;

    const shelf = buildShelf({ data, round, activeCounters: data.counters, size: 8, rng });
    assert.equal(shelf.length, 8);
    assert.equal(new Set(shelf.map(e => e.item.id)).size, 8);
    assert.ok(shelf.some(e => e.item.id === round.entry.item.id));
    assert.ok(["serve", "count", "order"].includes(round.mode));
    assert.ok(round.counter.entries.includes(round.entry));
    if (round.mode === "serve") {
      assert.ok(!round.counter.generic, "a generic counter cannot be a serve round");
      assert.ok(shelf.some(e => !itemAccepts(e, round.counter.counter)));
    }

    const choices = buildChoices({ data, round, size: 4, rng });
    assert.equal(choices.length, 4);
    assert.equal(choices.filter(c => c.correct).length, 1);
    assert.equal(new Set(choices.map(c => c.reading)).size, 4);
    const accepted = new Set(round.counter.generic
      ? readingsFor(round.counter, round.number)
      : acceptedReadingsForItem(data, round.entry, round.number));
    for (const choice of choices) {
      if (!round.counter.generic) assert.ok(!data.byKey.get(choice.counterKey).generic, "つ is never offered as a wrong answer");
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

test("generic counter つ and native readings", () => {
  const tsu = C("つ");
  assert.ok(tsu.generic && tsu.entries.length > 5);
  assert.ok(tsu.entries.every(e => !["人", "匹", "頭", "羽"].includes(e.counter.counter)));
  assert.equal(primaryReading(tsu, 3), "みっつ");
  assert.equal(amountText(tsu, 3), "3つ");
  assert.equal(amountText(tsu, 10), "10");
  assert.equal(amountText(C("人"), 2), "2人");
  assert.ok(hasNativeStem(tsu, 8) && hasNativeStem(C("人"), 1) && hasNativeStem(C("人"), 4));
  assert.ok(!hasNativeStem(C("本"), 1) && !hasNativeStem(C("人"), 3));
  const order = { mode: "order", counter: tsu, number: 2, entry: entryOf("apple") };
  assert.ok(checkServe(order, [{ entry: entryOf("apple"), count: 2 }]).correct);
  assert.ok(!checkServe(order, [{ entry: entryOf("egg"), count: 2 }]).correct, "egg also takes つ but was not ordered");
  const choices = buildChoices({ data, round: { mode: "count", counter: tsu, number: 3, entry: entryOf("apple") }, rng: seeded(3) });
  assert.ok(choices.every(c => c.counterKey === "つ"));
});

test("cards", () => {
  assert.deepEqual(cardIds(C("本")), ["use:本", "read:本:reg", "read:本:1", "read:本:3", "read:本:6", "read:本:8", "read:本:10"]);
  assert.deepEqual(cardIds(C("枚")), ["use:枚", "read:枚:reg"]);
  assert.equal(cardIds(C("つ")).length, 10, "つ: one card for regular ななつ, nine for the native readings");
  assert.ok(!cardIds(C("つ")).includes("use:つ"));
  assert.equal(cardForRound({ mode: "serve", counter: C("本"), number: 3 }), "use:本");
  assert.equal(cardForRound({ mode: "count", counter: C("本"), number: 3 }), "read:本:3");
  assert.equal(cardForRound({ mode: "order", counter: C("本"), number: 2 }), "read:本:reg");
  const rng = seeded(7);
  for (const counter of data.counters) {
    for (const id of cardIds(counter)) {
      for (let i = 0; i < 5; i++) {
        const round = roundForCard(data, id, rng);
        assert.equal(cardForRound(round), id, `round for ${id} must test that card`);
        if (round.mode === "order") assert.ok(hasNativeStem(round.counter, round.number));
      }
    }
  }
});

test("a new learner's first shifts introduce counters gradually", () => {
  const progress = emptyProgress();
  const now = Date.UTC(2026, 0, 1);
  const steps = buildShift({ data, progress, now, rng: seeded(1) });
  assert.deepEqual(steps[0], { kind: "lesson", counterKey: "個" });
  const cards = steps.filter(s => s.kind === "card");
  assert.equal(cards.length, 5);
  assert.ok(cards.every(s => s.isNew));
  assert.ok(steps.filter(s => s.kind === "lesson").length <= 2);
  // every new card comes after the lesson for its counter
  const taught = new Set();
  for (const step of steps) {
    if (step.kind === "lesson") taught.add(step.counterKey);
    else assert.ok(taught.has(step.cardId.split(":")[1]), step.cardId);
  }
});

test("spaced repetition: grading and scheduling", () => {
  const H = 3600 * 1000;
  const progress = emptyProgress();
  let now = 1e12;
  // known at first sight → skips ahead
  assert.equal(gradeCard(progress, "use:本", true, now).box, 3);
  // missed at first sight → due immediately, then a short interval once recalled
  assert.deepEqual(gradeCard(progress, "read:本:3", false, now), { box: 1, due: now });
  assert.deepEqual(gradeCard(progress, "read:本:3", true, now, { retry: true }), { box: 1, due: now + BOX_HOURS[1] * H });
  assert.deepEqual(dueCards(progress, now), []);
  // correct before it is due changes nothing
  assert.deepEqual(gradeCard(progress, "read:本:3", true, now + H), { box: 1, due: now + BOX_HOURS[1] * H });
  // correct when due → next box
  now += 5 * H;
  assert.deepEqual(dueCards(progress, now), ["read:本:3"]);
  assert.deepEqual(gradeCard(progress, "read:本:3", true, now), { box: 2, due: now + BOX_HOURS[2] * H });
  // a lapse drops it back
  progress.cards["use:本"].box = 6;
  assert.equal(gradeCard(progress, "use:本", false, now).box, 3);

  progress.unlocked = ["本"];
  const steps = buildShift({ data, progress, now: now + H, rng: seeded(2) });
  assert.equal(steps[0].cardId, "use:本", "the only due card comes first");
  assert.ok(!steps[0].isNew);
  const fresh = steps.filter(s => s.isNew).map(s => s.cardId);
  assert.equal(fresh[0], "read:本:reg", "then unseen cards of the counter in progress");
  assert.equal(nextNewCard(data, progress).unlock, null);
  assert.ok(steps.some(s => s.early && s.cardId === "read:本:3"), "not-yet-due cards fill the shift as extra practice");
});

test("lesson order, priority, stars, saved progress and day streak", () => {
  const progress = emptyProgress();
  assert.equal(nextNewCard(data, progress).unlock, "個");
  progress.priority = ["匹"];
  assert.deepEqual(nextNewCard(data, progress), { cardId: "use:匹", unlock: "匹" });

  assert.equal(counterStars(C("枚"), progress), null);
  progress.unlocked = ["枚"];
  assert.equal(counterStars(C("枚"), progress), 0);
  progress.cards["use:枚"] = { box: 5, due: 0 };
  assert.equal(counterStars(C("枚"), progress), 1);
  progress.cards["read:枚:reg"] = { box: 4, due: 0 };
  assert.equal(counterStars(C("枚"), progress), 3);

  const restored = normalizeProgress({ cards: { "use:本": { box: 99, due: 5 }, "use:球": { box: 1, due: 1 }, junk: 3 }, unlocked: ["球"], priority: ["本", "匹"], day: { last: "2026-01-01", streak: 4 } }, data);
  assert.deepEqual(restored.cards, { "use:本": { box: 6, due: 5 } });
  assert.deepEqual(restored.unlocked, ["本"]);
  assert.deepEqual(restored.priority, ["匹"]);
  assert.deepEqual(normalizeProgress("garbage", data), emptyProgress());

  assert.deepEqual(updateDayStreak({ last: "2026-01-01", streak: 4 }, "2026-01-02", "2026-01-01"), { last: "2026-01-02", streak: 5 });
  assert.deepEqual(updateDayStreak({ last: "2026-01-02", streak: 5 }, "2026-01-02", "2026-01-01"), { last: "2026-01-02", streak: 5 });
  assert.deepEqual(updateDayStreak({ last: "2025-12-25", streak: 9 }, "2026-01-02", "2026-01-01"), { last: "2026-01-02", streak: 1 });
  assert.deepEqual(updateDayStreak({ last: null, streak: 0 }, "2026-01-02", "2026-01-01"), { last: "2026-01-02", streak: 1 });
});

test("a simulated learner gets through the whole course", () => {
  const rng = seeded(11);
  const progress = emptyProgress();
  let now = Date.UTC(2026, 0, 1);
  const total = data.counters.flatMap(cardIds).length;
  let shifts = 0;
  while (Object.keys(progress.cards).length < total && shifts < 200) {
    const steps = buildShift({ data, progress, now, rng });
    assert.ok(steps.some(s => s.kind === "card"), "a shift always has something to do");
    assert.ok(steps.filter(s => s.kind === "card").length <= 12);
    for (const step of steps) {
      if (step.kind === "lesson") progress.unlocked.push(step.counterKey);
      else {
        const correct = rng() < 0.8;
        gradeCard(progress, step.cardId, correct, now);
        if (!correct) gradeCard(progress, step.cardId, true, now, { retry: true });
      }
    }
    shifts += 1;
    now += 24 * 3600 * 1000;
  }
  assert.equal(Object.keys(progress.cards).length, total);
  assert.equal(progress.unlocked.length, data.counters.length);
  assert.ok(shifts < 60, `took ${shifts} shifts`);
});
