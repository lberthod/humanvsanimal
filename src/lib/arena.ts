import type { Animal, Profile, Simulation } from './model';

export const W = 720, H = 440;
export type Status = 'alive' | 'light' | 'severe' | 'dead' | 'fled';
export interface Human { id: number; x: number; y: number; status: Status; engaged: boolean; recoverAt: number; tx: number; ty: number }
export interface Splash { x: number; y: number; t: number }
export interface Shot { x1: number; y1: number; x2: number; y2: number; t: number }
export interface Beast { x: number; y: number; r: number; stamina: number; dead: boolean; shake: number }

const bodyParts = ['au visage', 'à la gorge', 'au bras', 'à la cuisse', 'à la main', 'aux côtes', 'à la nuque'];
const verbs: Record<number, string[]> = {
  1: ['mord', 'griffe', 'renverse'],
  2: ['mord', 'arrache un doigt', 'projette au sol', 'frappe'],
  3: ['mord', 'griffe profondément', 'plaque au sol', 'brise'],
  4: ["frappe d'un coup de bras", 'mord', "projette en l'air", 'écrase'],
};
function rnd(a: number, b: number) { return a + Math.random() * (b - a); }
function shuffle<T>(arr: T[]) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

/** Simulation 2D pure (sans DOM) : rejoue dans une cage l'issue calculée par le modèle. */
export class ArenaSim {
  humans: Human[] = [];
  splashes: Splash[] = [];
  shots: Shot[] = [];
  beast: Beast = { x: W / 2, y: H / 2, r: 30, stamina: 1, dead: false, shake: 0 };
  log: string[] = [];
  elapsed = 0;
  finished = false;
  victory = false;
  banner = '';
  alive = 0; dead = 0; wounded = 0;
  private outcomes: Status[] = [];
  private nextStrike = 900; private nextShot = 600; private combatStart = -1; private combatTotal = 6000;
  readonly ranged: boolean; readonly knife: boolean; readonly n: number;

  constructor(readonly animal: Animal, readonly profile: Profile, count: number, readonly result: Simulation) {
    this.ranged = profile.slug === 'soldat';
    this.knife = profile.slug === 'combattant-couteau';
    this.n = Math.min(count, 300);
    const n = this.n;
    this.beast = { x: W / 2, y: H / 2, r: 18 + Math.sqrt(animal.weight) * 0.9, stamina: 1, dead: false, shake: 0 };
    for (let i = 0; i < n; i++) {
      const side = i % 4;
      const x = side === 0 ? rnd(30, W - 30) : side === 1 ? W - 20 : side === 2 ? rnd(30, W - 30) : 20;
      const y = side === 0 ? 20 : side === 1 ? rnd(30, H - 30) : side === 2 ? H - 20 : rnd(30, H - 30);
      this.humans.push({ id: i + 1, x, y, status: 'alive', engaged: false, recoverAt: 0, tx: x, ty: y });
    }
    const scale = n / Math.max(1, count);
    // En cas de victoire, on garde au moins 20 % du groupe debout pour finir le travail.
    const keep = result.animalDies ? Math.max(1, Math.ceil(n * 0.2)) : 0;
    const d = Math.min(n - keep, Math.round(result.humanDeaths * scale));
    const s = Math.max(0, Math.min(n - keep - d, Math.round(result.humanSevere * scale)));
    const l = Math.round(result.humanLight * scale);
    this.outcomes = [...Array(d).fill('dead'), ...shuffle([...Array(s).fill('severe'), ...Array(l).fill('light')])];
    this.combatTotal = Math.max(3500, this.outcomes.length * this.strikeInterval() + 2000) / (this.ranged ? 2 : 1);
    this.victory = result.animalDies;
    this.alive = n;
    this.pushLog(`${n} ${profile.name.toLowerCase()} entrent dans la cage face au ${animal.name.toLowerCase()}.`);
  }

  private pushLog(s: string) { this.log = [...this.log.slice(-7), `${(this.elapsed / 1000).toFixed(1)} s · ${s}`]; }
  private strikeInterval() {
    const base = ({ 1: 900, 2: 650, 3: 500, 4: 420 } as Record<number, number>)[this.animal.lethality] ?? 600;
    return this.ranged ? base * 1.5 : base;
  }

