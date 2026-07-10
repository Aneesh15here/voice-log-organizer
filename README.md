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

1. **Capture tab**: tap the big round **record button** once and start
   talking — that's the entire interaction. The button turns green and
   pulses with a "Listening…" label while it's capturing, with a live
   preview of the transcript underneath. It's one tap total: no separate
   "stop" step to remember.
2. Recording stops automatically as soon as the recognizer detects you've
   finished speaking (a short pause), or you can tap the button again to
   stop early. Either way, the transcript is immediately classified and
   **saved automatically** — a brief inline confirmation shows the saved
   text plus its assigned category/tag/date-time badges, with an **Undo**
   link if it saved something you didn't mean to keep.
3. Prefer typing? Expand **"Or type/paste a log manually"** for a text box
   with the same live classification preview and an explicit **Save log**
   button — a full substitute for voice, not just a fallback.
4. **Browse logs tab**: switch between **Work** and **Personal**, then
   filter by **All / Diary log / Reminders / Other-organizing**. When
   viewing Reminders, you can sort by upcoming date or newest first.
5. Every saved entry has its own **Category** and **Tag** dropdowns and a
   **Delete** button, so you can correct the auto-classification any time —
   the heuristics won't always get it right.
6. **⏰ Daily log reminder** (in the Capture tab, below the manual entry
   box): turn it on and pick a time, and once that time passes each day the
   app shows an in-app "Don't forget to add a log today!" banner (with a
   **Log now** shortcut that jumps to the record button, and a **Dismiss**
   that clears it for the rest of that day) — as long as you haven't logged
   anything yet that day. If your browser grants notification permission,
   you'll also get a real browser notification. See the limitation noted
   below — this only works while a browser is actually open/running.

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

- **Daily reminder has no backend, so it only works while a browser is
  open**: this app is 100% static/client-side with no server and no push
  subscription, so "every day" is implemented as a check that runs on page
  load and every 30 seconds while the app is open, comparing the current
  time to your saved reminder time. It will **not** fire after the
  browser/tab has been fully closed for the day — a true "notify me even
  if nothing is running" reminder would require a server-backed Web Push
  subscription, which is out of scope for a no-backend static app. In
  practice this means: if you keep a tab open (or the PWA installed and
  running), you'll get a real notification at the set time; otherwise,
  you'll get the in-app banner the next time you open the app that day.
- **"Logged today" check**: the reminder considers itself satisfied once
  *any* log (any category or tag) has been saved that calendar day, using
  the browser's local date/time.
- **One tap = one log**: the record button captures a single utterance and
  auto-stops on the first detected pause (`recognition.continuous = false`),
  which is the most reliable cross-browser "end of speech" signal. This
  means a long pause mid-sentence can end the recording early — if that
  happens, just tap the button again to record a follow-up log (or use the
  manual text box to combine/edit). This was a deliberate simplicity
  trade-off for a true one-touch flow over a stricter "keep listening no
  matter what" mode.
- **Auto-save confirmation window**: the inline "Saved: ..." banner (with
  its **Undo** link) auto-dismisses after 8 seconds. After that, removing
  or correcting an entry means using the Delete/Category/Tag controls in
  the Browse logs tab instead.
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
