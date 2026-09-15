<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import type { Animal, Profile, Simulation } from '../lib/model';
import { ArenaSim, W, H, type ArenaEvent } from '../lib/arena';

const props = defineProps<{ animal: Animal; profile: Profile; count: number; result: Simulation }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const running = ref(false);
const finished = ref(false);
const speed = ref(1);
const log = ref<string[]>([]);
const alive = ref(0), dead = ref(0), wounded = ref(0);

let sim: ArenaSim | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
let lastTs = 0;
let dpr = 1;
let floorCache: HTMLCanvasElement | null = null;

// Effets purement visuels (indépendants du moteur)
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: 'dust' | 'confetti' | 'blood' }
let particles: Particle[] = [];
let seenEvents = new WeakSet<ArenaEvent>();
let shake = 0;
let lastHumanPos = new Map<number, { x: number; y: number }>();

function sync() {
  if (!sim) return;
  log.value = sim.log; alive.value = sim.alive; dead.value = sim.dead; wounded.value = sim.wounded; finished.value = sim.finished;
}
function reset() {
  stop();
  sim = new ArenaSim(props.animal, props.profile, Math.max(1, Math.round(props.count)), props.result);
  particles = []; seenEvents = new WeakSet(); shake = 0; lastHumanPos = new Map();
  sync(); draw();
}
function tick() {
  if (!running.value || !sim) return;
  const now = performance.now();
  const dt = Math.min(50, now - lastTs) * speed.value; lastTs = now;
  sim.step(dt);
  spawnEffects(dt);
  sync(); draw();
  if (sim.done && particles.length === 0) stop();
}
function start() { reset(); running.value = true; lastTs = performance.now(); timer = setInterval(tick, 1000 / 60); }
function stop() { running.value = false; if (timer) clearInterval(timer); timer = undefined; }

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }

function spawnEffects(dt: number) {
  if (!sim) return;
  // Nouveaux événements du moteur → secousse, sang, confettis
  for (const e of sim.events) { if (!seenEvents.has(e)) { seenEvents.add(e); handleEvent(e); } }
  // Poussière sous les pas
  for (const h of sim.humans) {
    if (h.status === 'dead' || h.status === 'severe') continue;
    const prev = lastHumanPos.get(h.id);
    if (prev && Math.hypot(h.x - prev.x, h.y - prev.y) > 1.5 && Math.random() < 0.12) {
      particles.push({ x: h.x + rnd(-3, 3), y: h.y + 9, vx: rnd(-0.02, 0.02), vy: rnd(-0.03, -0.01), life: 0, max: 500, color: '#d9c39a', size: rnd(2, 4), kind: 'dust' });
    }
    lastHumanPos.set(h.id, { x: h.x, y: h.y });
  }
  for (const p of particles) {
    p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'confetti') { p.vy += 0.00025 * dt; p.vx *= 0.995; }
    if (p.kind === 'blood') { p.vy += 0.0004 * dt; p.vx *= 0.98; }
  }
  particles = particles.filter((p) => p.life < p.max);
  if (particles.length > 600) particles = particles.slice(-600);
  shake = Math.max(0, shake - dt * 0.02);
}

function handleEvent(e: ArenaEvent) {
  if (e.kind === 'dead' || e.kind === 'severe' || e.kind === 'light') {
    shake = Math.max(shake, e.kind === 'dead' ? 7 : e.kind === 'severe' ? 4 : 2);
    const n = e.kind === 'dead' ? 14 : e.kind === 'severe' ? 8 : 4;
    for (let i = 0; i < n; i++) {
      const ang = rnd(0, Math.PI * 2), sp = rnd(0.05, 0.22);
      particles.push({ x: e.x, y: e.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.05, life: 0, max: rnd(350, 700), color: '#9e0e14', size: rnd(1.5, 3.5), kind: 'blood' });
    }
  } else if (e.kind === 'beastDead') {
    shake = 10;
    for (let i = 0; i < 90; i++) {
      const ang = rnd(-Math.PI, 0), sp = rnd(0.12, 0.4);
      particles.push({ x: e.x, y: e.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0, max: rnd(1500, 2600), color: ['#f0a04b', '#3dd68c', '#f5c542', '#7dd3fc', '#f472b6'][i % 5], size: rnd(3, 6), kind: 'confetti' });
    }
  } else if (e.kind === 'shot') {
    shake = Math.max(shake, 1);
  }
}

