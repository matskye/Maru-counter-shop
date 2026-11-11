// Story: the opening, the regular customers, and the small scenes along the way.
// Content plus pure helpers (no DOM).
//
// Japanese lines use {漢字|かんじ} markup for furigana. They are kept short and, where
// possible, use a counter from the chapter they belong to.

import { counterStars } from "./logic.js";
import { HEART_STEPS } from "./rewards.js";

/** The regulars: one per chapter, each fond of that chapter's counters. */
export const REGULARS = [
  {
    id: "tanaka", emoji: "👵", ja: "{田中|たなか}さん", en: "Mrs Tanaka", role: "The lady from next door",
    chapter: "First steps",
    thanks: [["ありがとうね。", "Thank you, dear."], ["{助|たす}かるわ。", "That's a help."]],
    oops: ["あら、ちがうみたい。", "Oh, that doesn't seem right."],
    beats: [
      [
        { who: "tanaka", ja: "みかんを{三個|さんこ}、どうぞ。", en: "Here, three mandarins for you." },
        { who: "narrator", en: "You realise you understood “sanko” without having to think." }
      ],
      [
        { who: "tanaka", ja: "{孫|まご}が{二人|ふたり}いるのよ。", en: "I have two grandchildren, you know." },
        { who: "tanaka", ja: "{今度|こんど}、{連|つ}れてくるわね。", en: "I'll bring them along next time." }
      ],
      [
        { who: "narrator", en: "Mrs Tanaka arrives with two small children, who immediately ask for one of everything." },
        { who: "tanaka", ja: "あなたがいると、{買|か}い{物|もの}が{楽|たの}しいわ。", en: "Shopping is fun when you're here." }
      ]
    ]
  },
  {
    id: "kenta", emoji: "👦", ja: "けんた", en: "Kenta", role: "A schoolboy with a growing number of cats",
    chapter: "Around the shop",
    thanks: [["やった！", "Yes!"], ["ありがとう！", "Thanks!"]],
    oops: ["えー、ちがうよ。", "Aw, that's wrong."],
    beats: [
      [
        { who: "kenta", ja: "ねえ、うちの{猫|ねこ}、{三匹|さんびき}になったよ！", en: "Hey, we've got three cats now!" },
        { who: "maru", ja: "えさは{毎日|まいにち}ここで{買|か}ってね。", en: "Buy their food here every day, then." }
      ],
      [
        { who: "kenta", ja: "テスト、{百点|ひゃくてん}だった！", en: "I got a hundred on my test!" },
        { who: "narrator", en: "It was a test on counters. He says you helped. You suspect the cats did not." }
      ],
      [
        { who: "kenta", ja: "{大|おお}きくなったら、ここで{働|はたら}きたい。", en: "When I grow up, I want to work here." },
        { who: "maru", ja: "じゃあ、まず{宿題|しゅくだい}。", en: "Homework first, then." }
      ]
    ]
  },
  {
    id: "suzuki", emoji: "👨", ja: "{鈴木|すずき}さん", en: "Mr Suzuki", role: "An office worker who is never late",
    chapter: "Clock and calendar",
    thanks: [["ありがとうございます。", "Thank you very much."], ["{正確|せいかく}ですね。", "Very precise."]],
    oops: ["{違|ちが}いますね。", "That is not correct."],
    beats: [
      [
        { who: "suzuki", ja: "{九時|くじ}の{電車|でんしゃ}に{乗|の}ります。", en: "I am taking the nine o'clock train." },
        { who: "narrator", en: "Kuji, not kyūji. He waits, visibly, until he is sure you noticed." }
      ],
      [
        { who: "suzuki", ja: "{今日|きょう}は{二十日|はつか}、{私|わたし}の{誕生日|たんじょうび}です。", en: "Today is the twentieth: my birthday." },
        { who: "maru", ja: "おめでとう！{何歳|なんさい}？", en: "Happy birthday! How old?" },
        { who: "suzuki", ja: "それは{秘密|ひみつ}です。", en: "That is a secret." }
      ],
      [
        { who: "narrator", en: "Mr Suzuki is four minutes late. Mr Suzuki has never been late." },
        { who: "suzuki", ja: "{時計|とけい}を{忘|わす}れました。…{楽|らく}ですね。", en: "I forgot my watch. …It's rather nice, actually." }
      ]
    ]
  },
  {
    id: "yuki", emoji: "👩", ja: "ゆきさん", en: "Yuki", role: "A keeper at the zoo",
    chapter: "Animals and clothes",
    thanks: [["ありがとう！{助|たす}かります。", "Thanks! That helps."], ["ばっちり！", "Perfect!"]],
    oops: ["おしい！", "So close!"],
    beats: [
      [
        { who: "yuki", ja: "ペンギンが{一羽|いちわ}、{生|う}まれました！", en: "A penguin chick has hatched!" },
        { who: "narrator", en: "One bird: ichiwa. You are invited to come and see." }
      ],
      [
        { who: "yuki", ja: "ぞうは{二頭|にとう}、うさぎは{十羽|じゅうわ}。", en: "Two elephants, ten rabbits." },
        { who: "narrator", en: "Rabbits are counted like birds. Yuki says there is a story about hungry monks, and that it is probably not true." }
      ],
      [
        { who: "yuki", ja: "{動物園|どうぶつえん}の{名前|なまえ}、{知|し}ってる？", en: "Do you know what the zoo is called?" },
        { who: "narrator", en: "It's on her jacket: Maru Zoo. Maru is suddenly very busy with the shelves." }
      ]
    ]
  },
  {
    id: "taisho", emoji: "🧔", ja: "{大将|たいしょう}", en: "The Chef", role: "Runs the sushi counter across the street",
    chapter: "Food and drink",
    thanks: [["おう、いいぞ！", "Oh, good!"], ["うまい！", "Nicely done!"]],
    oops: ["ちがう、ちがう。", "No, no."],
    beats: [
      [
        { who: "taisho", ja: "{食|た}べろ。{二貫|にかん}だ。", en: "Eat. Two pieces." },
        { who: "narrator", en: "It is the best thing you have eaten all year." }
      ],
      [
        { who: "taisho", ja: "{昔|むかし}は{一日|いちにち}に{百皿|ひゃくさら}{洗|あら}った。", en: "In the old days I washed a hundred plates a day." },
        { who: "maru", ja: "{今|いま}は？", en: "And now?" },
        { who: "taisho", ja: "{弟子|でし}が{洗|あら}う。", en: "Now my apprentice washes them." }
      ],
      [
        { who: "taisho", ja: "うちで{働|はたら}かないか。", en: "Why don't you come and work for me?" },
        { who: "maru", ja: "だめ！", en: "No!" },
        { who: "narrator", en: "They argue about it for ten minutes. You have never felt so employable." }
      ]
    ]
  },
  {
    id: "maria", emoji: "👱", ja: "マリアさん", en: "Maria", role: "A traveller learning Japanese, like you",
    chapter: "How long, how often",
    thanks: [["ありがとうございます！", "Thank you!"], ["わかりました！", "I understood!"]],
    oops: ["あれ？ちがいますか。", "Huh? Is that wrong?"],
    beats: [
      [
        { who: "maria", ja: "{京都|きょうと}に{二泊|にはく}しました！", en: "I stayed two nights in Kyoto!" },
        { who: "narrator", en: "She says nihaku perfectly, and looks as surprised as you are." }
      ],
      [
        { who: "maria", ja: "{日本語|にほんご}の{勉強|べんきょう}、{一年|いちねん}です。まだ{難|むずか}しい。", en: "One year of studying Japanese. It's still hard." },
        { who: "maru", ja: "{二人|ふたり}とも、{上手|じょうず}になったよ。", en: "You've both got good, you know." }
      ],
      [
        { who: "maria", ja: "{来週|らいしゅう}、{国|くに}に{帰|かえ}ります。", en: "Next week I go home." },
        { who: "maria", ja: "でも、また{来|き}ます。{一年|いちねん}に{一回|いっかい}！", en: "But I'll come back. Once a year!" }
      ]
    ]
  },
  {
    id: "yamamoto", emoji: "👴", ja: "{山本|やまもと}さん", en: "Mr Yamamoto", role: "A retired railwayman",
    chapter: "Buildings and vehicles",
    thanks: [["どうもありがとう。", "Thank you kindly."], ["さすがですね。", "Just as I'd expect."]],
    oops: ["ちょっと{違|ちが}いますね。", "Not quite."],
    beats: [
      [
        { who: "yamamoto", ja: "この{電車|でんしゃ}は{八両|はちりょう}です。", en: "This train has eight carriages." },
        { who: "narrator", en: "He counts them for you anyway, one by one." }
      ],
      [
        { who: "yamamoto", ja: "{港|みなと}に{大|おお}きい{船|ふね}が{一隻|いっせき}{来|き}ましたよ。", en: "A big ship has come into the harbour." },
        { who: "narrator", en: "Isseki for a ship, issō for a little boat. He draws you a diagram." }
      ],
      [
        { who: "yamamoto", ja: "{孫|まご}に{電車|でんしゃ}の{数|かぞ}え{方|かた}を{教|おし}えました。", en: "I taught my grandchild how to count trains." },
        { who: "yamamoto", ja: "あなたのおかげです。", en: "It's thanks to you." }
      ]
    ]
  },
  {
    id: "sensei", emoji: "🧓", ja: "{先生|せんせい}", en: "Sensei", role: "Teaches calligraphy and music",
    chapter: "Paper, culture and more",
    thanks: [["ありがとうございます。", "Thank you."], ["お{見事|みごと}。", "Splendid."]],
    oops: ["もう{一度|いちど}。", "Once more."],
    beats: [
      [
        { who: "sensei", ja: "この{手紙|てがみ}、{一通|いっつう}{読|よ}んでみますか。", en: "Would you like to try reading one of these letters?" },
        { who: "narrator", en: "You can read more of it than you expected." }
      ],
      [
        { who: "sensei", ja: "{一曲|いっきょく}{歌|うた}いましょうか。", en: "Shall I sing a song?" },
        { who: "narrator", en: "Maru joins in. Maru cannot sing. Nobody says anything." }
      ],
      [
        { who: "sensei", ja: "{花火|はなび}を{見|み}に{行|い}きませんか。みんなで。", en: "Shall we go and see the fireworks? All of us." },
        { who: "narrator", en: "The whole street goes. You count every one: ippatsu, nihatsu, sanpatsu…" }
      ]
    ]
  }
];

