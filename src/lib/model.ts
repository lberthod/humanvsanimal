import animals from '../data/animals.json';
import profiles from '../data/profiles.json';
import matchupsRaw from '../data/matchups.json';

export type Animal = (typeof animals)[number];
export type Profile = (typeof profiles)[number];
export type Range = [number, number] | null;

const matchups = matchupsRaw as unknown as Record<string, Record<string, Range>>;

export { animals, profiles };

export function getThreshold(animalSlug: string, profileSlug: string): Range {
  return matchups[animalSlug]?.[profileSlug] ?? null;
}

export function formatThreshold(r: Range): string {
  if (r === null) return 'Impossible';
  if (r[0] === r[1]) return String(r[0]);
  return `${r[0]} à ${r[1]}`;
}

export interface Simulation {
  count: number;
  threshold: Range;
  winProbability: number; // 0..1
  verdict: 'victoire' | 'incertain' | 'defaite' | 'impossible';
  humanDeaths: number;
  humanSevere: number;
  humanLight: number;
  animalDies: boolean;
  totalHumanMass: number;
  massRatio: number;
  narrative: string[];
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

/** Pluriel correct du nom court d'un profil (« couteau » → « couteaux », pas « couteaus »). */
export function pluralShortName(profile: Profile, count: number): string {
  const base = profile.shortName.toLowerCase();
  if (count <= 1) return base;
  return base.endsWith('eau') ? `${base}x` : `${base}s`;
}

/** Élision : « de experts » → « d'experts », « de lambdas » → « de lambdas ». */
export function deArticle(word: string): string {
  return /^[aeiouhàâéèêë]/i.test(word) ? `d'${word}` : `de ${word}`;
}

/** Nom d'animal en minuscule pour insertion en milieu de phrase, sans perdre la majuscule du nom propre « Nil ». */
export function lowerAnimalName(animal: Animal): string {
  return animal.name.toLowerCase().replace(/\bnil\b/, 'Nil');
}

/**
 * Modèle simplifié : probabilité logistique centrée sur le seuil de victoire,
 * pertes humaines proportionnelles à la létalité de l'animal et au temps
 * d'action libre avant submersion.
 */
export function simulate(animal: Animal, profile: Profile, count: number): Simulation {
  const threshold = getThreshold(animal.slug, profile.slug);
  const totalHumanMass = count * profile.weight;
  const massRatio = totalHumanMass / animal.weight;
  const narrative: string[] = [];

  if (threshold === null) {
    const deaths = Math.round(clamp(count * 0.35 * (animal.lethality / 4), 0, count));
    narrative.push(
      `${count} ${profile.name.toLowerCase()} ne peuvent pas venir à bout d'un ${lowerAnimalName(animal)}, quel que soit leur nombre.`,
      `Le groupe s'effondre (fractures, épuisement, panique) avant d'avoir pu épuiser l'animal.`,
      `L'animal finit par fuir ou par se lasser une fois que plus personne ne l'approche.`
    );
    return {
      count, threshold, winProbability: 0, verdict: 'impossible',
      humanDeaths: deaths, humanSevere: Math.round((count - deaths) * 0.5),
      humanLight: count - deaths - Math.round((count - deaths) * 0.5),
      animalDies: false, totalHumanMass, massRatio, narrative,
    };
  }

  const [lo, hi] = threshold;
  // Le haut de la fourchette [lo, hi] correspond à une victoire quasi certaine (~90 %),
  // le bas à une victoire probable (~75 %), la moitié du bas à une défaite quasi certaine.
  const center = lo * 0.85;
  const spread = Math.max((hi - center) / 2.2, center * 0.1);
  const winProbability = 1 / (1 + Math.exp(-(count - center) / spread));

  const verdict: Simulation['verdict'] =
    winProbability >= 0.85 ? 'victoire' : winProbability >= 0.4 ? 'incertain' : 'defaite';

  // Pertes : les armes réduisent fortement le temps d'exposition.
  const exposure = profile.slug === 'soldat' || profile.slug === 'policier' ? 0.15 : profile.slug === 'chasseur-arc' ? 0.35 : profile.armed ? 0.15 : 1;
  const baseCasualties = animal.lethality * (
    profile.slug === 'soldat' ? 0.05 :
    profile.slug === 'policier' ? 0.12 :
    profile.slug === 'combattant-couteau' ? 0.4 :
    profile.slug === 'chasseur-arc' ? 0.3 : 1
  );
  // Temps d'action libre : plus on est nombreux par rapport au seuil, plus vite l'animal est submergé.
  const freeTime = clamp(((lo + hi) / 2) / Math.max(count, 1), 0.2, 2.5);
  let deaths = Math.round(clamp(baseCasualties * freeTime * exposure * (animal.lethality >= 4 ? 4.5 : animal.lethality >= 3 ? 3 : 0.8), 0, count));
  if (animal.lethality === 1) deaths = count === 1 && winProbability < 0.5 ? 1 : 0;
  const severe = Math.round(clamp(baseCasualties * 1.6 * freeTime * exposure, 0, count - deaths));
  const light = Math.round(clamp((count - deaths - severe) * 0.5, 0, count - deaths - severe));

  const animalDies = winProbability >= 0.5;

  narrative.push(
    `Masse humaine totale : ${totalHumanMass} kg contre ${animal.weight} kg, soit un rapport de ${massRatio.toFixed(1)} pour 1.`
  );
  if (verdict === 'victoire') {
    narrative.push(
      `Le nombre est suffisant : l'animal est submergé après ses premières attaques et ne peut plus porter de coups décisifs.`,
      profile.armed
        ? `Les armes permettent d'atteindre les points vitaux sans dépendre de la masse.`
        : `Une fois plaqué au sol, l'animal est neutralisé par asphyxie et frappes répétées à la tête.`
    );
  } else if (verdict === 'incertain') {
    narrative.push(
      `On est au seuil critique : tout dépend de la coordination du groupe dans les dix premières secondes.`,
      `Si les premiers engagés paniquent ou reculent, l'animal reprend le dessus et les élimine un par un.`
    );
  } else {
    narrative.push(
      `Trop peu nombreux : l'animal neutralise les humains l'un après l'autre en profitant de son temps d'action libre.`,
      `Il faudrait ${formatThreshold(threshold)} ${pluralShortName(profile, hi)} pour espérer une victoire certaine.`
    );
  }

  return {
    count, threshold, winProbability, verdict,
    humanDeaths: deaths, humanSevere: severe, humanLight: light,
    animalDies, totalHumanMass, massRatio, narrative,
  };
}

// ---------------------------------------------------------------------------
// Mode groupe mixte : plusieurs profils humains ET plusieurs espèces animales
// dans le même affrontement. On généralise le modèle 1 profil / 1 animal en
// convertissant chaque combattant en une unité de puissance commune, calibrée
// sur les seuils déjà validés (humain lambda comme référence universelle).
// ---------------------------------------------------------------------------

export interface GroupMember { profile: Profile; count: number }
export interface HordeMember { animal: Animal; count: number }

export interface GroupSimulation {
  totalHumans: number;
  totalHumanMass: number;
  totalAnimals: number;
  totalAnimalWeight: number;
  powerRatio: number;
  winProbability: number;
  verdict: Simulation['verdict'];
  humanDeaths: number;
  humanSevere: number;
  humanLight: number;
  animalsDefeated: number;
  narrative: string[];
  perProfile: { profile: Profile; count: number; power: number; deaths: number; severe: number; light: number }[];
  perAnimal: { animal: Animal; count: number; threat: number; defeated: number }[];
}

/** Combien de « lambdas » un animal représente, en s'appuyant sur son seuil connu face à l'humain lambda. */
function animalLambdaThreat(animal: Animal): number {
  const t = getThreshold(animal.slug, 'humain-lambda');
  return t ? t[1] : animal.weight / 4;
}

const profilePowerCache = new Map<string, number>();
/** Combien de « lambdas » vaut un seul membre du profil, en moyenne sur les animaux où le duel est possible. */
function profileLambdaPower(profile: Profile): number {
  if (profile.slug === 'humain-lambda') return 1;
  const cached = profilePowerCache.get(profile.slug);
  if (cached !== undefined) return cached;
  const ratios: number[] = [];
  for (const a of animals) {
    const t = getThreshold(a.slug, profile.slug);
    if (!t) continue;
    ratios.push(animalLambdaThreat(a) / t[1]);
  }
  const power = ratios.length ? ratios.reduce((s, x) => s + x, 0) / ratios.length : 0.3;
  profilePowerCache.set(profile.slug, power);
  return power;
}

function clampArr(values: number[], total: number): number[] {
  // Répartit `total` (déjà arrondi) entre les entrées au prorata, en corrigeant l'arrondi sur la dernière.
  if (values.length === 0 || total <= 0) return values.map(() => 0);
  const sum = values.reduce((s, x) => s + x, 0) || 1;
  const shares = values.map((v) => Math.round((v / sum) * total));
  const diff = total - shares.reduce((s, x) => s + x, 0);
  shares[shares.length - 1] = Math.max(0, shares[shares.length - 1] + diff);
  return shares;
}

export function simulateGroup(squad: GroupMember[], horde: HordeMember[]): GroupSimulation {
  const squadEntries = squad.filter((s) => s.count > 0);
  const hordeEntries = horde.filter((h) => h.count > 0);

  const totalHumans = squadEntries.reduce((s, e) => s + e.count, 0);
  const totalHumanMass = squadEntries.reduce((s, e) => s + e.count * e.profile.weight, 0);
  const totalAnimals = hordeEntries.reduce((s, e) => s + e.count, 0);
  const totalAnimalWeight = hordeEntries.reduce((s, e) => s + e.count * e.animal.weight, 0);

  const powers = squadEntries.map((e) => e.count * profileLambdaPower(e.profile));
  const totalPower = powers.reduce((s, x) => s + x, 0);
  const threats = hordeEntries.map((e) => e.count * animalLambdaThreat(e.animal));
  const totalThreat = threats.reduce((s, x) => s + x, 0);

  const powerRatio = totalThreat > 0 ? totalPower / Math.max(totalThreat, 0.001) : totalPower > 0 ? 99 : 0;

  const spread = 0.32;
  const winProbability = totalAnimals === 0 ? 1 : 1 / (1 + Math.exp(-(powerRatio - 1) / spread));
  const verdict: Simulation['verdict'] =
    winProbability >= 0.85 ? 'victoire' : winProbability >= 0.4 ? 'incertain' : 'defaite';

  const avgLethality = totalAnimals > 0
    ? hordeEntries.reduce((s, e) => s + e.count * e.animal.lethality, 0) / totalAnimals
    : 0;
  const avgExposure = totalHumans > 0
    ? squadEntries.reduce((s, e) => s + e.count * (e.profile.armed ? 0.15 : 1), 0) / totalHumans
    : 1;
  const freeTime = clamp(1 / Math.max(powerRatio, 0.05), 0.2, 3);
  const pressureFactor = powerRatio < 1 ? 1.6 : 1;

  const humanDeaths = Math.round(clamp(totalHumans * 0.11 * (avgLethality / 4) * avgExposure * freeTime * pressureFactor, 0, totalHumans));
  const humanSevere = Math.round(clamp(totalHumans * 0.08 * (avgLethality / 4) * avgExposure * freeTime, 0, totalHumans - humanDeaths));
  const humanLight = Math.round(clamp((totalHumans - humanDeaths - humanSevere) * 0.35, 0, totalHumans - humanDeaths - humanSevere));
  const animalsDefeated = Math.round(totalAnimals * clamp(winProbability, 0, 1));

  // Répartition des pertes : les profils les plus fragiles (faible puissance) trinquent davantage.
  const vulnerabilities = squadEntries.map((e) => e.count / Math.max(profileLambdaPower(e.profile), 0.05));
  const deathsPer = clampArr(vulnerabilities, humanDeaths);
  const severePer = clampArr(vulnerabilities, humanSevere);
  const lightPer = clampArr(vulnerabilities, humanLight);
  const perProfile = squadEntries.map((e, i) => ({
    profile: e.profile, count: e.count, power: powers[i],
    deaths: Math.min(e.count, deathsPer[i] ?? 0),
    severe: Math.min(e.count, severePer[i] ?? 0),
    light: Math.min(e.count, lightPer[i] ?? 0),
  }));
  const defeatedPer = clampArr(threats, animalsDefeated);
  const perAnimal = hordeEntries.map((e, i) => ({
    animal: e.animal, count: e.count, threat: threats[i], defeated: Math.min(e.count, defeatedPer[i] ?? 0),
  }));

  const narrative: string[] = [];
  if (totalHumans === 0 || totalAnimals === 0) {
    narrative.push('Ajoutez au moins un profil humain et un animal pour lancer la confrontation.');
  } else {
    const topProfile = [...perProfile].sort((a, b) => b.power - a.power)[0];
    const topAnimal = [...perAnimal].sort((a, b) => b.threat - a.threat)[0];
    narrative.push(
      `Puissance humaine totale : ${totalPower.toFixed(1)} unité(s) « lambda » contre une menace de ${totalThreat.toFixed(1)} pour ${totalAnimals} animal(aux), soit un rapport de ${powerRatio.toFixed(2)}.`
    );
    if (topProfile) narrative.push(`${topProfile.profile.name} porte l'essentiel de la puissance offensive du groupe.`);
    if (topAnimal) narrative.push(`${topAnimal.animal.name} est la menace la plus dangereuse de la horde.`);
    narrative.push(
      verdict === 'victoire'
        ? `Le groupe submerge la horde avant de subir des pertes décisives.`
        : verdict === 'incertain'
        ? `L'issue dépend de l'ordre dans lequel les animaux sont engagés : diviser la horde change tout.`
        : `Le groupe est débordé : trop d'animaux, ou des profils trop fragiles pour absorber les premiers assauts.`
    );
  }

  return {
    totalHumans, totalHumanMass, totalAnimals, totalAnimalWeight, powerRatio, winProbability, verdict,
    humanDeaths, humanSevere, humanLight, animalsDefeated, narrative, perProfile, perAnimal,
  };
}

export function matchupSlug(animal: Animal, profile: Profile): string {
  return `${profile.slug}-vs-${animal.slug}`;
}

// ---------------------------------------------------------------------------
// Mode animal contre animal : duel 1 contre 1 entre deux espèces, basé sur
// une puissance de combat dérivée de la masse (loi d'échelle ~0.75, comme la
// force physique n'augmente pas linéairement avec le poids) et de la létalité.
// ---------------------------------------------------------------------------

export interface AnimalDuel {
  a: Animal;
  b: Animal;
  powerA: number;
  powerB: number;
  winProbA: number; // probabilité de victoire de `a`, 0..1
  verdict: 'a' | 'b' | 'egalite';
  narrative: string[];
}

/** Puissance de combat relative d'un animal, calibrée sur masse et létalité. */
export function animalPower(animal: Animal): number {
  return Math.pow(animal.weight, 0.75) * (1 + animal.lethality * 0.22);
}

export function simulateAnimalDuel(a: Animal, b: Animal): AnimalDuel {
  const powerA = animalPower(a);
  const powerB = animalPower(b);
  const spread = 0.5;
  const winProbA = 1 / (1 + Math.exp(-Math.log(powerA / powerB) / spread));
  const verdict: AnimalDuel['verdict'] = winProbA > 0.55 ? 'a' : winProbA < 0.45 ? 'b' : 'egalite';

  const narrative: string[] = [];
  const heavier = a.weight >= b.weight ? a : b;
  const lighter = heavier === a ? b : a;
  narrative.push(
    `${heavier.name} (${heavier.weight} kg) contre ${lighter.name} (${lighter.weight} kg) : rapport de masse de ${(heavier.weight / lighter.weight).toFixed(1)} pour 1.`
  );
  if (verdict === 'egalite') {
    narrative.push(`Le duel est trop équilibré pour être tranché : masse et létalité se compensent presque exactement.`);
  } else {
    const winner = verdict === 'a' ? a : b;
    const loser = verdict === 'a' ? b : a;
    narrative.push(
      `${winner.name} impose sa loi grâce à ${winner.weight > loser.weight ? 'son gabarit' : 'sa létalité supérieure'} et finit par avoir raison de ${lowerAnimalName(loser)}.`,
      `${loser.name} résiste un temps mais s'épuise avant de pouvoir infliger une blessure décisive.`
    );
  }

  return { a, b, powerA, powerB, winProbA, verdict, narrative };
}