/** Sol de sable pré-rendu (grain, éclairage, marquages). */
function buildFloor(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = W * dpr; c.height = H * dpr;
  const ctx = c.getContext('2d')!; ctx.scale(dpr, dpr);
  // Extérieur sombre
  ctx.fillStyle = '#0d0f14'; ctx.fillRect(0, 0, W, H);
  // Arène octogonale
  const path = arenaPath();
  const g = ctx.createRadialGradient(W / 2, H / 2 - 40, 40, W / 2, H / 2, Math.max(W, H) * 0.62);
  g.addColorStop(0, '#d8b981'); g.addColorStop(0.55, '#b9955c'); g.addColorStop(1, '#6f5535');
  ctx.fillStyle = g; ctx.fill(path);
  // Grain
  ctx.save(); ctx.clip(path);
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.09)';
    ctx.fillRect(x, y, rnd(0.8, 2), rnd(0.8, 2));
  }
  // Traces de griffes / rayures
  ctx.strokeStyle = 'rgba(70,45,20,0.18)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 30; i++) {
    const x = rnd(40, W - 40), y = rnd(40, H - 40), l = rnd(15, 45), a = rnd(0, Math.PI);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  // Cercle central
  ctx.strokeStyle = 'rgba(90,60,30,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  // Vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // Grillage : losanges fins sur l'extérieur
  ctx.save();
  ctx.strokeStyle = 'rgba(180,190,205,0.10)'; ctx.lineWidth = 1;
  for (let x = -H; x < W + H; x += 14) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.stroke(); }
  ctx.restore();
  // Rebord acier de la cage
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#2a2f3a'; ctx.lineWidth = 16; ctx.stroke(path);
  const steel = ctx.createLinearGradient(0, 0, 0, H);
  steel.addColorStop(0, '#cfd5df'); steel.addColorStop(0.5, '#7d8595'); steel.addColorStop(1, '#b8bfcb');
  ctx.strokeStyle = steel; ctx.lineWidth = 9; ctx.stroke(path);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke(path);
  // Poteaux aux angles
  for (const [x, y] of arenaCorners()) {
    const pg = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 11);
    pg.addColorStop(0, '#e6eaf0'); pg.addColorStop(1, '#4b5260');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1c2029'; ctx.lineWidth = 2; ctx.stroke();
  }
  return c;
}
function arenaCorners(): [number, number][] {
  const m = 14, cut = 70;
  return [[m + cut, m], [W - m - cut, m], [W - m, m + cut], [W - m, H - m - cut], [W - m - cut, H - m], [m + cut, H - m], [m, H - m - cut], [m, m + cut]];
}
function arenaPath(): Path2D {
  const p = new Path2D(); const c = arenaCorners();
  p.moveTo(c[0][0], c[0][1]); for (let i = 1; i < c.length; i++) p.lineTo(c[i][0], c[i][1]); p.closePath();
  return p;
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha = 0.35) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

