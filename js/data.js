// All the game's numbers live here: towers, upgrades, enemies, levels, money.
// Balance by editing this file.

/* ---------- money ---------- */
// One number (in copper) displayed in denominations: 100 copper = 1 silver, etc.
export const CURRENCIES = [
  { id: "copper", name: "copper", value: 1, color: "#e0894b" },
  { id: "silver", name: "silver", value: 100, color: "#cfd6e4" },
  { id: "gold", name: "gold", value: 1e4, color: "#ffd84a" },
  { id: "diamond", name: "diamond", value: 1e6, color: "#8fe9ff" },
  { id: "emerald", name: "emerald", value: 1e8, color: "#5cf08a" },
  { id: "ruby", name: "ruby", value: 1e10, color: "#ff5a7a" },
];

// [{ currency, amount }] — the two largest non-zero denominations.
export function moneyParts(copper) {
  const v = Math.max(0, Math.floor(copper));
  let i = CURRENCIES.length - 1;
  while (i > 0 && v < CURRENCIES[i].value) i--;
  const big = CURRENCIES[i];
  const parts = [{ currency: big, amount: Math.floor(v / big.value) }];
  if (i > 0) {
    const small = CURRENCIES[i - 1];
    const rest = Math.floor((v % big.value) / small.value);
    if (rest > 0) parts.push({ currency: small, amount: rest });
  }
  return parts;
}

/* ---------- towers ---------- */
// Stats at upgrade levels (from the Workshop). Range is in tiles, cooldown in ticks (60/s).
export const TOWERS = {
  spark: {
    name: "Spark Crystal",
    blurb: "Fast single-target bolts. Your bread and butter.",
    unlockCost: 0,
    color: "#ffd84a",
    upgrades: {
      damage: { name: "Damage", max: 12, cost: (l) => Math.round(8 * 1.6 ** l) },
      rate: { name: "Fire rate", max: 10, cost: (l) => Math.round(10 * 1.6 ** l) },
      range: { name: "Range", max: 5, cost: (l) => Math.round(15 * 1.8 ** l) },
    },
    stats: (u) => ({
      damage: 1 * 1.28 ** u.damage,
      cooldown: 50 * 0.9 ** u.rate,
      range: 2.2 + 0.25 * u.range,
    }),
  },
  frost: {
    name: "Frost Crystal",
    blurb: "Chills everything it hits. Runners hate it.",
    unlockCost: 150,
    color: "#8fe9ff",
    upgrades: {
      slow: { name: "Chill", max: 6, cost: (l) => Math.round(40 * 1.7 ** l) },
      damage: { name: "Damage", max: 12, cost: (l) => Math.round(30 * 1.6 ** l) },
      range: { name: "Range", max: 5, cost: (l) => Math.round(40 * 1.8 ** l) },
    },
    stats: (u) => ({
      damage: 0.5 * 1.35 ** u.damage,
      cooldown: 40,
      range: 2 + 0.3 * u.range,
      slow: 0.3 + 0.05 * u.slow, // speed reduction
      slowTicks: 72,
    }),
  },
  mortar: {
    name: "Ember Mortar",
    blurb: "Slow, heavy splash shells that punch through armor.",
    unlockCost: 1500,
    color: "#ff7a45",
    upgrades: {
      damage: { name: "Damage", max: 20, cost: (l) => Math.round(200 * 1.5 ** l) },
      rate: { name: "Reload", max: 10, cost: (l) => Math.round(250 * 1.65 ** l) },
      splash: { name: "Blast size", max: 5, cost: (l) => Math.round(300 * 1.8 ** l) },
    },
    stats: (u) => ({
      damage: 40 * 1.3 ** u.damage, // starts competitive with a mid-upgraded Spark
      cooldown: 130 * 0.9 ** u.rate,
      range: 3.2,
      splash: 0.9 + 0.12 * u.splash, // tiles
      piercing: true,
      shellTicks: 40, // flight time
    }),
  },
};
export const TOWER_IDS = ["spark", "frost", "mortar"];

// How many towers you can field in a level.
export const COMMAND = {
  name: "Command slots",
  blurb: "How many towers you can place in a level.",
  base: 3,
  max: 7,
  cost: (l) => Math.round(20 * 2.1 ** l),
};

/* ---------- enemies ---------- */
export const ENEMIES = {
  slime: { name: "Slime", hp: 1, speed: 1, armor: 0, color: "#6fdc6f" },
  runner: { name: "Runner", hp: 0.55, speed: 1.9, armor: 0, color: "#ffb347" },
  beetle: { name: "Beetle", hp: 2.2, speed: 0.7, armor: 1, color: "#7c6cff" },
  boss: { name: "Brute", hp: 10, speed: 0.55, armor: 0.6, color: "#ff5a7a" },
};
// armor = flat damage removed from every hit (scaled up per level in levelSpec):
// damage dealt = max(10% of the hit, hit - armor). Mortar shells ignore armor.

/* ---------- levels ---------- */
export const BASE_SPEED = 0.028; // tiles per tick for speed 1 (≈1.7 tiles/s)

export function levelSpec(n) {
  const hp = 3 * 1.22 ** (n - 1);
  const armor = 0.5 + 0.25 * (n - 1);
  const count = Math.min(40, 8 + n);
  // composition: slimes first, then runners (lvl 4+), beetles (lvl 12+), a brute every 10th level
  const seq = [];
  for (let i = 0; i < count; i++) {
    let kind = "slime";
    if (n >= 4 && i % 3 === 1) kind = "runner";
    if (n >= 12 && i % 4 === 3) kind = "beetle";
    seq.push(kind);
  }
  if (n % 10 === 0) seq.push("boss");
  return {
    n,
    lives: 5,
    hp,
    armor,
    spawnGap: Math.max(24, 55 - n),
    enemies: seq,
    reward: Math.round(10 * 1.18 ** (n - 1)),
  };
}
