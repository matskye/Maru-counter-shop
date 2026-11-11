# Maru's Counter Shop

A browser game for practicing **Japanese counters** (助数詞) with Maru the red panda.

## How it works

| Mode | What you do | What it trains |
| --- | --- | --- |
| 🛒 **Serve** | A customer orders with a number and a counter (「3本ください」). Put that many matching items on the counter. | Knowing what each counter is used for; listening |
| 🧾 **Count** | Items are on the counter. Pick, or type, the right way to say how many there are (「鉛筆、さんぼんですね」). | Choosing the counter and producing the reading, including sound changes (いっぽん, さんぼん, ろっぴき…) |
| 🔀 **Mix** | Both of the above, at random. | |

Other features:

- **Adaptive practice**: counters and numbers you miss come up more often, and a missed question returns a few rounds later.
- **Challenge**: ten rounds without hints, with a best score per mode.
- **Counter guide** (📖 Counters): readings 1–10 for every counter with the irregular ones highlighted, example items, your accuracy, and switches to choose which counters to practice.
- **Settings**: furigana, voice (text-to-speech), listening practice (order text hidden), item names in Japanese/English/hidden, numbers 1–5 or 1–10, multiple choice or typed answers (hiragana or romaji).
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
js/logic.js         game rules: readings, round generation, answer checking (no DOM)
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

`npm test` checks the file for missing readings, missing images and ambiguous questions.
