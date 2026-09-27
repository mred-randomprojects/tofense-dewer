// Tofense Dewer — one level ("battle") as a pure, deterministic simulation.
// Positions are in tile units (x = column, y = row); the renderer projects
// them to isometric. No DOM, no Math.random: same inputs => same outcome.

import { ENEMIES, BASE_SPEED, levelSpec } from "./data.js";

export const TICK_HZ = 60;
export const GRID = 10; // 10x10 board

// Path as tile waypoints (off-board start and end).
export const WAYPOINTS = [
  [-1, 1], [7, 1], [7, 4], [2, 4], [2, 7], [8, 7], [8, 10],
];

export const PATH_TILES = new Set();
for (let i = 0; i < WAYPOINTS.length - 1; i++) {
  const [c0, r0] = WAYPOINTS[i];
  const [c1, r1] = WAYPOINTS[i + 1];
  const dc = Math.sign(c1 - c0);
  const dr = Math.sign(r1 - r0);
  for (let c = c0, r = r0; ; c += dc, r += dr) {
    if (c >= 0 && r >= 0 && c < GRID && r < GRID) PATH_TILES.add(`${c},${r}`);
    if (c === c1 && r === r1) break;
  }
}

const PTS = WAYPOINTS.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 }));
const SEG = [];
let total = 0;
for (let i = 0; i < PTS.length - 1; i++) {
  const len = Math.hypot(PTS[i + 1].x - PTS[i].x, PTS[i + 1].y - PTS[i].y);
  SEG.push({ a: PTS[i], b: PTS[i + 1], start: total, len });
  total += len;
}
export const PATH_LENGTH = total;

export function pointAt(dist) {
  for (const s of SEG) {
    if (dist <= s.start + s.len) {
      const t = Math.max(0, (dist - s.start) / s.len);
      return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
    }
  }
  return { ...PTS[PTS.length - 1] };
}

// towerStats: { spark: {...}, frost: {...} } for unlocked towers (see data.js); slots: max towers.
export function createBattle(levelN, towerStats, slots) {
  const spec = levelSpec(levelN);
  return {
    tick: 0,
    spec,
    towerStats,
    slots,
    phase: "prep", // prep -> running -> won | lost
    lives: spec.lives,
    spawnIndex: 0,
    spawnTimer: 0,
    towers: [],
    enemies: [],
    shells: [],
    kills: 0,
    bossKills: 0,
    nextId: 1,
    events: [],
    pending: [],
  };
}

/* ---------- player actions ---------- */

export function canPlace(b, type, c, r) {
  return (
    (b.phase === "prep" || b.phase === "running") &&
    Boolean(b.towerStats[type]) &&
    c >= 0 && r >= 0 && c < GRID && r < GRID &&
    !PATH_TILES.has(`${c},${r}`) &&
    !b.towers.some((t) => t.c === c && t.r === r) &&
    b.towers.length < b.slots
  );
}

export function place(b, type, c, r) {
  if (!canPlace(b, type, c, r)) return false;
  b.towers.push({ id: b.nextId++, type, c, r, x: c + 0.5, y: r + 0.5, cooldown: 0 });
  b.pending.push({ type: "place", tower: type, c, r });
  return true;
}

// Towers can be picked back up only before the round starts.
export function remove(b, c, r) {
  if (b.phase !== "prep") return false;
  const i = b.towers.findIndex((t) => t.c === c && t.r === r);
  if (i < 0) return false;
  b.towers.splice(i, 1);
  b.pending.push({ type: "remove", c, r });
  return true;
}

export function start(b) {
  if (b.phase !== "prep") return false;
  b.phase = "running";
  b.pending.push({ type: "start" });
  return true;
}

/* ---------- simulation ---------- */

function hit(b, e, dmg, piercing) {
  const dealt = piercing ? dmg : Math.max(dmg * 0.1, dmg - e.armor);
  e.hp -= dealt;
  return dealt;
}

