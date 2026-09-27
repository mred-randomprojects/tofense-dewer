// All the game's numbers live here: currencies, ages, towers, upgrades,
// enemies, levels, achievements. Balance by editing this file, then check
// the pacing with `npm run balance`.

/* ---------- money ---------- */
// One number (in copper), displayed in denominations of 1000.
export const CURRENCIES = [
  { id: "copper", name: "copper", value: 1, color: "#e0894b" },
  { id: "silver", name: "silver", value: 1e3, color: "#cfd6e4" },
  { id: "gold", name: "gold", value: 1e6, color: "#ffd84a" },
  { id: "diamond", name: "diamond", value: 1e9, color: "#8fe9ff" },
  { id: "emerald", name: "emerald", value: 1e12, color: "#5cf08a" },
  { id: "ruby", name: "ruby", value: 1e15, color: "#ff5a7a" },
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

/* ---------- ages ---------- */
// Each age's towers are paid in its own currency and start stronger than a
// maxed tower of the previous age.
export const AGES = [
  { id: "scrap", name: "Scrap Age", unit: 1, power: 1, color: "#b98a5a" },
  { id: "iron", name: "Iron Age", unit: 1e3, power: 70, color: "#9aa3b5" },
  { id: "arcane", name: "Arcane Age", unit: 1e6, power: 70 ** 2, color: "#b98cff" },
  { id: "prism", name: "Prism Age", unit: 1e9, power: 70 ** 3, color: "#8fe9ff" },
];

/* ---------- tower roles ---------- */
// The three jobs a tower can do. Stats scale with the age's power (P) and the
// tower's upgrade levels (u). Costs are multiplied by the age's currency unit.
const ROLES = {
  bolt: {
    label: "single target",
    upgrades: {
      damage: { name: "Damage", max: 30, base: 2, growth: 1.3 },
      rate: { name: "Fire rate", max: 15, base: 4, growth: 1.42 },
      range: { name: "Range", max: 8, base: 6, growth: 1.7 },
    },
    stats: (P, u) => ({
      damage: P * 1.12 ** u.damage,
      cooldown: 80 * 0.96 ** u.rate,
      range: 1.8 + 0.12 * u.range,
    }),
  },
  chill: {
    label: "slows",
    upgrades: {
      slow: { name: "Chill", max: 15, base: 5, growth: 1.38 },
      damage: { name: "Damage", max: 20, base: 3, growth: 1.3 },
      range: { name: "Range", max: 8, base: 6, growth: 1.7 },
    },
    stats: (P, u) => ({
      damage: P * 0.3 * 1.12 ** u.damage,
      cooldown: 60,
      range: 1.6 + 0.12 * u.range,
      slow: 0.15 + 0.02 * u.slow,
      slowTicks: 60,
    }),
  },
  blast: {
    label: "splash · pierces armor",
    upgrades: {
      damage: { name: "Damage", max: 30, base: 4, growth: 1.3 },
      rate: { name: "Reload", max: 15, base: 6, growth: 1.42 },
      splash: { name: "Blast size", max: 10, base: 8, growth: 1.6 },
    },
    stats: (P, u) => ({
      damage: P * 3.5 * 1.12 ** u.damage,
      cooldown: 170 * 0.96 ** u.rate,
      range: 2.6,
      splash: 0.6 + 0.05 * u.splash,
      piercing: true,
      shellTicks: 40,
    }),
  },
};
export const ROLE_IDS = ["bolt", "chill", "blast"];
export const ROLE_LABEL = Object.fromEntries(ROLE_IDS.map((r) => [r, ROLES[r].label]));

/* ---------- towers ---------- */
// unlock: cost in the age's currency units (0 = owned from the start).
const DEFS = [
  ["slingshot", "Slingshot", "scrap", "bolt", 0, "A forked stick and a pouch of pebbles. It's… a start.", "#c9a06a"],
  ["tarpot", "Tar Pot", "scrap", "chill", 60, "Lobs sticky tar. Everything slows down in it.", "#6b5a44"],
  ["catapult", "Rock Catapult", "scrap", "blast", 120, "Heaves big rocks. Slow, but it squashes groups and armor.", "#9aa0aa"],
  ["crossbow", "Crossbow", "iron", "bolt", 4, "Steel bolts, proper aim. Finally a real weapon.", "#c0c8d8"],
  ["snare", "Chain Snare", "iron", "chill", 10, "Flings weighted chains that tangle legs.", "#8d95a6"],
  ["cannon", "Cannon", "iron", "blast", 25, "Black powder and iron balls. Loud and messy.", "#5a5f6b"],
  ["spark", "Spark Crystal", "arcane", "bolt", 4, "Crackling bolts from a floating crystal.", "#ffd84a"],
  ["frost", "Frost Crystal", "arcane", "chill", 10, "Chills everything it touches.", "#8fe9ff"],
  ["mortar", "Ember Mortar", "arcane", "blast", 25, "Heavy ember shells that punch through anything.", "#ff7a45"],
  ["prism", "Prism Lance", "prism", "bolt", 4, "A beam of focused light.", "#f4f8ff"],
  ["stasis", "Stasis Obelisk", "prism", "chill", 10, "Time itself gets thick around it.", "#b98cff"],
  ["meteor", "Meteor Beacon", "prism", "blast", 25, "Calls small stars down on your enemies.", "#ff5a7a"],
];

export const TOWERS = {};
for (const [id, name, age, role, unlock, blurb, color] of DEFS) {
  const A = AGES.find((a) => a.id === age);
  const R = ROLES[role];
  TOWERS[id] = {
    id, name, age, role, blurb, color,
    unlockCost: unlock * A.unit,
    upgrades: Object.fromEntries(
      Object.entries(R.upgrades).map(([k, u]) => [
        k,
        { name: u.name, max: u.max, cost: (l) => Math.round(u.base * A.unit * u.growth ** l) },
      ]),
    ),
    stats: (u) => R.stats(A.power, u),
  };
}
export const TOWER_IDS = DEFS.map((d) => d[0]);

// How many towers you can field in a level.
export const COMMAND = {
  name: "Command slots",
  blurb: "How many towers you can place in a level.",
  base: 2,
  max: 10,
  cost: (l) => Math.round(8 * 3.2 ** l),
};

/* ---------- enemies ---------- */
export const ENEMIES = {
  slime: { name: "Slime", hp: 1, speed: 1, armor: 0, color: "#6fdc6f" },
  runner: { name: "Runner", hp: 0.55, speed: 1.9, armor: 0, color: "#ffb347" },
  beetle: { name: "Beetle", hp: 2.2, speed: 0.7, armor: 0.35, color: "#7c6cff" },
  boss: { name: "Brute", hp: 10, speed: 0.55, armor: 0.2, color: "#ff5a7a" },
};
// armor = flat damage removed from every hit, as a share of this level's slime HP:
// damage dealt = max(10% of the hit, hit - armor). Blast towers ignore armor.

/* ---------- levels ---------- */
export const BASE_SPEED = 0.028; // tiles per tick for speed 1 (≈1.7 tiles/s)
export const HP_GROWTH = 1.07; // enemies get 7% tougher every level
export const REWARD_GROWTH = 1.08; // …and pay 8% more

export function levelSpec(n) {
  const hp = 1.5 * HP_GROWTH ** (n - 1);
  const count = Math.min(60, 6 + Math.floor(n / 3));
  // slimes first; runners from level 6, beetles from 15, a brute every 10th level
  const seq = [];
  for (let i = 0; i < count; i++) {
    let kind = "slime";
    if (n >= 6 && i % 3 === 1) kind = "runner";
    if (n >= 15 && i % 4 === 3) kind = "beetle";
    seq.push(kind);
  }
  if (n % 10 === 0) seq.push("boss");
  return {
    n,
    lives: 5,
    hp,
    armor: hp, // multiplied by each enemy kind's armor share
    spawnGap: Math.max(16, 50 - Math.floor(n / 4)),
    enemies: seq,
    reward: Math.max(1, Math.floor(REWARD_GROWTH ** (n - 1))),
  };
}

/* ---------- achievements ---------- */
// Each one gives a permanent bonus: +damage for all towers, or +income.
// value(stats, profile) -> current progress; goal -> needed value.
const ACH = [];
const BONUS_SCALE = 0.5; // tune how much achievements help overall
const add = (id, name, desc, icon, goal, value, bonus) =>
  ACH.push({ id, name, desc, icon, goal, value, bonus: Object.fromEntries(Object.entries(bonus).map(([k, v]) => [k, v * BONUS_SCALE])) });
for (const [n, b] of [[5, 0.02], [10, 0.03], [25, 0.04], [50, 0.05], [75, 0.05], [100, 0.06], [150, 0.07], [200, 0.08], [300, 0.1]]) {
  add(`clear${n}`, `Level ${n}`, `Clear level ${n}.`, "🏁", n, (s, p) => p.maxCleared, { income: b });
}
for (const [n, b] of [[10, 0.02], [100, 0.03], [1000, 0.04], [10000, 0.05], [100000, 0.06], [1000000, 0.08]]) {
  add(`kills${n}`, `${n.toLocaleString("en")} defeated`, `Defeat ${n.toLocaleString("en")} enemies.`, "⚔️", n, (s) => s.kills, { damage: b });
}
for (const [n, b] of [[1, 0.03], [10, 0.04], [50, 0.06]]) {
  add(`boss${n}`, n === 1 ? "Giant slayer" : `${n} brutes down`, `Defeat ${n} brute${n > 1 ? "s" : ""}.`, "👹", n, (s) => s.bosses, { damage: b });
}
for (const [n, b] of [[10, 0.03], [30, 0.04], [60, 0.05], [100, 0.06]]) {
  add(`flawless${n}`, `Flawless ${n}`, `Win level ${n} or higher without losing a single life.`, "💎", n, (s) => s.flawlessBest, { damage: b });
}
for (const [n, b] of [[25, 0.02], [100, 0.03], [500, 0.04], [2000, 0.05], [10000, 0.06]]) {
  add(`played${n}`, `Grinder ${n.toLocaleString("en")}`, `Play ${n.toLocaleString("en")} levels.`, "⛏️", n, (s) => s.played, { income: b });
}
for (const [cur, b] of [["silver", 0.05], ["gold", 0.07], ["diamond", 0.09], ["emerald", 0.1]]) {
  const c = CURRENCIES.find((x) => x.id === cur);
  add(`earn_${cur}`, `First ${cur}`, `Earn 1 ${cur} in total.`, "🪙", c.value, (s) => s.earned, { income: b });
}
for (const id of TOWER_IDS.slice(1)) {
  add(`unlock_${id}`, TOWERS[id].name, `Unlock the ${TOWERS[id].name}.`, "🔓", 1, (s, p) => (p.towers[id].unlocked ? 1 : 0), { damage: 0.02 });
}
for (const id of TOWER_IDS) {
  const total = Object.values(TOWERS[id].upgrades).reduce((a, u) => a + u.max, 0);
  add(`max_${id}`, `${TOWERS[id].name} mastered`, `Max every upgrade of the ${TOWERS[id].name}.`, "⭐", total, (s, p) => Object.values(p.towers[id].upgrades).reduce((a, v) => a + v, 0), { damage: 0.04 });
}
add("command_max", "Full command", "Buy every Command slot.", "🏰", COMMAND.max, (s, p) => p.command, { damage: 0.05 });
export const ACHIEVEMENTS = ACH;
