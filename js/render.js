// Isometric renderer. World positions are in tiles (x = column, y = row);
// iso(x, y) projects them to the canvas. Every object is drawn procedurally,
// unless a sprite for it exists in assets/ (see ASSETS) — then the sprite wins.

import { GRID, PATH_TILES } from "./sim.js";
import { TOWERS, ENEMIES } from "./data.js";

export const VIEW_W = 700;
export const VIEW_H = 400;
const HALF_W = 32; // half a tile's width on screen
const HALF_H = 16; // half a tile's height on screen
const DEPTH = 10; // thickness of the board's edge blocks
const ORIGIN = { x: VIEW_W / 2, y: 58 };

export function iso(x, y) {
  return { x: ORIGIN.x + (x - y) * HALF_W, y: ORIGIN.y + (x + y) * HALF_H };
}

export function tileAtPoint(px, py) {
  const X = (px - ORIGIN.x) / HALF_W;
  const Y = (py - ORIGIN.y) / HALF_H;
  return { c: Math.floor((Y + X) / 2), r: Math.floor((Y - X) / 2) };
}

// Optional sprites (drawn with their bottom-centre on the tile centre).
// Drop PNGs with these names into assets/ and they replace the drawings.
export const ASSETS = {
  tile_grass: { w: 64 }, tile_path: { w: 64 },
  tower_spark: { w: 44 }, tower_frost: { w: 44 }, tower_mortar: { w: 48 },
  enemy_slime: { w: 26 }, enemy_runner: { w: 24 }, enemy_beetle: { w: 30 }, enemy_boss: { w: 44 },
};
const images = {};
// Resolves once every sprite has either loaded or turned out to be missing.
export async function loadAssets() {
  let available = [];
  try {
    const res = await fetch("assets/index.json", { cache: "no-cache" });
    if (res.ok) available = await res.json();
  } catch {
    /* no sprites yet: everything is drawn procedurally */
  }
  return Promise.all(
    Object.keys(ASSETS).filter((n) => available.includes(n)).map(
      (name) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            images[name] = img;
            resolve();
          };
          img.onerror = resolve;
          img.src = `assets/${name}.png`;
        }),
    ),
  );
}