export function step(b) {
  b.events = b.pending;
  b.pending = [];
  if (b.phase !== "running") return b.events;
  b.tick += 1;
  const spec = b.spec;

  // spawn
  if (b.spawnIndex < spec.enemies.length && --b.spawnTimer <= 0) {
    const kind = spec.enemies[b.spawnIndex++];
    const k = ENEMIES[kind];
    const hp = spec.hp * k.hp;
    b.enemies.push({
      id: b.nextId++, kind, dist: 0, hp, maxHp: hp,
      speed: BASE_SPEED * k.speed, armor: k.armor * spec.armor,
      slow: 0, slowTicks: 0, x: PTS[0].x, y: PTS[0].y,
    });
    b.spawnTimer = spec.spawnGap;
  }

  // move
  for (const e of b.enemies) {
    if (e.slowTicks > 0) e.slowTicks -= 1;
    else e.slow = 0;
    e.dist += e.speed * (1 - e.slow);
    const p = pointAt(e.dist);
    e.x = p.x;
    e.y = p.y;
  }

  // leaks
  for (const e of b.enemies) {
    if (e.dist >= PATH_LENGTH) {
      b.lives = Math.max(0, b.lives - (e.kind === "boss" ? 3 : 1));
      e.hp = -Infinity; // removed below, no reward
      b.events.push({ type: "leak", x: e.x, y: e.y });
    }
  }

  // towers
  for (const t of b.towers) {
    const st = b.towerStats[t.type];
    if (t.cooldown > 0) t.cooldown -= 1;
    if (t.cooldown > 0) continue;
    let target = null;
    for (const e of b.enemies) {
      if (e.hp <= 0) continue;
      if ((e.x - t.x) ** 2 + (e.y - t.y) ** 2 > st.range * st.range) continue;
      if (!target || e.dist > target.dist) target = e;
    }
    if (!target) continue;
    t.cooldown = st.cooldown;
    if (st.shellTicks) {
      // lob a shell at where the target will be when it lands
      const land = pointAt(target.dist + target.speed * (1 - target.slow) * st.shellTicks);
      b.shells.push({ id: b.nextId++, type: t.type, x0: t.x, y0: t.y, x: land.x, y: land.y, t: 0, life: st.shellTicks, damage: st.damage, splash: st.splash });
      b.events.push({ type: "lob", tower: t.id, x0: t.x, y0: t.y, x1: land.x, y1: land.y });
    } else {
      const dealt = hit(b, target, st.damage, st.piercing);
      if (st.slow) {
        target.slow = Math.max(target.slow, st.slow);
        target.slowTicks = st.slowTicks;
      }
      b.events.push({ type: "shot", tower: t.id, kind: t.type, x0: t.x, y0: t.y, x1: target.x, y1: target.y, dealt });
    }
  }

  // shells land
  for (const s of b.shells) {
    s.t += 1;
    if (s.t < s.life) continue;
    for (const e of b.enemies) {
      if (e.hp > 0 && (e.x - s.x) ** 2 + (e.y - s.y) ** 2 <= s.splash * s.splash) hit(b, e, s.damage, true);
    }
    b.events.push({ type: "boom", tower: s.type, x: s.x, y: s.y, splash: s.splash });
  }
  b.shells = b.shells.filter((s) => s.t < s.life);

  // deaths
  for (const e of b.enemies) {
    if (e.hp <= 0 && e.hp !== -Infinity) {
      b.kills += 1;
      if (e.kind === "boss") b.bossKills += 1;
      b.events.push({ type: "kill", kind: e.kind, x: e.x, y: e.y });
    }
  }
  b.enemies = b.enemies.filter((e) => e.hp > 0);

  // end
  if (b.lives <= 0) {
    b.phase = "lost";
    b.events.push({ type: "lost" });
  } else if (b.spawnIndex >= spec.enemies.length && b.enemies.length === 0 && b.shells.length === 0) {
    b.phase = "won";
    b.events.push({ type: "won" });
  }
  return b.events;
}
