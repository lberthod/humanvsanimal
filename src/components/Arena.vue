<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue';
import type { Animal, Profile, Simulation } from '../lib/model';

const props = defineProps<{ animal: Animal; profile: Profile; count: number; result: Simulation }>();

const W = 720, H = 440;
const canvas = ref<HTMLCanvasElement | null>(null);
const running = ref(false);
const finished = ref(false);
const speed = ref(1);
const elapsed = ref(0);
const log = ref<string[]>([]);
const banner = ref('');

type Status = 'alive' | 'light' | 'severe' | 'dead' | 'fled';
interface Human { x: number; y: number; vx: number; vy: number; status: Status; engaged: boolean; recoverAt: number; tx: number; ty: number; id: number }
interface Splash { x: number; y: number; t: number }
interface Shot { x1: number; y1: number; x2: number; y2: number; t: number }

let humans: Human[] = [];
let splashes: Splash[] = [];
let shots: Shot[] = [];
let outcomes: Status[] = [];
let animal = { x: W / 2, y: H / 2, r: 30, stamina: 1, dead: false, shake: 0 };
let nextStrike = 0, nextShot = 0, tCombatStart = -1, combatTotal = 6000, rafId = 0, lastTs = 0;
let victory = false;

const isRanged = computed(() => props.profile.slug === 'soldat');
const isKnife = computed(() => props.profile.slug === 'combattant-couteau');
const alive = ref(0), dead = ref(0), wounded = ref(0);

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }
function shuffle<T>(arr: T[]) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
function pushLog(s: string) { log.value = [...log.value.slice(-7), `${(elapsed.value / 1000).toFixed(1)} s · ${s}`]; }

const bodyParts = ['au visage', 'à la gorge', 'au bras', 'à la cuisse', 'à la main', 'aux côtes', 'à la nuque'];
const verbs: Record<number, string[]> = {
  1: ['mord', 'griffe', 'renverse'],
  2: ['mord', 'arrache un doigt', 'projette au sol', 'frappe'],
  3: ['mord', 'griffe profondément', 'plaque au sol', 'brise'],
  4: ['frappe d\'un coup de bras', 'mord', 'projette en l\'air', 'écrase'],
};

function setup() {
  const n = Math.min(props.count, 300);
  const r = props.result;
  animal = { x: W / 2, y: H / 2, r: 18 + Math.sqrt(props.animal.weight) * 0.9, stamina: 1, dead: false, shake: 0 };
  humans = [];
  for (let i = 0; i < n; i++) {
    // Entrée par les quatre côtés de la cage
    const side = i % 4;
    const x = side === 0 ? rnd(30, W - 30) : side === 1 ? W - 20 : side === 2 ? rnd(30, W - 30) : 20;
    const y = side === 0 ? 20 : side === 1 ? rnd(30, H - 30) : side === 2 ? H - 20 : rnd(30, H - 30);
    humans.push({ id: i + 1, x, y, vx: 0, vy: 0, status: 'alive', engaged: false, recoverAt: 0, tx: x, ty: y });
  }
  // File des issues : les morts en premier (première vague), puis blessés graves, puis légers (mélangés)
  const scale = n / Math.max(1, props.count);
  const d = Math.round(r.humanDeaths * scale), s = Math.round(r.humanSevere * scale), l = Math.round(r.humanLight * scale);
  outcomes = [...Array(d).fill('dead'), ...shuffle([...Array(s).fill('severe'), ...Array(l).fill('light')])];
  const interval = strikeInterval();
  combatTotal = Math.max(3500, outcomes.length * interval + 2000) / (isRanged.value ? 2 : 1);
  splashes = []; shots = []; log.value = []; banner.value = '';
  elapsed.value = 0; nextStrike = 900; nextShot = 600; tCombatStart = -1; victory = r.animalDies; finished.value = false;
  alive.value = n; dead.value = 0; wounded.value = 0;
  pushLog(`${n} ${props.profile.name.toLowerCase()} entrent dans la cage face au ${props.animal.name.toLowerCase()}.`);
}

function strikeInterval() {
  const base = { 1: 900, 2: 650, 3: 500, 4: 420 }[props.animal.lethality] ?? 600;
  return isRanged.value ? base * 1.5 : base;
}

