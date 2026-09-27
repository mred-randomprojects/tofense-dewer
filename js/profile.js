// The player's persistent progress: money, cleared levels, Workshop upgrades.
// Pure functions over a plain object; main.js saves it to localStorage.

import { TOWERS, TOWER_IDS, COMMAND, levelSpec } from "./data.js";

export function newProfile() {
  const towers = {};
  for (const id of TOWER_IDS) {
    towers[id] = { unlocked: TOWERS[id].unlockCost === 0, upgrades: Object.fromEntries(Object.keys(TOWERS[id].upgrades).map((k) => [k, 0])) };
  }
  return { version: 1, money: 0, maxCleared: 0, clears: {}, command: 0, towers };
}

// Fill in anything added to the game since this save was made.
export function migrate(p) {
  const fresh = newProfile();
  if (!p || typeof p !== "object") return fresh;
  const out = { ...fresh, ...p, towers: { ...fresh.towers } };
  for (const id of TOWER_IDS) {
    const t = p.towers?.[id];
    if (t) out.towers[id] = { unlocked: Boolean(t.unlocked) || fresh.towers[id].unlocked, upgrades: { ...fresh.towers[id].upgrades, ...t.upgrades } };
  }
  return out;
}

export function slots(p) {
  return COMMAND.base + p.command;
}

export function towerStats(p) {
  const out = {};
  for (const id of TOWER_IDS) if (p.towers[id].unlocked) out[id] = TOWERS[id].stats(p.towers[id].upgrades);
  return out;
}

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

// Paid only when a level is won. First clear pays double.
export function rewardFor(p, levelN) {
  const base = levelSpec(levelN).reward;
  return p.clears[levelN] ? base : base * 2;
}

export function recordWin(p, levelN) {
  const reward = rewardFor(p, levelN);
  p.money += reward;
  p.clears[levelN] = (p.clears[levelN] ?? 0) + 1;
  p.maxCleared = Math.max(p.maxCleared, levelN);
  return reward;
}
