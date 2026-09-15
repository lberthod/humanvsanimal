<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { animals, profiles, simulate, simulateAnimalDuel, formatThreshold, pluralShortName, getThreshold } from '../lib/model';
import { animalIcon, profileIcon } from '../lib/icons';
import Arena from './Arena.vue';
import AnimalDuelArena from './AnimalDuelArena.vue';

const props = defineProps<{ animal?: string; profile?: string; count?: number }>();

const mode = ref<'human' | 'animal'>('human');

const animalSlug = ref(props.animal ?? 'gorille');
const profileSlug = ref(props.profile ?? 'humain-lambda');
const count = ref(props.count ?? 10);
const animalBSlug = ref('lion');

const animal = computed(() => animals.find((a) => a.slug === animalSlug.value) ?? animals[0]);
const profile = computed(() => profiles.find((p) => p.slug === profileSlug.value) ?? profiles[0]);
const result = computed(() => simulate(animal.value, profile.value, Math.max(1, Math.round(count.value))));
const pct = computed(() => Math.round(result.value.winProbability * 100));
const max = computed(() => {
  const t = result.value.threshold;
  return t ? Math.max(20, t[1] * 2) : 200;
});

const animalB = computed(() => animals.find((a) => a.slug === animalBSlug.value) ?? animals[1] ?? animals[0]);
const duelResult = computed(() => simulateAnimalDuel(animal.value, animalB.value));
const duelPctA = computed(() => Math.round(duelResult.value.winProbA * 100));

const verdictLabel: Record<string, string> = {
  victoire: 'Victoire humaine',
  incertain: 'Issue incertaine',
  defaite: 'Défaite humaine',
  impossible: 'Mission impossible',
};
const verdictClass: Record<string, string> = { victoire: 'ok', incertain: 'warn', defaite: 'bad', impossible: 'bad' };