  step(dt: number) {
    if (this.finished && this.elapsed > this.finishedAt + 1800) return;
    this.elapsed += dt;
    const t = this.elapsed, a = this.beast, list = this.humans, engageR = a.r + 9;

    let engagedCount = 0;
    for (const h of list) {
      if (h.status === 'dead') continue;
      if (h.status === 'fled' || h.status === 'severe') {
        const dx = h.tx - h.x, dy = h.ty - h.y, dist = Math.hypot(dx, dy);
        if (dist > 2) { const sp = (h.status === 'fled' ? 0.16 : 0.04) * dt; h.x += (dx / dist) * sp; h.y += (dy / dist) * sp; }
        continue;
      }
      if (h.status === 'light' && t < h.recoverAt) continue;
      if (h.status === 'light') h.status = 'alive';
      const dx = a.x - h.x, dy = a.y - h.y, dist = Math.hypot(dx, dy) || 1;
      const stopAt = this.ranged ? 150 : engageR;
      if (a.dead) { /* victoire : on reste sur place */ }
      else if (dist > stopAt) { const sp = 0.09 * dt; h.x += (dx / dist) * sp; h.y += (dy / dist) * sp; h.engaged = false; }
      else { h.engaged = !this.ranged; if (this.ranged && dist < 120) { h.x -= (dx / dist) * 0.06 * dt; h.y -= (dy / dist) * 0.06 * dt; } }
      if (h.engaged) engagedCount++;
    }
    for (let i = 0; i < list.length; i++) {
      const h = list[i]; if (h.status === 'dead' || h.status === 'severe') continue;
      for (let j = i + 1; j < list.length; j++) {
        const o = list[j]; if (o.status === 'dead' || o.status === 'severe') continue;
        const dx = o.x - h.x, dy = o.y - h.y, d2 = dx * dx + dy * dy;
        if (d2 < 100 && d2 > 0.01) { const d = Math.sqrt(d2), push = (10 - d) * 0.5; h.x -= (dx / d) * push; h.y -= (dy / d) * push; o.x += (dx / d) * push; o.y += (dy / d) * push; }
      }
      h.x = Math.max(14, Math.min(W - 14, h.x)); h.y = Math.max(14, Math.min(H - 14, h.y));
    }
    if (a.dead || this.finished) return;

    const targets = list.filter((h) => h.status === 'alive' || h.status === 'light');
    if (targets.length === 0) { this.finish(false); return; }
    if (engagedCount < 3) {
      let best = targets[0], bd = Infinity;
      for (const h of targets) { const d = Math.hypot(h.x - a.x, h.y - a.y); if (d < bd) { bd = d; best = h; } }
      if (bd > engageR) { const sp = 0.07 * dt; a.x += ((best.x - a.x) / bd) * sp; a.y += ((best.y - a.y) / bd) * sp; }
    }
    a.shake = engagedCount > 0 ? 2 : 0;
    a.x = Math.max(a.r + 6, Math.min(W - a.r - 6, a.x)); a.y = Math.max(a.r + 6, Math.min(H - a.r - 6, a.y));

    const inReach = targets.filter((h) => Math.hypot(h.x - a.x, h.y - a.y) < engageR + 14);
    if (this.combatStart < 0 && (inReach.length > 0 || this.ranged)) this.combatStart = t;

    if (this.combatStart >= 0 && t >= this.nextStrike && this.outcomes.length > 0 && inReach.length > 0) {
      const victim = inReach[Math.floor(Math.random() * inReach.length)];
      const outcome = this.outcomes.shift()!;
      const vs = verbs[this.animal.lethality] ?? verbs[2];
      const verb = vs[Math.floor(Math.random() * vs.length)];
      const part = bodyParts[Math.floor(Math.random() * bodyParts.length)];
      const name = this.animal.name.toLowerCase();
      this.splashes.push({ x: victim.x, y: victim.y, t });
      victim.engaged = false;
      if (outcome === 'dead') { victim.status = 'dead'; this.dead++; this.alive--; this.pushLog(`Le ${name} ${verb} l'humain n°${victim.id} ${part} : mort.`); }
      else if (outcome === 'severe') { victim.status = 'severe'; this.wounded++; this.alive--; victim.tx = victim.x < W / 2 ? 24 : W - 24; victim.ty = Math.max(24, Math.min(H - 24, victim.y + rnd(-60, 60))); this.pushLog(`Humain n°${victim.id} ${verb === 'mord' ? 'mordu' : 'touché'} ${part} : blessé grave, il rampe hors de la mêlée.`); }
      else { victim.status = 'light'; victim.recoverAt = t + 900; this.wounded++; const dx = victim.x - a.x, dy = victim.y - a.y, d = Math.hypot(dx, dy) || 1; victim.x += (dx / d) * 45; victim.y += (dy / d) * 45; this.pushLog(`Humain n°${victim.id} projeté en arrière : blessé léger, il revient au contact.`); }
      this.nextStrike = t + this.strikeInterval() * rnd(0.7, 1.3);
    }

    if (this.ranged && t >= this.nextShot) {
      const shooter = targets[Math.floor(Math.random() * targets.length)];
      this.shots.push({ x1: shooter.x, y1: shooter.y, x2: a.x + rnd(-8, 8), y2: a.y + rnd(-8, 8), t });
      this.splashes.push({ x: a.x + rnd(-10, 10), y: a.y + rnd(-10, 10), t });
      this.nextShot = t + 140;
    }
    if (this.knife && engagedCount > 0 && Math.random() < dt / 400) this.splashes.push({ x: a.x + rnd(-a.r, a.r), y: a.y + rnd(-a.r, a.r), t });
    this.shots = this.shots.filter((s) => t - s.t <= 90);
    if (this.splashes.length > 400) this.splashes = this.splashes.slice(-400);

    if (this.combatStart >= 0 && (engagedCount > 0 || this.ranged)) {
      const pressure = this.ranged ? 1 : Math.min(1.6, engagedCount / Math.max(3, (this.result.threshold?.[0] ?? this.n) * 0.5));
      const floor = this.victory ? 0 : 0.35;
      a.stamina = Math.max(floor, a.stamina - (dt / this.combatTotal) * pressure);
      if (this.victory && a.stamina <= 0 && this.outcomes.length === 0) {
        a.dead = true;
        this.pushLog(`Le ${this.animal.name.toLowerCase()} s'effondre, ${this.ranged ? 'criblé de balles' : 'étouffé sous la masse'}. Victoire humaine.`);
        this.finish(true);
        return;
      }
    }
    // Sécurité : victoire acquise mais plus personne d'engagé (ex. tous blessés légers) → l'endurance continue de baisser lentement
    if (this.victory && this.combatStart >= 0 && this.outcomes.length === 0 && engagedCount === 0 && !this.ranged && t > this.combatStart + 4000) {
      a.stamina = Math.max(0, a.stamina - dt / 3000);
      if (a.stamina <= 0) { a.dead = true; this.pushLog(`Le ${this.animal.name.toLowerCase()} s'effondre d'épuisement. Victoire humaine.`); this.finish(true); return; }
    }
    if (!this.victory && this.outcomes.length === 0 && this.combatStart >= 0 && t > this.combatStart + 1500) {
      for (const h of targets) { h.status = 'fled'; h.engaged = false; h.tx = h.x < W / 2 ? 18 : W - 18; h.ty = h.y < H / 2 ? 18 : H - 18; }
      this.pushLog(`Les survivants paniquent et refluent vers les barreaux. Le ${this.animal.name.toLowerCase()} reste maître de la cage.`);
      this.finish(false);
    }
  }

  private finishedAt = 0;
  private finish(win: boolean) {
    if (this.finished) return;
    this.finished = true; this.finishedAt = this.elapsed;
    this.banner = win
      ? `Victoire humaine en ${(this.elapsed / 1000).toFixed(0)} s : ${this.dead} mort(s), ${this.wounded} blessé(s).`
      : `Défaite humaine : ${this.dead} mort(s), ${this.wounded} blessé(s), l'animal reste debout.`;
  }
  /** Vrai quand l'animation peut s'arrêter (petit délai après la fin pour laisser la scène se poser). */
  get done() { return this.finished && this.elapsed > this.finishedAt + 1800; }
}
