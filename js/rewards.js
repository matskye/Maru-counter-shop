// Rewards: the shop's takings, its rank, decorations and the stamp card.
// Pure functions only (no DOM), so everything here is unit-tested.
//
// Design rule: rewards follow learning. Yen comes from answering in shifts
// (first tries only), stamps from showing up and from things actually remembered.

import { counterStars, cardIds } from "./logic.js";

/** The shop grows with lifetime takings. */
export const RANKS = [
  { at: 0, ja: "屋台", kana: "やたい", en: "Street stall", icon: "⛺" },
  { at: 3000, ja: "小さな店", kana: "ちいさなみせ", en: "Little shop", icon: "🏠" },
  { at: 12000, ja: "商店", kana: "しょうてん", en: "Town store", icon: "🏪" },
  { at: 30000, ja: "人気店", kana: "にんきてん", en: "Popular shop", icon: "🏬" },
  { at: 70000, ja: "名店", kana: "めいてん", en: "Famous shop", icon: "🏯" },
  { at: 140000, ja: "老舗", kana: "しにせ", en: "Shop of long standing", icon: "⛩️" },
  { at: 250000, ja: "日本一の店", kana: "にほんいちのみせ", en: "Best shop in Japan", icon: "🗻" }
];

/** Things to dress the shop front with. */
export const DECORATIONS = [
  { id: "lantern", emoji: "🏮", ja: "ちょうちん", kana: "ちょうちん", en: "Paper lantern", price: 1500 },
  { id: "goldfish", emoji: "🐠", ja: "金魚", kana: "きんぎょ", en: "Goldfish", price: 2500 },
  { id: "windchime", emoji: "🎐", ja: "風鈴", kana: "ふうりん", en: "Wind chime", price: 3500 },
  { id: "sakura", emoji: "🌸", ja: "桜", kana: "さくら", en: "Cherry blossoms", price: 5000 },
  { id: "maple", emoji: "🍁", ja: "もみじ", kana: "もみじ", en: "Autumn maple", price: 6500 },
  { id: "koinobori", emoji: "🎏", ja: "こいのぼり", kana: "こいのぼり", en: "Carp streamers", price: 8000 },
  { id: "kadomatsu", emoji: "🎍", ja: "門松", kana: "かどまつ", en: "New Year pine", price: 10000 },
  { id: "tanabata", emoji: "🎋", ja: "七夕飾り", kana: "たなばたかざり", en: "Tanabata tree", price: 13000 },
  { id: "tsukimi", emoji: "🎑", ja: "月見", kana: "つきみ", en: "Moon-viewing display", price: 17000 },
  { id: "hina", emoji: "🎎", ja: "ひな人形", kana: "ひなにんぎょう", en: "Hina dolls", price: 22000 },
  { id: "torii", emoji: "⛩️", ja: "鳥居", kana: "とりい", en: "Torii gate", price: 28000 },
  { id: "fuji", emoji: "🗻", ja: "富士山の絵", kana: "ふじさんのえ", en: "Painting of Mt Fuji", price: 40000 }
];

export const BASE_REWARD = 100;
export const COMBO_STEP = 20;
export const COMBO_CAP = 5;
export const PERFECT_BONUS = 500;

/** Correct first-try answers for a regular needed for one, two and three hearts. */
export const HEART_STEPS = [8, 25, 60];
export const REGULAR_COUNT = 8;

/** Yen for a first-try correct answer; `combo` is how many in a row including this one. */
export function answerReward(combo) {
  return BASE_REWARD + COMBO_STEP * Math.min(Math.max(combo, 1) - 1, COMBO_CAP);
}

export function emptyGame() {
  return { yen: 0, earned: 0, owned: [], stamps: {}, history: {}, perfectShifts: 0, bestCombo: 0 };
}

