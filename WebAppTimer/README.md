# WebAppTimer

A lightweight, single-page **time tracker** that runs entirely in the browser.
No account, no backend — every entry is stored in `localStorage` on the device
you use it from.

## Features

- **Live timer** — type what you're working on (plus an optional project) and
  hit *Start*. The running clock shows in the page and the browser tab title.
  *Pause* / *Continue* stops the clock without ending the entry (paused time is
  not counted); *Stop & save* writes a log entry; *Discard* throws it away. A
  running or paused timer survives a page reload.
- **Manual entries** — add time after the fact from a start/end time or a plain
  duration like `1h 30m`, `90m`, or `1.5h`.
- **Summary** — Today / This week / entry count / distinct days tracked.
- **Range view** — switch the log and the per-project breakdown between
  *Today*, *This week*, and *All time*.
- **Per-project breakdown** — bar chart of where the time in the current range
  went.
- **Edit / delete / resume** any entry. *Resume* starts a fresh timer for the
  same task and project.
- **CSV export / import** — round-trips `task, project, date, start, end,
  duration_hours`. Import merges (it never overwrites).
- **Screenshot capture (opt-in)** — while a timer runs, grabs one frame from a
  shared screen/window/tab at a random point every 5–10 minutes. Requires the
  browser's Screen Capture API: clicking *Start timer* triggers the browser's
  own share picker and sharing indicator (a page can't screenshot silently —
  that's a browser security restriction, not a limitation of this app).
  Screenshots are stored as JPEGs in **IndexedDB**, tied to the log entry they
  belong to; review or delete them from a **📸** button on that entry. If the
  tab reloads mid-timer, capture pauses until you click *Resume screenshot
  sharing* (a fresh user click is required to re-grant sharing).

## Run locally

It's static. Open `index.html`, or serve the folder:

```bash
cd WebAppTimer
python3 -m http.server 8000
# http://localhost:8000
```

## Deploy to Firebase Hosting

Fully static, no build step. Project `hrvtools-app-28b2b`, site `wots-webapptimer`.
From this folder: `firebase deploy --only hosting`.
Live at https://wots-webapptimer.web.app

## Files

| File         | Purpose                                             |
|--------------|-----------------------------------------------------|
| `index.html` | Markup and the edit dialog                          |
| `styles.css` | Dark theme, layout                                  |
| `app.js`     | Timer, storage, rendering, CSV (vanilla ES module) |
| `firebase.json`| Host config                                      |

## Data & limits

- Storage is **per browser, per device**. Clearing site data wipes the log
  (and any saved screenshots) — export a CSV backup regularly.
- Times are stored as local epoch milliseconds; the CSV uses local date/time.
- Timers that cross midnight are handled (end rolls to the next day).