export const OPENING = [
  { who: "narrator", en: "A rainy evening. You duck under the awning of a tiny street stall to wait it out." },
  { who: "maru", ja: "いらっしゃいませ！", en: "Welcome!" },
  { who: "narrator", en: "The shopkeeper is a red panda in a party hat. You decide not to ask about the hat." },
  { who: "maru", ja: "{私|わたし}はマル。{君|きみ}、{日本語|にほんご}を{勉強|べんきょう}している？", en: "I'm Maru. You're studying Japanese?" },
  { who: "narrator", en: "You nod, and try to buy three apples. “Apple… three… please?”" },
  { who: "maru", ja: "りんごを{三|さん}…{何|なに}？", en: "Three… what of apples?" },
  { who: "narrator", en: "In Japanese, Maru explains, you don't just say “three”. Flat things, long things, small animals, people: each is counted in its own way." },
  { who: "maru", ja: "ここで{働|はたら}かない？{教|おし}えるよ。", en: "Why not work here? I'll teach you." },
  { who: "narrator", en: "The stall is small and the shelves are half empty, but the rain isn't stopping. You tie on an apron." },
  { who: "maru", ja: "よろしくね！", en: "Glad to have you!" }
];

export const FINALE = [
  { who: "narrator", en: "Closing time. Maru flips the sign and, for once, takes off the party hat." },
  { who: "maru", ja: "{最初|さいしょ}の{日|ひ}を{覚|おぼ}えている？", en: "Do you remember your first day?" },
  { who: "narrator", en: "Three apples. You didn't know how to ask for three apples." },
  { who: "maru", ja: "{今|いま}は{何|なん}でも{数|かぞ}えられる。{人|ひと}も、{時間|じかん}も、{花火|はなび}も。", en: "Now you can count anything. People, hours, fireworks." },
  { who: "maru", ja: "ありがとう。これからもよろしくね。", en: "Thank you. Let's keep going, together." },
  { who: "narrator", en: "The hat goes back on. Tomorrow there will be customers." }
];

