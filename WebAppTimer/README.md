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

## Run locally

It's static. Open `index.html`, or serve the folder:

```bash
cd WebAppTimer
python3 -m http.server 8000
# http://localhost:8000
```

## Deploy

Static host, no build step. On Vercel: set the project root to `WebAppTimer`.
`vercel.json` enables `cleanUrls` and keeps `index.html` / CSS / JS revalidating
so updates aren't stuck behind a stale cache.

## Files

| File         | Purpose                                             |
|--------------|-----------------------------------------------------|
| `index.html` | Markup and the edit dialog                          |
| `styles.css` | Dark theme, layout                                  |
| `app.js`     | Timer, storage, rendering, CSV (vanilla ES module) |
| `vercel.json`| Host config                                        |

## Data & limits

- Storage is **per browser, per device**. Clearing site data wipes the log —
  export a CSV backup regularly.
- Times are stored as local epoch milliseconds; the CSV uses local date/time.
- Timers that cross midnight are handled (end rolls to the next day).