function step(dt: number) {
  elapsed.value += dt;
  const t = elapsed.value;
  const a = animal;
  const engageR = a.r + 9;
  const list = humans;

  // Déplacement des humains
  let engagedCount = 0;
  for (const h of list) {
    if (h.status === 'dead') continue;
    if (h.status === 'fled' || h.status === 'severe') {
      // rampe / fuit vers sa cible au bord
      const dx = h.tx - h.x, dy = h.ty - h.y, dist = Math.hypot(dx, dy);
      if (dist > 2) { const sp = (h.status === 'fled' ? 0.16 : 0.04) * dt; h.x += (dx / dist) * sp; h.y += (dy / dist) * sp; }
      continue;
    }
    if (h.status === 'light' && t < h.recoverAt) continue;
    if (h.status === 'light') h.status = 'alive';
    const dx = a.x - h.x, dy = a.y - h.y, dist = Math.hypot(dx, dy);
    const stopAt = isRanged.value ? 150 : engageR;
    if (a.dead) { h.vx *= 0.9; h.vy *= 0.9; }
    else if (dist > stopAt) { const sp = 0.09 * dt; h.x += (dx / dist) * sp; h.y += (dy / dist) * sp; h.engaged = false; }
    else { h.engaged = !isRanged.value; if (isRanged.value && dist < 120) { h.x -= (dx / dist) * 0.06 * dt; h.y -= (dy / dist) * 0.06 * dt; } }
    if (h.engaged) engagedCount++;
  }
  // Séparation pour former une mêlée sans superposition totale
  for (let i = 0; i < list.length; i++) {
    const h = list[i]; if (h.status === 'dead' || h.status === 'severe') continue;
    for (let j = i + 1; j < list.length; j++) {
      const o = list[j]; if (o.status === 'dead' || o.status === 'severe') continue;
      const dx = o.x - h.x, dy = o.y - h.y, d2 = dx * dx + dy * dy;
      if (d2 < 100 && d2 > 0.01) { const d = Math.sqrt(d2), push = (10 - d) * 0.5; h.x -= (dx / d) * push; h.y -= (dy / d) * push; o.x += (dx / d) * push; o.y += (dy / d) * push; }
    }
    h.x = Math.max(14, Math.min(W - 14, h.x)); h.y = Math.max(14, Math.min(H - 14, h.y));
  }

  if (a.dead) { checkEnd(); return; }

  // L'animal charge l'humain le plus proche s'il n'est pas submergé
  const targets = list.filter((h) => h.status === 'alive' || h.status === 'light');
  if (targets.length === 0) { finish(false); return; }
  if (engagedCount < 3) {
    let best = targets[0], bd = Infinity;
    for (const h of targets) { const d = Math.hypot(h.x - a.x, h.y - a.y); if (d < bd) { bd = d; best = h; } }
    if (bd > engageR) { const sp = 0.07 * dt; a.x += ((best.x - a.x) / bd) * sp; a.y += ((best.y - a.y) / bd) * sp; }
  }
  a.shake = engagedCount > 0 ? 2 : 0;
  a.x = Math.max(a.r + 6, Math.min(W - a.r - 6, a.x)); a.y = Math.max(a.r + 6, Math.min(H - a.r - 6, a.y));

  // Début du combat au premier contact
  const inReach = targets.filter((h) => Math.hypot(h.x - a.x, h.y - a.y) < engageR + 14);
  if (tCombatStart < 0 && (inReach.length > 0 || isRanged.value)) tCombatStart = t;

  // Frappes de l'animal
  if (tCombatStart >= 0 && t >= nextStrike && outcomes.length > 0 && inReach.length > 0) {
    const victim = inReach[Math.floor(Math.random() * inReach.length)];
    const outcome = outcomes.shift()!;
    const verb = verbs[props.animal.lethality][Math.floor(Math.random() * verbs[props.animal.lethality].length)];
    const part = bodyParts[Math.floor(Math.random() * bodyParts.length)];
    splashes.push({ x: victim.x, y: victim.y, t });
    victim.engaged = false;
    if (outcome === 'dead') { victim.status = 'dead'; dead.value++; alive.value--; pushLog(`Le ${props.animal.name.toLowerCase()} ${verb} l'humain n°${victim.id} ${part} : mort.`); }
    else if (outcome === 'severe') { victim.status = 'severe'; wounded.value++; alive.value--; victim.tx = victim.x < W / 2 ? 24 : W - 24; victim.ty = Math.max(24, Math.min(H - 24, victim.y + rnd(-60, 60))); pushLog(`Humain n°${victim.id} ${verb === 'mord' ? 'mordu' : 'touché'} ${part} : blessé grave, il rampe hors de la mêlée.`); }
    else { victim.status = 'light'; victim.recoverAt = t + 900; wounded.value++; const dx = victim.x - a.x, dy = victim.y - a.y, d = Math.hypot(dx, dy) || 1; victim.x += (dx / d) * 45; victim.y += (dy / d) * 45; pushLog(`Humain n°${victim.id} projeté en arrière : blessé léger, il revient au contact.`); }
    nextStrike = t + strikeInterval() * rnd(0.7, 1.3);
  }

  // Tirs (soldats) ou coups de couteau
  if (isRanged.value && t >= nextShot) {
    const shooter = targets[Math.floor(Math.random() * targets.length)];
    shots.push({ x1: shooter.x, y1: shooter.y, x2: a.x + rnd(-8, 8), y2: a.y + rnd(-8, 8), t });
    splashes.push({ x: a.x + rnd(-10, 10), y: a.y + rnd(-10, 10), t });
    nextShot = t + 140;
  }
  if (isKnife.value && engagedCount > 0 && Math.random() < dt / 400) splashes.push({ x: a.x + rnd(-a.r, a.r), y: a.y + rnd(-a.r, a.r), t });

  // Endurance de l'animal : baisse quand il est submergé (ou sous le feu)
  if (tCombatStart >= 0 && (engagedCount > 0 || isRanged.value)) {
    const pressure = isRanged.value ? 1 : Math.min(1.6, engagedCount / Math.max(3, (props.result.threshold?.[0] ?? props.count) * 0.5));
    const floor = victory ? 0 : 0.35;
    a.stamina = Math.max(floor, a.stamina - (dt / combatTotal) * pressure);
    if (victory && a.stamina <= 0 && outcomes.length === 0) { a.dead = true; pushLog(`Le ${props.animal.name.toLowerCase()} s'effondre, étouffé sous la masse${isRanged.value ? ' de plomb' : ''}. Victoire humaine.`); finish(true); }
  }
  // Défaite : toutes les frappes consommées, l'animal tient toujours → les survivants fuient
  if (!victory && outcomes.length === 0 && tCombatStart >= 0 && t > tCombatStart + 1500) {
    for (const h of targets) { h.status = 'fled'; h.engaged = false; h.tx = h.x < W / 2 ? 18 : W - 18; h.ty = h.y < H / 2 ? 18 : H - 18; }
    pushLog(`Les survivants paniquent et refluent vers les barreaux. Le ${props.animal.name.toLowerCase()} reste maître de la cage.`);
    finish(false);
  }
}

