import { createBattle, canPlace, place, remove, start, step, TICK_HZ, GRID } from "./sim.js";
import { TOWERS, TOWER_IDS, COMMAND, moneyParts } from "./data.js";
import * as P from "./profile.js";
import { createRenderer, loadAssets } from "./render.js";
import * as sfx from "./audio.js";
import { initMobile, isTouch, goFullscreen } from "./mobile.js";

const SAVE_KEY = "tofense-dewer:v1";
const DEV = new URLSearchParams(location.search).has("dev"); // adds a 20× speed for testing
const $ = (id) => document.getElementById(id);
const canvas = $("board");
const renderer = createRenderer(canvas);

/* ---------- save ---------- */

function load() {
  try {
    return P.migrate(JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null"));
  } catch {
    return P.newProfile();
  }
}
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(profile));
  } catch {
    /* private mode etc: progress lasts until the tab closes */
  }
}
let profile = load();

/* ---------- state ---------- */

let screen = "home"; // home | workshop | battle
let battle = null;
let levelN = 1;
let speed = 1;
let selectedType = "spark";
let hover = null; // {c, r}
let armed = null; // touch: first tap arms a tile, second tap confirms
let resultShown = false;

/* ---------- money display ---------- */

function money(copper) {
  return moneyParts(copper)
    .map((p) => `<span class="coin" style="--c:${p.currency.color}" title="${p.currency.name}"></span>${p.amount}<span class="unit">${p.currency.name}</span>`)
    .join(" ");
}

/* ---------- screens ---------- */

function show(name) {
  screen = name;
  for (const s of ["home", "workshop", "battleHud"]) $(s).hidden = true;
  if (name === "home") renderHome();
  if (name === "workshop") renderWorkshop();
  if (name === "battle") $("battleHud").hidden = false;
  $(name === "battle" ? "battleHud" : name).hidden = false;
  $("result").hidden = true;
}

function renderHome() {
  const next = profile.maxCleared + 1;
  const levels = [];
  const last = Math.max(12, next + 3);
  for (let n = 1; n <= last; n++) {
    const locked = n > next;
    const cleared = Boolean(profile.clears[n]);
    levels.push(`<button class="lvl ${cleared ? "cleared" : ""} ${n === next ? "next" : ""}" data-level="${n}" ${locked ? "disabled" : ""}>
      <b>${n}</b><small>${locked ? "🔒" : money(P.rewardFor(profile, n))}</small></button>`);
  }
  $("home").innerHTML = `
    <div class="homeTop">
      <h1>TOFENSE <span>DEWER</span></h1>
      <div class="wallet">${money(profile.money)}</div>
    </div>
    <div class="homeActions">
      <button class="big primary" data-level="${next}">▶ Play level ${next}</button>
      <button class="big" data-act="workshop">🔧 Workshop</button>
    </div>
    <p class="hint">Money is paid when you <b>win</b> a level — first clears pay double. Replay easy levels to grind.</p>
    <div class="levels">${levels.join("")}</div>`;
  // keep the next level in view
  $("home").querySelector(".lvl.next")?.scrollIntoView({ block: "nearest", inline: "center" });
}

function pips(level, max) {
  return `<span class="pips">${"<i class=on></i>".repeat(level)}${"<i></i>".repeat(max - level)}</span>`;
}

function statLine(id) {
  const st = TOWERS[id].stats(profile.towers[id].upgrades);
  const parts = [`dmg ${fmtNum(st.damage)}`, `${fmtNum(TICK_HZ / st.cooldown)}/s`, `range ${st.range.toFixed(1)}`];
  if (st.slow) parts.push(`slow ${Math.round(st.slow * 100)}%`);
  if (st.splash) parts.push(`blast ${st.splash.toFixed(1)}`);
  if (st.piercing) parts.push("pierces armor");
  return parts.join(" · ");
}

function fmtNum(v) {
  return v >= 100 ? Math.round(v).toString() : v >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/0$/, "");
}

