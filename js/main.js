import { createBattle, canPlace, place, remove, start, step, TICK_HZ, GRID } from "./sim.js";
import { TOWERS, TOWER_IDS, AGES, COMMAND, ACHIEVEMENTS, ROLE_IDS, ROLE_LABEL, moneyParts } from "./data.js";
import * as P from "./profile.js";
import { createRenderer, loadAssets } from "./render.js";
import * as sfx from "./audio.js";
import { initMobile, isTouch, goFullscreen } from "./mobile.js";

const SAVE_KEY = "tofense-dewer:v2";
const DEV = new URLSearchParams(location.search).has("dev"); // adds a 20× speed for testing
const LEVELS_PER_PAGE = 30;
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
const profile = load();

/* ---------- state ---------- */

let screen = "home"; // home | workshop | achievements | battle
let battle = null;
let levelN = 1;
let speed = 1;
let selectedType = "slingshot";
let showAllTowers = false;
let hover = null; // {c, r}
let armed = null; // touch: first tap arms a tile, second tap confirms
let resultShown = false;
let levelPage = null; // null = page with the next level
// auto-repeat: replay the same level with the same layout until stopped (or a loss)
let auto = null; // { level, layout: [{type,c,r}], runs, earned }
const cheers = []; // achievements waiting to be celebrated

/* ---------- formatting ---------- */

function money(copper) {
  return moneyParts(copper)
    .map((p) => `<span class="coin" style="--c:${p.currency.color}" title="${p.currency.name}"></span>${p.amount.toLocaleString("en")}`)
    .join(" ");
}

function fmtNum(v) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e4) return `${(v / 1e3).toFixed(1)}k`;
  return v >= 100 ? Math.round(v).toString() : v >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/\.?0+$/, "");
}

function pct(v) {
  return `${Math.round(v * 100)}%`;
}

/* ---------- screens ---------- */

function show(name) {
  screen = name;
  for (const s of ["home", "workshop", "achievements", "battleHud"]) $(s).hidden = true;
  if (name === "home") renderHome();
  if (name === "workshop") renderWorkshop();
  if (name === "achievements") renderAchievements();
  $(name === "battle" ? "battleHud" : name).hidden = false;
  $("result").hidden = true;
}

function renderHome() {
  const next = profile.maxCleared + 1;
  const page = levelPage ?? Math.floor((next - 1) / LEVELS_PER_PAGE);
  const from = page * LEVELS_PER_PAGE + 1;
  const to = from + LEVELS_PER_PAGE - 1;
  const lastPage = Math.floor((next - 1) / LEVELS_PER_PAGE);
  const levels = [];
  for (let n = from; n <= to; n++) {
    const locked = n > next;
    const cleared = Boolean(profile.clears[n]);
    levels.push(`<button class="lvl ${cleared ? "cleared" : ""} ${n === next ? "next" : ""} ${n % 10 === 0 ? "boss" : ""}" data-level="${n}" ${locked ? "disabled" : ""}>
      <b>${n}</b><small>${locked ? "🔒" : money(P.rewardFor(profile, n))}</small></button>`);
  }
  const b = P.bonuses(profile);
  const got = Object.keys(profile.achievements).length;
  $("home").innerHTML = `
    <div class="homeTop">
      <h1>TOFENSE <span>DEWER</span></h1>
      <div class="wallet">${money(profile.money)}</div>
    </div>
    <div class="homeActions">
      <button class="big primary" data-level="${next}">▶ Play level ${next}</button>
      <button class="big" data-act="workshop">🔧 Workshop</button>
      <button class="big" data-act="achievements">🏆 ${got}/${ACHIEVEMENTS.length}</button>
    </div>
    <p class="hint">Money only comes from <b>winning</b> — first clears pay double. Replay easy levels to grind (try ⟳ Auto-repeat).
      ${b.damage || b.income ? `<span class="bonus">Achievement bonuses: +${pct(b.damage)} damage · +${pct(b.income)} income</span>` : ""}</p>
    <div class="pager">
      <button data-act="page" data-page="${page - 1}" ${page === 0 ? "disabled" : ""}>‹</button>
      <span>Levels ${from}–${to}</span>
      <button data-act="page" data-page="${page + 1}" ${page >= lastPage ? "disabled" : ""}>›</button>
    </div>
    <div class="levels">${levels.join("")}</div>`;
}

function pips(level, max) {
  return `<span class="pips">${"<i class=on></i>".repeat(level)}${"<i></i>".repeat(max - level)}</span>`;
}

