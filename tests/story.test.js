import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareData, emptyProgress, cardIds } from "../js/logic.js";
import { emptyGame, HEART_STEPS, REGULAR_COUNT } from "../js/rewards.js";
import {
  REGULARS, OPENING, FINALE, CHAPTER_SCENES, parseRuby, spokenText, writtenText, emptyStory, normalizeStory,
  hearts, metRegulars, regularFor, allScenes, pendingScenes, markSeen, regularById
} from "../js/story.js";

const data = prepareData(JSON.parse(readFileSync(new URL("../data/counters.json", import.meta.url), "utf8")));
const chapters = [...new Set(data.counters.map(c => c.group))];
const fresh = () => ({ ...emptyProgress(), game: emptyGame(), story: emptyStory() });

test("ruby markup", () => {
  assert.deepEqual(parseRuby("{猫|ねこ}が{三匹|さんびき}いる"), [
    { text: "猫", ruby: "ねこ" }, { text: "が" }, { text: "三匹", ruby: "さんびき" }, { text: "いる" }
  ]);
  assert.deepEqual(parseRuby("ありがとう"), [{ text: "ありがとう" }]);
  assert.equal(spokenText("{九時|くじ}の{電車|でんしゃ}"), "くじのでんしゃ");
  assert.equal(writtenText("{九時|くじ}の{電車|でんしゃ}"), "九時の電車");
});

test("every chapter has scenes and exactly one regular", () => {
  assert.equal(REGULARS.length, REGULAR_COUNT);
  assert.equal(new Set(REGULARS.map(r => r.id)).size, REGULARS.length);
  assert.equal(new Set(REGULARS.map(r => r.emoji)).size, REGULARS.length);
  for (const name of chapters) {
    assert.ok(CHAPTER_SCENES[name], `scenes for ${name}`);
    assert.equal(REGULARS.filter(r => r.chapter === name).length, 1, `one regular for ${name}`);
  }
  for (const r of REGULARS) {
    assert.ok(chapters.includes(r.chapter));
    assert.equal(r.beats.length, HEART_STEPS.length);
    assert.ok(r.thanks.length && r.oops.length === 2);
  }
});

test("all story text is well formed", () => {
  const speakers = new Set(["narrator", "maru", ...REGULARS.map(r => r.id)]);
  const scenes = allScenes(data);
  assert.equal(new Set(scenes.map(s => s.id)).size, scenes.length);
  assert.equal(scenes.length, 2 + chapters.length * 2 + REGULARS.length * HEART_STEPS.length);
  const check = (ja, where) => {
    // every kanji must sit inside {kanji|kana} markup, and readings must be kana
    for (const part of parseRuby(ja)) {
      if (part.ruby) assert.match(part.ruby, /^[ぁ-ゖー]+$/, `${where}: reading ${part.ruby}`);
      else assert.doesNotMatch(part.text, /[一-龯々]/, `${where}: bare kanji in “${part.text}”`);
    }
    assert.doesNotMatch(ja.replace(/\{[^|{}]+\|[^|{}]+\}/g, ""), /[{}|]/, `${where}: broken markup`);
  };
  for (const scene of scenes) {
    assert.ok(scene.lines.length >= 2 && scene.lines.length <= 12, scene.id);
    scene.lines.forEach((line, i) => {
      assert.ok(speakers.has(line.who), `${scene.id}[${i}] speaker ${line.who}`);
      assert.ok(line.en && line.en.trim(), `${scene.id}[${i}] needs English`);
      if (line.who === "narrator") assert.equal(line.ja, undefined);
      else assert.ok(line.ja, `${scene.id}[${i}] needs Japanese`);
      if (line.ja) check(line.ja, `${scene.id}[${i}]`);
    });
  }
  for (const r of REGULARS) {
    check(r.ja, r.id);
    [...r.thanks, r.oops].forEach(([ja, en]) => { check(ja, r.id); assert.ok(en); });
  }
  assert.ok(OPENING.length && FINALE.length);
});

test("hearts and saved story data", () => {
  const [one, two, three] = HEART_STEPS;
  assert.deepEqual([0, one - 1, one, two - 1, two, three - 1, three, 999].map(hearts), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(hearts(undefined), 0);
  assert.deepEqual(normalizeStory(null), emptyStory());
  assert.deepEqual(normalizeStory({ seen: ["opening", "opening", 3], friends: { tanaka: 4.9, nobody: 9, kenta: -1 } }),
    { seen: ["opening"], friends: { tanaka: 4 } });
});

test("regulars appear once met, for their own chapter", () => {
  const progress = fresh();
  assert.deepEqual(metRegulars(data, progress), []);
  progress.unlocked.push("個");
  assert.deepEqual(metRegulars(data, progress).map(r => r.id), ["tanaka"]);
  markSeen(progress.story, "intro:Food and drink");
  assert.deepEqual(metRegulars(data, progress).map(r => r.id), ["tanaka", "taisho"]);

  const met = metRegulars(data, progress);
  const C = key => data.byKey.get(key);
  assert.equal(regularFor(C("個"), met, () => 0).id, "tanaka");
  assert.equal(regularFor(C("皿"), met, () => 0).id, "taisho");
  assert.equal(regularFor(C("個"), met, () => 0.9), null, "sometimes it is a stranger");
  assert.equal(regularFor(C("時"), met, () => 0), null, "Mr Suzuki has not been met yet");
  assert.equal(regularById("yuki").chapter, "Animals and clothes");
});

test("scenes unlock from friendship and finished chapters", () => {
  const progress = fresh();
  assert.deepEqual(pendingScenes(data, progress), []);

  progress.story.friends.tanaka = HEART_STEPS[1]; // two hearts
  assert.deepEqual(pendingScenes(data, progress).map(s => s.id), ["beat:tanaka:0"], "one moment at a time");
  markSeen(progress.story, "beat:tanaka:0");
  assert.deepEqual(pendingScenes(data, progress).map(s => s.id), ["beat:tanaka:1"]);
  markSeen(progress.story, "beat:tanaka:1");
  assert.deepEqual(pendingScenes(data, progress), []);

  // finish the first chapter
  data.counters.filter(c => c.group === chapters[0]).forEach(counter => {
    progress.unlocked.push(counter.counter);
    cardIds(counter).forEach(id => { progress.cards[id] = { box: 4, due: 0 }; });
  });
  assert.deepEqual(pendingScenes(data, progress).map(s => s.id), [`outro:${chapters[0]}`]);

  // finish everything: outros first, then the finale once they have all played
  data.counters.forEach(counter => {
    if (!progress.unlocked.includes(counter.counter)) progress.unlocked.push(counter.counter);
    cardIds(counter).forEach(id => { progress.cards[id] = { box: 4, due: 0 }; });
  });
  let pending = pendingScenes(data, progress).map(s => s.id);
  assert.equal(pending.length, chapters.length);
  assert.ok(!pending.includes("finale"));
  pending.forEach(id => markSeen(progress.story, id));
  assert.deepEqual(pendingScenes(data, progress).map(s => s.id), ["finale"]);
  markSeen(progress.story, "finale");
  assert.deepEqual(pendingScenes(data, progress), []);
});
