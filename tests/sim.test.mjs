import test from "node:test";
import assert from "node:assert/strict";
import { createBattle, place, remove, start, step, canPlace, PATH_TILES, GRID, PATH_LENGTH } from "../js/sim.js";
import { moneyParts, levelSpec } from "../js/data.js";
import * as P from "../js/profile.js";

const run = (b) => {
  while (b.phase === "running") step(b);
  return b;
};

test("path stays on the board and is connected", () => {
  assert.ok(PATH_TILES.size > 20);
  for (const k of PATH_TILES) {
    const [c, r] = k.split(",").map(Number);
    assert.ok(c >= 0 && r >= 0 && c < GRID && r < GRID);
  }
  assert.ok(PATH_LENGTH > 20);
});

test("placement rules: not on the path, not twice, not over the slot limit, remove only in prep", () => {
  const p = P.newProfile();
  const b = createBattle(1, P.towerStats(p), 2);
  assert.equal(canPlace(b, "spark", 1, 1), false, "path tile");
  assert.ok(place(b, "spark", 0, 0));
  assert.equal(place(b, "spark", 0, 0), false, "occupied");
  assert.equal(place(b, "frost", 0, 2), false, "frost is locked");
  assert.ok(place(b, "spark", 0, 2));
  assert.equal(place(b, "spark", 0, 3), false, "slots full");
  assert.ok(remove(b, 0, 2));
  start(b);
  assert.equal(remove(b, 0, 0), false, "can't remove during the round");
});

test("level 1 is winnable with 3 starting towers; losing with none", () => {
  const p = P.newProfile();
  const b = createBattle(1, P.towerStats(p), P.slots(p));
  place(b, "spark", 3, 2);
  place(b, "spark", 6, 3);
  place(b, "spark", 3, 5);
  start(b);
  assert.equal(run(b).phase, "won");
  const empty = createBattle(1, P.towerStats(p), 3);
  start(empty);
  assert.equal(run(empty).phase, "lost");
});

test("same setup => same result (deterministic)", () => {
  const p = P.newProfile();
  const go = () => {
    const b = createBattle(6, P.towerStats(p), 3);
    place(b, "spark", 3, 2);
    place(b, "spark", 6, 3);
    start(b);
    return run(b);
  };
  const a = go();
  const b = go();
  assert.equal(a.tick, b.tick);
  assert.equal(a.kills, b.kills);
  assert.equal(a.lives, b.lives);
});

test("money: paid on win, first clear double, denominations", () => {
  const p = P.newProfile();
  const r1 = P.recordWin(p, 3);
  const r2 = P.recordWin(p, 3);
  assert.equal(r1, 2 * levelSpec(3).reward);
  assert.equal(r2, levelSpec(3).reward);
  assert.equal(p.maxCleared, 3);
  // shows the two largest denominations: 12,345 copper = 1 gold 23 silver (45 copper hidden)
  assert.deepEqual(moneyParts(12345).map((x) => [x.currency.id, x.amount]), [["gold", 1], ["silver", 23]]);
  assert.deepEqual(moneyParts(2_030_000).map((x) => [x.currency.id, x.amount]), [["diamond", 2], ["gold", 3]]);
  assert.deepEqual(moneyParts(250).map((x) => [x.currency.id, x.amount]), [["silver", 2], ["copper", 50]]);
  assert.deepEqual(moneyParts(7).map((x) => [x.currency.id, x.amount]), [["copper", 7]]);
});

test("workshop: can't buy without money, upgrades raise stats, unlock works", () => {
  const p = P.newProfile();
  assert.equal(P.buyUpgrade(p, "spark", "damage"), false);
  p.money = 10_000;
  const before = P.towerStats(p).spark.damage;
  assert.ok(P.buyUpgrade(p, "spark", "damage"));
  assert.ok(P.towerStats(p).spark.damage > before);
  assert.ok(P.buyUnlock(p, "frost"));
  assert.ok(P.towerStats(p).frost);
  const slots = P.slots(p);
  assert.ok(P.buyCommand(p));
  assert.equal(P.slots(p), slots + 1);
});
