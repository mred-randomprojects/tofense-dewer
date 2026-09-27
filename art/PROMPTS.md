# Tofense Dewer — sprite prompts (ChatGPT image generation)

Save each image into `art/` with the given name, then run:

    python3 tools/prep-sprites.py

It removes the magenta background, trims, and installs everything into `assets/`, where the game picks it up automatically (no code changes).

## Style block — paste at the start of EVERY prompt

> A single game sprite for a cute, colorful isometric tower-defense game. True 2:1 isometric view (classic "30° from above", camera looking from the south), soft light from the top-left, gentle outlines, rich saturated colors, polished mobile-game quality (think Kingdom Rush / Clash Royale, but simpler). ONE object only, centered, fully visible, nothing cropped. Solid flat magenta background (#FF00FF) everywhere around it — no shadow on the background, no ground, no scenery, no text, no UI.

(Magenta instead of "transparent" so the background can be removed perfectly. Don't draw the ground under objects — the game draws its own board and shadows.)

## Towers — they don't rotate, so each is ONE image

The game design uses crystals/objects that shoot magic, so no aiming poses are needed.

- `tower_spark.png`
  > A small stone pedestal (square, isometric) with a glowing golden-yellow crystal floating above it, little sparks around the crystal. Compact, sturdy, friendly.
- `tower_frost.png`
  > A small icy stone pedestal (square, isometric) with a pale-cyan ice crystal cluster floating above it, frost mist curling around, a few snowflakes.
- `tower_mortar.png`
  > A squat bronze-and-iron mortar cannon on a round stone base (isometric), short fat barrel pointing straight up, glowing orange ember vents, a little smoke.

## Enemies — one image each, facing the viewer (they bob, not walk)

- `enemy_slime.png`
  > A cute round green jelly slime with big shiny eyes and a small grin, glossy highlight on top.
- `enemy_runner.png`
  > A small fast orange imp/goblin creature mid-sprint, leaning forward, big ears, mischievous face. Chibi proportions.
- `enemy_beetle.png`
  > An armored purple beetle with a thick metallic shell plate on its back, stubby legs, determined little eyes. Clearly "armored".
- `enemy_boss.png`
  > A big red brute ogre-like monster, chibi but menacing, horns, heavy spiked shoulder armor, clenched fists. About twice as bulky as the other creatures.

## Board tiles (optional — the drawn board already looks fine)

Exact isometric tile geometry is hard for image generators, so try these last:

- `tile_grass.png`
  > One isometric grass tile block, a perfect 2:1 diamond top (twice as wide as tall) with lush green grass and a few tiny flowers, and a thin brown soil side visible below the front two edges.
- `tile_path.png`
  > One isometric dirt-path tile block, a perfect 2:1 diamond top with sandy packed dirt and tiny pebbles, and a thin brown soil side visible below the front two edges.

## Coins (for the wallet — later)

- `coins.png`
  > Five shiny round game coins in a row, isometric-ish 3/4 view, each a different material: copper, silver, gold, a cut blue diamond coin, a cut green emerald coin.

## Tips

- If a sprite comes out with a painted checkerboard or white background, ask again with "solid flat magenta #FF00FF background".
- Keep a winner as the reference: for the frost/mortar towers you can attach `tower_spark.png` and say "same style, same pedestal size, same lighting".