/** Scenes that open and close each chapter. */
export const CHAPTER_SCENES = {
  "First steps": {
    intro: [
      { who: "narrator", en: "Your first customer is already waiting: the old lady from next door." },
      { who: "tanaka", ja: "あら、{新|あたら}しい{人|ひと}？", en: "Oh my, someone new?" },
      { who: "maru", ja: "{田中|たなか}さんは{毎日|まいにち}{来|く}るよ。", en: "Mrs Tanaka comes in every day." },
      { who: "tanaka", ja: "ゆっくりでいいのよ。", en: "Take your time, dear." }
    ],
    outro: [
      { who: "maru", ja: "もう{数|かぞ}えられるね！", en: "You can count now!" },
      { who: "narrator", en: "Five counters cover a surprising amount of daily life. The rest is detail: delightful, endless detail." }
    ]
  },
  "Around the shop": {
    intro: [
      { who: "narrator", en: "The stall has grown: there is room now for books and a shelf of gadgets. A boy presses his nose to the window." },
      { who: "kenta", ja: "マル、ゲームある？", en: "Maru, got any games?" },
      { who: "maru", ja: "{宿題|しゅくだい}は？", en: "What about your homework?" },
      { who: "kenta", ja: "…ノートを{一冊|いっさつ}ください。", en: "…One notebook, please." },
      { who: "narrator", en: "And now that money is changing hands, you will need to read prices too." }
    ],
    outro: [
      { who: "maru", ja: "お{店|みせ}らしくなってきたね。", en: "It's starting to look like a real shop." },
      { who: "narrator", en: "Books, machines, pets, drinks, prices. You can run the till without help now." }
    ]
  },
  "Clock and calendar": {
    intro: [
      { who: "narrator", en: "A man in a grey suit checks his watch, then the shop clock, then his watch again." },
      { who: "suzuki", ja: "すみません、{今|いま}{何時|なんじ}ですか。", en: "Excuse me, what time is it now?" },
      { who: "maru", ja: "{鈴木|すずき}さんは{時計|とけい}を{三|みっ}つ{持|も}っているのに。", en: "And Mr Suzuki owns three watches." },
      { who: "suzuki", ja: "{時間|じかん}は{大切|たいせつ}です。", en: "Time is precious." },
      { who: "narrator", en: "Times and dates use some of the oldest, strangest readings in the language. Mr Suzuki will see that you practise." }
    ],
    outro: [
      { who: "maru", ja: "もう{遅刻|ちこく}しないね。", en: "No more being late." },
      { who: "narrator", en: "Yoji, kuji, tsuitachi, hatsuka. The ones everybody trips over, and you didn't." }
    ]
  },
  "Animals and clothes": {
    intro: [
      { who: "narrator", en: "Someone comes in with straw in her hair and a parrot on her shoulder." },
      { who: "yuki", ja: "こんにちは！{動物園|どうぶつえん}のゆきです。", en: "Hello! I'm Yuki, from the zoo." },
      { who: "maru", ja: "その{鳥|とり}も{買|か}い{物|もの}？", en: "Is the bird shopping too?" },
      { who: "yuki", ja: "この{子|こ}は{見|み}ているだけ。", en: "This one's just looking." },
      { who: "narrator", en: "Small animals, big animals, birds: each has its own counter. Yuki's shopping lists are going to be an education." }
    ],
    outro: [
      { who: "maru", ja: "{動物|どうぶつ}も{服|ふく}も{大丈夫|だいじょうぶ}。", en: "Animals, clothes: no problem." },
      { who: "narrator", en: "The parrot has learned to say “ichiwa”. Yuki is not sure how she feels about that." }
    ]
  },
  "Food and drink": {
    intro: [
      { who: "narrator", en: "The sushi chef from across the street ducks through the doorway. He does not so much speak as announce." },
      { who: "taisho", ja: "マル！{今日|きょう}の{魚|さかな}はいいぞ！", en: "Maru! Today's fish is good!" },
      { who: "maru", ja: "{大将|たいしょう}、{声|こえ}が{大|おお}きい。", en: "Chef, you're loud." },
      { who: "taisho", ja: "{新人|しんじん}か。すしは{一貫|いっかん}、{二貫|にかん}と{数|かぞ}えるんだ。", en: "The new one, eh? Sushi is counted ikkan, nikan." },
      { who: "narrator", en: "Plates, slices, skewers, boxes: food has more counters than anything else in the shop." }
    ],
    outro: [
      { who: "maru", ja: "お{腹|なか}がすいた…", en: "Now I'm hungry…" },
      { who: "narrator", en: "The Chef sends over a plate to celebrate. One plate: hitosara. You count it before you eat it." }
    ]
  },
  "How long, how often": {
    intro: [
      { who: "narrator", en: "A traveller with an enormous backpack studies the shelves, then her phrasebook, then the shelves." },
      { who: "maria", ja: "すみません。{日本語|にほんご}、まだ{下手|へた}です。", en: "Sorry. My Japanese is still bad." },
      { who: "maru", ja: "{大丈夫|だいじょうぶ}。この{人|ひと}も{勉強中|べんきょうちゅう}だよ。", en: "It's fine. This one is still learning too." },
      { who: "maria", ja: "{日本|にほん}に{三|さん}か{月|げつ}います。", en: "I will be in Japan for three months." },
      { who: "narrator", en: "How long, how many nights, how many weeks: Maria needs exactly the words you are about to learn." }
    ],
    outro: [
      { who: "maru", ja: "{旅行|りょこう}の{計画|けいかく}もできるね。", en: "You could plan a whole trip now." },
      { who: "narrator", en: "Maria asks you, not Maru, how to say “two nights”. You know." }
    ]
  },
  "Buildings and vehicles": {
    intro: [
      { who: "narrator", en: "An old man in a railway cap sets a model train on the counter, very carefully." },
      { who: "yamamoto", ja: "{昔|むかし}、{駅|えき}で{働|はたら}いていました。", en: "I used to work at the station." },
      { who: "maru", ja: "{山本|やまもと}さんは{電車|でんしゃ}が{大好|だいす}き。", en: "Mr Yamamoto loves trains." },
      { who: "yamamoto", ja: "{電車|でんしゃ}は{一両|いちりょう}、{二両|にりょう}。{覚|おぼ}えてね。", en: "Carriages are ichiryō, niryō. Do remember." },
      { who: "narrator", en: "Houses, ships, planes, even chairs have counters of their own." }
    ],
    outro: [
      { who: "maru", ja: "{町|まち}のものは{何|なん}でも{数|かぞ}えられるね。", en: "You can count anything in town." },
      { who: "narrator", en: "Mr Yamamoto gives you the model train. One carriage: ichiryō. It sits by the till now." }
    ]
  },
  "Paper, culture and more": {
    intro: [
      { who: "narrator", en: "The last of the regulars arrives with ink on her fingers and a stack of envelopes." },
      { who: "sensei", ja: "こんにちは。{手紙|てがみ}を{出|だ}したいんです。", en: "Good afternoon. I would like to send some letters." },
      { who: "maru", ja: "{先生|せんせい}は{字|じ}がとてもきれい。", en: "Sensei's handwriting is beautiful." },
      { who: "sensei", ja: "{言葉|ことば}は、{数|かぞ}え{方|かた}まで{美|うつく}しいですよ。", en: "Words are beautiful, right down to the way we count them." },
      { who: "narrator", en: "Letters, songs, flowers, fireworks. These are the counters that show how much care the language takes." }
    ],
    outro: [
      { who: "maru", ja: "{本当|ほんとう}に、よくがんばった。", en: "You really did work hard." },
      { who: "narrator", en: "Sensei writes something on a card and props it by the till. It says: counted with care." }
    ]
  }
};

