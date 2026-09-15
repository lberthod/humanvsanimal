<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { animals, profiles, simulate, formatThreshold } from '../lib/model';
import Arena from './Arena.vue';

const props = defineProps<{ animal?: string; profile?: string; count?: number }>();

const animalSlug = ref(props.animal ?? 'gorille');
const profileSlug = ref(props.profile ?? 'humain-lambda');
const count = ref(props.count ?? 10);

const animal = computed(() => animals.find((a) => a.slug === animalSlug.value) ?? animals[0]);
const profile = computed(() => profiles.find((p) => p.slug === profileSlug.value) ?? profiles[0]);
const result = computed(() => simulate(animal.value, profile.value, Math.max(1, Math.round(count.value))));
const pct = computed(() => Math.round(result.value.winProbability * 100));
const max = computed(() => {
  const t = result.value.threshold;
  return t ? Math.max(20, t[1] * 2) : 200;
});

const verdictLabel: Record<string, string> = {
  victoire: 'Victoire humaine',
  incertain: 'Issue incertaine',
  defaite: 'Défaite humaine',
  impossible: 'Mission impossible',
};
const verdictClass: Record<string, string> = { victoire: 'ok', incertain: 'warn', defaite: 'bad', impossible: 'bad' };

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
</script>

<template>
  <div class="sim">
    <div class="controls">
      <label>
        <span>Animal</span>
        <select v-model="animalSlug">
          <option v-for="a in animals" :key="a.slug" :value="a.slug">{{ a.emoji }} {{ a.name }} ({{ a.weight }} kg)</option>
        </select>
      </label>
      <label>
        <span>Profil humain</span>
        <select v-model="profileSlug">
          <option v-for="p in profiles" :key="p.slug" :value="p.slug">{{ p.emoji }} {{ p.name }}</option>
        </select>
      </label>
      <label>
        <span>Nombre d'humains : <strong>{{ count }}</strong></span>
        <input type="range" min="1" :max="max" v-model.number="count" />
        <input type="number" min="1" max="1000" v-model.number="count" />
      </label>
      <button class="btn secondary" type="button" @click="setThreshold" :disabled="!result.threshold">
        Régler au seuil de victoire ({{ formatThreshold(result.threshold) }})
      </button>
    </div>

    <div class="arena">
      <div class="side">
        <div class="big">{{ profile.emoji }}</div>
        <div class="label">{{ count }} × {{ profile.name }}</div>
        <div class="note">{{ result.totalHumanMass }} kg au total</div>
      </div>
      <div class="vs">VS</div>
      <div class="side">
        <div class="big">{{ animal.emoji }}</div>
        <div class="label">{{ animal.name }}</div>
        <div class="note">{{ animal.weight }} kg</div>
      </div>
    </div>

    <div class="result card">
      <div class="verdict">
        <span :class="['tag', verdictClass[result.verdict]]">{{ verdictLabel[result.verdict] }}</span>
        <span class="pct">{{ pct }} % de chances de victoire humaine</span>
      </div>
      <div class="bar"><div class="fill" :style="{ width: pct + '%' }"></div></div>

      <div class="stats">
        <div><strong>{{ result.humanDeaths }}</strong><span>morts</span></div>
        <div><strong>{{ result.humanSevere }}</strong><span>blessés graves</span></div>
        <div><strong>{{ result.humanLight }}</strong><span>blessés légers</span></div>
        <div><strong>{{ result.massRatio.toFixed(1) }}</strong><span>rapport de masse</span></div>
        <div><strong>{{ result.animalDies ? 'Oui' : 'Non' }}</strong><span>animal vaincu</span></div>
      </div>

      <ul class="clean">
        <li v-for="(line, i) in result.narrative" :key="i">{{ line }}</li>
      </ul>
      <p class="note">
        Seuil de victoire quasi certaine pour ce duel : <strong>{{ formatThreshold(result.threshold) }}</strong>
<template v-if="result.threshold">&nbsp;{{ profile.shortName.toLowerCase() }}(s)</template>.
        Estimation ludique, pas une donnée scientifique.
      </p>
    </div>

    <h2 class="arena-title">Simulation 2D dans la cage</h2>
    <Arena :animal="animal" :profile="profile" :count="Math.max(1, Math.round(count))" :result="result" />
  </div>
</template>

<style scoped>
.sim { display: grid; gap: 20px; }
.arena-title { margin: 8px 0 0; }
.controls { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); align-items: end; }
label { display: grid; gap: 6px; font-weight: 600; }
label span { font-size: .9rem; color: var(--muted); }
select, input[type="number"] {
  background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
  border-radius: 8px; padding: 10px; font-size: 1rem; width: 100%;
}
input[type="range"] { width: 100%; accent-color: var(--accent); }
.arena { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; text-align: center; }
.big { font-size: clamp(3rem, 10vw, 5rem); line-height: 1; }
.label { font-weight: 700; }
.vs { font-weight: 900; font-size: 1.5rem; color: var(--accent); }
.verdict { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 10px; }
.pct { font-weight: 700; font-size: 1.1rem; }
.bar { height: 12px; background: var(--surface-2); border-radius: 999px; overflow: hidden; }
.fill { height: 100%; background: linear-gradient(90deg, var(--accent-2), var(--warn), var(--ok)); transition: width .25s; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin: 18px 0; }
.stats div { background: var(--surface-2); border-radius: 10px; padding: 10px; text-align: center; display: grid; }
.stats strong { font-size: 1.5rem; }
.stats span { color: var(--muted); font-size: .8rem; }
</style>