function statLine(id) {
  const st = P.towerStats(profile)[id] ?? TOWERS[id].stats(profile.towers[id].upgrades);
  const parts = [`dmg ${fmtNum(st.damage)}`, `${fmtNum(TICK_HZ / st.cooldown)}/s`, `range ${st.range.toFixed(1)}`];
  if (st.slow) parts.push(`slow ${pct(st.slow)}`);
  if (st.splash) parts.push(`blast ${st.splash.toFixed(2)}`);
  return parts.join(" · ");
}

function renderWorkshop() {
  const cmdCost = P.commandCost(profile);
  const firstLocked = TOWER_IDS.find((id) => !profile.towers[id].unlocked);
  const sections = [
    `<div class="cards"><div class="card">
      <h3>🏰 ${COMMAND.name}</h3>
      <p>${COMMAND.blurb}</p>
      <div class="row"><span>${P.slots(profile)} towers</span>${pips(profile.command, COMMAND.max)}
        ${cmdCost === null ? `<span class="maxed">MAX</span>` : `<button class="buy" data-act="command" ${profile.money < cmdCost ? "disabled" : ""}>${money(cmdCost)}</button>`}</div>
    </div></div>`,
  ];
  for (const age of AGES) {
    const ids = TOWER_IDS.filter((id) => TOWERS[id].age === age.id);
    const reached = ids.some((id) => profile.towers[id].unlocked) || ids.includes(firstLocked);
    const cards = ids.map((id) => {
      const T = TOWERS[id];
      const t = profile.towers[id];
      if (!t.unlocked && id !== firstLocked) {
        return `<div class="card mystery"><h3>❔ ???</h3><p>${reached ? `A ${ROLE_LABEL[T.role]} tower. Unlock the ones before it first.` : "Something from an age yet to come…"}</p></div>`;
      }
      if (!t.unlocked) {
        return `<div class="card locked" style="--c:${T.color}">
          <h3><span class="gem"></span>${T.name}</h3><p>${T.blurb} <i>(${ROLE_LABEL[T.role]})</i></p>
          <button class="buy unlock" data-act="unlock" data-tower="${id}" ${profile.money < T.unlockCost ? "disabled" : ""}>Unlock · ${money(T.unlockCost)}</button>
        </div>`;
      }
      const rows = Object.entries(T.upgrades).map(([k, u]) => {
        const cost = P.upgradeCost(profile, id, k);
        return `<div class="row"><span>${u.name} <small>${t.upgrades[k]}/${u.max}</small></span>${pips(t.upgrades[k], u.max)}
          ${cost === null ? `<span class="maxed">MAX</span>` : `<button class="buy" data-act="upgrade" data-tower="${id}" data-key="${k}" ${profile.money < cost ? "disabled" : ""}>${money(cost)}</button>`}</div>`;
      });
      return `<div class="card" style="--c:${T.color}">
        <h3><span class="gem"></span>${T.name} <small class="role">${ROLE_LABEL[T.role]}</small></h3><p class="stats">${statLine(id)}</p>${rows.join("")}
      </div>`;
    });
    sections.push(`<h3 class="age" style="--c:${age.color}">${reached ? age.name : "??? Age"}</h3><div class="cards">${cards.join("")}</div>`);
    if (!reached) break; // don't reveal more than one age ahead
  }
  $("workshop").innerHTML = `
    <div class="wsTop"><button data-act="home">← Back</button><h2>Workshop</h2><div class="wallet">${money(profile.money)}</div></div>
    ${sections.join("")}`;
}

function renderAchievements() {
  const b = P.bonuses(profile);
  const rows = ACHIEVEMENTS.map((a) => {
    const done = a.id in profile.achievements;
    const prog = P.achievementProgress(profile, a);
    const bonus = a.bonus.damage ? `+${pct(a.bonus.damage)} damage` : `+${pct(a.bonus.income)} income`;
    const hidden = !done && a.id.startsWith("unlock_") && !TOWER_IDS.slice(0, TOWER_IDS.indexOf(a.id.slice(7))).every((id) => profile.towers[id].unlocked);
    return `<div class="ach ${done ? "done" : ""}">
      <span class="icon">${done ? a.icon : "🔒"}</span>
      <div class="body"><b>${hidden ? "???" : a.name}</b><small>${hidden ? "Keep playing to find out." : a.desc}</small>
        ${done ? "" : `<span class="bar"><i style="width:${(100 * prog) / a.goal}%"></i></span>`}</div>
      <span class="reward">${bonus}</span></div>`;
  });
  $("achievements").innerHTML = `
    <div class="wsTop"><button data-act="home">← Back</button><h2>Achievements</h2>
      <div class="wallet">${Object.keys(profile.achievements).length}/${ACHIEVEMENTS.length}</div></div>
    <p class="hint">Every achievement is a permanent bonus. Right now: <b>+${pct(b.damage)} damage</b> for every tower and <b>+${pct(b.income)} income</b>.</p>
    <div class="achs">${rows.join("")}</div>`;
}

