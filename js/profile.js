// The player's persistent progress: money, cleared levels, Workshop upgrades,
// lifetime stats and achievements. Pure functions over a plain object, plus
// loadSave(), which reads it from the storage it is given; main.js saves it to
// localStorage.

import { TOWERS, TOWER_IDS, COMMAND, ACHIEVEMENTS, levelSpec } from "./data.js";

export const SAVE_KEY = "tofense-dewer:v2";
export const BACKUP_KEY = "tofense-dewer:backup";
const VERSION = 2;

export function newProfile() {
  const towers = {};
  for (const id of TOWER_IDS) {
    towers[id] = { unlocked: TOWERS[id].unlockCost === 0, upgrades: Object.fromEntries(Object.keys(TOWERS[id].upgrades).map((k) => [k, 0])) };
  }
  return {
    version: VERSION,
    money: 0,
    maxCleared: 0,
    clears: {},
    command: 0,
    towers,
    stats: { kills: 0, bosses: 0, played: 0, wins: 0, earned: 0, flawlessBest: 0 },
    achievements: {}, // id -> unlocked timestamp (ms)
  };
}

/* ---------- saving ---------- */

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
// A whole number ≥ 0, or `fallback` for anything else.
const count = (v, fallback) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback);

// Read the save from `storage` (localStorage, or a stand-in in tests).
// Returns { profile, readOnly }. A save this version can't read is never lost:
// - nothing saved yet: a new profile;
// - from a newer version (or a version that isn't a number): a new profile
//   with readOnly set, so the caller never writes over that save;
// - not valid JSON, or from an older version: its raw text is copied to
//   BACKUP_KEY (unless a backup is already there), then a new profile;
// - otherwise the save, repaired by migrate().
export function loadSave(storage) {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) return { profile: newProfile(), readOnly: false };
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    /* backed up below */
  }
  if (isObject(data) && (typeof data.version !== "number" || data.version > VERSION)) {
    return { profile: newProfile(), readOnly: true };
  }
  if (isObject(data) && data.version === VERSION) {
    try {
      return { profile: migrate(data), readOnly: false };
    } catch {
      /* unreadable after all: backed up below */
    }
  }
  try {
    if (storage.getItem(BACKUP_KEY) === null) storage.setItem(BACKUP_KEY, raw);
  } catch {
    /* storage full or blocked: nothing more to do */
  }
  return { profile: newProfile(), readOnly: false };
}

// Fill in anything added to the game since this save was made, and reset any
// malformed field to its starting value so it can't break the game. Unknown
// keys are kept. Upgrade levels above a since-lowered max are kept as they are.
export function migrate(p) {
  const fresh = newProfile();
  if (!isObject(p) || p.version !== VERSION) return fresh;
  const savedStats = isObject(p.stats) ? p.stats : {};
  const stats = { ...fresh.stats, ...savedStats };
  for (const k of Object.keys(fresh.stats)) stats[k] = count(savedStats[k], fresh.stats[k]);
  const towers = { ...fresh.towers };
  for (const id of TOWER_IDS) {
    const t = isObject(p.towers) ? p.towers[id] : undefined;
    if (!isObject(t)) continue;
    const saved = isObject(t.upgrades) ? t.upgrades : {};
    const upgrades = { ...fresh.towers[id].upgrades, ...saved };
    for (const k of Object.keys(fresh.towers[id].upgrades)) upgrades[k] = count(saved[k], 0);
    towers[id] = { unlocked: Boolean(t.unlocked) || fresh.towers[id].unlocked, upgrades };
  }
  return {
    ...fresh,
    ...p,
    money: count(p.money, 0),
    maxCleared: count(p.maxCleared, 0),
    command: Math.min(count(p.command, 0), COMMAND.max),
    clears: isObject(p.clears) ? { ...p.clears } : {},
    towers,
    stats,
    achievements: isObject(p.achievements) ? { ...p.achievements } : {},
  };
}

/* ---------- bonuses from achievements ---------- */

export function bonuses(p) {
  const b = { damage: 0, income: 0 };
  for (const a of ACHIEVEMENTS) {
    if (!(a.id in p.achievements)) continue;
    b.damage += a.bonus.damage ?? 0;
    b.income += a.bonus.income ?? 0;
  }
  return b;
}

export function slots(p) {
  return COMMAND.base + p.command;
}

export function towerStats(p) {
  const dmg = 1 + bonuses(p).damage;
  const out = {};
  for (const id of TOWER_IDS) {
    if (!p.towers[id].unlocked) continue;
    const st = TOWERS[id].stats(p.towers[id].upgrades);
    out[id] = { ...st, damage: st.damage * dmg };
  }
  return out;
}

/* ---------- shop ---------- */

export function upgradeCost(p, towerId, key) {
  const lvl = p.towers[towerId].upgrades[key];
  const u = TOWERS[towerId].upgrades[key];
  return lvl >= u.max ? null : u.cost(lvl);
}

export function buyUpgrade(p, towerId, key) {
  const cost = upgradeCost(p, towerId, key);
  if (cost === null || !p.towers[towerId].unlocked || p.money < cost) return false;
  p.money -= cost;
  p.towers[towerId].upgrades[key] += 1;
  return true;
}

export function buyUnlock(p, towerId) {
  const t = p.towers[towerId];
  const cost = TOWERS[towerId].unlockCost;
  if (t.unlocked || p.money < cost) return false;
  p.money -= cost;
  t.unlocked = true;
  return true;
}

export function commandCost(p) {
  return p.command >= COMMAND.max ? null : COMMAND.cost(p.command);
}

export function buyCommand(p) {
  const cost = commandCost(p);
  if (cost === null || p.money < cost) return false;
  p.money -= cost;
  p.command += 1;
  return true;
}

/* ---------- levels ---------- */

// Paid only when a level is won. First clear pays double; achievements add income %.
export function rewardFor(p, levelN) {
  const base = levelSpec(levelN).reward * (p.clears[levelN] ? 1 : 2);
  return Math.max(1, Math.floor(base * (1 + bonuses(p).income)));
}

// Fold a finished battle into the profile. Returns { reward } (0 on a loss).
export function recordBattle(p, battle) {
  const s = p.stats;
  s.played += 1;
  s.kills += battle.kills;
  s.bosses += battle.bossKills ?? 0;
  if (battle.phase !== "won") return { reward: 0 };
  const n = battle.spec.n;
  const reward = rewardFor(p, n);
  p.money += reward;
  s.earned += reward;
  s.wins += 1;
  if (battle.lives === battle.spec.lives) s.flawlessBest = Math.max(s.flawlessBest, n);
  p.clears[n] = (p.clears[n] ?? 0) + 1;
  p.maxCleared = Math.max(p.maxCleared, n);
  return { reward };
}

/* ---------- achievements ---------- */

export function achievementProgress(p, a) {
  return Math.min(a.goal, a.value(p.stats, p));
}

// Unlock everything newly earned; returns the list of new achievements.
export function checkAchievements(p, now = Date.now()) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (a.id in p.achievements) continue;
    if (a.value(p.stats, p) >= a.goal) {
      p.achievements[a.id] = now;
      fresh.push(a);
    }
  }
  return fresh;
}
