import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareData, emptyProgress, cardIds } from "../js/logic.js";
import {
  RANKS, DECORATIONS, answerReward, emptyGame, normalizeGame, addYen, rankInfo, buyDecoration,
  recordShiftDay, lastSevenDays, stampList, awardStamps, gameFacts
} from "../js/rewards.js";
import { REGULARS } from "../js/story.js";

const data = prepareData(JSON.parse(readFileSync(new URL("../data/counters.json", import.meta.url), "utf8")));
const fresh = () => ({ ...emptyProgress(), game: emptyGame() });

test("answer rewards grow with the combo, up to a cap", () => {
  assert.deepEqual([1, 2, 3, 6, 7, 50].map(answerReward), [100, 120, 140, 200, 200, 200]);
  assert.equal(answerReward(0), 100);
});

test("ranks", () => {
  assert.ok(RANKS.every((r, i) => i === 0 || r.at > RANKS[i - 1].at));
  assert.equal(rankInfo(0).index, 0);
  assert.equal(rankInfo(0).fraction, 0);
  assert.equal(rankInfo(2999).index, 0);
  const second = rankInfo(3000);
  assert.equal(second.rank.ja, "小さな店");
  assert.equal(second.toGo, 9000);
  assert.equal(rankInfo(7500).fraction, 0.5);
  const top = rankInfo(10 ** 7);
  assert.deepEqual([top.index, top.next, top.fraction], [RANKS.length - 1, null, 1]);
});

test("buying decorations", () => {
  const game = emptyGame();
  assert.equal(buyDecoration(game, "lantern"), false, "cannot afford it yet");
  addYen(game, 2000);
  assert.equal(buyDecoration(game, "nope"), false);
  assert.equal(buyDecoration(game, "lantern"), true);
  assert.deepEqual([game.yen, game.earned, game.owned], [500, 2000, ["lantern"]]);
  addYen(game, 5000);
  assert.equal(buyDecoration(game, "lantern"), false, "cannot buy twice");
  assert.equal(new Set(DECORATIONS.map(d => d.id)).size, DECORATIONS.length);
  assert.ok(DECORATIONS.every((d, i) => i === 0 || d.price > DECORATIONS[i - 1].price));
});

test("saved game data is cleaned up", () => {
  assert.deepEqual(normalizeGame(null), emptyGame());
  const game = normalizeGame({
    yen: 500.7, earned: 100, owned: ["lantern", "lantern", "junk"], stamps: { shift_1: "2026-01-01", bad: 3 },
    history: { "2026-01-01": 2, nonsense: 1, "2026-01-02": 0 }, perfectShifts: -4, bestCombo: "x"
  });
  assert.deepEqual(game, {
    yen: 500, earned: 500, owned: ["lantern"], stamps: { shift_1: "2026-01-01" },
    history: { "2026-01-01": 2 }, perfectShifts: 0, bestCombo: 0
  });
});

test("calendar", () => {
  const game = emptyGame();
  recordShiftDay(game, "2026-03-10");
  recordShiftDay(game, "2026-03-10");
  recordShiftDay(game, "2026-03-08");
  assert.deepEqual(game.history, { "2026-03-10": 2, "2026-03-08": 1 });
  const week = lastSevenDays(game.history, new Date(2026, 2, 10));
  assert.equal(week.length, 7);
  assert.deepEqual(week.map(d => d.played), [false, false, false, false, true, false, true]);
  assert.equal(week[6].date, "2026-03-10");
  assert.equal(week[6].weekday, "火");
  assert.ok(week[6].isToday && !week[5].isToday);
  assert.equal(week[0].date, "2026-03-04");
  for (let i = 0; i < 200; i++) recordShiftDay(game, `2027-01-${String((i % 28) + 1).padStart(2, "0")}`.replace("2027", String(2027 + Math.floor(i / 28))));
  assert.ok(Object.keys(game.history).length <= 120);
});

test("stamps", () => {
  const stamps = stampList(data);
  assert.equal(new Set(stamps.map(s => s.id)).size, stamps.length);
  assert.equal(stamps.filter(s => s.id.startsWith("chapter:")).length, new Set(data.counters.map(c => c.group)).size);

  const progress = fresh();
  assert.deepEqual(awardStamps(data, progress, 0, "2026-01-01"), [], "nothing for nothing");

  progress.shifts = 1;
  progress.game.perfectShifts = 1;
  const first = awardStamps(data, progress, 1, "2026-01-01").map(s => s.id);
  assert.deepEqual(first, ["shift_1", "perfect_1"]);
  assert.deepEqual(awardStamps(data, progress, 1, "2026-01-02"), [], "a stamp is only awarded once");
  assert.equal(progress.game.stamps.shift_1, "2026-01-01");

  // Finish the first chapter: every card of its counters well learned.
  const firstChapter = data.counters.filter(c => c.group === data.counters[0].group);
  firstChapter.forEach(counter => {
    progress.unlocked.push(counter.counter);
    cardIds(counter).forEach(id => { progress.cards[id] = { box: 5, due: 0 }; });
  });
  const facts = gameFacts(data, progress, 3);
  assert.equal(facts.counters, firstChapter.length);
  assert.equal(facts.mastered, firstChapter.length);
  assert.deepEqual(facts.chaptersDone, [data.counters[0].group]);
  const more = awardStamps(data, progress, 3, "2026-01-05").map(s => s.id);
  assert.ok(more.includes(`chapter:${data.counters[0].group}`));
  assert.ok(more.includes("streak_3") && more.includes("counters_5") && more.includes("master_1"));
  assert.ok(!more.includes("counters_20") && !more.includes("master_10"));

  // Everything, everywhere: the whole card can be filled.
  const all = fresh();
  all.shifts = 999;
  all.game = { ...emptyGame(), earned: 10 ** 7, owned: DECORATIONS.map(d => d.id), perfectShifts: 99, bestCombo: 99 };
  all.story = { seen: [], friends: Object.fromEntries(REGULARS.map(r => [r.id, 99])) };
  data.counters.forEach(counter => {
    all.unlocked.push(counter.counter);
    cardIds(counter).forEach(id => { all.cards[id] = { box: 7, due: 0 }; });
  });
  assert.equal(awardStamps(data, all, 365, "2030-01-01").length, stamps.length);
});
