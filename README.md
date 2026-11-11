# Maru's Counter Shop

A browser game for practicing **Japanese counters** (助数詞) with Maru the red panda.

## How it works

**Shifts** are the heart of the game. A shift is a few minutes of customers in Maru's shop:

- Maru introduces counters **one at a time**, each with a short lesson (what it counts, readings 1–10, examples), starting with the most useful ones (個, 本, 枚, 人, つ…).
- Every counter is broken into small things to remember: what it is used for, its regular readings, and one card for **each irregular reading** (いっぽん, さんぼん, ろっぽん…).
- Those cards are scheduled with **spaced repetition**: something you get right comes back after 4 hours, then a day, 3 days, a week, and so on; something you miss comes back later in the same shift and again soon after.
- A shift mixes the reviews that are due with a little new material. If you already know something the first time you see it, it skips ahead and Maru moves on faster.
- The home screen shows what is ready for review, your day streak, and 0–3 stars per counter.

Customers ask three kinds of questions:

| Task | What you do | What it trains |
| --- | --- | --- |
| 🛒 **Serve** | A customer orders with only a number and a counter (「3本ください」). Put that many matching items on the counter. | Knowing what each counter is used for |
| 🧾 **Count** | Items are on the counter. Pick, or type, the right way to say how many there are (「鉛筆、さんぼんですね」). | Choosing the counter and producing the reading, including sound changes |
| 👂 **Order** | The customer names the item and says the amount with a native number (「りんごをみっつください」, 「お客さん、ふたり」). Put exactly that on the counter. | Recognising ひとつ…とお, ひとり, ふたり and friends |

Other features:

- **Free practice** (Serve / Count / Mix) and a ten-round **Challenge** for extra drilling with any counters you tick, weighted towards the ones you miss.
- **Counter guide** (📖 Counters): readings 1–10 for every counter with the irregular ones highlighted, example items, your stars and accuracy, and a "learn this one next" button to reorder the lesson plan.
- **Settings**: furigana, voice (text-to-speech), listening practice (order text hidden), item names in Japanese/English/hidden, multiple choice or typed answers (hiragana or romaji).
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
js/app.js           UI, storage, speech
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
    { "id": "soda_can", "label_en": "can of soda", "label_ja": "缶ジュース", "kana": "かんジュース",
      "image": "data/assets/items/soda_can/soda_can.png", "also": ["個"] }
  ]
}
```

- `readings` needs an entry for every number from 1 to 10. Each is a list: the standard reading first, then any other reading that should be accepted (they are never offered as wrong answers).
- `confusable` lists counters learners mix this one up with; their items are preferred as distractors.
- `also` on an item lists other counters that are also correct for it. Such an item is accepted for those counters and never used as a wrong option for them.
- Item `id`s must be unique across the whole file.
- The order of the counters in the file is the order Maru teaches them in.
- A counter with `"generic": true` (つ) has no items of its own: it borrows every item that lists it under `also`, is never offered as a wrong answer, and `notFor` lists the counters whose items it must not be used for (people and animals).
- Lesson cards are derived automatically: a reading counts as irregular when it differs from plain number + counter reading.

`npm test` checks the file for missing readings, missing images and ambiguous questions.
