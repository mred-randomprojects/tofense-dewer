import test from "node:test";
import assert from "node:assert/strict";
import { createBattle, place, remove, start, step, canPlace, PATH_TILES, GRID, PATH_LENGTH } from "../js/sim.js";
import { moneyParts, levelSpec, TOWERS, TOWER_IDS, AGES, ACHIEVEMENTS } from "../js/data.js";
import * as P from "../js/profile.js";

const run = (b) => {
  while (b.phase === "running") step(b);
  return b;
};

test("path stays on the board", () => {
  assert.ok(PATH_TILES.size > 20);
  for (const k of PATH_TILES) {
    const [c, r] = k.split(",").map(Number);
    assert.ok(c >= 0 && r >= 0 && c < GRID && r < GRID);
  }
  assert.ok(PATH_LENGTH > 20);
});

test("placement rules: not on the path, not twice, not locked, not over the slot limit, remove only in prep", () => {
  const p = P.newProfile();
  const b = createBattle(1, P.towerStats(p), 2);
  assert.equal(canPlace(b, "slingshot", 1, 1), false, "path tile");
  assert.ok(place(b, "slingshot", 0, 0));
  assert.equal(place(b, "slingshot", 0, 0), false, "occupied");
  assert.equal(place(b, "tarpot", 0, 2), false, "tar pot is locked");
  assert.ok(place(b, "slingshot", 0, 2));
  assert.equal(place(b, "slingshot", 0, 3), false, "slots full");
  assert.ok(remove(b, 0, 2));
  start(b);
  assert.equal(remove(b, 0, 0), false, "can't remove during the round");
});

test("level 1: two slingshots win, an empty board loses", () => {
  const p = P.newProfile();
  const b = createBattle(1, P.towerStats(p), P.slots(p));
  place(b, "slingshot", 3, 2);
  place(b, "slingshot", 6, 3);
  start(b);
  assert.equal(run(b).phase, "won");
  const empty = createBattle(1, P.towerStats(p), 2);
  start(empty);
  assert.equal(run(empty).phase, "lost");
});

test("same setup => same result (deterministic)", () => {
  const p = P.newProfile();
  const go = () => {
    const b = createBattle(6, P.towerStats(p), 2);
    place(b, "slingshot", 3, 2);
    place(b, "slingshot", 6, 3);
    start(b);
    return run(b);
  };
  const a = go();
  const b = go();
  assert.deepEqual([a.tick, a.kills, a.lives], [b.tick, b.kills, b.lives]);
});

test("money: 1000 per denomination, tiny early rewards, paid only on a win, first clear double", () => {
  assert.deepEqual(moneyParts(12345).map((x) => [x.currency.id, x.amount]), [["silver", 12], ["copper", 345]]);
  assert.deepEqual(moneyParts(2_030_000).map((x) => [x.currency.id, x.amount]), [["gold", 2], ["silver", 30]]);
  assert.deepEqual(moneyParts(7).map((x) => [x.currency.id, x.amount]), [["copper", 7]]);
  assert.equal(levelSpec(1).reward, 1, "level 1 pays a single copper");
  const p = P.newProfile();
  const lost = createBattle(1, P.towerStats(p), 2);
  start(lost);
  run(lost);
  assert.equal(P.recordBattle(p, lost).reward, 0);
  assert.equal(p.stats.played, 1);
  const won = createBattle(1, P.towerStats(p), 2);
  place(won, "slingshot", 3, 2);
  place(won, "slingshot", 6, 3);
  start(won);
  run(won);
  assert.equal(P.recordBattle(p, won).reward, 2, "first clear: 1 copper x2");
  assert.equal(p.maxCleared, 1);
});

test("every age starts stronger than the previous age maxed out (per role)", () => {
  for (const role of ["bolt", "chill", "blast"]) {
    const ids = TOWER_IDS.filter((id) => TOWERS[id].role === role);
    assert.equal(ids.length, AGES.length);
    for (let i = 1; i < ids.length; i++) {
      const prev = TOWERS[ids[i - 1]];
      const maxed = prev.stats(Object.fromEntries(Object.entries(prev.upgrades).map(([k, u]) => [k, u.max])));
      const fresh = TOWERS[ids[i]].stats(Object.fromEntries(Object.keys(TOWERS[ids[i]].upgrades).map((k) => [k, 0])));
      const dps = (s) => s.damage / s.cooldown;
      assert.ok(dps(fresh) > dps(maxed), `${ids[i]} should beat a maxed ${ids[i - 1]}`);
    }
  }
});

test("achievements unlock, give bonuses, and never unlock twice", () => {
  const p = P.newProfile();
  p.stats.kills = 150;
  const got = P.checkAchievements(p, 1).map((a) => a.id);
  assert.ok(got.includes("kills10") && got.includes("kills100"));
  assert.ok(!got.includes("kills1000"));
  assert.ok(P.bonuses(p).damage > 0);
  assert.equal(P.checkAchievements(p, 2).length, 0);
  const dmgBefore = P.towerStats(P.newProfile()).slingshot.damage;
  assert.ok(P.towerStats(p).slingshot.damage > dmgBefore, "damage bonus applies to towers");
  assert.ok(ACHIEVEMENTS.length > 40);
});

test("workshop: can't buy without money; unlocks in any order cost their price", () => {
  const p = P.newProfile();
  assert.equal(P.buyUpgrade(p, "slingshot", "damage"), false);
  p.money = 1000;
  const before = P.towerStats(p).slingshot.damage;
  assert.ok(P.buyUpgrade(p, "slingshot", "damage"));
  assert.ok(P.towerStats(p).slingshot.damage > before);
  assert.ok(P.buyUnlock(p, "tarpot"));
  assert.ok(P.towerStats(p).tarpot);
  const slots = P.slots(p);
  assert.ok(P.buyCommand(p));
  assert.equal(P.slots(p), slots + 1);
});
