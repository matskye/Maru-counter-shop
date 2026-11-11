# Maru's Counter Shop

A browser game for practicing **Japanese counters** (助数詞) with Maru the red panda: 57 counters in eight chapters, from 個 and 本 to 泊, 艘 and 貫, including readings above ten.

## How it works

**Shifts** are the heart of the game. A shift is a few minutes of customers in Maru's shop:

- Maru introduces counters **one at a time**, each with a short lesson (what it counts, readings 1–10, examples), chapter by chapter:

  | Chapter | Counters |
  | --- | --- |
  | First steps | 個 本 枚 人 つ |
  | Around the shop | 冊 台 匹 杯 円 |
  | Clock and calendar | 時 分 日 月 歳 回 階 |
  | Animals and clothes | 頭 羽 足 着 |
  | Food and drink | 缶 皿 切れ 袋 箱 膳 粒 玉 串 貫 束 |
  | How long, how often | 年 か月 週間 時間 泊 番 |
  | Buildings and vehicles | 軒 棟 機 両 隻 艘 脚 |
  | Paper, culture and more | 通 部 件 点 曲 問 輪 組 体 発 滴 名 |
- Every counter is broken into small things to remember: what it is used for, its regular readings, and one card for **each irregular reading** (いっぽん, さんぼん, ろっぽん…).
- Once the basics of a counter have stuck, it deepens with **numbers above ten** (じゅういっぽん, じゅうよにん, にじゅっぷん) and special readings such as 20日 はつか and 20歳 はたち.
- Those cards are scheduled with **spaced repetition**: something you get right comes back after 4 hours, then a day, 4 days, 10 days, and so on up to several months; something you miss comes back later in the same shift and again soon after.
- The whole course is a little over 300 cards. At one shift a day that is roughly half a year from zero; faster if you already know some of it or play more than one shift.
- A shift mixes the reviews that are due with a little new material. If you already know something the first time you see it, it skips ahead and Maru moves on faster.
- The home screen shows what is ready for review, your day streak, and 0–3 stars per counter.

Rewards are tied to learning rather than to time spent:

- **Yen**: every first-try correct answer in a shift earns ¥100, rising to ¥200 for answers in a row, plus ¥500 for a perfect shift. Free practice earns nothing, so there is no reason to grind.
- **Shop rank**: lifetime takings grow the shop from a 屋台 (street stall) through seven ranks to 日本一の店.
- **Decorations**: yen buys things for the shop front (lanterns, wind chimes, a torii gate…).
- **Stamp card**: 34 stamps for milestones such as a week-long streak, a perfect shift, finishing a chapter or three stars on a counter.
- **This week**: a seven-day strip on the home screen shows which days you played.

There is a little story too:

- An **opening scene** on first launch, and a short scene at the start and end of each chapter.
- Eight **regular customers**, one per chapter (Mrs Tanaka next door, Kenta and his cats, the ever-punctual Mr Suzuki…). They turn up as the customer for their chapter's counters and react to your answers in their own way of speaking.
- Answering a regular right first time during shifts earns **hearts**; each heart unlocks a small scene with them.
- Japanese lines in scenes always carry furigana and an English translation, and are read aloud if voice is on. **📖 Story** on the home screen lists your regulars and lets you replay any scene.

Customers ask three kinds of questions:

| Task | What you do | What it trains |
| --- | --- | --- |
| 🛒 **Serve** | A customer orders with only a number and a counter (「3本ください」). Put that many matching items on the counter. | Knowing what each counter is used for |
| 🧾 **Count** | Items are on the counter. Pick, or type, the right way to say how many there are (「鉛筆、さんぼんですね」). | Choosing the counter and producing the reading, including sound changes |
| 🔤 **Read** | For counters with nothing to put on a counter (時, 日, 歳, 円…): you see 「3日です」 and choose or type the reading. | みっか, よじ, はたち, じゅうよっか |
| 👂 **Order** | The customer names the item and says the amount with a native number (「りんごをみっつください」, 「お客さん、ふたり」). Put exactly that on the counter. | Recognising ひとつ…とお, ひとり, ふたり and friends |

Other features:

