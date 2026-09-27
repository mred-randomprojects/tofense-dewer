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
  tower_slingshot: { w: 40 }, tower_tarpot: { w: 40 }, tower_catapult: { w: 46 },
  tower_crossbow: { w: 44 }, tower_snare: { w: 44 }, tower_cannon: { w: 46 },
  tower_spark: { w: 44 }, tower_frost: { w: 44 }, tower_mortar: { w: 48 },
  tower_prism: { w: 44 }, tower_stasis: { w: 44 }, tower_meteor: { w: 48 },
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
        spawn({ kind: "ring", x: p.x, y: p.y, rx: e.splash * HALF_W * 1.414, ry: e.splash * HALF_H * 1.414, age: 0, life: 0.4, color: TOWERS[e.tower]?.color ?? "#ffb347" });
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
      for (const t of b.towers) things.push({ d: t.x + t.y, draw: () => drawTower(t) });
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
      drawTower({ type, x: h.c + 0.5, y: h.r + 0.5, id: -1 });
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

  function drawTower(t) {
    const p = iso(t.x, t.y);
    const col = TOWERS[t.type].color;
    const since = fx.time - (fx.pulses.get(t.id) ?? -9);
    const kick = since < 0.12 ? 1 - since / 0.12 : 0;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 2, 18, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    if (sprite(ctx, `tower_${t.type}`, p.x, p.y + 6)) {
      if (kick > 0) glow(p.x, p.y - 30, 14 * kick, col);
      return;
    }
    const bob = Math.sin(fx.time * 2.5 + (t.id ?? 0)) * 1.5;
    const age = TOWERS[t.type].age;
    // base: tree stump (scrap), stone block (iron), carved pedestal (arcane), white marble (prism)
    if (age === "scrap") stump(p.x, p.y);
    else if (age === "iron") isoBlock(p.x, p.y, 13, 12, "#9a9ca8", "#72747f", "#5b5d67");
    else if (age === "arcane") isoBlock(p.x, p.y, 13, 14, "#8d8fa3", "#6c6e82", "#56586b");
    else isoBlock(p.x, p.y, 13, 14, "#f2f4fa", "#c9cedb", "#aab0c0");
    const y0 = p.y - (age === "scrap" ? 10 : 14 + (age === "iron" ? -2 : 0));
    const D = TOWER_ART[t.type];
    D(p.x, y0, col, kick, bob);
  }

  function stump(x, y) {
    ctx.fillStyle = "#6b4a2e";
    ctx.fillRect(x - 10, y - 10, 20, 10);
    ctx.beginPath();
    ctx.ellipse(x, y, 10, 5, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = "#a8794a";
    ctx.beginPath();
    ctx.ellipse(x, y - 10, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7d5634";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y - 10, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function line(x0, y0, x1, y1, color, w) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function crystal(x, top, col, kick, h = 14, w = 7) {
    glow(x, top, 12 + 10 * kick, col);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, top - h);
    ctx.lineTo(x + w, top);
    ctx.lineTo(x, top + h * 0.55);
    ctx.lineTo(x - w, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.moveTo(x, top - h);
    ctx.lineTo(x - w, top);
    ctx.lineTo(x - 1, top);
    ctx.closePath();
    ctx.fill();
  }

  // one drawing per tower: (x, y = top of the base, color, kick 0..1 right after firing, bob)
  const TOWER_ART = {
    slingshot: (x, y, col, kick) => {
      line(x, y, x, y - 10, "#8a5a32", 3);
      line(x, y - 10, x - 6, y - 20, "#8a5a32", 3);
      line(x, y - 10, x + 6, y - 20, "#8a5a32", 3);
      const pull = 4 - kick * 4;
      line(x - 6, y - 20, x, y - 14 + pull, "#c9a06a", 1.5);
      line(x + 6, y - 20, x, y - 14 + pull, "#c9a06a", 1.5);
      circle(x, y - 14 + pull, 2, "#777");
    },
    tarpot: (x, y, col, kick) => {
      ctx.fillStyle = "#2c2a2e";
      ctx.beginPath();
      ctx.ellipse(x, y - 7, 9, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1512";
      ctx.beginPath();
      ctx.ellipse(x, y - 13, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      const bub = (Math.sin(fx.time * 5) + 1) * 1.5 + kick * 3;
      circle(x - 2, y - 14 - bub, 2, "#3b2e22");
      circle(x + 3, y - 13 - bub * 0.6, 1.5, "#4a3a2a");
    },
    catapult: (x, y, col, kick) => {
      ctx.fillStyle = "#7a5230";
      ctx.fillRect(x - 10, y - 5, 20, 5);
      const a = -0.9 + kick * 1.4;
      const ex = x + Math.cos(a) * 16;
      const ey = y - 5 + Math.sin(a) * 16;
      line(x - 4, y - 4, ex, ey, "#9a6a3a", 3);
      if (kick < 0.3) circle(ex, ey - 2, 3.5, "#9aa0aa");
    },
    crossbow: (x, y, col, kick) => {
      line(x - 9, y - 10, x + 9, y - 10, "#6b4a2e", 3);
      ctx.strokeStyle = "#c0c8d8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 4, 11, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      line(x - 9, y - 9, x, y - 10 + 3 * (1 - kick), "#e7ecff", 1);
      line(x + 9, y - 9, x, y - 10 + 3 * (1 - kick), "#e7ecff", 1);
    },
    snare: (x, y, col, kick) => {
      ctx.fillStyle = "#4a4d57";
      ctx.fillRect(x - 7, y - 14, 14, 12);
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = "#b4bccb";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x - 4 + i * 4, y - 16 - kick * 4, 2.5, 1.8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
    cannon: (x, y, col, kick) => {
      ctx.save();
      ctx.translate(x, y - 8);
      ctx.rotate(-0.6);
      ctx.fillStyle = "#2c2f37";
      ctx.fillRect(-3 - kick * 3, -4, 18, 8);
      ctx.fillStyle = "#474b56";
      ctx.fillRect(13 - kick * 3, -5, 3, 10);
      ctx.restore();
      circle(x - 4, y - 5, 4, "#6b4a2e");
      if (kick > 0) glow(x + 11, y - 20, 8 * kick, "#ffb347");
    },
    spark: (x, y, col, kick, bob) => crystal(x, y - 12 + bob, col, kick),
    frost: (x, y, col, kick, bob) => {
      crystal(x - 4, y - 10 + bob, col, kick, 11, 5);
      crystal(x + 4, y - 12 + bob, col, 0, 13, 5);
    },
    mortar: (x, y, col, kick) => {
      ctx.fillStyle = "#3a3440";
      ctx.fillRect(x - 8, y - 16 + kick * 3, 16, 14);
      ctx.fillStyle = "#56505e";
      ctx.beginPath();
      ctx.ellipse(x, y - 16 + kick * 3, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.fillRect(x - 8, y - 8 + kick * 3, 16, 2);
      glow(x, y - 17, 6 + 8 * kick, col);
    },
    prism: (x, y, col, kick, bob) => {
      const hue = (fx.time * 60) % 360;
      glow(x, y - 16 + bob, 14 + 10 * kick, `#ffffff`);
      crystal(x, y - 14 + bob, col, kick, 20, 5);
      ctx.fillStyle = `hsla(${hue},90%,70%,0.5)`;
      ctx.fillRect(x - 1, y - 33 + bob, 2, 30);
    },
    stasis: (x, y, col, kick) => {
      ctx.fillStyle = "#2a2140";
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x - 4, y - 26);
      ctx.lineTo(x, y - 32);
      ctx.lineTo(x + 4, y - 26);
      ctx.lineTo(x + 6, y);
      ctx.closePath();
      ctx.fill();
      const pulse = 0.5 + 0.5 * Math.sin(fx.time * 3);
      ctx.fillStyle = col;
      for (let i = 0; i < 3; i++) ctx.fillRect(x - 1.5, y - 8 - i * 7, 3, 3);
      glow(x, y - 18, 10 + 6 * pulse + 8 * kick, col);
    },
    meteor: (x, y, col, kick, bob) => {
      ctx.strokeStyle = "#e7ecff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y - 14 + bob, 9, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      glow(x, y - 16 + bob, 14 + 8 * kick, col);
      circle(x, y - 16 + bob, 5, col);
      circle(x - 1.5, y - 17.5 + bob, 1.8, "#ffd0d8");
    },
  };

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

  const SHELL_LOOK = {
    catapult: { color: "#9aa0aa", glow: null, r: 4 },
    cannon: { color: "#22252c", glow: "#ffb347", r: 3.5 },
    mortar: { color: "#2b2530", glow: "#ff7a45", r: 4 },
    meteor: { color: "#ff5a7a", glow: "#ffd0d8", r: 5 },
  };

  function drawShell(sh) {
    const t = sh.t / sh.life;
    const x = sh.x0 + (sh.x - sh.x0) * t;
    const y = sh.y0 + (sh.y - sh.y0) * t;
    const p = iso(x, y);
    const height = 70 * 4 * t * (1 - t) + 28 * (1 - t);
    const look = SHELL_LOOK[sh.type] ?? SHELL_LOOK.mortar;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (look.glow) glow(p.x, p.y - height, 9, look.glow);
    ctx.fillStyle = look.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y - height, look.r, 0, Math.PI * 2);
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

