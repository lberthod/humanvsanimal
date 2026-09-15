<script setup lang="ts">
import { ref, computed } from 'vue';
import { animals, profiles, simulateGroup, type GroupMember, type HordeMember } from '../lib/model';
import { animalIcon, profileIcon } from '../lib/icons';

interface Row { slug: string; count: number }

const squadRows = ref<Row[]>([{ slug: 'humain-lambda', count: 20 }]);
const hordeRows = ref<Row[]>([{ slug: 'gorille', count: 1 }]);

const availableProfiles = computed(() => profiles.filter((p) => !squadRows.value.some((r) => r.slug === p.slug)));
const availableAnimals = computed(() => animals.filter((a) => !hordeRows.value.some((r) => r.slug === a.slug)));

function addSquadRow() {
  const next = availableProfiles.value[0];
  if (next) squadRows.value.push({ slug: next.slug, count: 5 });
}
function addHordeRow() {
  const next = availableAnimals.value[0];
  if (next) hordeRows.value.push({ slug: next.slug, count: 1 });
}
function removeSquadRow(i: number) { if (squadRows.value.length > 1) squadRows.value.splice(i, 1); }
function removeHordeRow(i: number) { if (hordeRows.value.length > 1) hordeRows.value.splice(i, 1); }

const squad = computed<GroupMember[]>(() =>
  squadRows.value.map((r) => ({ profile: profiles.find((p) => p.slug === r.slug)!, count: Math.max(0, Math.round(r.count)) })).filter((s) => s.profile)
);
const horde = computed<HordeMember[]>(() =>
  hordeRows.value.map((r) => ({ animal: animals.find((a) => a.slug === r.slug)!, count: Math.max(0, Math.round(r.count)) })).filter((h) => h.animal)
);

const result = computed(() => simulateGroup(squad.value, horde.value));
const pct = computed(() => Math.round(result.value.winProbability * 100));

const verdictLabel: Record<string, string> = {
  victoire: 'Le groupe l’emporte',
  incertain: 'Issue incertaine',
  defaite: 'La horde l’emporte',
  impossible: 'Mission impossible',
};
const verdictClass: Record<string, string> = { victoire: 'ok', incertain: 'warn', defaite: 'bad', impossible: 'bad' };
</script>

<template>
  <div class="group-sim card">
    <div class="cols">
      <div class="col">
        <h3>Escouade humaine</h3>
        <div class="rows">
          <div class="row" v-for="(row, i) in squadRows" :key="'sq' + i">
            <select v-model="row.slug">
              <option :value="row.slug">{{ profiles.find(p => p.slug === row.slug)?.shortName }}</option>
              <option v-for="p in availableProfiles" :key="p.slug" :value="p.slug">{{ p.shortName }}</option>
            </select>
            <input type="number" min="0" max="500" v-model.number="row.count" />
            <button type="button" class="rm" @click="removeSquadRow(i)" :disabled="squadRows.length === 1" aria-label="Retirer">✕</button>
          </div>
        </div>
        <button type="button" class="btn secondary add" @click="addSquadRow" :disabled="!availableProfiles.length">+ Ajouter un profil</button>
      </div>

      <div class="col">
        <h3>Horde animale</h3>
        <div class="rows">
          <div class="row" v-for="(row, i) in hordeRows" :key="'an' + i">
            <select v-model="row.slug">
              <option :value="row.slug">{{ animals.find(a => a.slug === row.slug)?.name }}</option>
              <option v-for="a in availableAnimals" :key="a.slug" :value="a.slug">{{ a.name }}</option>
            </select>
            <input type="number" min="0" max="50" v-model.number="row.count" />
            <button type="button" class="rm" @click="removeHordeRow(i)" :disabled="hordeRows.length === 1" aria-label="Retirer">✕</button>
          </div>
        </div>
        <button type="button" class="btn secondary add" @click="addHordeRow" :disabled="!availableAnimals.length">+ Ajouter un animal</button>
      </div>
    </div>

    <div class="versus">
      <div class="roster">
        <div class="unit" v-for="e in result.perProfile" :key="e.profile.slug">
          <span class="unit-icon" v-html="profileIcon(e.profile.slug)"></span>
          <span class="unit-count">×{{ e.count }}</span>
          <span v-if="e.deaths + e.severe > 0" class="unit-loss">-{{ e.deaths + e.severe }}</span>
        </div>
      </div>
      <span class="vs-mark">VS</span>
      <div class="roster">
        <div class="unit" v-for="e in result.perAnimal" :key="e.animal.slug">
          <span class="unit-icon" v-html="animalIcon(e.animal.slug)"></span>
          <span class="unit-count">×{{ e.count }}</span>
          <span v-if="e.defeated > 0" class="unit-loss">-{{ e.defeated }}</span>
        </div>
      </div>
    </div>

    <div class="power-bar" :title="`Rapport de puissance ${result.powerRatio.toFixed(2)}`">
      <div class="power-fill" :style="{ width: pct + '%' }"></div>
      <span class="power-mid"></span>
    </div>

    <div class="verdict">
      <span :class="['tag', verdictClass[result.verdict]]">{{ verdictLabel[result.verdict] }}</span>
      <span class="pct">{{ pct }} % de chances de victoire du groupe</span>
    </div>

    <div class="stats">
      <div><strong>{{ result.humanDeaths }}</strong><span>morts</span></div>
      <div><strong>{{ result.humanSevere }}</strong><span>blessés graves</span></div>
      <div><strong>{{ result.humanLight }}</strong><span>blessés légers</span></div>
      <div><strong>{{ result.animalsDefeated }}/{{ result.totalAnimals }}</strong><span>animaux vaincus</span></div>
    </div>

    <ul class="clean">
      <li v-for="(line, i) in result.narrative" :key="i">{{ line }}</li>
    </ul>
    <p class="note">Mode groupe : calcul agrégé (puissance humaine cumulée contre menace animale cumulée), pas de rejeu 2D image par image. Estimation ludique.</p>
  </div>
