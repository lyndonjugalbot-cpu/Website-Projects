# TCG Randomizer

A modern, animated pack-opening randomizer for trading card events. Tap a sealed pack, watch it
shake and burst open, and reveal a random card with a rarity-based glow/confetti payoff. Built to
run on a phone or tablet at a booth, with no backend and no internet dependency once loaded.

## How it works

- **Free mode** — no price shown, for giveaways/promos. Admin sets which cards are in the pool.
- **Paid mode** — shows a price per pack; staff taps "Payment Received" to confirm cash was
  collected before the pack opens. Tracks packs sold and remaining.
- Each mode has its own independent card pool, event name, and pull history.
- Cards are drawn without replacement from whatever quantity is left, weighted by how many of
  each card remain — once a card's stock hits 0 it drops out of the draw.
- All data (cards, prices, history, PIN) is stored in `localStorage` on the device — nothing
  leaves the browser, and it keeps working with no signal via the built-in offline cache
  (add to home screen for a full-screen kiosk app).

## Admin panel

Tap the gear icon (top right) and enter the PIN (default `1234`, change it under the Security
tab) to:
- Switch between Free/Paid mode and set the event name/price
- Add, edit, restock, or delete cards (name, rarity, quantity, optional image URL or upload)
- Restock all cards back to full quantity for a new event day
- View/clear pull history
- Change the admin PIN or wipe all data

Cards without an image get an auto-generated rarity-colored placeholder, so you can set up a
pool by name alone if you don't have card art on hand yet.

## Tech

Plain HTML/CSS/JS, no build step, no dependencies. Confetti and pack-opening animations are
hand-rolled (canvas + CSS keyframes) so the app has zero external runtime requests.

## Deploy

Static site — deployed via Firebase Hosting (`firebase deploy --only hosting` from this folder,
project `hrvtools-app-28b2b`, site `wots-tcg-randomizer`). Works on any static host if needed.
