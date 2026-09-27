// Auto-player to check the progression curve:
//   node tools/balance.mjs [levels=40]
// Plays like a reasonable human: covers the most path per tower, always tries
// the next level, grinds the last cleared level after a loss, and spends all
// money on the cheapest upgrade/unlock after every win.

import { createBattle, place, start, step, PATH_TILES, GRID, pointAt, PATH_LENGTH } from "../js/sim.js";
import { TOWERS, TOWER_IDS, moneyParts } from "../js/data.js";
import * as P from "../js/profile.js";

const maxLevel = Number(process.argv[2] ?? 40);

// path samples for coverage scoring
const samples = [];
for (let d = 0; d < PATH_LENGTH; d += 0.25) samples.push(pointAt(d));

function coverage(c, r, range) {
  let n = 0;
  for (const s of samples) if ((s.x - c - 0.5) ** 2 + (s.y - r - 0.5) ** 2 <= range * range) n++;
  return n;
}

function planTowers(p, mix = { frost: 0, mortar: 0 }) {
  const stats = P.towerStats(p);
  const n = P.slots(p);
  const types = [];
  const frost = stats.frost ? Math.min(n, mix.frost) : 0;
  const mortar = stats.mortar ? Math.round(n * mix.mortar) : 0;
  for (let i = 0; i < n; i++) types.push(i < frost ? "frost" : i < frost + mortar ? "mortar" : "spark");
  const spots = [];
  for (let c = 0; c < GRID; c++) for (let r = 0; r < GRID; r++) if (!PATH_TILES.has(`${c},${r}`)) spots.push({ c, r });
  const used = new Set();
  const plan = [];
  for (const type of types) {
    let best = null;
    for (const s of spots) {
      if (used.has(`${s.c},${s.r}`)) continue;
      const score = coverage(s.c, s.r, stats[type].range);
      if (!best || score > best.score) best = { ...s, score };
    }
    used.add(`${best.c},${best.r}`);
    plan.push({ type, c: best.c, r: best.r });
  }
  return plan;
}

const MIXES = [];
for (const frost of [0, 1, 2]) for (const mortar of [0, 0.25, 0.5]) MIXES.push({ frost, mortar });

function run(p, level, mix) {
  const b = createBattle(level, P.towerStats(p), P.slots(p));
  for (const t of planTowers(p, mix)) place(b, t.type, t.c, t.r);
  start(b);
  while (b.phase === "running") step(b);
  return b;
}

// Like a human experimenting: try a few tower mixes, keep the first that wins.
let lastMix = MIXES[0];
function play(p, level) {
  if (run(p, level, lastMix).phase === "won") return true;
  for (const mix of MIXES) {
    if (mix !== lastMix && run(p, level, mix).phase === "won") {
      lastMix = mix;
      return true;
    }
  }
  return false;
}

function shop(p) {
  for (;;) {
    const options = [];
    const cmd = P.commandCost(p);
    if (cmd !== null) options.push({ cost: cmd, buy: () => P.buyCommand(p) });
    for (const id of TOWER_IDS) {
      if (!p.towers[id].unlocked) {
        options.push({ cost: TOWERS[id].unlockCost, buy: () => P.buyUnlock(p, id) });
        continue;
      }
      for (const k of Object.keys(TOWERS[id].upgrades)) {
        const c = P.upgradeCost(p, id, k);
        if (c !== null) options.push({ cost: c, buy: () => P.buyUpgrade(p, id, k) });
      }
    }
    options.sort((a, b) => a.cost - b.cost);
    if (!options.length || options[0].cost > p.money) return;
    options[0].buy();
  }
}

const fmt = (v) => moneyParts(v).map((x) => `${x.amount} ${x.currency.name}`).join(" ");
const p = P.newProfile();
let attempts = 0;
let sinceProgress = 0;
const sparkMaxed = () => Object.entries(p.towers.spark.upgrades).every(([k, v]) => v >= TOWERS.spark.upgrades[k].max);
let sparkMaxedAt = null;
console.log("level | attempts so far | grinds for this level | money after | tech");
while (p.maxCleared < maxLevel && attempts < 3000) {
  const target = p.maxCleared + 1;
  attempts++;
  if (play(p, target)) {
    P.recordWin(p, target);
    const u = (id) => (p.towers[id].unlocked ? Object.values(p.towers[id].upgrades).join("/") : "locked");
    shop(p);
    if (sparkMaxedAt === null && sparkMaxed()) sparkMaxedAt = target;
    console.log(`${String(target).padStart(5)} | mix f${lastMix.frost}/m${lastMix.mortar} | ${String(attempts).padStart(15)} | ${String(sinceProgress).padStart(21)} | ${fmt(p.money).padEnd(18)} | slots ${P.slots(p)} spark ${u("spark")} frost ${u("frost")} mortar ${u("mortar")}`);
    sinceProgress = 0;
  } else {
    // grind the last cleared level once, then retry
    sinceProgress++;
    // grind the highest level we can still win (a human would drop down too)
    for (let lv = p.maxCleared; lv >= 1; lv--) {
      if (play(p, lv)) {
        P.recordWin(p, lv);
        break;
      }
    }
    shop(p);
    attempts++;
    if (sinceProgress > 400) {
      console.log(`stuck at level ${target} after ${sinceProgress} grinds; money ${fmt(p.money)}; profile`, JSON.stringify(p.towers), "slots", P.slots(p));
      const b = run(p, target, lastMix);
      console.log("  retry:", b.phase, "lives", b.lives, "kills", b.kills, "of", b.spec.enemies.length, "towers", b.towers.map((t) => t.type).join(","));
      break;
    }
  }
}
console.log(`spark fully maxed after clearing level ${sparkMaxedAt ?? "never"}`);
