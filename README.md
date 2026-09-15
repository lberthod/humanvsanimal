# Humain vs Animal

Site statique Astro + Vue : simulateur et pages SEO « combien d'humains pour battre un gorille / chimpanzé / lion / ours / loup / crocodile ».

- Prod : https://humanvsanimal.loicberthod.ch
- Données : `src/data/*.json` (animaux, profils, seuils par duel)
- Moteur : `src/lib/model.ts`
- Simulateur : `src/components/Simulator.vue`
- Pages générées : accueil, simulateur, méthode, 6 animaux, 6 profils, 36 combats, sitemap

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # dist/
```

Déploiement (chemin B du guide VPS) : rsync du projet vers `/mnt/data/humanvsanimal`, `npm install && npm run build` sur le VPS, bloc Caddy dédié servant `dist/`.
