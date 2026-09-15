<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import type { Animal, Profile, Simulation } from '../lib/model';
import { ArenaSim, W, H } from '../lib/arena';

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

function sync() {
  if (!sim) return;
  log.value = sim.log; alive.value = sim.alive; dead.value = sim.dead; wounded.value = sim.wounded; finished.value = sim.finished;
}
function reset() {
  stop();
  sim = new ArenaSim(props.animal, props.profile, Math.max(1, Math.round(props.count)), props.result);
  sync(); draw();
}
function tick() {
  if (!running.value || !sim) return;
  const now = performance.now();
  const dt = Math.min(50, now - lastTs) * speed.value; lastTs = now;
  sim.step(dt);
  sync(); draw();
  if (sim.done) stop();
}
function start() { reset(); running.value = true; lastTs = performance.now(); timer = setInterval(tick, 1000 / 60); }
function stop() { running.value = false; if (timer) clearInterval(timer); timer = undefined; }

function draw() {
  const c = canvas.value; if (!c || !sim) return;
  const ctx = c.getContext('2d')!;
  const t = sim.elapsed, a = sim.beast;
  ctx.fillStyle = '#3a3226'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4a3f2f';
  for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % W, (i * 53) % H, 26, 10);
  ctx.strokeStyle = '#9aa0ab'; ctx.lineWidth = 3;
  for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  ctx.strokeStyle = '#b8bec9'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8);
  for (const s of sim.splashes) {
    const age = t - s.t; if (age > 6000) continue;
    ctx.globalAlpha = Math.max(0.15, 1 - age / 6000); ctx.fillStyle = '#b3121a';
    ctx.beginPath(); ctx.arc(s.x, s.y, 5 + Math.min(8, age / 300), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const s of sim.shots) { ctx.strokeStyle = '#ffd866'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const h of sim.humans) {
    if (h.status === 'dead') { ctx.font = '16px system-ui'; ctx.fillText('💀', h.x, h.y); continue; }
    if (h.status === 'severe') { ctx.font = '16px system-ui'; ctx.fillText('🤕', h.x, h.y); continue; }
    ctx.font = h.status === 'light' ? '15px system-ui' : '18px system-ui';
    ctx.fillText(props.profile.emoji, h.x, h.y);
  }
  const sx = a.dead ? 0 : (Math.random() - 0.5) * a.shake * 2, sy = a.dead ? 0 : (Math.random() - 0.5) * a.shake * 2;
  ctx.font = `${Math.round(a.r * 1.9)}px system-ui`;
  ctx.fillText(a.dead ? '💀' : props.animal.emoji, a.x + sx, a.y + sy);
  ctx.fillStyle = '#000a'; ctx.fillRect(a.x - 30, a.y - a.r - 18, 60, 8);
  ctx.fillStyle = a.stamina > 0.5 ? '#3dd68c' : a.stamina > 0.25 ? '#f5c542' : '#e5484d';
  ctx.fillRect(a.x - 30, a.y - a.r - 18, 60 * a.stamina, 8);
  ctx.fillStyle = '#000a'; ctx.fillRect(W - 92, 10, 82, 26);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'right'; ctx.fillText(`${(t / 1000).toFixed(1)} s`, W - 16, 23);
  if (sim.banner) {
    ctx.fillStyle = '#000c'; ctx.fillRect(0, H / 2 - 30, W, 60);
    ctx.fillStyle = sim.victory ? '#3dd68c' : '#e5484d'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(sim.banner, W / 2, H / 2);
  }
}

watch(() => [props.animal.slug, props.profile.slug, props.count], reset);
onMounted(reset);
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
