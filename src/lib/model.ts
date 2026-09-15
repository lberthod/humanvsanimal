import animals from '../data/animals.json';
import profiles from '../data/profiles.json';
import matchupsRaw from '../data/matchups.json';

export type Animal = (typeof animals)[number];
export type Profile = (typeof profiles)[number];
export type Range = [number, number] | null;

const matchups = matchupsRaw as unknown as Record<string, Record<string, Range>>;

export { animals, profiles };

export function getAnimal(slug: string): Animal | undefined {
  return animals.find((a) => a.slug === slug);
}
export function getProfile(slug: string): Profile | undefined {
  return profiles.find((p) => p.slug === slug);
}
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
      `${count} ${profile.name.toLowerCase()} ne peuvent pas venir à bout d'un ${animal.name.toLowerCase()}, quel que soit leur nombre.`,
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
  const exposure = profile.armed ? 0.15 : 1;
  const baseCasualties = animal.lethality * (profile.slug === 'soldat' ? 0.05 : profile.slug === 'combattant-couteau' ? 0.4 : 1);
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
      `Il faudrait ${formatThreshold(threshold)} ${profile.shortName.toLowerCase()}${lo > 1 ? 's' : ''} pour espérer une victoire certaine.`
    );
  }

  return {
    count, threshold, winProbability, verdict,
    humanDeaths: deaths, humanSevere: severe, humanLight: light,
    animalDies, totalHumanMass, massRatio, narrative,
  };
}

export function matchupTitle(animal: Animal, profile: Profile): string {
  return `${profile.name} vs ${animal.name}`;
}

export function matchupSlug(animal: Animal, profile: Profile): string {
  return `${profile.slug}-vs-${animal.slug}`;
}
