import test from "node:test";
import assert from "node:assert/strict";
import { createBattle, place, start, step } from "../js/sim.js";
import { TOWER_IDS, COMMAND } from "../js/data.js";
import * as P from "../js/profile.js";

// A stand-in for localStorage.
function storage(entries = {}) {
  const items = new Map(Object.entries(entries));
  return {
    items,
    getItem: (k) => (items.has(k) ? items.get(k) : null),
    setItem: (k, v) => void items.set(k, String(v)),
  };
}

const saved = (profile) => storage({ [P.SAVE_KEY]: JSON.stringify(profile) });

test("nothing saved yet: a new profile, and nothing written", () => {
  const s = storage();
  const { profile, readOnly } = P.loadSave(s);
  assert.deepEqual(profile, P.newProfile());
  assert.equal(readOnly, false);
  assert.equal(s.items.size, 0);
});

test("a save loads back exactly as it was saved", () => {
  assert.deepEqual(P.loadSave(saved(P.newProfile())).profile, P.newProfile());
  const p = P.newProfile();
  const b = createBattle(1, P.towerStats(p), P.slots(p));
  place(b, "slingshot", 3, 2);
  place(b, "slingshot", 6, 3);
  start(b);
  while (b.phase === "running") step(b);
  P.recordBattle(p, b);
  P.checkAchievements(p, 1);
  p.money = 5000;
  P.buyUnlock(p, "tarpot");
  P.buyUpgrade(p, "slingshot", "damage");
  const s = saved(p);
  const { profile, readOnly } = P.loadSave(s);
  assert.deepEqual(profile, JSON.parse(JSON.stringify(p)));
  assert.equal(readOnly, false);
  assert.equal(s.getItem(P.BACKUP_KEY), null);
});

test("a save from before newer towers and stats existed gains them", () => {
  const old = { version: 2, money: 40, maxCleared: 3, clears: { 1: 2, 2: 1, 3: 1 }, command: 1, towers: { slingshot: { unlocked: true, upgrades: { damage: 5 } } }, stats: { kills: 30 }, achievements: { kills10: 1 } };
  const p = P.loadSave(saved(old)).profile;
  assert.deepEqual(Object.keys(p.towers), TOWER_IDS);
  assert.deepEqual(p.towers.slingshot.upgrades, { damage: 5, rate: 0, range: 0 });
  assert.deepEqual(p.towers.tarpot, P.newProfile().towers.tarpot);
  assert.deepEqual(p.stats, { ...P.newProfile().stats, kills: 30 });
  assert.equal(p.money, 40);
  assert.deepEqual(p.clears, { 1: 2, 2: 1, 3: 1 });
});

test("malformed fields load as their starting values instead of breaking the game", () => {
  const bad = {
    ...P.newProfile(),
    money: "lots",
    maxCleared: -5,
    command: 99,
    stats: { kills: "many", played: -1, wins: 4.5, later: 1 },
    achievements: [1, 2],
    towers: { slingshot: { unlocked: true, upgrades: { damage: -3, rate: "x", range: 2.7 } }, tarpot: "?" },
  };
  const p = P.migrate(JSON.parse(JSON.stringify(bad)));
  assert.equal(p.money, 0);
  assert.equal(p.maxCleared, 0);
  assert.equal(p.command, COMMAND.max);
  assert.deepEqual(p.stats, { ...P.newProfile().stats, wins: 4, later: 1 });
  assert.deepEqual(P.migrate({ ...P.newProfile(), stats: "nope" }).stats, P.newProfile().stats);
  assert.deepEqual(p.achievements, {});
  assert.deepEqual(p.towers.slingshot, { unlocked: true, upgrades: { damage: 0, rate: 0, range: 2 } });
  assert.deepEqual(p.towers.tarpot, P.newProfile().towers.tarpot);
  assert.ok(P.towerStats(p).slingshot.damage > 0);
});

test("unknown achievements and upgrade levels above today's max are kept", () => {
  const p = P.newProfile();
  p.achievements = { kills10: 1, retired_one: 2 };
  p.towers.slingshot.upgrades.damage = 33; // above the max of 30: clamp or refund is an open question
  const out = P.migrate(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(out.achievements, { kills10: 1, retired_one: 2 });
  assert.equal(out.towers.slingshot.upgrades.damage, 33);
  assert.equal(P.upgradeCost(out, "slingshot", "damage"), null);
});

test("clears: null loads as no clears, so the level list can still be priced", () => {
  const p = P.loadSave(saved({ ...P.newProfile(), clears: null })).profile;
  assert.deepEqual(p.clears, {});
  assert.equal(P.rewardFor(p, 1), 2);
});

test("a save from a newer version is left untouched and the game won't save over it", () => {
  for (const version of [3, "2", undefined]) {
    const raw = JSON.stringify({ ...P.newProfile(), version, money: 123456789, maxCleared: 150 });
    const s = storage({ [P.SAVE_KEY]: raw });
    const { profile, readOnly } = P.loadSave(s);
    assert.equal(readOnly, true, `version ${JSON.stringify(version)}`);
    assert.deepEqual(profile, P.newProfile());
    assert.equal(s.getItem(P.SAVE_KEY), raw);
    assert.equal(s.getItem(P.BACKUP_KEY), null);
  }
});

test("an unreadable or older save is backed up once, then the game starts fresh", () => {
  for (const raw of ["{not json", JSON.stringify({ version: 1, money: 7 }), "[]", "null"]) {
    const s = storage({ [P.SAVE_KEY]: raw });
    const { profile, readOnly } = P.loadSave(s);
    assert.deepEqual(profile, P.newProfile(), raw);
    assert.equal(readOnly, false);
    assert.equal(s.getItem(P.BACKUP_KEY), raw);
  }
  const s = storage({ [P.SAVE_KEY]: "{second", [P.BACKUP_KEY]: "{first" });
  P.loadSave(s);
  assert.equal(s.getItem(P.BACKUP_KEY), "{first", "an existing backup is never replaced");
});