</template>

<style scoped>
.group-sim { display: grid; gap: 16px; }
.cols { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.col h3 { margin: 0 0 10px; font-size: .85rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-weight: 700; }
.rows { display: grid; gap: 8px; margin-bottom: 10px; }
.row { display: grid; grid-template-columns: 1fr 64px 32px; gap: 6px; align-items: center; }
.row select, .row input {
  background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
  border-radius: 7px; padding: 7px 8px; font-size: .85rem; font-family: var(--font-body); height: 34px; width: 100%;
}
.row input { text-align: center; }
.rm {
  background: var(--surface-2); color: var(--muted); border: 1px solid var(--border); border-radius: 7px;
  height: 34px; cursor: pointer; font-size: .8rem;
}
.rm:hover:not(:disabled) { color: var(--danger-text); border-color: var(--accent-2); }
.rm:disabled { opacity: .35; cursor: not-allowed; }
.add { width: 100%; justify-content: center; font-size: .8rem; padding: 8px; }

.versus { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; padding-top: 4px; }
.roster { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; flex: 1; min-width: 0; }
.unit {
  position: relative; display: grid; place-items: center; gap: 2px;
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px;
  padding: 8px 10px; min-width: 52px;
}
.unit-icon { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; color: var(--text); }
.unit-icon :deep(svg) { width: 100%; height: 100%; }
.unit-count { font-family: var(--font-mono); font-size: .7rem; color: var(--muted); font-weight: 700; }
.unit-loss {
  position: absolute; top: -7px; right: -7px; background: var(--accent-2); color: #fff;
  font-family: var(--font-mono); font-size: .62rem; font-weight: 700; padding: 1px 5px; border-radius: 999px;
  box-shadow: 0 0 0 2px var(--surface);
}
.vs-mark {
  font-family: var(--font-display); font-size: .95rem; letter-spacing: .04em;
  color: var(--ink); background: var(--accent); padding: .45em .65em; border-radius: 7px; line-height: 1; flex: none;
}

.power-bar { position: relative; height: 10px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; overflow: visible; }
.power-fill { position: absolute; inset: 0; width: 0; background: var(--accent); border-radius: 999px; transition: width .4s cubic-bezier(.22,.9,.32,1); }
.power-mid { position: absolute; left: 50%; top: -4px; bottom: -4px; width: 2px; background: var(--text); opacity: .35; }

.verdict { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.pct { font-weight: 700; font-size: 1rem; font-family: var(--font-mono); }

.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.stats div { background: var(--surface-2); padding: 10px 8px; text-align: center; display: grid; gap: 3px; }
.stats strong { font-size: 1.15rem; font-family: var(--font-mono); font-weight: 700; }
.stats span { color: var(--muted); font-size: .68rem; text-transform: uppercase; letter-spacing: .04em; }

@media (max-width: 480px) {
  .stats { grid-template-columns: repeat(2, 1fr); }
}
</style>