// Anime un nombre affiché vers sa nouvelle valeur (au lieu d'un saut brut à chaque changement de paramètre).
function useTween(source: () => number, duration = 400) {
  const display = ref(source());
  let raf = 0;
  watch(source, (to, from) => {
    cancelAnimationFrame(raf);
    const start = performance.now();
    const fromVal = from ?? display.value;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      display.value = fromVal + (to - fromVal) * eased;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  return display;
}
const pctAnim = useTween(() => pct.value);
const deathsAnim = useTween(() => result.value.humanDeaths);
const severeAnim = useTween(() => result.value.humanSevere);
const lightAnim = useTween(() => result.value.humanLight);
const massRatioAnim = useTween(() => result.value.massRatio);

// Synchronise l'URL (partage de résultats) sans recharger la page.
onMounted(() => {
  const q = new URLSearchParams(window.location.search);
  if (q.get('animal') && animals.some((a) => a.slug === q.get('animal'))) animalSlug.value = q.get('animal')!;
  if (q.get('profil') && profiles.some((p) => p.slug === q.get('profil'))) profileSlug.value = q.get('profil')!;
  const n = Number(q.get('n'));
  if (n > 0) count.value = n;
});
watch([animalSlug, profileSlug, count], () => {
  if (typeof window === 'undefined') return;
  const q = new URLSearchParams({ animal: animalSlug.value, profil: profileSlug.value, n: String(count.value) });
  history.replaceState(null, '', `?${q}`);
});

function setThreshold() {
  const t = result.value.threshold;
  if (t) count.value = t[1];
}

function pick<T>(arr: T[], exclude?: string, key?: (x: T) => string): T {
  const pool = exclude && key ? arr.filter((x) => key(x) !== exclude) : arr;
  return pool[Math.floor(Math.random() * pool.length)] ?? arr[0];
}
function randomizeHuman() {
  animalSlug.value = pick(animals).slug;
  profileSlug.value = pick(profiles).slug;
  const t = getThreshold(animalSlug.value, profileSlug.value);
  count.value = t ? Math.max(1, Math.round(t[0] + Math.random() * (t[1] - t[0] + 4))) : Math.ceil(rnd(1, 30));
}
function randomizeAnimal() {
  animalSlug.value = pick(animals).slug;
  animalBSlug.value = pick(animals, animalSlug.value, (a) => a.slug).slug;
}
function rnd(a: number, b: number) { return a + Math.random() * (b - a); }
</script>

<template>
  <div class="sim">
    <div class="mode-switch" role="tablist">
      <button type="button" role="tab" :aria-selected="mode === 'human'" :class="['mode-btn', { active: mode === 'human' }]" @click="mode = 'human'">
        Humains vs Animal
      </button>
      <button type="button" role="tab" :aria-selected="mode === 'animal'" :class="['mode-btn', { active: mode === 'animal' }]" @click="mode = 'animal'">
        Animal vs Animal
      </button>
    </div>

    <template v-if="mode === 'human'">
      <div class="controls">
        <label>
          <span>Animal</span>
          <select v-model="animalSlug">
            <option v-for="a in animals" :key="a.slug" :value="a.slug" :title="`${a.name} (${a.weight} kg)`">{{ a.name }}</option>
          </select>
        </label>
        <label>
          <span>Profil humain</span>
          <select v-model="profileSlug">
            <option v-for="p in profiles" :key="p.slug" :value="p.slug" :title="p.description">{{ p.shortName }}</option>
          </select>
        </label>
        <label class="count-label">
          <span>Nombre d'humains <strong>{{ count }}</strong></span>
          <div class="count-row">
            <input type="range" min="1" :max="max" v-model.number="count" />
            <input type="number" min="1" max="1000" v-model.number="count" />
          </div>
        </label>
        <button class="btn secondary" type="button" @click="setThreshold" :disabled="!result.threshold">
          Seuil de victoire ({{ formatThreshold(result.threshold) }})
        </button>
        <button class="btn secondary dice" type="button" @click="randomizeHuman" title="Tirer un affrontement au hasard">
          🎲 Au hasard
        </button>
      </div>

      <div class="result card">
        <div class="matchup">
          <div class="side">
            <Transition name="swap" mode="out-in">
              <span class="unit-icon" :key="profile.slug" v-html="profileIcon(profile.slug)"></span>
            </Transition>
            <span class="who">{{ count }} × {{ profile.name }}<small>{{ result.totalHumanMass }} kg au total</small></span>
          </div>
          <span class="vs-mark">VS</span>
          <div class="side">
            <Transition name="swap" mode="out-in">
              <span class="unit-icon" :key="animal.slug" v-html="animalIcon(animal.slug)"></span>
            </Transition>
            <span class="who">{{ animal.name }}<small>{{ animal.weight }} kg</small></span>
          </div>
        </div>

        <div class="verdict">
          <Transition name="swap" mode="out-in">
            <span :class="['tag', verdictClass[result.verdict]]" :key="result.verdict">{{ verdictLabel[result.verdict] }}</span>
          </Transition>
          <span class="pct">{{ Math.round(pctAnim) }} % de chances de victoire humaine</span>
        </div>
        <div class="bar">
          <div class="fill" :style="{ width: pctAnim + '%' }"></div>
          <div v-if="result.threshold" class="threshold-mark" :style="{ left: Math.min(100, (result.threshold[1] / max) * 100) + '%' }" title="Seuil de victoire quasi certaine"></div>
        </div>

        <div class="stats">
          <div><strong>{{ Math.round(deathsAnim) }}</strong><span>morts</span></div>
          <div><strong>{{ Math.round(severeAnim) }}</strong><span>blessés graves</span></div>
          <div><strong>{{ Math.round(lightAnim) }}</strong><span>blessés légers</span></div>
          <div><strong>{{ massRatioAnim.toFixed(1) }}</strong><span>rapport de masse</span></div>
          <div><strong>{{ result.animalDies ? 'Oui' : 'Non' }}</strong><span>animal vaincu</span></div>
        </div>

        <ul class="clean">
          <li v-for="(line, i) in result.narrative" :key="i">{{ line }}</li>
        </ul>
        <p class="note">
          Seuil de victoire quasi certaine pour ce duel : <strong>{{ formatThreshold(result.threshold) }}</strong>
<template v-if="result.threshold">&nbsp;{{ pluralShortName(profile, result.threshold[1]) }}</template>.
          Estimation ludique, pas une donnée scientifique.
        </p>
      </div>

      <h2 class="arena-title">Simulation 2D dans la cage</h2>
      <Arena :animal="animal" :profile="profile" :count="Math.max(1, Math.round(count))" :result="result" />
    </template>

    <template v-else>
      <div class="controls">
        <label>
          <span>Animal A</span>
          <select v-model="animalSlug">
            <option v-for="a in animals" :key="a.slug" :value="a.slug" :title="`${a.name} (${a.weight} kg)`">{{ a.name }}</option>
          </select>
        </label>
        <label>
          <span>Animal B</span>
          <select v-model="animalBSlug">
            <option v-for="a in animals" :key="a.slug" :value="a.slug" :title="`${a.name} (${a.weight} kg)`">{{ a.name }}</option>
          </select>
        </label>
        <button class="btn secondary dice" type="button" @click="randomizeAnimal" title="Tirer un duel au hasard">
          🎲 Au hasard
        </button>
      </div>

      <div class="result card">
        <div class="matchup">
          <div class="side">
            <Transition name="swap" mode="out-in">
              <span class="unit-icon" :key="animal.slug" v-html="animalIcon(animal.slug)"></span>
            </Transition>
            <span class="who">{{ animal.name }}<small>{{ animal.weight }} kg</small></span>
          </div>
          <span class="vs-mark">VS</span>
          <div class="side">
            <Transition name="swap" mode="out-in">
              <span class="unit-icon" :key="animalB.slug" v-html="animalIcon(animalB.slug)"></span>
            </Transition>
            <span class="who">{{ animalB.name }}<small>{{ animalB.weight }} kg</small></span>
          </div>
        </div>

        <div class="verdict">
          <span :class="['tag', duelResult.verdict === 'egalite' ? 'warn' : 'ok']">
            {{ duelResult.verdict === 'egalite' ? 'Duel équilibré' : duelResult.verdict === 'a' ? `${animal.name} favori` : `${animalB.name} favori` }}
          </span>
          <span class="pct">{{ duelPctA }} % de chances pour {{ animal.name }}</span>
        </div>
        <div class="bar">
          <div class="fill" :style="{ width: duelPctA + '%' }"></div>
        </div>

        <ul class="clean">
          <li v-for="(line, i) in duelResult.narrative" :key="i">{{ line }}</li>
        </ul>
        <p class="note">Estimation ludique basée sur la masse et la létalité, pas une donnée scientifique.</p>
      </div>

      <h2 class="arena-title">Simulation 2D dans la cage</h2>
      <AnimalDuelArena :animal-a="animal" :animal-b="animalB" :result="duelResult" />
    </template>
  </div>
</template>

<style scoped>
.sim { display: grid; gap: 14px; }
.arena-title { margin: 4px 0 0; }
.mode-switch { display: flex; gap: 6px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 4px; width: fit-content; }
.mode-btn {
  background: transparent; color: var(--muted); border: none; border-radius: 7px; padding: 8px 14px;
  font-size: .85rem; font-weight: 700; cursor: pointer; transition: background .15s ease, color .15s ease;
}
.mode-btn:hover { color: var(--text); }
.mode-btn.active { background: var(--accent); color: var(--ink); }
.controls {
  display: flex; flex-wrap: wrap; gap: 10px; align-items: end;
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 12px 14px;
}
label { display: grid; gap: 5px; font-weight: 600; flex: 1 1 170px; min-width: 0; }
label span { font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); white-space: nowrap; }
label span strong { color: var(--text); text-transform: none; letter-spacing: 0; font-family: var(--font-mono); margin-left: .4em; }
select, input[type="number"] {
  background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
  border-radius: 7px; padding: 7px 9px; font-size: .88rem; width: 100%;
  font-family: var(--font-body); height: 34px;
  transition: border-color .15s ease, box-shadow .15s ease;
}
select { text-overflow: ellipsis; cursor: pointer; }
select:hover, input:hover { border-color: var(--muted-2); }
select:focus-visible, input:focus-visible { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .18); }
input[type="range"] { width: 100%; accent-color: var(--accent); cursor: pointer; }
.count-label { flex-basis: 220px; }
.count-row { display: grid; grid-template-columns: 1fr 64px; gap: 8px; align-items: center; }
.count-row input[type="number"] { padding: 7px 6px; text-align: center; }
.controls .btn.secondary { flex: 0 0 auto; padding: 7px 14px; font-size: .82rem; white-space: nowrap; height: 34px; }
.controls .btn.dice:active { transform: scale(.94); }

