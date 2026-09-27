# Tofense Dewer — sprite prompts (ChatGPT image generation)

Save each image into `art/` with the given name, then run:

    python3 tools/prep-sprites.py

It removes the magenta background, trims, and installs everything into `assets/`, where the game picks it up automatically (no code changes).

## Style block — paste at the start of EVERY prompt

> A single game sprite for a cute, colorful isometric tower-defense game. True 2:1 isometric view (classic "30° from above", camera looking from the south), soft light from the top-left, gentle outlines, rich saturated colors, polished mobile-game quality (think Kingdom Rush / Clash Royale, but simpler). ONE object only, centered, fully visible, nothing cropped. Solid flat magenta background (#FF00FF) everywhere around it — no shadow on the background, no ground, no scenery, no text, no UI.

(Magenta instead of "transparent" so the background can be removed perfectly. Don't draw the ground under objects — the game draws its own board and shadows.)

## Towers — one image each (they don't rotate)

Four ages, from junk to marvels. The first ones should look genuinely poor and improvised; each age should look clearly richer than the last. Keep the base footprint the same size for all of them.

**Scrap Age — improvised, shabby, wood and rope**
- `tower_slingshot.png`
  > A crude slingshot: a forked tree branch jammed into a mossy tree stump, a frayed leather strap, a couple of pebbles on the stump. Shabby and improvised.
- `tower_tarpot.png`
  > A dented, blackened iron cooking pot on a tree stump, full of bubbling black tar, a wooden ladle sticking out, drips down the side.
- `tower_catapult.png`
  > A small rickety wooden catapult lashed together with rope, a rock in its spoon, mounted on a flat log base. Handmade and wobbly.

**Iron Age — sturdy, grey stone and steel**
- `tower_crossbow.png`
  > A heavy steel crossbow mounted on a squat grey stone block, loaded with a bolt, riveted metal fittings. Solid and military.
- `tower_snare.png`
  > A grey stone block with a spinning iron drum on top wound with heavy chains ending in iron weights (bolas), ready to fling.
- `tower_cannon.png`
  > A black iron cannon angled upward on a wooden gun carriage, sitting on a grey stone block, a stack of cannonballs beside it.

**Arcane Age — magical, floating crystals, glowing**
- `tower_spark.png`
  > A carved stone pedestal with glowing runes, a golden-yellow crystal floating above it, crackling with little lightning sparks.
- `tower_frost.png`
  > A carved stone pedestal with glowing runes, a cluster of pale-cyan ice crystals floating above it, frost mist curling around, snowflakes.
- `tower_mortar.png`
  > A squat bronze mortar with glowing orange ember vents on a carved rune pedestal, short fat barrel pointing up, a wisp of smoke.

**Prism Age — pristine, white marble and light**
- `tower_prism.png`
  > A white marble pedestal with gold trim, a tall clear crystal prism floating above it splitting light into a small rainbow. Pristine and radiant.
- `tower_stasis.png`
  > A tall dark-violet obelisk on a white marble base, glowing purple runes, a faint clock-like ring of light hovering around it.
- `tower_meteor.png`
  > A white marble pedestal with a golden ring floating above it, a glowing red-pink star-orb hovering inside the ring, sparkles falling.

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
