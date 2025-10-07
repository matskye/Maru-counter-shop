# Maru-counter-shop
A fun little game to practice your Japanese counters

A browser-based game for practicing **Japanese counters**.  
Players serve customers in Maru’s shop by dragging the right number of items to the counter.
Requests are spoken aloud in Japanese (TTS) and support irregular counter readings (e.g. いっぴき, はっぽん).

## Voice playback

Open the in-game **Settings** menu to enable or disable voice prompts. When a browser does not
support the Web Speech API (or blocks it for privacy reasons), you can toggle **Use fallback voice
service** to stream audio from Google Translate’s public TTS endpoint. The fallback runs entirely in
the browser; no extra backend is required. Disable the toggle if you prefer not to load audio from
Google’s servers.
