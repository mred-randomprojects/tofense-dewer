# Tofense Dewer

A very simple isometric tower defense that gets harder and harder — built phone-first (landscape).

A giant, grindy game on purpose: the first towers are junk, level 1 pays a single copper coin, and everything takes a long time.

**Loop:** pick a level → place towers (limited by Command slots) → START → win to get paid.
Money only comes from winning; first clears pay double; replay easy levels to grind — **⟳ Auto-repeat** replays a level with the same layout hands-free.

**Money:** one number shown in denominations of 1000: copper → silver → gold → diamond → emerald → ruby.

**Workshop (tech tree):** four ages, three roles each (single target / slows / splash that pierces armor):
Scrap Age (Slingshot, Tar Pot, Rock Catapult) → Iron Age (Crossbow, Chain Snare, Cannon) → Arcane Age (Spark Crystal, Frost Crystal, Ember Mortar) → Prism Age (Prism Lance, Stasis Obelisk, Meteor Beacon).
Each age's towers are paid in its own currency and start stronger than a maxed tower of the previous age. Future ages stay hidden until you reach them.

**Achievements:** 55 of them (levels, kills, brutes, flawless wins, first silver/gold/…, unlocks, mastering towers, grinding). Each is celebrated full-screen and gives a permanent +damage or +income bonus.

**Pacing** (from `npm run balance`, a strong auto-player; people will be slower): first silver ≈ 3h, Iron Age ≈ 7h, first gold ≈ 21h, Arcane Age ≈ 45–60h, first diamond ≈ 140h. The knobs are `HP_GROWTH` and `REWARD_GROWTH` in `js/data.js`.

- Run: `npm run serve` → http://localhost:8432 (`?dev` adds a 20× speed for testing)
- Test: `npm test`
- Balance check: `node tools/balance.mjs [maxLevel] [maxHours]` — an auto-player plays the whole game and prints estimated hours, grinding, unlocks and first coins.

## Files

- `js/data.js` — every number: towers, upgrade costs, enemies, level scaling, currencies. Balance here.
- `js/sim.js` — one level as a pure deterministic simulation (tile units, no DOM).
- `js/profile.js` — persistent progress: money, clears, Workshop purchases (saved to localStorage).
- `js/render.js` — isometric renderer; draws everything procedurally unless a sprite exists in `assets/`.
- `js/main.js` — screens (home, Workshop, battle, result) and input. Mouse: click places/removes. Touch: tap to preview, tap again to confirm.
- `js/mobile.js`, `js/audio.js` — phone support (zoom blocking, fullscreen) and synthesized sounds.

## Sprites

Prompts are in `art/PROMPTS.md`. Save ChatGPT's images into `art/` with the listed names and run `python3 tools/prep-sprites.py` — it keys out the magenta background, trims, and installs them into `assets/`. The game uses them automatically.