/* ---------- Text helpers ---------- */

/** Split "{漢字|かんじ}です" into [{ text: "漢字", ruby: "かんじ" }, { text: "です" }]. */
export function parseRuby(text) {
  const parts = [];
  const pattern = /\{([^|{}]+)\|([^|{}]+)\}/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: match[1], ruby: match[2] });
    last = pattern.lastIndex;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** The line as it is read aloud: kana in place of kanji. */
export function spokenText(text) {
  return parseRuby(text).map(part => part.ruby || part.text).join("");
}

/** The line as it is written: kanji, no furigana. */
export function writtenText(text) {
  return parseRuby(text).map(part => part.text).join("");
}

/* ---------- Progress ---------- */

export function emptyStory() {
  return { seen: [], friends: {} };
}

export function normalizeStory(saved) {
  const story = emptyStory();
  if (!saved || typeof saved !== "object") return story;
  if (Array.isArray(saved.seen)) story.seen = [...new Set(saved.seen.filter(id => typeof id === "string"))];
  const known = new Set(REGULARS.map(r => r.id));
  if (saved.friends && typeof saved.friends === "object") {
    Object.entries(saved.friends).forEach(([id, count]) => {
      if (known.has(id) && Number.isFinite(count) && count > 0) story.friends[id] = Math.floor(count);
    });
  }
  return story;
}