/* ---------- battle ---------- */

function startLevel(n, layout = null) {
  levelN = n;
  battle = createBattle(n, P.towerStats(profile), P.slots(profile));
  resultShown = false;
  armed = null;
  hover = null;
  if (!profile.towers[selectedType]?.unlocked) selectedType = newestPerRole()[0];
  show("battle");
  if (layout) {
    for (const t of layout) if (profile.towers[t.type]?.unlocked) place(battle, t.type, t.c, t.r);
    start(battle);
  }
  renderHud();
}

// newest unlocked tower of each role (what you'd normally want to place)
function newestPerRole() {
  const best = {};
  for (const id of TOWER_IDS) if (profile.towers[id].unlocked) best[TOWERS[id].role] = id;
  return ROLE_IDS.filter((r) => best[r]).map((r) => best[r]);
}

function renderHud() {
  const b = battle;
  $("hudLevel").innerHTML = `Level ${levelN}${levelN % 10 === 0 ? " 👹" : ""}`;
  $("hudLives").textContent = `♥ ${b.lives}`;
  const unlocked = TOWER_IDS.filter((id) => profile.towers[id].unlocked);
  const shown = showAllTowers ? unlocked : newestPerRole();
  if (!shown.includes(selectedType) && unlocked.includes(selectedType)) shown.push(selectedType);
  $("picker").innerHTML =
    shown.map((id) => `<button class="pick ${id === selectedType ? "on" : ""}" data-pick="${id}" style="--c:${TOWERS[id].color}"><span class="gem"></span>${TOWERS[id].name.split(" ").pop()}</button>`).join("") +
    (unlocked.length > newestPerRole().length ? `<button class="pick more" data-act="alltowers">${showAllTowers ? "−" : "+"}</button>` : "") +
    `<span class="slots">${b.towers.length}/${b.slots}</span>`;
  const left = b.spec.enemies.length - b.spawnIndex + b.enemies.length;
  $("startBtn").hidden = b.phase !== "prep";
  $("progress").hidden = b.phase === "prep";
  $("progress").textContent = `${left} enemies left`;
  $("speedBtn").textContent = `${speed}×`;
  $("prepHint").hidden = b.phase !== "prep" || Boolean(auto);
  $("prepHint").textContent =
    b.towers.length === 0
      ? isTouch()
        ? "Tap a grass tile, then tap again to place"
        : "Click a grass tile to place a tower"
      : "Place your towers, then START. Tap a tower to pick it back up.";
  $("autoBar").hidden = !auto;
  if (auto) $("autoBar").innerHTML = `⟳ Auto-repeat · level ${auto.level} · ${auto.runs} runs · +${money(auto.earned)} <button data-act="stopauto">Stop</button>`;
}

function finishBattle() {
  resultShown = true;
  const won = battle.phase === "won";
  const first = won && !profile.clears[levelN];
  const { reward } = P.recordBattle(profile, battle);
  cheers.push(...P.checkAchievements(profile));
  save();
  if (auto) {
    auto.runs += 1;
    auto.earned += reward;
    if (won) {
      if (!cheers.length) {
        // quietly go again with the same layout
        sfx.coin();
        setTimeout(() => auto && startLevel(auto.level, auto.layout), 900);
        return;
      }
    } else auto = null; // a loss ends auto-repeat
  }
  won ? sfx.win() : sfx.lose();
  const layout = battle.towers.map((t) => ({ type: t.type, c: t.c, r: t.r }));
  let body;
  if (won) {
    body = `<h2 class="win">Victory!</h2>
      <p class="reward">+ ${money(reward)} ${first ? `<span class="tag">first clear ×2</span>` : ""}</p>
      <p class="dim">Wallet: ${money(profile.money)}</p>
      <div class="btns">
        <button class="big primary" data-level="${levelN + 1}">Next level ▶</button>
        <button class="big" data-act="workshop">🔧 Workshop</button>
        <button class="big" data-act="auto">⟳ Auto-repeat</button>
      </div>`;
  } else {
    body = `<h2 class="lose">Defeat</h2>
      <p class="dim">${battle.kills} of ${battle.spec.enemies.length} enemies defeated. No reward — upgrade in the Workshop, or grind an easier level.</p>
      <div class="btns">
        <button class="big primary" data-act="workshop">🔧 Workshop</button>
        <button class="big" data-level="${levelN}">↻ Retry</button>
        <button class="big" data-act="home">Levels</button>
      </div>`;
  }
  lastLayout = layout;
  $("result").innerHTML = `<div class="panel">${body}</div>`;
  $("result").hidden = false;
  showNextCheer();
}
let lastLayout = [];

