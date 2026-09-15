// Icônes vectorielles maison (aucun emoji) pour les 6 animaux et 6 profils humains.
// Chaque icône est un silhouette 24×24 simple, dessinée en primitives, utilisable
// telle quelle en SVG (pages/composants) ou rejouée trait pour trait sur le canvas
// de l'arène via drawAnimalIcon / drawProfileIcon (mêmes proportions).

const ANIMAL_TINTS: Record<string, string> = {
  loup: '#aab2c0',
  chimpanze: '#8a6a4a',
  lion: '#caa04a',
  gorille: '#6b6560',
  'ours-brun': '#8a5a35',
  crocodile: '#5f7a52',
};
const PROFILE_TINTS: Record<string, string> = {
  'humain-lambda': '#d7c7a8',
  bimbo: '#d68fae',
  retraite: '#b7aea0',
  'expert-arts-martiaux': '#e0a24a',
  'combattant-couteau': '#c1362b',
  soldat: '#5f7a52',
  boxeur: '#c97a3a',
  policier: '#3a5fa0',
  'chasseur-arc': '#5a7a4a',
  'lutteur-sumo': '#b06a3a',
};

function svg(inner: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

// --- Animaux (profil de tête, silhouette latérale) -------------------------------------------

const ANIMAL_SVG: Record<string, string> = {
  loup: svg(`
    <path d="M4 16c0-3 1.5-5 3.5-6.5L6 6l3.2 1.4C10.3 6.5 11.6 6 13 6l2-3 .3 3.6c2.4 1 4.2 3.1 4.2 5.9 0 3.6-3.2 6.5-7.75 6.5S4 19.1 4 16Z" fill="currentColor"/>
    <circle cx="14.2" cy="12.6" r="1" fill="var(--surface)"/>
  `),
  chimpanze: svg(`
    <circle cx="12" cy="13" r="6.2" fill="currentColor"/>
    <circle cx="6.6" cy="10.5" r="2" fill="currentColor"/>
    <circle cx="17.4" cy="10.5" r="2" fill="currentColor"/>
    <ellipse cx="12" cy="15" rx="3" ry="2.4" fill="var(--surface)" opacity=".5"/>
    <circle cx="10" cy="12.5" r=".9" fill="var(--surface)"/>
    <circle cx="14" cy="12.5" r=".9" fill="var(--surface)"/>
  `),
  lion: svg(`
    <g fill="currentColor">
      <circle cx="12" cy="13" r="4" />
      <path d="M12 3.5 12.9 7 15 4.5l-.4 3.6 2.9-1.7-1.4 3.3 3.2-.2-2.4 2.4 3 1.2-3.2.9 2 2.6-3.2-.7.7 3.1-2.6-2-1.3 2.9-.6-3.2-2.2 2.3.3-3.2-2.7 1.7 1-3.1L8 20l1-3.1-2.7-1.7 2.3-.3-2.2-2.3-.6 3.2-1.3-2.9-2.6 2 .7-3.1-3.2.7 2-2.6-3.2-.9 3-1.2-2.4-2.4 3.2.2-1.4-3.3 2.9 1.7L9 4.5l2.1 2.5Z"/>
    </g>
  `),
  gorille: svg(`
    <path d="M6 15.5c0-1.6.4-2.8 1.1-3.8L6.4 8l3-.9c.8-.6 1.7-.9 2.6-.9s1.8.3 2.6.9l3-.9-.7 3.7c.7 1 1.1 2.2 1.1 3.8 0 3.4-3 5.7-6.5 5.7s-6.5-2.3-6.5-5.7Z" fill="currentColor"/>
    <rect x="7.3" y="10.6" width="9.4" height="1.7" rx=".8" fill="var(--surface)" opacity=".55"/>
    <circle cx="9.7" cy="14.3" r=".9" fill="var(--surface)"/>
    <circle cx="14.3" cy="14.3" r=".9" fill="var(--surface)"/>
  `),
  'ours-brun': svg(`
    <circle cx="12" cy="13.5" r="6" fill="currentColor"/>
    <circle cx="6.8" cy="8.6" r="2.1" fill="currentColor"/>
    <circle cx="17.2" cy="8.6" r="2.1" fill="currentColor"/>
    <ellipse cx="12" cy="16" rx="2.6" ry="2" fill="var(--surface)" opacity=".5"/>
    <circle cx="10" cy="12.5" r=".9" fill="var(--surface)"/>
    <circle cx="14" cy="12.5" r=".9" fill="var(--surface)"/>
  `),
  crocodile: svg(`
    <path d="M2.5 14c2-1.4 4.3-2.2 6.9-2.2.6-1.3 1.8-2.3 3.4-2.6l1-2.6.9 2.4c2.6.1 5 1 6.8 2.6l1-.6-.3 1.6 1.3.9-1.6.3.2 1.6-1.4-1c-1.6.9-3.6 1.4-5.8 1.4H8.3c-2 0-3.9-.5-5.5-1.4Z" fill="currentColor"/>
    <path d="M9.4 11.8 8.6 13l1.1.2.8-1.3Zm2.6-.3-.7 1.3 1.1.1.7-1.3Zm2.6.1-.6 1.3 1.1.1.5-1.3Z" fill="var(--surface)" opacity=".7"/>
    <circle cx="13.6" cy="9.5" r=".9" fill="var(--surface)"/>
  `),
};

// --- Profils humains (silhouette debout, buste) -----------------------------------------------

const PROFILE_SVG: Record<string, string> = {
  'humain-lambda': svg(`
    <circle cx="12" cy="6" r="3" fill="currentColor"/>
    <path d="M6.5 21v-4.2C6.5 13 8.9 11 12 11s5.5 2 5.5 5.8V21" fill="currentColor"/>
  `),
  bimbo: svg(`
    <circle cx="12" cy="6" r="3" fill="currentColor"/>
    <path d="M14.6 4.2c1 .6 1.6 1.7 1.4 3l-1 .4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M8 21l-1.3-7.4C6.3 11 8.8 9.4 12 9.4s5.7 1.6 5.3 4.2L16 21Z" fill="currentColor"/>
  `),
  retraite: svg(`
    <circle cx="11" cy="6" r="2.8" fill="currentColor"/>
    <path d="M6.5 21v-3.8c0-3.3 2-5.6 4.7-6.1" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M12 11.2c2.6.6 4.3 2.7 4.3 5.8V21" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M17 12.5 15.6 21" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  `),
  'expert-arts-martiaux': svg(`
    <circle cx="12" cy="6" r="3" fill="currentColor"/>
    <path d="M12 11c-2.6 0-4.7 1.6-5.3 4H8l1-2.6V21h1.6v-6h2.8v6H15v-8.6l1 2.6h1.3c-.6-2.4-2.7-4-5.3-4Z" fill="currentColor"/>
    <circle cx="6.3" cy="14.6" r="1.3" fill="currentColor"/>
    <circle cx="17.7" cy="14.6" r="1.3" fill="currentColor"/>
  `),
  'combattant-couteau': svg(`
    <circle cx="11" cy="6" r="3" fill="currentColor"/>
    <path d="M6 21v-4.6C6 13 8.3 11 11.3 11s5.3 2 5.3 5.8V21" fill="currentColor"/>
    <path d="M15.5 12.2 20 8.4l-1.1 3.9-3 2Z" fill="currentColor"/>
  `),
  soldat: svg(`
    <path d="M9 6.4c0-1.9 1.4-3.2 3-3.2s3 1.3 3 3.2c0 .3-1.3.9-3 .9s-3-.6-3-.9Z" fill="currentColor"/>
    <path d="M6.5 21v-4.2C6.5 13 8.9 11 12 11s5.5 2 5.5 5.8V21" fill="currentColor"/>
    <path d="M8.5 13.5 18 11l-.3 1.7-8.7 2.6Z" fill="currentColor"/>
  `),
  boxeur: svg(`
    <circle cx="12" cy="6" r="3" fill="currentColor"/>
    <path d="M6.5 21v-4.2C6.5 13 8.9 11 12 11s5.5 2 5.5 5.8V21" fill="currentColor"/>
    <circle cx="5.5" cy="14.5" r="2.3" fill="currentColor"/>
    <circle cx="18.5" cy="12.5" r="2.3" fill="currentColor"/>
  `),
  policier: svg(`
    <circle cx="12" cy="6" r="3" fill="currentColor"/>
    <path d="M6.5 21v-4.2C6.5 13 8.9 11 12 11s5.5 2 5.5 5.8V21" fill="currentColor"/>
    <rect x="10.2" y="13.4" width="3.6" height="2.6" rx=".5" fill="var(--surface)" opacity=".6"/>
    <path d="M15.5 15.6 20 14l-.6 1.6-3.9 1.6Z" fill="currentColor"/>
  `),
  'chasseur-arc': svg(`
    <circle cx="12" cy="6" r="3" fill="currentColor"/>
    <path d="M6.5 21v-4.2C6.5 13 8.9 11 12 11s5.5 2 5.5 5.8V21" fill="currentColor"/>
    <path d="M18 6.5c1.8 1.4 1.8 9.6 0 11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M18 6.5 18 17.5" stroke="currentColor" stroke-width=".6" opacity=".6"/>
  `),
  'lutteur-sumo': svg(`
    <circle cx="12" cy="5.6" r="3.1" fill="currentColor"/>
    <path d="M5 21v-3.6C5 13.4 7.8 11 12 11s7 2.4 7 6.4V21Z" fill="currentColor"/>
    <rect x="5" y="15.4" width="14" height="2.2" fill="var(--surface)" opacity=".5"/>
  `),
};

export function animalIcon(slug: string): string {
  return ANIMAL_SVG[slug] ?? svg('<circle cx="12" cy="12" r="6" fill="currentColor"/>');
}
export function profileIcon(slug: string): string {
  return PROFILE_SVG[slug] ?? svg('<circle cx="12" cy="12" r="6" fill="currentColor"/>');
}

// --- Rendu canvas (arène) : mêmes silhouettes, tracées en primitives, teintées ------------------

export function drawAnimalIcon(ctx: CanvasRenderingContext2D, slug: string, cx: number, cy: number, size: number, color?: string) {
  const s = size / 24;
  ctx.save();
  ctx.translate(cx - 12 * s, cy - 12 * s);
  ctx.scale(s, s);
  ctx.fillStyle = color ?? ANIMAL_TINTS[slug] ?? '#999';
  ctx.shadowColor = 'rgba(8,6,3,.6)'; ctx.shadowBlur = 2.5;
  switch (slug) {
    case 'loup': {
      ctx.beginPath();
      ctx.moveTo(4, 16); ctx.bezierCurveTo(4, 13, 5.5, 11, 7.5, 9.5); ctx.lineTo(6, 6); ctx.lineTo(9.2, 7.4);
      ctx.bezierCurveTo(10.3, 6.5, 11.6, 6, 13, 6); ctx.lineTo(15, 3); ctx.lineTo(15.3, 6.6);
      ctx.bezierCurveTo(17.7, 7.6, 19.5, 9.7, 19.5, 12.5); ctx.bezierCurveTo(19.5, 16.1, 16.3, 19, 11.75, 19);
      ctx.bezierCurveTo(7.5, 19, 4, 19.1, 4, 16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0c0b09'; ctx.beginPath(); ctx.arc(14.2, 12.6, 1, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'chimpanze': {
      ctx.beginPath(); ctx.arc(12, 13, 6.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6.6, 10.5, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(17.4, 10.5, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0c0b09';
      ctx.beginPath(); ctx.arc(10, 12.5, .9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(14, 12.5, .9, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'lion': {
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        const r = i % 2 === 0 ? 9 : 6.5;
        const x = 12 + Math.cos(ang) * r, y = 13 + Math.sin(ang) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0c0b09'; ctx.beginPath(); ctx.arc(10, 12.5, .8, 0, Math.PI * 2); ctx.arc(14, 12.5, .8, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'gorille': {
      ctx.beginPath();
      ctx.moveTo(6, 15.5); ctx.bezierCurveTo(6, 13.9, 6.4, 12.7, 7.1, 11.7); ctx.lineTo(6.4, 8); ctx.lineTo(9.4, 7.1);
      ctx.bezierCurveTo(10.2, 6.5, 11.1, 6.2, 12, 6.2); ctx.bezierCurveTo(12.9, 6.2, 13.8, 6.5, 14.6, 7.1); ctx.lineTo(17.6, 8.2); ctx.lineTo(16.9, 11.9);
      ctx.bezierCurveTo(17.6, 12.9, 18, 14.1, 18, 15.5); ctx.bezierCurveTo(18, 18.9, 15, 21.2, 11.5, 21.2); ctx.bezierCurveTo(8, 21.2, 6, 18.9, 6, 15.5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0c0b09'; ctx.beginPath(); ctx.arc(9.7, 14.3, .9, 0, Math.PI * 2); ctx.arc(14.3, 14.3, .9, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'ours-brun': {
      ctx.beginPath(); ctx.arc(12, 13.5, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6.8, 8.6, 2.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(17.2, 8.6, 2.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0c0b09'; ctx.beginPath(); ctx.arc(10, 12.5, .9, 0, Math.PI * 2); ctx.arc(14, 12.5, .9, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'crocodile': {
      ctx.beginPath();
      ctx.moveTo(2.5, 14); ctx.bezierCurveTo(4.5, 12.6, 6.8, 11.8, 9.4, 11.8); ctx.bezierCurveTo(10, 10.5, 11.2, 9.5, 12.8, 9.2);
      ctx.lineTo(13.8, 6.6); ctx.lineTo(14.7, 9); ctx.bezierCurveTo(17.3, 9.1, 19.7, 10, 21.5, 11.6); ctx.lineTo(22.5, 11); ctx.lineTo(22.2, 12.6);
      ctx.lineTo(23.5, 13.5); ctx.lineTo(21.9, 13.8); ctx.lineTo(22.1, 15.4); ctx.lineTo(20.7, 14.4);
      ctx.bezierCurveTo(19.1, 15.3, 17.1, 15.8, 14.9, 15.8); ctx.lineTo(8.3, 15.8); ctx.bezierCurveTo(6.3, 15.8, 4.1, 15.3, 2.5, 14);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0c0b09'; ctx.beginPath(); ctx.arc(13.6, 9.5, .9, 0, Math.PI * 2); ctx.fill();
      break;
    }
    default: {
      ctx.beginPath(); ctx.arc(12, 12, 8, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

export function drawProfileIcon(ctx: CanvasRenderingContext2D, slug: string, cx: number, cy: number, size: number, color?: string) {
  const s = size / 24;
  ctx.save();
  ctx.translate(cx - 12 * s, cy - 12 * s);
  ctx.scale(s, s);
  ctx.fillStyle = color ?? PROFILE_TINTS[slug] ?? '#ccc';
  ctx.strokeStyle = ctx.fillStyle as string;
  const head = () => { ctx.beginPath(); ctx.arc(12, 6, 3, 0, Math.PI * 2); ctx.fill(); };
  const torso = () => {
    ctx.beginPath();
    ctx.moveTo(6.5, 21); ctx.lineTo(6.5, 16.8); ctx.bezierCurveTo(6.5, 13, 8.9, 11, 12, 11);
    ctx.bezierCurveTo(15.1, 11, 17.5, 13, 17.5, 16.8); ctx.lineTo(17.5, 21); ctx.closePath(); ctx.fill();
  };
  switch (slug) {
    case 'humain-lambda': head(); torso(); break;
    case 'bimbo': {
      head();
      ctx.beginPath();
      ctx.moveTo(8, 21); ctx.lineTo(6.7, 13.6); ctx.bezierCurveTo(6.3, 11, 8.8, 9.4, 12, 9.4);
      ctx.bezierCurveTo(15.2, 9.4, 17.7, 11, 17.3, 13.6); ctx.lineTo(16, 21); ctx.closePath(); ctx.fill();
      break;
    }
    case 'retraite': {
      ctx.beginPath(); ctx.arc(11, 6, 2.8, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(6.5, 21); ctx.lineTo(6.5, 17.2); ctx.bezierCurveTo(6.5, 13.9, 8.5, 11.6, 11.2, 11.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, 11.2); ctx.bezierCurveTo(14.6, 11.8, 16.3, 13.9, 16.3, 17); ctx.lineTo(16.3, 21); ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(17, 12.5); ctx.lineTo(15.6, 21); ctx.stroke();
      break;
    }
    case 'expert-arts-martiaux': {
      head();
      ctx.beginPath();
      ctx.moveTo(6.7, 15); ctx.lineTo(7, 12.4); ctx.lineTo(9, 14.4); ctx.lineTo(9, 21); ctx.lineTo(10.6, 21); ctx.lineTo(10.6, 15);
      ctx.lineTo(13.4, 15); ctx.lineTo(13.4, 21); ctx.lineTo(15, 21); ctx.lineTo(15, 14.4); ctx.lineTo(17, 12.4); ctx.lineTo(17.3, 15);
      ctx.bezierCurveTo(16.7, 12.4, 14.6, 11, 12, 11); ctx.bezierCurveTo(9.4, 11, 7.3, 12.4, 6.7, 15); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(6.3, 14.6, 1.3, 0, Math.PI * 2); ctx.arc(17.7, 14.6, 1.3, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'combattant-couteau': {
      ctx.beginPath(); ctx.arc(11, 6, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(6, 21); ctx.lineTo(6, 16.8); ctx.bezierCurveTo(6, 13, 8.3, 11, 11.3, 11);
      ctx.bezierCurveTo(14.4, 11, 16.6, 13, 16.6, 16.8); ctx.lineTo(16.6, 21); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(15.5, 12.2); ctx.lineTo(20, 8.4); ctx.lineTo(18.9, 12.3); ctx.lineTo(15.9, 14.3); ctx.closePath(); ctx.fill();
      break;
    }
    case 'soldat': {
      ctx.beginPath();
      ctx.moveTo(9, 6.4); ctx.bezierCurveTo(9, 4.5, 10.4, 3.2, 12, 3.2); ctx.bezierCurveTo(13.6, 3.2, 15, 4.5, 15, 6.4);
      ctx.bezierCurveTo(15, 6.7, 13.7, 7.3, 12, 7.3); ctx.bezierCurveTo(10.3, 7.3, 9, 6.7, 9, 6.4); ctx.closePath(); ctx.fill();
      torso();
      ctx.beginPath(); ctx.moveTo(8.5, 13.5); ctx.lineTo(18, 11); ctx.lineTo(17.7, 12.7); ctx.lineTo(9, 15.3); ctx.closePath(); ctx.fill();
      break;
    }
    case 'boxeur': {
      head(); torso();
      ctx.beginPath(); ctx.arc(5.5, 14.5, 2.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(18.5, 12.5, 2.3, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'policier': {
      head(); torso();
      ctx.beginPath(); ctx.moveTo(15.5, 15.6); ctx.lineTo(20, 14); ctx.lineTo(19.4, 15.6); ctx.lineTo(15.5, 17.2); ctx.closePath(); ctx.fill();
      break;
    }
    case 'chasseur-arc': {
      head(); torso();
      ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(18, 6.5); ctx.bezierCurveTo(19.8, 7.9, 19.8, 16.1, 18, 17.5); ctx.stroke();
      break;
    }
    case 'lutteur-sumo': {
      ctx.beginPath(); ctx.arc(12, 5.6, 3.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(5, 21); ctx.lineTo(5, 17.4); ctx.bezierCurveTo(5, 13.4, 7.8, 11, 12, 11);
      ctx.bezierCurveTo(16.2, 11, 19, 13.4, 19, 17.4); ctx.lineTo(19, 21); ctx.closePath(); ctx.fill();
      break;
    }
    default: head(); torso();
  }
  ctx.restore();
}