export function normalizeGame(saved) {
  const game = emptyGame();
  if (!saved || typeof saved !== "object") return game;
  const count = v => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  game.yen = count(saved.yen);
  game.earned = Math.max(count(saved.earned), game.yen);
  game.perfectShifts = count(saved.perfectShifts);
  game.bestCombo = count(saved.bestCombo);
  const known = new Set(DECORATIONS.map(d => d.id));
  if (Array.isArray(saved.owned)) game.owned = [...new Set(saved.owned)].filter(id => known.has(id));
  if (saved.stamps && typeof saved.stamps === "object") {
    Object.entries(saved.stamps).forEach(([id, date]) => {
      if (typeof date === "string") game.stamps[id] = date;
    });
  }
  if (saved.history && typeof saved.history === "object") {
    Object.entries(saved.history).forEach(([date, shifts]) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && count(shifts)) game.history[date] = count(shifts);
    });
  }
  return game;
}

export function addYen(game, amount) {
  game.yen += amount;
  game.earned += amount;
}

/** Where the shop stands: current rank, the next one, and how far along (0-1). */
export function rankInfo(earned) {
  let index = 0;
  RANKS.forEach((rank, i) => {
    if (earned >= rank.at) index = i;
  });
  const rank = RANKS[index];
  const next = RANKS[index + 1] || null;
  const fraction = next ? (earned - rank.at) / (next.at - rank.at) : 1;
  return { index, rank, next, fraction, toGo: next ? next.at - earned : 0 };
}

/** Buy a decoration. Returns true if the purchase went through. */
export function buyDecoration(game, id) {
  const item = DECORATIONS.find(d => d.id === id);
  if (!item || game.owned.includes(id) || game.yen < item.price) return false;
  game.yen -= item.price;
  game.owned.push(id);
  return true;
}

/** Record a finished shift in the calendar and keep the history from growing forever. */
export function recordShiftDay(game, today) {
  game.history[today] = (game.history[today] || 0) + 1;
  const dates = Object.keys(game.history).sort();
  dates.slice(0, Math.max(0, dates.length - 120)).forEach(date => delete game.history[date]);
}

function dateString(date) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The last seven days, oldest first, for the "this week" strip. */
export function lastSevenDays(history, today) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - i));
    const key = dateString(day);
    return { date: key, weekday: "日月火水木金土"[day.getDay()], played: Boolean(history[key]), isToday: i === 6 };
  });
}

/* ---------- Stamp card ---------- */

const CHAPTER_ICONS = ["🌱", "🛒", "🕒", "🐾", "🍙", "⏳", "🚃", "🎨"];

/** Everything the stamp rules look at. */
export function gameFacts(data, progress, dayStreak) {
  const game = progress.game || emptyGame();
  const stars = data.counters.map(counter => ({ counter, stars: counterStars(counter, progress) }));
  const chapters = new Map();
  stars.forEach(({ counter, stars: s }) => {
    const name = counter.group || "Counters";
    if (!chapters.has(name)) chapters.set(name, []);
    chapters.get(name).push(s);
  });
  return {
    shifts: progress.shifts || 0,
    dayStreak,
    cards: Object.keys(progress.cards).length,
    totalCards: data.counters.flatMap(cardIds).length,
    counters: progress.unlocked.length,
    totalCounters: data.counters.length,
    mastered: stars.filter(s => s.stars === 3).length,
    chaptersDone: [...chapters.entries()].filter(([, list]) => list.every(s => s !== null && s >= 2)).map(([name]) => name),
    perfectShifts: game.perfectShifts,
    bestCombo: game.bestCombo,
    owned: game.owned.length,
    bestFriends: Object.values((progress.story && progress.story.friends) || {}).filter(n => n >= HEART_STEPS[HEART_STEPS.length - 1]).length,
    rank: rankInfo(game.earned).index
  };
}