function finish(win: boolean) {
  if (finished.value) return;
  finished.value = true;
  banner.value = win
    ? `Victoire humaine en ${(elapsed.value / 1000).toFixed(0)} s : ${dead.value} mort(s), ${wounded.value} blessé(s).`
    : `Défaite humaine : ${dead.value} mort(s), ${wounded.value} blessé(s), l'animal reste debout.`;
  setTimeout(() => { running.value = false; cancelAnimationFrame(rafId); draw(); }, 1800);
}
function checkEnd() { /* laisser l'animation se poser */ }

function draw() {
  const c = canvas.value; if (!c) return;
  const ctx = c.getContext('2d')!;
  const t = elapsed.value;
  // Sol
  ctx.fillStyle = '#3a3226'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4a3f2f';
  for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % W, (i * 53) % H, 26, 10);
  // Barreaux
  ctx.strokeStyle = '#9aa0ab'; ctx.lineWidth = 3;
  for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  ctx.strokeStyle = '#b8bec9'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8);
  // Sang
  for (const s of splashes) {
    const age = t - s.t; if (age > 6000) continue;
    ctx.globalAlpha = Math.max(0.15, 1 - age / 6000); ctx.fillStyle = '#b3121a';
    ctx.beginPath(); ctx.arc(s.x, s.y, 5 + Math.min(8, age / 300), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Tirs
  for (const s of shots) { const age = t - s.t; if (age > 90) continue; ctx.strokeStyle = '#ffd866'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); }
  shots = shots.filter((s) => t - s.t <= 90);
  // Humains
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const h of humans) {
    if (h.status === 'dead') { ctx.font = '16px system-ui'; ctx.fillText('💀', h.x, h.y); continue; }
    if (h.status === 'severe') { ctx.font = '16px system-ui'; ctx.fillText('🤕', h.x, h.y); continue; }
    ctx.font = h.status === 'light' ? '15px system-ui' : '18px system-ui';
    ctx.fillText(props.profile.emoji, h.x, h.y);
  }
  // Animal
  const a = animal;
  const sx = a.dead ? 0 : (Math.random() - 0.5) * a.shake * 2, sy = a.dead ? 0 : (Math.random() - 0.5) * a.shake * 2;
  ctx.font = `${Math.round(a.r * 1.9)}px system-ui`;
  ctx.fillText(a.dead ? '💀' : props.animal.emoji, a.x + sx, a.y + sy);
  // Barre d'endurance de l'animal
  ctx.fillStyle = '#000a'; ctx.fillRect(a.x - 30, a.y - a.r - 18, 60, 8);
  ctx.fillStyle = a.stamina > 0.5 ? '#3dd68c' : a.stamina > 0.25 ? '#f5c542' : '#e5484d';
  ctx.fillRect(a.x - 30, a.y - a.r - 18, 60 * a.stamina, 8);
  // Chrono
  ctx.fillStyle = '#000a'; ctx.fillRect(W - 92, 10, 82, 26);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'right'; ctx.fillText(`${(t / 1000).toFixed(1)} s`, W - 16, 23);
  if (banner.value) {
    ctx.fillStyle = '#000c'; ctx.fillRect(0, H / 2 - 30, W, 60);
    ctx.fillStyle = victory ? '#3dd68c' : '#e5484d'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(banner.value, W / 2, H / 2);
  }
}

