// Auto-player to check the pacing of the whole game:
//   node tools/balance.mjs [maxLevel=200] [maxHours=200]
// Plays like a reasonable human: fields the newest tower of each role, covers
// the most path per tower, tries a few tower mixes, grinds the highest level
// it can win after a loss, buys unlocks as soon as affordable, otherwise the
// cheapest useful upgrade (and saves up when an unlock is close).
// Play time is estimated as game time at 2x speed + 15s per level of setup.

import { createBattle, place, start, step, PATH_TILES, GRID, pointAt, PATH_LENGTH, TICK_HZ } from "../js/sim.js";
import { TOWERS, TOWER_IDS, ROLE_IDS, moneyParts, CURRENCIES } from "../js/data.js";
import * as P from "../js/profile.js";

const maxLevel = Number(process.argv[2] ?? 200);
const maxHours = Number(process.argv[3] ?? 200);
const SPEED = 2;
const SETUP_S = 15;

const samples = [];
for (let d = 0; d < PATH_LENGTH; d += 0.25) samples.push(pointAt(d));
const coverage = (c, r, range) => samples.filter((s) => (s.x - c - 0.5) ** 2 + (s.y - r - 0.5) ** 2 <= range * range).length;

// newest unlocked tower of each role
function active(p) {
  const out = {};
  for (const id of TOWER_IDS) if (p.towers[id].unlocked) out[TOWERS[id].role] = id;
  return out;
}

function planTowers(p, mix) {
  const act = active(p);
  const stats = P.towerStats(p);
  const n = P.slots(p);
  const chill = act.chill ? Math.min(n - 1, mix.chill) : 0;
  const blast = act.blast ? Math.round((n - chill) * mix.blast) : 0;
  const types = [];
  for (let i = 0; i < n; i++) types.push(i < chill ? act.chill : i < chill + blast ? act.blast : act.bolt);
  const used = new Set();
  const plan = [];
  for (const type of types) {
    let best = null;
    for (let c = 0; c < GRID; c++) {
      for (let r = 0; r < GRID; r++) {
        const k = `${c},${r}`;
        if (PATH_TILES.has(k) || used.has(k)) continue;
        const score = coverage(c, r, stats[type].range);
        if (!best || score > best.score) best = { c, r, score };
      }
    }
    used.add(`${best.c},${best.r}`);
    plan.push({ type, c: best.c, r: best.r });
  }
  return plan;
}

const MIXES = [];
for (const chill of [0, 1, 2]) for (const blast of [0, 0.3, 0.6]) MIXES.push({ chill, blast });

let playSeconds = 0;
function run(p, level, mix) {
  const b = createBattle(level, P.towerStats(p), P.slots(p));
  for (const t of planTowers(p, mix)) place(b, t.type, t.c, t.r);
  start(b);
  while (b.phase === "running") step(b);
  return b;
}

let lastMix = MIXES[0];
// one "play": the human tries their usual setup; if it loses they rethink (a second play)
function play(p, level) {
  let b = run(p, level, lastMix);
  playSeconds += b.tick / TICK_HZ / SPEED + SETUP_S;
  if (b.phase !== "won") {
    for (const mix of MIXES) {
      if (mix === lastMix) continue;
      const t = run(p, level, mix);
      if (t.phase === "won") {
        lastMix = mix;
        b = t;
        playSeconds += b.tick / TICK_HZ / SPEED + SETUP_S;
        break;
      }
    }
  }
  P.recordBattle(p, b);
  P.checkAchievements(p, 0);
  return b.phase === "won";
}

const events = [];
function shop(p) {
  for (;;) {
    const next = TOWER_IDS.find((id) => !p.towers[id].unlocked);
    if (next && p.money >= TOWERS[next].unlockCost) {
      P.buyUnlock(p, next);
      events.push(`unlocked ${TOWERS[next].name}`);
      P.checkAchievements(p, 0);
      continue;
    }
    const options = [];
    const cmd = P.commandCost(p);
    if (cmd !== null) options.push({ cost: cmd, buy: () => P.buyCommand(p) });
    for (const id of Object.values(active(p))) {
      for (const k of Object.keys(TOWERS[id].upgrades)) {
        const c = P.upgradeCost(p, id, k);
        if (c !== null) options.push({ cost: c, buy: () => P.buyUpgrade(p, id, k) });
      }
    }
    options.sort((a, b) => a.cost - b.cost);
    if (!options.length) return;
    const cheapest = options[0];
    // save up for an unlock that's within reach instead of nickel-and-diming
    if (next && TOWERS[next].unlockCost <= cheapest.cost * 15) return;
    if (cheapest.cost > p.money) return;
    cheapest.buy();
    P.checkAchievements(p, 0);
  }
}

const fmt = (v) => moneyParts(v).map((x) => `${x.amount} ${x.currency.name}`).join(" ");
const hrs = () => (playSeconds / 3600).toFixed(1).padStart(5);
const p = P.newProfile();
const milestones = new Set([1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 90, 100, 120, 140, 160, 180, 200, 250, 300]);
let grinds = 0;
let firstCurrency = 1;
console.log(" hours | level | plays | grinds since last | wallet          | slots | active towers (upgrade levels)");
while (p.maxCleared < maxLevel && playSeconds / 3600 < maxHours) {
  const target = p.maxCleared + 1;
  if (play(p, target)) {
    shop(p);
    const act = active(p);
    if (milestones.has(target)) {
      const desc = ROLE_IDS.filter((r) => act[r]).map((r) => `${act[r]} ${Object.values(p.towers[act[r]].upgrades).join("/")}`).join(", ");
      console.log(`${hrs()} | ${String(target).padStart(5)} | ${String(p.stats.played).padStart(5)} | ${String(grinds).padStart(17)} | ${fmt(p.money).padEnd(15)} | ${String(P.slots(p)).padStart(5)} | ${desc}`);
    }
    grinds = 0;
  } else {
    grinds++;
    for (let lv = p.maxCleared; lv >= 1; lv--) if (play(p, lv)) break;
    shop(p);
    if (grinds > 3000) {
      console.log(`STUCK at level ${target}`);
      break;
    }
  }
  while (firstCurrency < CURRENCIES.length && p.stats.earned >= CURRENCIES[firstCurrency].value) {
    events.push(`first ${CURRENCIES[firstCurrency].name}`);
    firstCurrency++;
  }
  for (const e of events.splice(0)) console.log(`${hrs()} |       ${e} (level ${p.maxCleared})`);
}
console.log(`\n${p.stats.played} levels played, ${hrs().trim()} hours, ${Object.keys(p.achievements).length} achievements, bonuses ${JSON.stringify(P.bonuses(p))}`);