function sprite(ctx, name, x, y, lift = 0) {
  const img = images[name];
  if (!img) return false;
  const w = ASSETS[name].w;
  const h = (img.height / img.width) * w;
  ctx.drawImage(img, x - w / 2, y - h - lift, w, h);
  return true;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  const fx = { particles: [], time: 0, shake: 0, flash: 0, pulses: new Map() };
  let board = buildBoard();
  let scale = 1;
  let offX = 0;
  let offY = 0;

  function resize(w, h) {
    const dpr = window.devicePixelRatio || 1;
    scale = Math.min(w / VIEW_W, h / VIEW_H);
    offX = (w - VIEW_W * scale) / 2;
    offY = (h - VIEW_H * scale) / 2;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  // CSS pixel (relative to canvas) -> tile
  function tileAt(px, py) {
    return tileAtPoint((px - offX) / scale, (py - offY) / scale);
  }

  function spawn(p) {
    if (fx.particles.length < 700) fx.particles.push(p);
  }

  function onEvents(events) {
    for (const e of events) {
      if (e.type === "shot") {
        fx.pulses.set(e.tower, fx.time);
        spawn({ kind: "bolt", tower: e.kind, a: iso(e.x0, e.y0), b: iso(e.x1, e.y1), age: 0, life: 0.1 });
      } else if (e.type === "lob") {
        fx.pulses.set(e.tower, fx.time);
      } else if (e.type === "boom") {
        const p = iso(e.x, e.y);
        spawn({ kind: "ring", x: p.x, y: p.y, rx: e.splash * HALF_W * 1.414, ry: e.splash * HALF_H * 1.414, age: 0, life: 0.4, color: "#ffb347" });
        spawn({ kind: "flash", x: p.x, y: p.y - 6, r: 16, age: 0, life: 0.15 });
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 40 + Math.random() * 90;
          spawn({ kind: "spark", x: p.x, y: p.y - 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 - 40, g: 160, age: 0, life: 0.5, color: i % 2 ? "#ffb347" : "#ff6a3d" });
        }
        fx.shake = Math.min(8, fx.shake + 2.5);
      } else if (e.type === "kill") {
        const p = iso(e.x, e.y);
        const col = ENEMIES[e.kind].color;
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 30 + Math.random() * 80;
          spawn({ kind: "spark", x: p.x, y: p.y - 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 50, g: 220, age: 0, life: 0.45 + Math.random() * 0.2, color: col });
        }
      } else if (e.type === "leak") {
        fx.shake = Math.min(10, fx.shake + 5);
        fx.flash = 0.25;
      } else if (e.type === "place") {
        const p = iso(e.c + 0.5, e.r + 0.5);
        spawn({ kind: "ring", x: p.x, y: p.y, rx: 26, ry: 13, age: 0, life: 0.35, color: TOWERS[e.tower].color });
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2;
          spawn({ kind: "spark", x: p.x, y: p.y, vx: Math.cos(a) * 50, vy: Math.sin(a) * 25 - 30, g: 100, age: 0, life: 0.4, color: "#ffffff" });
        }
      }
    }
  }

  function update(dt) {
    fx.time += dt;
    fx.shake *= Math.exp(-8 * dt);
    fx.flash = Math.max(0, fx.flash - dt);
    for (let i = fx.particles.length - 1; i >= 0; i--) {
      const p = fx.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        fx.particles.splice(i, 1);
        continue;
      }
      if (p.vx !== undefined) {
        p.vy += (p.g ?? 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
  }

  // ui: { selectedType, hover: {c, r} | null, armed, showRangeOf: tower | null }
  function draw(b, ui) {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#1c2433";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const s = scale * dpr;
    const sx = (Math.random() - 0.5) * fx.shake;
    const sy = (Math.random() - 0.5) * fx.shake;
    ctx.setTransform(s, 0, 0, s, (offX + sx) * dpr, (offY + sy) * dpr);

    ctx.drawImage(board, 0, 0);
    if (b) {
      drawHover(b, ui);
      // depth-sort everything standing on the board
      const things = [];
      for (const t of b.towers) things.push({ d: t.x + t.y, draw: () => drawTower(t, b) });
      for (const e of b.enemies) things.push({ d: e.x + e.y, draw: () => drawEnemy(e) });
      things.sort((p, q) => p.d - q.d);
      for (const th of things) th.draw();
      for (const sh of b.shells) drawShell(sh);
    }
    drawParticles();
    if (fx.flash > 0) {
      ctx.fillStyle = `rgba(255,40,60,${fx.flash * 0.8})`;
      ctx.fillRect(-50, -50, VIEW_W + 100, VIEW_H + 100);
    }
  }

  function rangeEllipse(x, y, range, color) {
    const p = iso(x, y);
    ctx.fillStyle = `${color}22`;
    ctx.strokeStyle = `${color}aa`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, range * HALF_W * 1.414, range * HALF_H * 1.414, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function drawHover(b, ui) {
    const h = ui.hover;
    if (!h || h.c < 0 || h.r < 0 || h.c >= GRID || h.r >= GRID) return;
    const existing = b.towers.find((t) => t.c === h.c && t.r === h.r);
    if (existing) {
      rangeEllipse(existing.x, existing.y, b.towerStats[existing.type].range, TOWERS[existing.type].color);
      tileOutline(h.c, h.r, ui.armed ? "#ff5a6a" : "#ffffff");
      return;
    }
    const type = ui.selectedType;
    const free = !PATH_TILES.has(`${h.c},${h.r}`);
    const ok = type && free && b.towers.length < b.slots && (b.phase === "prep" || b.phase === "running");
    if (ok) rangeEllipse(h.c + 0.5, h.r + 0.5, b.towerStats[type].range, TOWERS[type].color);
    tileOutline(h.c, h.r, ok ? (ui.armed ? "#ffd84a" : "#8fffa0") : "#ff5a6a");
    if (ok) {
      ctx.globalAlpha = 0.55;
      drawTower({ type, x: h.c + 0.5, y: h.r + 0.5, id: -1 }, b);
      ctx.globalAlpha = 1;
    }
  }

  function tileOutline(c, r, color) {
    const a = iso(c, r);
    const bb = iso(c + 1, r);
    const cc = iso(c + 1, r + 1);
    const d = iso(c, r + 1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(bb.x, bb.y);
    ctx.lineTo(cc.x, cc.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.stroke();
  }

  function drawTower(t, b) {
    const p = iso(t.x, t.y);
    const col = TOWERS[t.type].color;
    const since = fx.time - (fx.pulses.get(t.id) ?? -9);
    const kick = since < 0.12 ? 1 - since / 0.12 : 0;
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, 18, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    if (sprite(ctx, `tower_${t.type}`, p.x, p.y + 6)) {
      if (kick > 0) glow(p.x, p.y - 30, 14 * kick, col);
      return;
    }
    // stone pedestal (a small iso block)
    isoBlock(p.x, p.y, 13, 14, "#8d8fa3", "#6c6e82", "#56586b");
    const bob = Math.sin(fx.time * 2.5 + (t.id ?? 0)) * 1.5;
    const top = p.y - 16 - 10 + bob;
    if (t.type === "mortar") {
      // squat barrel
      ctx.fillStyle = "#3a3440";
      ctx.fillRect(p.x - 8, p.y - 30 + kick * 3, 16, 14);
      ctx.fillStyle = "#56505e";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 30 + kick * 3, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.fillRect(p.x - 8, p.y - 22 + kick * 3, 16, 2);
      glow(p.x, p.y - 31, 6 + 8 * kick, col);
      return;
    }
    // floating crystal
    glow(p.x, top, 12 + 10 * kick, col);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(p.x, top - 14);
    ctx.lineTo(p.x + 7, top);
    ctx.lineTo(p.x, top + 8);
    ctx.lineTo(p.x - 7, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.moveTo(p.x, top - 14);
    ctx.lineTo(p.x - 7, top);
    ctx.lineTo(p.x - 1, top);
    ctx.closePath();
    ctx.fill();
  }

  function isoBlock(x, y, hw, h, top, left, right) {
    const hh = hw / 2;
    ctx.fillStyle = left;
    ctx.beginPath();
    ctx.moveTo(x - hw, y - h);
    ctx.lineTo(x, y - h + hh);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x - hw, y);
    ctx.fill();
    ctx.fillStyle = right;
    ctx.beginPath();
    ctx.moveTo(x + hw, y - h);
    ctx.lineTo(x, y - h + hh);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x + hw, y);
    ctx.fill();
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.moveTo(x, y - h - hh);
    ctx.lineTo(x + hw, y - h);
    ctx.lineTo(x, y - h + hh);
    ctx.lineTo(x - hw, y - h);
    ctx.fill();
  }

  function glow(x, y, r, col) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `${col}cc`);
    g.addColorStop(1, `${col}00`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function drawEnemy(e) {
    const p = iso(e.x, e.y);
    const k = ENEMIES[e.kind];
    const big = e.kind === "boss" ? 1.8 : e.kind === "beetle" ? 1.15 : e.kind === "runner" ? 0.8 : 1;
    const hop = Math.abs(Math.sin(fx.time * (e.kind === "runner" ? 16 : 8) + e.id)) * 4 * big;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 9 * big, 4.5 * big, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!sprite(ctx, `enemy_${e.kind}`, p.x, p.y + 2, hop)) {
      const r = 8 * big;
      const cy = p.y - r - hop + 2;
      ctx.fillStyle = k.color;
      ctx.beginPath();
      if (e.kind === "beetle") {
        ctx.ellipse(p.x, cy + 2, r, r * 0.8, 0, Math.PI, 0);
        ctx.lineTo(p.x + r, cy + 4);
        ctx.lineTo(p.x - r, cy + 4);
      } else ctx.ellipse(p.x, cy, r, r * (e.kind === "runner" ? 0.9 : 0.85), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.ellipse(p.x - r * 0.35, cy - r * 0.35, r * 0.3, r * 0.2, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1420";
      ctx.fillRect(p.x - r * 0.35 - 1, cy - 1, 2, 3);
      ctx.fillRect(p.x + r * 0.35 - 1, cy - 1, 2, 3);
    }
    if (e.slow > 0) {
      ctx.fillStyle = "rgba(143,233,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 8 * big, 10 * big, 9 * big, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const f = Math.max(0, e.hp / e.maxHp);
    if (f < 1) {
      const w = 20 * Math.min(1.5, big);
      const y = p.y - 22 * big - hop;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(p.x - w / 2 - 1, y, w + 2, 4);
      ctx.fillStyle = f > 0.5 ? "#8fffa0" : f > 0.25 ? "#ffd84a" : "#ff5a6a";
      ctx.fillRect(p.x - w / 2, y + 1, w * f, 2);
    }
  }

  function drawShell(sh) {
    const t = sh.t / sh.life;
    const x = sh.x0 + (sh.x - sh.x0) * t;
    const y = sh.y0 + (sh.y - sh.y0) * t;
    const p = iso(x, y);
    const height = 70 * 4 * t * (1 - t) + 28 * (1 - t);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    glow(p.x, p.y - height, 9, "#ff7a45");
    ctx.fillStyle = "#2b2530";
    ctx.beginPath();
    ctx.arc(p.x, p.y - height, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParticles() {
    for (const p of fx.particles) {
      const t = p.age / p.life;
      ctx.globalAlpha = 1 - t;
      if (p.kind === "bolt") {
        const col = TOWERS[p.tower].color;
        ctx.strokeStyle = col;
        ctx.lineWidth = 3 * (1 - t) + 1;
        ctx.beginPath();
        ctx.moveTo(p.a.x, p.a.y - 28);
        ctx.lineTo(p.b.x, p.b.y - 8);
        ctx.stroke();
        glow(p.b.x, p.b.y - 8, 10, col);
      } else if (p.kind === "spark") {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      } else if (p.kind === "ring") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5 * (1 - t) + 0.5;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.rx * (0.3 + 0.7 * t), p.ry * (0.3 + 0.7 * t), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "flash") {
        glow(p.x, p.y, p.r * (1 + t), "#fff2c2");
      }
      ctx.globalAlpha = 1;
    }
  }

  // re-draw the static board (e.g. after tile sprites finished loading)
  function refreshBoard() {
    board = buildBoard();
  }

  return { resize, tileAt, onEvents, update, draw, refreshBoard };
}

/* ---------- the board (drawn once) ---------- */

function buildBoard() {
  const c = document.createElement("canvas");
  c.width = VIEW_W;
  c.height = VIEW_H;
  const g = c.getContext("2d");
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const imgGrass = images.tile_grass;
  const imgPath = images.tile_path;

  // board edge (the block's thickness under the front two sides)
  const L = iso(0, GRID);
  const B = iso(GRID, GRID);
  const R = iso(GRID, 0);
  g.fillStyle = "#6b4a2e";
  g.beginPath();
  g.moveTo(L.x, L.y);
  g.lineTo(B.x, B.y);
  g.lineTo(B.x, B.y + DEPTH * 2);
  g.lineTo(L.x, L.y + DEPTH * 2);
  g.fill();
  g.fillStyle = "#553a24";
  g.beginPath();
  g.moveTo(B.x, B.y);
  g.lineTo(R.x, R.y);
  g.lineTo(R.x, R.y + DEPTH * 2);
  g.lineTo(B.x, B.y + DEPTH * 2);
  g.fill();

  for (let s = 0; s <= 2 * (GRID - 1); s++) {
    for (let col = 0; col < GRID; col++) {
      const row = s - col;
      if (row < 0 || row >= GRID) continue;
      const path = PATH_TILES.has(`${col},${row}`);
      const a = iso(col, row);
      const b = iso(col + 1, row);
      const cc = iso(col + 1, row + 1);
      const d = iso(col, row + 1);
      const img = path ? imgPath : imgGrass;
      if (img) {
        const h = (img.height / img.width) * 64;
        g.drawImage(img, a.x - 32, a.y, 64, h);
        continue;
      }
      const light = (col + row) % 2 === 0;
      g.fillStyle = path ? (light ? "#e0c089" : "#d6b47b") : light ? "#6cbf5c" : "#63b454";
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.lineTo(cc.x, cc.y);
      g.lineTo(d.x, d.y);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(0,0,0,0.06)";
      g.stroke();
      // tiny details
      const cxm = (a.x + cc.x) / 2;
      const cym = (a.y + cc.y) / 2;
      for (let i = 0; i < (path ? 3 : 4); i++) {
        const ox = (rnd() - 0.5) * 34;
        const oy = (rnd() - 0.5) * 14;
        if (path) {
          g.fillStyle = "rgba(120,85,45,0.35)";
          g.fillRect(cxm + ox, cym + oy, 2, 2);
        } else {
          g.fillStyle = rnd() < 0.15 ? "#f7e27a" : "rgba(30,90,30,0.45)";
          g.fillRect(cxm + ox, cym + oy, 1, 3);
        }
      }
    }
  }
  return c;
}