function renderWorkshop() {
  const cmdCost = P.commandCost(profile);
  const cards = [
    `<div class="card">
      <h3>🏰 ${COMMAND.name}</h3>
      <p>${COMMAND.blurb}</p>
      <div class="row"><span>${P.slots(profile)} towers</span>${pips(profile.command, COMMAND.max)}
        ${cmdCost === null ? `<span class="maxed">MAX</span>` : `<button class="buy" data-act="command" ${profile.money < cmdCost ? "disabled" : ""}>${money(cmdCost)}</button>`}</div>
    </div>`,
  ];
  for (const id of TOWER_IDS) {
    const T = TOWERS[id];
    const t = profile.towers[id];
    if (!t.unlocked) {
      cards.push(`<div class="card locked" style="--c:${T.color}">
        <h3><span class="gem"></span>${T.name}</h3><p>${T.blurb}</p>
        <button class="buy unlock" data-act="unlock" data-tower="${id}" ${profile.money < T.unlockCost ? "disabled" : ""}>Unlock · ${money(T.unlockCost)}</button>
      </div>`);
      continue;
    }
    const rows = Object.entries(T.upgrades).map(([k, u]) => {
      const cost = P.upgradeCost(profile, id, k);
      return `<div class="row"><span>${u.name}</span>${pips(t.upgrades[k], u.max)}
        ${cost === null ? `<span class="maxed">MAX</span>` : `<button class="buy" data-act="upgrade" data-tower="${id}" data-key="${k}" ${profile.money < cost ? "disabled" : ""}>${money(cost)}</button>`}</div>`;
    });
    cards.push(`<div class="card" style="--c:${T.color}">
      <h3><span class="gem"></span>${T.name}</h3><p class="stats">${statLine(id)}</p>${rows.join("")}
    </div>`);
  }
  $("workshop").innerHTML = `
    <div class="wsTop"><button data-act="home">← Back</button><h2>Workshop</h2><div class="wallet">${money(profile.money)}</div></div>
    <div class="cards">${cards.join("")}</div>`;
}

function startLevel(n) {
  levelN = n;
  battle = createBattle(n, P.towerStats(profile), P.slots(profile));
  resultShown = false;
  armed = null;
  hover = null;
  if (!profile.towers[selectedType]?.unlocked) selectedType = "spark";
  show("battle");
  renderHud();
}

function renderHud() {
  const b = battle;
  const spec = b.spec;
  $("hudLevel").innerHTML = `Level ${levelN}`;
  $("hudLives").textContent = `♥ ${b.lives}`;
  const unlocked = TOWER_IDS.filter((id) => profile.towers[id].unlocked);
  $("picker").innerHTML =
    unlocked
      .map((id) => `<button class="pick ${id === selectedType ? "on" : ""}" data-pick="${id}" style="--c:${TOWERS[id].color}"><span class="gem"></span>${TOWERS[id].name.split(" ")[0]}</button>`)
      .join("") + `<span class="slots">${b.towers.length}/${b.slots}</span>`;
  const left = spec.enemies.length - b.spawnIndex + b.enemies.length;
  $("startBtn").hidden = b.phase !== "prep";
  $("progress").hidden = b.phase === "prep";
  $("progress").textContent = `${left} enemies left`;
  $("speedBtn").textContent = `${speed}×`;
  $("prepHint").hidden = b.phase !== "prep";
  $("prepHint").textContent =
    b.towers.length === 0
      ? isTouch()
        ? "Tap a grass tile, then tap again to place"
        : "Click a grass tile to place a tower"
      : "Place your towers, then START. Tap a tower to pick it back up.";
}

function showResult() {
  resultShown = true;
  const won = battle.phase === "won";
  let body;
  if (won) {
    const first = !profile.clears[levelN];
    const reward = P.recordWin(profile, levelN);
    save();
    sfx.win();
    body = `<h2 class="win">Victory!</h2>
      <p class="reward">+ ${money(reward)} ${first ? `<span class="tag">first clear ×2</span>` : ""}</p>
      <p class="dim">Wallet: ${money(profile.money)}</p>
      <div class="btns">
        <button class="big primary" data-level="${levelN + 1}">Next level ▶</button>
        <button class="big" data-act="workshop">🔧 Workshop</button>
        <button class="big" data-level="${levelN}">↻ Replay</button>
      </div>`;
  } else {
    sfx.lose();
    body = `<h2 class="lose">Defeat</h2>
      <p class="dim">${battle.kills} of ${battle.spec.enemies.length} enemies defeated. No reward — upgrade in the Workshop, or grind an easier level.</p>
      <div class="btns">
        <button class="big primary" data-act="workshop">🔧 Workshop</button>
        <button class="big" data-level="${levelN}">↻ Retry</button>
        <button class="big" data-act="home">Levels</button>
      </div>`;
  }
  $("result").innerHTML = `<div class="panel">${body}</div>`;
  $("result").hidden = false;
}

