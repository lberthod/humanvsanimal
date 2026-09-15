import { lowerAnimalName, type Animal, type AnimalDuel } from './model';
import { W, H, type Splash, type ArenaEvent } from './arena';

export { W, H };

export type DuelStatus = 'alive' | 'winner' | 'dead';
export interface DuelBeast { x: number; y: number; r: number; stamina: number; status: DuelStatus; shake: number; side: 'a' | 'b' }

const bodyParts = ['au visage', 'à la gorge', 'au flanc', 'à la patte', 'à la nuque', 'aux côtes'];
const verbs: Record<number, string[]> = {
  1: ['mord', 'griffe', 'bouscule'],
  2: ['mord', 'griffe', 'percute'],
  3: ['mord profondément', 'griffe', 'plaque au sol'],
  4: ["frappe d'un coup puissant", 'mord', 'écrase'],
};
function rnd(a: number, b: number) { return a + Math.random() * (b - a); }

/** Simulation 2D pure d'un duel animal contre animal, rejouant l'issue calculée par le modèle. */
export class DuelSim {
  a: DuelBeast;
  b: DuelBeast;
  splashes: Splash[] = [];
  events: ArenaEvent[] = [];
  log: string[] = [];
  elapsed = 0;
  finished = false;
  banner = '';
  winnerSlug: string;
  private nextStrike = 700;
  private combatStart = -1;

  constructor(readonly animalA: Animal, readonly animalB: Animal, readonly result: AnimalDuel) {
    const ra = 22 + Math.sqrt(animalA.weight) * 1.1;
    const rb = 22 + Math.sqrt(animalB.weight) * 1.1;
    this.a = { x: W * 0.28, y: H / 2, r: ra, stamina: 1, status: 'alive', shake: 0, side: 'a' };
    this.b = { x: W * 0.72, y: H / 2, r: rb, stamina: 1, status: 'alive', shake: 0, side: 'b' };
    this.winnerSlug = result.verdict === 'b' ? animalB.slug : result.verdict === 'a' ? animalA.slug
      : (Math.random() < 0.5 ? animalA.slug : animalB.slug);
    this.pushLog(`${animalA.name} et ${animalB.name} entrent dans la cage l'un face à l'autre.`);
  }

  private pushLog(s: string) { this.log = [...this.log.slice(-7), `${(this.elapsed / 1000).toFixed(1)} s · ${s}`]; }
  private strikeInterval(loser: Animal) {
    return ({ 1: 850, 2: 620, 3: 480, 4: 400 } as Record<number, number>)[loser.lethality] ?? 600;
  }

  step(dt: number) {
    if (this.finished && this.elapsed > this.finishedAt + 1800) return;
    this.elapsed += dt;
    const t = this.elapsed, a = this.a, b = this.b;

    for (const beast of [a, b]) {
      if (beast.status === 'dead') continue;
      const other = beast === a ? b : a;
      const dx = other.x - beast.x, dy = other.y - beast.y, dist = Math.hypot(dx, dy) || 1;
      const stopAt = a.r + b.r - 6;
      if (other.status === 'dead') continue;
      if (dist > stopAt) { const sp = 0.075 * dt; beast.x += (dx / dist) * sp; beast.y += (dy / dist) * sp; }
      beast.x = Math.max(beast.r + 24, Math.min(W - beast.r - 24, beast.x));
      beast.y = Math.max(beast.r + 24, Math.min(H - beast.r - 24, beast.y));
    }
    if (a.status === 'dead' || b.status === 'dead' || this.finished) return;

    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const engaged = dist < a.r + b.r + 6;
    a.shake = engaged ? 2 : 0; b.shake = engaged ? 2 : 0;
    if (engaged && this.combatStart < 0) this.combatStart = t;

    if (this.combatStart >= 0 && engaged && t >= this.nextStrike) {
      const loserIsA = this.winnerSlug !== this.animalA.slug;
      const loser = loserIsA ? a : b, loserAnimal = loserIsA ? this.animalA : this.animalB;
      const winnerAnimal = loserIsA ? this.animalB : this.animalA;
      const vs = verbs[winnerAnimal.lethality] ?? verbs[2];
      const verb = vs[Math.floor(Math.random() * vs.length)];
      const part = bodyParts[Math.floor(Math.random() * bodyParts.length)];
      this.splashes.push({ x: loser.x, y: loser.y, t });
      const dmg = 0.1 + winnerAnimal.lethality * 0.028;
      loser.stamina = Math.max(0, loser.stamina - dmg);
      this.events.push({ t, x: loser.x, y: loser.y, kind: loser.stamina <= 0 ? 'dead' : 'light' });
      this.pushLog(`${winnerAnimal.name} ${verb} ${lowerAnimalName(loserAnimal)} ${part}.`);
      if (loser.stamina <= 0) {
        loser.status = 'dead';
        (loserIsA ? b : a).status = 'winner';
        this.events.push({ t, x: loser.x, y: loser.y, kind: 'beastDead' });
        this.pushLog(`${loserAnimal.name} s'effondre. ${winnerAnimal.name} l'emporte.`);
        this.finish();
      }
      this.nextStrike = t + this.strikeInterval(loserAnimal) * rnd(0.7, 1.3);
    }

    this.splashes = this.splashes.filter((s) => t - s.t <= 9000);
    this.events = this.events.filter((e) => t - e.t < 4000);
  }

  private finishedAt = 0;
  private finish() {
    if (this.finished) return;
    this.finished = true; this.finishedAt = this.elapsed;
    const winner = this.winnerSlug === this.animalA.slug ? this.animalA : this.animalB;
    this.banner = `${winner.name} remporte le duel en ${(this.elapsed / 1000).toFixed(0)} s.`;
  }
  get phase(): 'entree' | 'combat' | 'verdict' {
    if (this.finished) return 'verdict';
    return this.combatStart < 0 ? 'entree' : 'combat';
  }
  get combatStarted() { return this.combatStart >= 0; }
  get done() { return this.finished && this.elapsed > this.finishedAt + 1800; }
}