function loop(ts: number) {
  if (!running.value) return;
  const dt = Math.min(50, ts - lastTs) * speed.value; lastTs = ts;
  step(dt);
  draw();
  rafId = requestAnimationFrame(loop);
}

function start() {
  cancelAnimationFrame(rafId);
  setup();
  running.value = true;
  lastTs = performance.now();
  rafId = requestAnimationFrame(loop);
}
function stop() { running.value = false; cancelAnimationFrame(rafId); }

watch(() => [props.animal.slug, props.profile.slug, props.count], () => { stop(); setup(); finished.value = false; banner.value = ''; draw(); });
onMounted(() => { setup(); draw(); });
onBeforeUnmount(stop);
</script>

<template>
  <div class="arena-wrap card">
    <div class="toolbar">
      <button class="btn" type="button" @click="start">{{ running ? 'Relancer' : finished ? 'Rejouer la simulation' : 'Lancer la simulation' }}</button>
      <label class="speed">Vitesse
        <select v-model.number="speed"><option :value="0.5">0,5×</option><option :value="1">1×</option><option :value="2">2×</option><option :value="4">4×</option></select>
      </label>
      <div class="counters">
        <span class="tag ok">{{ alive }} debout</span>
        <span class="tag warn">{{ wounded }} blessés</span>
        <span class="tag bad">{{ dead }} morts</span>
      </div>
    </div>
    <canvas ref="canvas" :width="W" :height="H" aria-label="Arène de simulation 2D"></canvas>
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
canvas { width: 100%; height: auto; border-radius: 10px; background: #3a3226; display: block; }
.log { list-style: none; padding: 0; margin: 0; font-size: .9rem; color: var(--muted); display: grid; gap: 2px; min-height: 3em; }
.log li:last-child { color: var(--text); font-weight: 600; }
</style>