export const regularById = id => REGULARS.find(r => r.id === id) || null;

/** 0-3 hearts with a regular. */
export function hearts(count) {
  return HEART_STEPS.filter(step => (count || 0) >= step).length;
}

/** Regulars the player has met: their chapter's opening scene has played, or a counter of theirs is under way. */
export function metRegulars(data, progress) {
  const started = new Set(data.counters.filter(c => progress.unlocked.includes(c.counter)).map(c => c.group));
  const seen = new Set(progress.story.seen);
  return REGULARS.filter(r => started.has(r.chapter) || seen.has(`intro:${r.chapter}`));
}

/**
 * Which regular, if any, is the customer for a question about this counter.
 * Regulars shop for the things in their own chapter; strangers make up the rest.
 */
export function regularFor(counter, met, rng = Math.random) {
  const fans = met.filter(r => r.chapter === counter.group);
  if (!fans.length || rng() >= 0.6) return null;
  return fans[Math.floor(rng() * fans.length)];
}

/** Every scene in the game, in story order: [{ id, title, lines }]. */
export function allScenes(data) {
  const chapters = [...new Set(data.counters.map(c => c.group))].filter(name => CHAPTER_SCENES[name]);
  const scenes = [{ id: "opening", title: "A rainy evening", lines: OPENING }];
  chapters.forEach(name => {
    const regular = REGULARS.find(r => r.chapter === name);
    scenes.push({ id: `intro:${name}`, title: `${name}: a new regular`, lines: CHAPTER_SCENES[name].intro });
    if (regular) {
      regular.beats.forEach((lines, i) => {
        scenes.push({ id: `beat:${regular.id}:${i}`, title: `${regular.en} ${"♥".repeat(i + 1)}`, lines });
      });
    }
    scenes.push({ id: `outro:${name}`, title: `${name}: complete`, lines: CHAPTER_SCENES[name].outro });
  });
  scenes.push({ id: "finale", title: "Closing time", lines: FINALE });
  return scenes;
}