/* ---------- achievement celebration ---------- */

function showNextCheer() {
  const a = cheers.shift();
  if (!a) {
    $("cheer").hidden = true;
    // auto-repeat was waiting for the celebration to be dismissed
    if (auto && battle?.phase === "won") startLevel(auto.level, auto.layout);
    return;
  }
  const bonus = a.bonus.damage ? `+${pct(a.bonus.damage)} damage for every tower` : `+${pct(a.bonus.income)} income from every level`;
  const confetti = Array.from({ length: 40 }, (_, i) => {
    const hue = (i * 47) % 360;
    return `<i style="--x:${Math.random() * 100}%;--d:${(Math.random() * 0.6).toFixed(2)}s;--h:${hue};--r:${Math.round(Math.random() * 720 - 360)}deg"></i>`;
  }).join("");
  $("cheer").innerHTML = `<div class="confetti">${confetti}</div>
    <div class="cheerCard">
      <div class="cheerKicker">ACHIEVEMENT UNLOCKED</div>
      <div class="cheerIcon">${a.icon}</div>
      <h2>${a.name}</h2>
      <p>${a.desc}</p>
      <p class="cheerBonus">${bonus}, forever</p>
      <button class="big primary" data-act="cheerok">${cheers.length ? `Next (${cheers.length} more)` : "Awesome!"}</button>
    </div>`;
  $("cheer").hidden = false;
  sfx.fanfare();
}

/* ---------- input ---------- */

document.body.addEventListener("click", (e) => {
  const el = e.target.closest("button");
  if (!el || el.disabled) return;
  sfx.unlock();
  if (el.dataset.level) {
    if (isTouch()) goFullscreen();
    auto = null;
    sfx.click();
    startLevel(Number(el.dataset.level));
    return;
  }
  const act = el.dataset.act;
  if (act === "workshop") show("workshop");
  else if (act === "achievements") show("achievements");
  else if (act === "home") {
    auto = null;
    battle = null;
    levelPage = null;
    show("home");
  } else if (act === "page") {
    levelPage = Number(el.dataset.page);
    renderHome();
  } else if (act === "command" && P.buyCommand(profile)) bought();
  else if (act === "unlock" && P.buyUnlock(profile, el.dataset.tower)) {
    selectedType = el.dataset.tower;
    bought();
  } else if (act === "upgrade" && P.buyUpgrade(profile, el.dataset.tower, el.dataset.key)) bought();
  else if (act === "auto") {
    auto = { level: levelN, layout: lastLayout, runs: 0, earned: 0 };
    startLevel(auto.level, auto.layout);
  } else if (act === "stopauto") {
    auto = null;
    renderHud();
  } else if (act === "cheerok") showNextCheer();
  else if (act === "alltowers") {
    showAllTowers = !showAllTowers;
    renderHud();
  } else if (el.dataset.pick) {
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
    auto = null;
    battle = null;
    show("home");
  }
});

function bought() {
  sfx.buy();
  cheers.push(...P.checkAchievements(profile));
  save();
  renderWorkshop();
  showNextCheer();
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

function layoutView() {
  renderer.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", layoutView);
window.addEventListener("orientationchange", () => setTimeout(layoutView, 200));
layoutView();

let last = performance.now();
let acc = 0;
const DT = 1 / TICK_HZ;
let hudTimer = 0;
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (screen === "battle" && battle && battle.phase === "running" && !resultShown) {
    acc += dt * speed;
    let steps = 0;
    while (acc >= DT && steps < 60 && battle.phase === "running") {
      const events = step(battle);
      renderer.onEvents(events);
      playSounds(events);
      acc -= DT;
      steps++;
    }
    if (steps === 60) acc = 0; // device can't keep up: slow down rather than spiral
    if (battle.phase === "won" || battle.phase === "lost") {
      resultShown = true;
      renderHud();
      setTimeout(finishBattle, 700);
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
    if (e.type === "shot" && shots++ < 2) sfx.shot(TOWERS[e.kind]?.role ?? "bolt");
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