/* ---------- input ---------- */

document.body.addEventListener("click", (e) => {
  const el = e.target.closest("button");
  if (!el || el.disabled) return;
  sfx.unlock();
  if (el.dataset.level) {
    if (isTouch()) goFullscreen();
    sfx.click();
    startLevel(Number(el.dataset.level));
    return;
  }
  const act = el.dataset.act;
  if (act === "workshop") show("workshop");
  else if (act === "home") show("home");
  else if (act === "command" && P.buyCommand(profile)) buySound();
  else if (act === "unlock" && P.buyUnlock(profile, el.dataset.tower)) buySound();
  else if (act === "upgrade" && P.buyUpgrade(profile, el.dataset.tower, el.dataset.key)) buySound();
  else if (el.dataset.pick) {
    selectedType = el.dataset.pick;
    armed = null;
    sfx.click();
    renderHud();
  } else if (el.id === "startBtn" && battle && start(battle)) {
    armed = null;
    sfx.start();
    renderHud();
  } else if (el.id === "speedBtn") {
    const speeds = DEV ? [1, 2, 3, 20] : [1, 2, 3];
    speed = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    renderHud();
  } else if (el.id === "quitBtn") {
    battle = null;
    show("home");
  }
});

function buySound() {
  save();
  sfx.buy();
  renderWorkshop();
}

function boardPoint(e) {
  const r = canvas.getBoundingClientRect();
  return renderer.tileAt(e.clientX - r.left, e.clientY - r.top);
}

canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse") hover = boardPoint(e);
});
canvas.addEventListener("pointerleave", (e) => {
  if (e.pointerType === "mouse") hover = null;
});
canvas.addEventListener("pointerdown", (e) => {
  sfx.unlock();
  if (screen !== "battle" || !battle || resultShown) return;
  const t = boardPoint(e);
  const onBoard = t.c >= 0 && t.r >= 0 && t.c < GRID && t.r < GRID;
  if (!onBoard) {
    armed = null;
    hover = null;
    return;
  }
  // touch needs a confirming second tap on the same tile; mouse acts at once
  const confirm = e.pointerType === "mouse" || (armed && armed.c === t.c && armed.r === t.r);
  hover = t;
  const existing = battle.towers.find((tw) => tw.c === t.c && tw.r === t.r);
  if (!confirm) {
    armed = t;
    return;
  }
  armed = null;
  if (existing) {
    if (remove(battle, t.c, t.r)) sfx.remove();
  } else if (canPlace(battle, selectedType, t.c, t.r)) {
    place(battle, selectedType, t.c, t.r);
    sfx.place();
  } else sfx.nope();
  renderHud();
});

/* ---------- loop ---------- */

function layout() {
  renderer.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", layout);
window.addEventListener("orientationchange", () => setTimeout(layout, 200));
layout();

let last = performance.now();
let acc = 0;
const DT = 1 / TICK_HZ;
let hudTimer = 0;
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (screen === "battle" && battle && battle.phase !== "prep" && !resultShown) {
    acc += dt * speed;
    let steps = 0;
    while (acc >= DT && steps < 60) {
      const events = step(battle);
      renderer.onEvents(events);
      playSounds(events);
      acc -= DT;
      steps++;
    }
    if (steps === 60) acc = 0; // device can't keep up: slow down rather than spiral
    if (battle.phase === "won" || battle.phase === "lost") {
      renderHud();
      setTimeout(showResult, 700);
      resultShown = true;
    }
  } else if (battle) {
    // prep: deliver place/remove events for their effects
    const ev = battle.pending;
    battle.pending = [];
    renderer.onEvents(ev);
  }
  hudTimer -= dt;
  if (screen === "battle" && battle && hudTimer <= 0) {
    hudTimer = 0.2;
    renderHud();
  }
  renderer.update(dt);
  renderer.draw(screen === "battle" ? battle : null, { hover: armed ?? hover, armed: Boolean(armed), selectedType });
  requestAnimationFrame(frame);
}

function playSounds(events) {
  let shots = 0;
  for (const e of events) {
    if (e.type === "shot" && shots++ < 2) sfx.shot(e.kind);
    else if (e.type === "lob") sfx.lob();
    else if (e.type === "boom") sfx.boom();
    else if (e.type === "kill") sfx.pop();
    else if (e.type === "leak") sfx.leak();
  }
}

initMobile();
show("home");
requestAnimationFrame(frame);
loadAssets().then(() => renderer.refreshBoard());