function draw() {
  const c = canvas.value; if (!c || !sim) return;
  const ctx = c.getContext('2d')!;
  if (!floorCache) floorCache = buildFloor();
  const t = sim.elapsed, a = sim.beast;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (shake > 0) ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
  ctx.drawImage(floorCache, 0, 0, W, H);

  // Sang au sol
  for (let i = 0; i < sim.splashes.length; i++) {
    const s = sim.splashes[i]; const age = t - s.t; if (age > 9000) continue;
    ctx.globalAlpha = Math.max(0.25, 1 - age / 9000);
    ctx.fillStyle = '#7a0b10';
    const grow = Math.min(1, age / 250);
    for (let k = 0; k < 5; k++) {
      const seed = (i * 7 + k * 13) % 17;
      const ox = ((seed * 5) % 11 - 5) * grow, oy = ((seed * 3) % 9 - 4) * grow;
      const r = (2 + (seed % 4)) * grow + (k === 0 ? 4 : 0);
      ctx.beginPath(); ctx.arc(s.x + ox, s.y + oy, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Tirs : trait lumineux + lueur au canon
  for (const s of sim.shots) {
    ctx.strokeStyle = 'rgba(255,230,120,0.9)'; ctx.lineWidth = 2; ctx.shadowColor = '#ffd866'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff4c2'; ctx.beginPath(); ctx.arc(s.x1, s.y1, 4, 0, Math.PI * 2); ctx.fill();
  }

  // Tri par y pour une profondeur correcte
  const drawables: { y: number; fn: () => void }[] = [];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const h of sim.humans) {
    drawables.push({ y: h.y, fn: () => {
      if (h.status === 'dead') { drawShadow(ctx, h.x, h.y + 4, 9, 4, 0.25); ctx.font = '20px system-ui'; ctx.globalAlpha = 0.85; ctx.fillText('💀', h.x, h.y); ctx.globalAlpha = 1; return; }
      if (h.status === 'severe') { drawShadow(ctx, h.x, h.y + 6, 9, 4, 0.25); ctx.font = '20px system-ui'; ctx.fillText('🤕', h.x, h.y); return; }
      const bob = Math.sin((t + h.id * 137) / 90) * 1.5;
      drawShadow(ctx, h.x, h.y + 12, 10, 4, 0.32);
      if (h.status === 'light') { ctx.strokeStyle = 'rgba(245,197,66,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.x, h.y, 15, 0, Math.PI * 2); ctx.stroke(); }
      if (h.engaged) { ctx.fillStyle = 'rgba(240,160,75,0.25)'; ctx.beginPath(); ctx.arc(h.x, h.y, 15, 0, Math.PI * 2); ctx.fill(); }
      ctx.font = '26px system-ui';
      ctx.fillText(props.profile.emoji, h.x, h.y + bob);
    } });
  }
  drawables.push({ y: a.y + a.r * 0.6, fn: () => {
    const rage = a.dead ? 0 : Math.min(1, a.shake / 2);
    drawShadow(ctx, a.x, a.y + a.r * 0.75, a.r * 0.95, a.r * 0.35, 0.4);
    if (!a.dead) {
      const pulse = 0.5 + 0.5 * Math.sin(t / 120);
      const aura = ctx.createRadialGradient(a.x, a.y, a.r * 0.4, a.x, a.y, a.r * (1.5 + pulse * 0.25));
      aura.addColorStop(0, `rgba(229,72,77,${0.10 + 0.25 * rage})`); aura.addColorStop(1, 'rgba(229,72,77,0)');
      ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(a.x, a.y, a.r * 1.9, 0, Math.PI * 2); ctx.fill();
    }
    const sx = a.dead ? 0 : (Math.random() - 0.5) * a.shake * 2, sy = a.dead ? 0 : (Math.random() - 0.5) * a.shake * 2;
    const breathe = a.dead ? 1 : 1 + Math.sin(t / 220) * 0.03;
    ctx.save(); ctx.translate(a.x + sx, a.y + sy); ctx.scale(breathe, breathe);
    if (a.dead) { ctx.rotate(Math.PI / 2); ctx.globalAlpha = 0.9; }
    ctx.font = `${Math.round(a.r * 1.9)}px system-ui`;
    ctx.fillText(props.animal.emoji, 0, 0);
    ctx.restore(); ctx.globalAlpha = 1;
    if (a.dead) { ctx.font = `${Math.round(a.r * 0.9)}px system-ui`; ctx.fillText('💀', a.x + a.r * 0.6, a.y - a.r * 0.6); }
    // Barre d'endurance
    const bw = 70, bx = a.x - bw / 2, by = a.y - a.r - 22;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(ctx, bx - 2, by - 2, bw + 4, 12, 6); ctx.fill();
    const col = a.stamina > 0.5 ? '#3dd68c' : a.stamina > 0.25 ? '#f5c542' : '#e5484d';
    ctx.fillStyle = col; roundRect(ctx, bx, by, Math.max(2, bw * a.stamina), 8, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(ctx, bx, by, Math.max(2, bw * a.stamina), 3, 2); ctx.fill();
  } });
  drawables.sort((p, q) => p.y - q.y).forEach((d) => d.fn());

  // Particules
  for (const p of particles) {
    const k = 1 - p.life / p.max;
    ctx.globalAlpha = p.kind === 'dust' ? k * 0.5 : k;
    ctx.fillStyle = p.color;
    if (p.kind === 'confetti') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life / 150); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.kind === 'dust' ? 1 + p.life / p.max : 1), 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;

  // Ondes de choc et textes flottants
  for (const e of sim.events) {
    const age = t - e.t;
    if (e.kind === 'shot' || e.kind === 'flee' || age > 1300) continue;
    if (e.kind === 'light') { if (age < 350) { ctx.strokeStyle = `rgba(255,255,255,${(1 - age / 350) * 0.7})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 8 + age / 8, 0, Math.PI * 2); ctx.stroke(); } continue; }
    if (age < 500) {
      ctx.strokeStyle = e.kind === 'dead' ? 'rgba(229,72,77,' : e.kind === 'severe' ? 'rgba(245,197,66,' : e.kind === 'beastDead' ? 'rgba(61,214,140,' : 'rgba(255,255,255,';
      ctx.strokeStyle += `${(1 - age / 500) * 0.9})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, 6 + age / 6, 0, Math.PI * 2); ctx.stroke();
    }
    const label = e.kind === 'dead' ? 'MORT' : e.kind === 'severe' ? 'BLESSÉ GRAVE' : e.kind === 'light' ? 'touché' : 'K.O.';
    ctx.globalAlpha = Math.max(0, 1 - age / 1300);
    ctx.font = `bold ${e.kind === 'beastDead' ? 30 : e.kind === 'dead' ? 16 : 12}px system-ui`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.fillStyle = e.kind === 'dead' ? '#ff5c61' : e.kind === 'severe' ? '#ffd35c' : e.kind === 'beastDead' ? '#5cf0a8' : '#ffffff';
    const ty = e.y - 18 - age / 25;
    ctx.strokeText(label, e.x, ty); ctx.fillText(label, e.x, ty);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // HUD : chrono
  ctx.fillStyle = 'rgba(8,10,14,0.75)'; roundRect(ctx, W - 96, 12, 84, 30, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; roundRect(ctx, W - 96, 12, 84, 30, 8); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(`${(t / 1000).toFixed(1)} s`, W - 20, 27);
  // HUD : titre du duel
  ctx.textAlign = 'left'; ctx.font = 'bold 13px system-ui'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`${sim.n} × ${props.profile.shortName}  vs  ${props.animal.name}`, 16, 27);

  // Bannière de fin
  if (sim.banner) {
    const k = Math.min(1, (t - (sim.elapsed - 0)) / 1 + 1);
    const bh = 86, by = H / 2 - bh / 2;
    ctx.fillStyle = 'rgba(8,10,14,0.85)'; ctx.fillRect(0, by, W, bh);
    const lg = ctx.createLinearGradient(0, by, W, by);
    const col = sim.victory ? '61,214,140' : '229,72,77';
    lg.addColorStop(0, `rgba(${col},0)`); lg.addColorStop(0.5, `rgba(${col},0.35)`); lg.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = lg; ctx.fillRect(0, by, W, bh);
    ctx.fillStyle = `rgba(${col},0.9)`; ctx.fillRect(0, by, W, 2); ctx.fillRect(0, by + bh - 2, W, 2);
    ctx.textAlign = 'center';
    ctx.font = '900 30px system-ui'; ctx.fillStyle = sim.victory ? '#5cf0a8' : '#ff5c61';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8;
    ctx.fillText(sim.victory ? 'VICTOIRE HUMAINE' : 'DÉFAITE HUMAINE', W / 2, by + 30);
    ctx.shadowBlur = 0;
    ctx.font = '500 15px system-ui'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(sim.banner.replace(/^(Victoire|Défaite) humaine( en \d+ s)? : /, ''), W / 2, by + 60);
    void k;
  }
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function setupCanvas() {
  const c = canvas.value; if (!c) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = W * dpr; c.height = H * dpr;
  floorCache = null;
}

watch(() => [props.animal.slug, props.profile.slug, props.count], reset);
onMounted(() => { setupCanvas(); reset(); });
onBeforeUnmount(stop);
</script>

<template>
  <div class="arena-wrap card">
    <div class="toolbar">
      <button class="btn" type="button" @click="start">{{ running ? '↻ Relancer' : finished ? '↻ Rejouer la simulation' : '▶ Lancer la simulation' }}</button>
      <label class="speed">Vitesse
        <select v-model.number="speed"><option :value="0.5">0,5×</option><option :value="1">1×</option><option :value="2">2×</option><option :value="4">4×</option></select>
      </label>
      <div class="counters">
        <span class="tag ok">🧍 {{ alive }} debout</span>
        <span class="tag warn">🤕 {{ wounded }} blessés</span>
        <span class="tag bad">💀 {{ dead }} morts</span>
      </div>
    </div>
    <div class="frame">
      <canvas ref="canvas" aria-label="Arène de simulation 2D"></canvas>
    </div>
    <ul class="log" aria-live="polite">
      <li v-for="(l, i) in log" :key="i">{{ l }}</li>
    </ul>
    <p class="note">Les issues (morts, blessés, vainqueur) sont celles du modèle ci-dessus ; l'animation en rejoue le déroulement dans la cage.</p>
  </div>
</template>

<style scoped>
.arena-wrap { display: grid; gap: 12px; }
.toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.speed { display: flex; gap: 6px; align-items: center; color: var(--muted); font-size: .9rem; }
.speed select { background: var(--surface-2); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 6px; }
.counters { display: flex; gap: 8px; margin-left: auto; flex-wrap: wrap; }
.frame { border-radius: 14px; overflow: hidden; border: 1px solid var(--border); box-shadow: 0 20px 50px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.04); background: #0d0f14; }
canvas { width: 100%; height: auto; aspect-ratio: 720 / 440; display: block; }
.log { list-style: none; padding: 0; margin: 0; font-size: .9rem; color: var(--muted); display: grid; gap: 2px; min-height: 3em; }
.log li:last-child { color: var(--text); font-weight: 600; }
</style>
