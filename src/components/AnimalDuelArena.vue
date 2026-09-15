<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import type { Animal, AnimalDuel } from '../lib/model';
import { DuelSim, W, H, type DuelBeast } from '../lib/duel';
import { drawAnimalIcon, animalIcon } from '../lib/icons';
import type { ArenaEvent } from '../lib/arena';
import { sfx, isSoundEnabled, setSoundEnabled } from '../lib/sound';

const props = defineProps<{ animalA: Animal; animalB: Animal; result: AnimalDuel }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const running = ref(false);
const finished = ref(false);
const speed = ref(1);
const log = ref<string[]>([]);
const soundOn = ref(true);
function toggleSound() { soundOn.value = !soundOn.value; setSoundEnabled(soundOn.value); }

let sim: DuelSim | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
let lastTs = 0;
let dpr = 1;
let floorCache: HTMLCanvasElement | null = null;

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: 'confetti' | 'blood' }
let particles: Particle[] = [];
let seenEvents = new WeakSet<ArenaEvent>();
let shake = 0;
const cam = { x: W / 2, y: H / 2, z: 1 };
let slowmoUntil = 0;
let flash = 0;
const phaseLabel: Record<string, string> = { entree: 'Entrée dans la cage', combat: 'Combat', verdict: 'Verdict' };
const phase = ref('entree');

function sync() {
  if (!sim) return;
  log.value = sim.log; finished.value = sim.finished; phase.value = sim.phase;
}
function reset() {
  stop();
  sim = new DuelSim(props.animalA, props.animalB, props.result);
  particles = []; seenEvents = new WeakSet(); shake = 0; cam.x = W / 2; cam.y = H / 2; cam.z = 1; slowmoUntil = 0; flash = 0;
  sync(); draw();
}
function tick() {
  if (!running.value || !sim) return;
  const now = performance.now();
  const real = Math.min(50, now - lastTs); lastTs = now;
  const slow = now < slowmoUntil ? 0.22 : 1;
  const dt = real * speed.value * slow;
  sim.step(dt);
  spawnEffects(dt);
  updateCamera(real);
  flash = Math.max(0, flash - real / 500);
  sync(); draw();
  if (sim.done && particles.length === 0) stop();
}
function start() { reset(); running.value = true; lastTs = performance.now(); timer = setInterval(tick, 1000 / 60); }
function stop() { running.value = false; if (timer) clearInterval(timer); timer = undefined; }

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }

function spawnEffects(dt: number) {
  if (!sim) return;
  for (const e of sim.events) { if (!seenEvents.has(e)) { seenEvents.add(e); handleEvent(e); } }
  for (const p of particles) {
    p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'confetti') { p.vy += 0.00025 * dt; p.vx *= 0.995; }
    if (p.kind === 'blood') { p.vy += 0.0004 * dt; p.vx *= 0.98; }
  }
  particles = particles.filter((p) => p.life < p.max);
  if (particles.length > 400) particles = particles.slice(-400);
  shake = Math.max(0, shake - dt * 0.02);
}
function handleEvent(e: ArenaEvent) {
  if (e.kind === 'dead' || e.kind === 'light') {
    shake = Math.max(shake, e.kind === 'dead' ? 7 : 3);
    const n = e.kind === 'dead' ? 14 : 6;
    for (let i = 0; i < n; i++) {
      const ang = rnd(0, Math.PI * 2), sp = rnd(0.05, 0.22);
      particles.push({ x: e.x, y: e.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.05, life: 0, max: rnd(350, 700), color: '#9e0e14', size: rnd(1.5, 3.5), kind: 'blood' });
    }
    if (e.kind === 'dead') sfx.hitDead(); else sfx.hitLight();
  } else if (e.kind === 'beastDead') {
    shake = 10; slowmoUntil = performance.now() + 1300; flash = 1;
    for (let i = 0; i < 90; i++) {
      const ang = rnd(-Math.PI, 0), sp = rnd(0.12, 0.4);
      particles.push({ x: e.x, y: e.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0, max: rnd(1500, 2600), color: ['#f0a04b', '#3dd68c', '#f5c542', '#7dd3fc', '#f472b6'][i % 5], size: rnd(3, 6), kind: 'confetti' });
    }
    sfx.victory();
  }
}
function updateCamera(real: number) {
  if (!sim) return;
  const mx = (sim.a.x + sim.b.x) / 2, my = (sim.a.y + sim.b.y) / 2;
  let tz = 1, tx = W / 2, ty = H / 2;
  if (sim.combatStarted) { tz = sim.finished ? 1.15 : 1.28; tx = mx; ty = my; }
  tx = Math.max(W / (2 * tz), Math.min(W - W / (2 * tz), tx));
  ty = Math.max(H / (2 * tz), Math.min(H - H / (2 * tz), ty));
  const k = Math.min(1, real / 600);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.z += (tz - cam.z) * k;
}