.matchup { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
.matchup .side { display: flex; align-items: center; gap: 10px; }
.unit-icon {
  width: 38px; height: 38px; flex: none; display: flex; align-items: center; justify-content: center;
  border-radius: 50%; background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
}
.unit-icon :deep(svg) { width: 22px; height: 22px; }
.who { display: flex; flex-direction: column; line-height: 1.3; font-weight: 700; font-size: .92rem; text-align: left; }
.who small { font-weight: 500; color: var(--muted); font-size: .72rem; }
.vs-mark {
  font-family: var(--font-display); font-size: .95rem; letter-spacing: .04em;
  color: var(--ink); background: var(--accent); padding: .4em .6em; border-radius: 7px; line-height: 1; flex: none;
}

.verdict { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 12px; }
.pct { font-weight: 700; font-size: 1.05rem; font-family: var(--font-mono); }
.bar { position: relative; height: 9px; background: var(--surface-2); border-radius: 999px; overflow: visible; }
.fill { position: absolute; inset: 0; width: 0; background: var(--accent); border-radius: 999px; transition: width .5s cubic-bezier(.22,.9,.32,1); }
.threshold-mark { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--text); opacity: .5; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 1px; margin: 14px 0; background: var(--border); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.stats div { background: var(--surface-2); padding: 10px 8px; text-align: center; display: grid; gap: 3px; }
.stats strong { font-size: 1.2rem; font-family: var(--font-mono); font-weight: 700; font-variant-numeric: tabular-nums; }
.stats span { color: var(--muted); font-size: .68rem; text-transform: uppercase; letter-spacing: .04em; }
@media (max-width: 480px) {
  .stats { grid-template-columns: repeat(2, 1fr); }
  .stats div:nth-child(5) { grid-column: 1 / -1; }
}

/* Transitions Vue : swap d'emoji / verdict au changement de paramètre */
.swap-enter-active, .swap-leave-active { transition: opacity .18s ease, transform .18s ease; }
.swap-enter-from { opacity: 0; transform: scale(.7) translateY(-4px); }
.swap-leave-to { opacity: 0; transform: scale(.7) translateY(4px); }
</style>