- **Free practice** (Serve / Count / Mix) and a ten-round **Challenge** for extra drilling with any counters you tick, weighted towards the ones you miss.
- **Counter guide** (📖 Counters): readings 1–10 for every counter with the irregular ones highlighted, example items, your stars and accuracy, and a "learn this one next" button to reorder the lesson plan.
- **Settings**: furigana, voice, listening practice (order text hidden), item names in Japanese/English/hidden, multiple choice or typed answers (hiragana or romaji).
- **Voice** uses the browser's own text-to-speech, so nothing is sent anywhere. It needs a Japanese voice on the device: Chrome, Edge and Safari have one; some browsers and Linux systems do not. Where there is none, the replay buttons and voice settings are hidden rather than left dead, and Settings explains why (with a "turn voice on anyway" button for devices that can speak but do not list their voices).
- Works with mouse, touch and keyboard (`Enter` = Done/Next, `1`–`4` = answer, `R` = replay, `H` = hint).

Progress and settings are stored in the browser's `localStorage`.

## Running it

The game is a static site with no build step, but it loads `data/counters.json` and ES modules, so it has to be served over HTTP (opening `index.html` straight from disk will not work):

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. It also works as-is on GitHub Pages.

## Project layout

```
index.html          page structure
style.css           styles
js/logic.js         game rules: readings, questions, answer checking, lesson plan and spaced repetition (no DOM)
js/rewards.js       yen, shop ranks, decorations and the stamp card (no DOM)
js/story.js         opening, chapter scenes, regular customers and their story beats
js/speech.js        text-to-speech with detection of a usable Japanese voice
js/app.js           UI and storage
data/counters.json  counters, readings and items
data/assets/        images
tests/              unit tests for the logic and the data file
```

Run the tests with Node 18+ (no dependencies):

```bash
npm test
```

## Adding counters and items

Everything the game knows lives in `data/counters.json`. Each counter looks like this:

```json
{
  "counter": "本",
  "reading": "ほん",
  "group": "First steps",
  "category": "long, thin objects",
  "note": "Shown as a hint and in the counter guide.",
  "confusable": ["枚", "個", "缶"],
  "readings": {
    "1": ["いっぽん"],
    "8": ["はっぽん", "はちほん"]
  },
  "items": [
    { "id": "pencil", "label_en": "pencil", "label_ja": "鉛筆", "kana": "えんぴつ",
      "image": "data/assets/items/pencil/pencil.png" },
    { "id": "umbrella", "label_en": "umbrella", "label_ja": "傘", "kana": "かさ", "emoji": "☂️" },
    { "id": "soda_can", "label_en": "can of soda", "label_ja": "缶ジュース", "kana": "かんジュース",
      "image": "data/assets/items/soda_can/soda_can.png", "also": ["個"] }
  ]
}
```

- `readings` needs an entry for every number from 1 to 10. Each is a list: the standard reading first, then any other reading that should be accepted (they are never offered as wrong answers).
- `confusable` lists counters learners mix this one up with; their items are preferred as distractors.
- `also` on an item lists other counters that are also correct for it. Such an item is accepted for those counters and never used as a wrong option for them.
- An item needs either an `image` or an `emoji`. Emoji are stand-ins for artwork that does not exist yet: to replace one, add a PNG under `data/assets/items/` and swap `emoji` for `image`.
- Item `id`s and `label_ja`s must be unique across the whole file.
- `group` is the chapter shown on the home screen.
- **Above ten** readings are built automatically from the last digit (13本 = じゅう + さんぼん, 20本 = に + じゅっぽん). Three optional fields adjust that:
  - `max`: the highest number the counter is used with (つ and the ひと〜/ふた〜 counters stop at 10, 時 and 月 at 12, 日 at 31).
  - `compound`: the reading a digit takes inside a bigger number when it differs from the stand-alone one (11人 is じゅう + いちにん, not じゅうひとり).
  - extra keys in `readings` for numbers with a reading of their own (`"20": ["はつか"]`). Each gets its own lesson card.
- `"abstract": true` marks counters with nothing to hand over a shop counter (time, dates, age, money). They are practised as reading questions only; their single item is just the picture and label shown with the number.
- A counter with an empty `items` list borrows every item that lists it under `also` (つ, and 名 for people).
- The order of the counters in the file is the order Maru teaches them in.
- A counter with `"generic": true` (つ) is never offered as a wrong answer, and `notFor` lists the counters whose items it must not be used for (people and animals).
- Lesson cards are derived automatically: a reading counts as irregular when it differs from plain number + counter reading.

`npm test` checks the file for missing readings, missing images and ambiguous questions.

## Writing story scenes

Scenes live in `js/story.js`. A line is either narration (`{ who: "narrator", en: "…" }`) or speech (`{ who: "maru" | <regular id>, ja: "…", en: "…" }`). Japanese text uses `{漢字|かんじ}` for furigana; `npm test` fails if any kanji is left without a reading.