/**
 * Scenes that have been earned but not yet shown, in the order they should play.
 * (The opening and chapter introductions are not here: they play at fixed moments.)
 */
export function pendingScenes(data, progress) {
  const seen = new Set(progress.story.seen);
  const byId = new Map(allScenes(data).map(scene => [scene.id, scene]));
  const pending = [];
  const chapters = [...new Set(data.counters.map(c => c.group))].filter(name => CHAPTER_SCENES[name]);

  REGULARS.forEach(regular => {
    const earned = hearts(progress.story.friends[regular.id]);
    for (let i = 0; i < earned; i++) {
      const id = `beat:${regular.id}:${i}`;
      if (!seen.has(id) && byId.has(id)) {
        pending.push(byId.get(id));
        break; // one moment at a time per regular
      }
    }
  });

  const done = chapters.filter(name =>
    data.counters.filter(c => c.group === name).every(c => (counterStars(c, progress) || 0) >= 2));
  done.forEach(name => {
    if (!seen.has(`outro:${name}`)) pending.push(byId.get(`outro:${name}`));
  });

  if (chapters.length && chapters.every(name => seen.has(`outro:${name}`)) && !seen.has("finale")) {
    pending.push(byId.get("finale"));
  }
  return pending;
}

export function markSeen(story, sceneId) {
  if (!story.seen.includes(sceneId)) story.seen.push(sceneId);
}
