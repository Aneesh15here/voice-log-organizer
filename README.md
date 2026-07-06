# Voice Log Organizer

A single-page web app for quickly capturing voice or typed logs and having
them auto-sorted:

- **Category**: Diary log / Reminder / Other-organizing
- **Tag**: Work / Personal

Everything runs client-side — voice-to-text via the browser's built-in
Web Speech API, storage via `localStorage`. No accounts, no backend, no
database, no API keys.

## Running it locally

Any static file server works. From this folder:

```bash
python3 -m http.server 4321
```

Then open **http://localhost:4321** in a browser.

(Or use any other static server you like — e.g. `npx serve .`. Note: the
Web Speech API and service worker require `http://` or `https://`, and
Chrome only grants microphone access on `localhost` or a secure origin —
so a real local server is recommended over opening `index.html` directly
via `file://`.)

## Using it

1. **Capture tab**: click **Start recording** and speak, or just type/paste
   into the text box. As you type (or as speech is recognized), a live
   preview shows how the log would be classified — category, Work/Personal
   tag, and any date/time it picked up.
2. Click **Save log** to store it.
3. **Browse logs tab**: switch between **Work** and **Personal**, then
   filter by **All / Diary log / Reminders / Other-organizing**. When
   viewing Reminders, you can sort by upcoming date or newest first.
4. Every saved entry has its own **Category** and **Tag** dropdowns and a
   **Delete** button, so you can correct the auto-classification any time —
   the heuristics won't always get it right.

## Browser support for voice input

The Web Speech API (`SpeechRecognition`) is **not** a web standard with
universal support:

- **Chrome and Edge (desktop and Android)** support it well.
- **Safari** has partial/inconsistent support depending on version.
- **Firefox** does not support it.

If your browser doesn't support it, the mic button is disabled and a note
explains why — typing or pasting text is always available as a full
substitute, and classification works identically either way.

Voice input also requires:
- **Microphone permission**, granted via the browser's normal permission
  prompt the first time you click "Start recording".
- **A secure context** — `localhost` works for local development, but
  once deployed it needs `https://` (GitHub Pages serves over HTTPS by
  default, so the live version works fine).

## How the classification heuristics work

All classification logic lives in [`classify.js`](classify.js), kept
separate from the rest of the app (`app.js`) so it can be improved or
swapped out independently (e.g. for a real NLP model) later.

- **Category** (`classifyCategory`): checks the log text (lowercased) for
  keyword/phrase matches.
  - Phrases like *"remind me"*, *"don't forget"*, *"need to"*, *"due by"*,
    *"schedule a"* → **Reminder**. A bare date/time mention (see below)
    with no diary-style framing is also treated as a **Reminder** (e.g.
    "Dentist appointment 3pm Thursday").
  - Phrases like *"today I..."*, *"I felt..."*, *"reflecting on..."*,
    *"my day"* → **Diary log**.
  - Anything matching neither falls back to **Other/organizing** (general
    notes, ideas, lists).
- **Date/time extraction** (`extractDateTimeText`): a set of regex
  patterns looks for explicit times (`5pm`, `17:00`), numeric dates
  (`2026-07-06`, `5/7`), month-day mentions (`March 5th`), weekday names,
  and relative terms (`tomorrow`, `next week`). The first match found is
  shown alongside Reminder entries.
- **Work vs. Personal** (`classifyTag`): counts matches against a
  work-keyword list (*meeting, client, deadline, project, boss, colleague,
  email, report, standup, invoice...*) and a personal-keyword list
  (*family, friend, gym, vacation, dinner, doctor, weekend...*). Whichever
  list scores higher wins; ties default to **Personal**.

These are intentionally simple, transparent keyword rules — not machine
learning — so they're easy to read, predict, and extend. They won't be
perfect, which is why every entry's category and tag can be manually
overridden after the fact in the Browse view.

## Assumptions & notes

- **No transcription cleanup**: whatever the Web Speech API returns (or
  whatever you type) is classified and stored as-is — no spelling
  correction or punctuation normalization is applied.
- **Single-year date parsing**: the "sort by upcoming date" option parses
  extracted date/time text using the current year as a best-effort guess
  (the extractor itself doesn't capture a year unless you say one). If a
  reminder's text doesn't parse into a valid date, it sorts to the end of
  the upcoming-first list rather than erroring.
- **Default tag on a tie**: if a log has no clear work or personal
  keywords (or an equal number of both), it defaults to **Personal**.
- **Local-only storage**: logs are stored in the browser's `localStorage`
  on the device/browser you use — they aren't synced anywhere. Clearing
  browser data (or using a different browser/device) means a fresh, empty
  log.
- **PWA**: a `manifest.json`, an SVG icon, and a minimal service worker
  (caches only the static shell) are included so the app is installable to
  a phone home screen, matching the pattern used in the `aus-trip-weather`
  project in this same folder. This wasn't a strict requirement, just a
  nice-to-have for consistency.

## Files

- `index.html` — page structure (Capture view + Browse view)
- `style.css` — styling
- `classify.js` — isolated classification heuristics (category, tag, date/time extraction)
- `app.js` — speech recognition, localStorage persistence, rendering, filters
- `manifest.json`, `sw.js`, `icon.svg` — PWA installability