function buildFloor(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = W * dpr; c.height = H * dpr;
  const ctx = c.getContext('2d')!; ctx.scale(dpr, dpr);
  ctx.fillStyle = '#0d0f14'; ctx.fillRect(0, 0, W, H);
  const path = arenaPath();
  const g = ctx.createRadialGradient(W / 2, H / 2 - 40, 40, W / 2, H / 2, Math.max(W, H) * 0.62);
  g.addColorStop(0, '#d8b981'); g.addColorStop(0.55, '#b9955c'); g.addColorStop(1, '#6f5535');
  ctx.fillStyle = g; ctx.fill(path);
  ctx.save(); ctx.clip(path);
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * W, y = Math.random() * H;
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.09)';
    ctx.fillRect(x, y, rnd(0.8, 2), rnd(0.8, 2));
  }
  ctx.strokeStyle = 'rgba(70,45,20,0.18)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 30; i++) {
    const x = rnd(40, W - 40), y = rnd(40, H - 40), l = rnd(15, 45), a = rnd(0, Math.PI);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(90,60,30,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(180,190,205,0.10)'; ctx.lineWidth = 1;
  for (let x = -H; x < W + H; x += 14) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.stroke(); }
  ctx.restore();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#2a2f3a'; ctx.lineWidth = 16; ctx.stroke(path);
  const steel = ctx.createLinearGradient(0, 0, 0, H);
  steel.addColorStop(0, '#cfd5df'); steel.addColorStop(0.5, '#7d8595'); steel.addColorStop(1, '#b8bfcb');
  ctx.strokeStyle = steel; ctx.lineWidth = 9; ctx.stroke(path);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke(path);
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
function drawKoMark(ctx: CanvasRenderingContext2D, x: number, y: number, size = 9) {
  ctx.save();
  ctx.strokeStyle = 'rgba(235,235,240,0.92)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size); ctx.stroke();
  ctx.restore();
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawBeast(ctx: CanvasRenderingContext2D, beast: DuelBeast, animal: Animal, t: number) {
  drawShadow(ctx, beast.x, beast.y + beast.r * 0.75, beast.r * 0.95, beast.r * 0.35, 0.4);
  if (beast.status === 'dead') { ctx.fillStyle = 'rgba(110,10,14,0.7)'; ctx.beginPath(); ctx.ellipse(beast.x, beast.y + beast.r * 0.4, beast.r * 1.2, beast.r * 0.5, 0, 0, Math.PI * 2); ctx.fill(); }
  const sx = beast.status === 'dead' ? 0 : (Math.random() - 0.5) * beast.shake * 2, sy = beast.status === 'dead' ? 0 : (Math.random() - 0.5) * beast.shake * 2;
  const breathe = beast.status === 'dead' ? 1 : 1 + Math.sin(t / 220 + (beast.side === 'a' ? 0 : 3)) * 0.03;
  ctx.save(); ctx.translate(beast.x + sx, beast.y + sy); ctx.scale(breathe * (beast.side === 'b' ? -1 : 1), breathe);
  if (beast.status === 'dead') { ctx.rotate(Math.PI / 2); ctx.globalAlpha = 0.9; }
  drawAnimalIcon(ctx, animal.slug, 0, 0, beast.r * 1.9);
  ctx.restore(); ctx.globalAlpha = 1;
  if (beast.status === 'dead') drawKoMark(ctx, beast.x + beast.r * 0.6, beast.y - beast.r * 0.6, Math.max(8, beast.r * 0.28));
  const bw = 70, bx = beast.x - bw / 2, by = beast.y - beast.r - 22;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(ctx, bx - 2, by - 2, bw + 4, 12, 6); ctx.fill();
  const col = beast.stamina > 0.5 ? '#3dd68c' : beast.stamina > 0.25 ? '#f5c542' : '#e5484d';
  ctx.fillStyle = col; roundRect(ctx, bx, by, Math.max(2, bw * beast.stamina), 8, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(ctx, bx, by, Math.max(2, bw * beast.stamina), 3, 2); ctx.fill();
}

function draw() {
  const c = canvas.value; if (!c || !sim) return;
  const ctx = c.getContext('2d')!;
  if (!floorCache) floorCache = buildFloor();
  const t = sim.elapsed;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0d0f14'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  if (shake > 0) ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
  ctx.drawImage(floorCache, 0, 0, W, H);

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

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const drawables = [
    { y: sim.a.y, fn: () => drawBeast(ctx, sim!.a, props.animalA, t) },
    { y: sim.b.y, fn: () => drawBeast(ctx, sim!.b, props.animalB, t) },
  ].sort((p, q) => p.y - q.y);
  drawables.forEach((d) => d.fn());

  for (const p of particles) {
    const k = 1 - p.life / p.max;
    ctx.globalAlpha = k;
    ctx.fillStyle = p.color;
    if (p.kind === 'confetti') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life / 150); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;

  for (const e of sim.events) {
    const age = t - e.t;
    if (age > 1300) continue;
    if (e.kind === 'light') { if (age < 350) { ctx.strokeStyle = `rgba(255,255,255,${(1 - age / 350) * 0.7})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 8 + age / 8, 0, Math.PI * 2); ctx.stroke(); } continue; }
    if (age < 500) {
      ctx.strokeStyle = e.kind === 'dead' ? 'rgba(229,72,77,' : e.kind === 'beastDead' ? 'rgba(61,214,140,' : 'rgba(255,255,255,';
      ctx.strokeStyle += `${(1 - age / 500) * 0.9})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, 6 + age / 6, 0, Math.PI * 2); ctx.stroke();
    }
    const label = e.kind === 'dead' ? 'MORT' : e.kind === 'beastDead' ? 'K.O.' : 'touché';
    ctx.globalAlpha = Math.max(0, 1 - age / 1300);
    ctx.font = `bold ${e.kind === 'beastDead' ? 30 : e.kind === 'dead' ? 16 : 12}px system-ui`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.fillStyle = e.kind === 'dead' ? '#ff5c61' : e.kind === 'beastDead' ? '#5cf0a8' : '#ffffff';
    const ty = e.y - 18 - age / 25;
    ctx.strokeText(label, e.x, ty); ctx.fillText(label, e.x, ty);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.6})`; ctx.fillRect(0, 0, W, H); }

  const ph = phaseLabel[sim.phase];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 12px system-ui';
  const pw = ctx.measureText(ph.toUpperCase()).width + 26;
  ctx.fillStyle = 'rgba(8,10,14,0.75)'; roundRect(ctx, W / 2 - pw / 2, 12, pw, 26, 13); ctx.fill();
  ctx.fillStyle = sim.phase === 'verdict' ? '#5cf0a8' : sim.phase === 'combat' ? '#ff5c61' : '#fff';
  ctx.fillText(ph.toUpperCase(), W / 2, 25);

  ctx.fillStyle = 'rgba(8,10,14,0.75)'; roundRect(ctx, W - 96, 12, 84, 30, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; roundRect(ctx, W - 96, 12, 84, 30, 8); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(`${(t / 1000).toFixed(1)} s`, W - 20, 27);

  ctx.textAlign = 'left'; ctx.font = 'bold 12px system-ui'; ctx.fillStyle = 'rgba(8,10,14,0.7)';
  const title = `${props.animalA.name}  vs  ${props.animalB.name}`;
  const tw = ctx.measureText(title).width + 20;
  roundRect(ctx, 12, 12, tw, 26, 8); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(title, 22, 25);

  if (sim.banner) {
    const bh = 78, by = H - bh - 22;
    ctx.fillStyle = 'rgba(8,10,14,0.85)'; ctx.fillRect(0, by, W, bh);
    const lg = ctx.createLinearGradient(0, by, W, by);
    lg.addColorStop(0, 'rgba(61,214,140,0)'); lg.addColorStop(0.5, 'rgba(61,214,140,0.35)'); lg.addColorStop(1, 'rgba(61,214,140,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, by, W, bh);
    ctx.fillStyle = 'rgba(61,214,140,0.9)'; ctx.fillRect(0, by, W, 2); ctx.fillRect(0, by + bh - 2, W, 2);
    ctx.textAlign = 'center';
    ctx.font = '900 26px system-ui'; ctx.fillStyle = '#5cf0a8';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8;
    const winner = sim.winnerSlug === props.animalA.slug ? props.animalA : props.animalB;
    ctx.fillText(`VICTOIRE : ${winner.name.toUpperCase()}`, W / 2, by + 28);
    ctx.shadowBlur = 0;
    ctx.font = '500 15px system-ui'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(sim.banner, W / 2, by + 56);
  }
}

function setupCanvas() {
  const c = canvas.value; if (!c) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = W * dpr; c.height = H * dpr;
  floorCache = null;
}

watch(() => [props.animalA.slug, props.animalB.slug], reset);
onMounted(() => { soundOn.value = isSoundEnabled(); setupCanvas(); reset(); });
onBeforeUnmount(stop);
</script>

<template>
  <div class="arena-wrap card">
    <div class="toolbar">
      <button class="btn" type="button" @click="start">{{ running ? '↻ Relancer' : finished ? '↻ Rejouer la simulation' : '▶ Lancer le duel' }}</button>
      <label class="speed">Vitesse
        <select v-model.number="speed"><option :value="0.5">0,5×</option><option :value="1">1×</option><option :value="2">2×</option><option :value="4">4×</option></select>
      </label>
      <span class="phase" :data-phase="phase">{{ phaseLabel[phase] }}</span>
      <div class="counters">
        <span class="tag"><span class="ico" v-html="animalIcon(animalA.slug)"></span> {{ animalA.name }}</span>
        <span class="tag"><span class="ico" v-html="animalIcon(animalB.slug)"></span> {{ animalB.name }}</span>
        <button class="sound-btn" type="button" @click="toggleSound" :aria-pressed="soundOn" :title="soundOn ? 'Couper le son' : 'Activer le son'">{{ soundOn ? '🔊' : '🔇' }}</button>
      </div>
    </div>
    <div class="frame">
      <canvas ref="canvas" aria-label="Arène de duel animal 2D"></canvas>
    </div>
    <ul class="log" aria-live="polite">
      <li v-for="(l, i) in log" :key="i">{{ l }}</li>
    </ul>
    <p class="note">L'issue (vainqueur) est celle du modèle ci-dessus ; l'animation en rejoue le déroulement dans la cage.</p>
  </div>
</template>

<style scoped>
.arena-wrap { display: grid; gap: 12px; }
.toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.speed { display: flex; gap: 6px; align-items: center; color: var(--muted); font-size: .9rem; }
.speed select { background: var(--surface-2); color: var(--text); border: 1px solid var(--border); border-radius: 8px; padding: 6px; }
.counters { display: flex; gap: 8px; margin-left: auto; flex-wrap: wrap; align-items: center; }
.counters .ico { display: inline-flex; width: 14px; height: 14px; vertical-align: -2px; margin-right: 4px; }
.counters .ico :deep(svg) { width: 100%; height: 100%; }
.sound-btn {
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px;
  width: 30px; height: 30px; display: grid; place-items: center; cursor: pointer; font-size: .9rem; line-height: 1;
  transition: border-color .15s ease;
}
.sound-btn:hover { border-color: var(--muted-2); }
.phase { font-size: .8rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.phase[data-phase='combat'] { color: var(--danger-text); }
.phase[data-phase='verdict'] { color: var(--ok); }
.frame { border-radius: 14px; overflow: hidden; border: 1px solid var(--border); box-shadow: 0 20px 50px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.04); background: #0d0f14; }
canvas { width: 100%; height: auto; aspect-ratio: 720 / 440; display: block; }
.log { list-style: none; padding: 0; margin: 0; font-size: .9rem; color: var(--muted); display: grid; gap: 2px; min-height: 3em; }
.log li:last-child { color: var(--text); font-weight: 600; }
</style>
