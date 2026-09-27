# Tofense Dewer

A very simple isometric tower defense that gets harder and harder — built phone-first (landscape).

**Loop:** pick a level → place towers (limited by Command slots) → START → win to get paid.
Money only comes from winning; first clears pay double; replay easy levels to grind.
Spend it in the **Workshop**: upgrade the Spark Crystal, unlock Frost (slows) and the Ember Mortar (armor-piercing splash), buy more Command slots.
Money is one number shown in denominations: 100 copper = 1 silver, 100 silver = 1 gold, then diamond, emerald, ruby.

- Run: `npm run serve` → http://localhost:8432 (`?dev` adds a 20× speed for testing)
- Test: `npm test`
- Balance check: `npm run balance` — an auto-player plays up to level N and prints where it had to grind, what it bought and when.

## Files

- `js/data.js` — every number: towers, upgrade costs, enemies, level scaling, currencies. Balance here.
- `js/sim.js` — one level as a pure deterministic simulation (tile units, no DOM).
- `js/profile.js` — persistent progress: money, clears, Workshop purchases (saved to localStorage).
- `js/render.js` — isometric renderer; draws everything procedurally unless a sprite exists in `assets/`.
- `js/main.js` — screens (home, Workshop, battle, result) and input. Mouse: click places/removes. Touch: tap to preview, tap again to confirm.
- `js/mobile.js`, `js/audio.js` — phone support (zoom blocking, fullscreen) and synthesized sounds.

## Sprites

Prompts are in `art/PROMPTS.md`. Save ChatGPT's images into `art/` with the listed names and run `python3 tools/prep-sprites.py` — it keys out the magenta background, trims, and installs them into `assets/`. The game uses them automatically.