/** The full stamp card for this data set: [{ id, icon, title, how, earned(facts) }]. */
export function stampList(data) {
  const chapterNames = [...new Set(data.counters.map(c => c.group || "Counters"))];
  const total = data.counters.length;
  return [
    { id: "shift_1", icon: "🔰", title: "First day on the job", how: "Finish your first shift", earned: f => f.shifts >= 1 },
    { id: "shift_10", icon: "🧹", title: "Getting the hang of it", how: "Finish 10 shifts", earned: f => f.shifts >= 10 },
    { id: "shift_50", icon: "👘", title: "Seasoned clerk", how: "Finish 50 shifts", earned: f => f.shifts >= 50 },
    { id: "shift_150", icon: "🎖️", title: "Shop veteran", how: "Finish 150 shifts", earned: f => f.shifts >= 150 },
    { id: "streak_3", icon: "🔥", title: "Three days running", how: "Play 3 days in a row", earned: f => f.dayStreak >= 3 },
    { id: "streak_7", icon: "📅", title: "A full week", how: "Play 7 days in a row", earned: f => f.dayStreak >= 7 },
    { id: "streak_30", icon: "🌕", title: "A full month", how: "Play 30 days in a row", earned: f => f.dayStreak >= 30 },
    { id: "streak_100", icon: "💯", title: "Hundred-day habit", how: "Play 100 days in a row", earned: f => f.dayStreak >= 100 },
    { id: "perfect_1", icon: "✨", title: "Flawless service", how: "Finish a shift with no mistakes", earned: f => f.perfectShifts >= 1 },
    { id: "perfect_10", icon: "💎", title: "Ten flawless shifts", how: "Finish 10 shifts with no mistakes", earned: f => f.perfectShifts >= 10 },
    { id: "combo_10", icon: "⚡", title: "On a roll", how: "Get 10 right in a row in a shift", earned: f => f.bestCombo >= 10 },
    { id: "combo_20", icon: "🌪️", title: "Unstoppable", how: "Get 20 right in a row in a shift", earned: f => f.bestCombo >= 20 },
    { id: "counters_5", icon: "🖐️", title: "Five counters", how: "Start learning 5 counters", earned: f => f.counters >= 5 },
    { id: "counters_20", icon: "📚", title: "Twenty counters", how: "Start learning 20 counters", earned: f => f.counters >= 20 },
    { id: "counters_all", icon: "🗾", title: "Met them all", how: `Start learning all ${total} counters`, earned: f => f.counters >= f.totalCounters },
    { id: "cards_100", icon: "🧠", title: "A hundred things learned", how: "Learn 100 cards", earned: f => f.cards >= 100 },
    { id: "cards_all", icon: "🎓", title: "Nothing left to teach", how: "Learn every card in the course", earned: f => f.cards >= f.totalCards },
    { id: "master_1", icon: "⭐", title: "First three-star counter", how: "Get 3 stars on a counter", earned: f => f.mastered >= 1 },
    { id: "master_10", icon: "🌟", title: "Ten three-star counters", how: "Get 3 stars on 10 counters", earned: f => f.mastered >= 10 },
    { id: "master_all", icon: "👑", title: "Counter master", how: "Get 3 stars on every counter", earned: f => f.mastered >= f.totalCounters },
    ...chapterNames.map((name, i) => ({
      id: `chapter:${name}`, icon: CHAPTER_ICONS[i % CHAPTER_ICONS.length], title: name,
      how: `Get 2 stars on every counter in “${name}”`, earned: f => f.chaptersDone.includes(name)
    })),
    { id: "friend_1", icon: "💌", title: "A regular's favourite", how: "Reach three hearts with a regular", earned: f => f.bestFriends >= 1 },
    { id: "friend_all", icon: "🏘️", title: "Heart of the street", how: "Reach three hearts with every regular", earned: f => f.bestFriends >= REGULAR_COUNT },
    { id: "deco_1", icon: "🏮", title: "A touch of style", how: "Buy a decoration for the shop", earned: f => f.owned >= 1 },
    { id: "deco_all", icon: "🎊", title: "Fully decorated", how: "Buy every decoration", earned: f => f.owned >= DECORATIONS.length },
    { id: "rank_3", icon: "🏬", title: "Talk of the town", how: "Grow the shop into a 人気店", earned: f => f.rank >= 3 },
    { id: "rank_top", icon: "🗻", title: "Best shop in Japan", how: "Reach the highest shop rank", earned: f => f.rank >= RANKS.length - 1 }
  ];
}

/** Award any stamps newly earned. Returns their definitions; marks them on the card with today's date. */
export function awardStamps(data, progress, dayStreak, today) {
  const game = progress.game;
  const facts = gameFacts(data, progress, dayStreak);
  const fresh = stampList(data).filter(stamp => !game.stamps[stamp.id] && stamp.earned(facts));
  fresh.forEach(stamp => {
    game.stamps[stamp.id] = today;
  });
  return fresh;
}
