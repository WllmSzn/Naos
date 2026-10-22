# Contexte commun — à coller en tête de chaque prompt

Tu travailles sur **Naos**, un serveur MCP TypeScript (stdio, sans LLM) qui fournit des systèmes de design (« DNA »), des règles et des sections de référence pour générer des écrans HTML + Tailwind, puis les assemble (`wrap_screen`), les contrôle (`lint_screen`, `preview_screen`) et change leur DNA sans régénération (`retheme`).

- Dépôt : `C:\Users\Artefact\Naos`. **Lis `CLAUDE.md` en entier avant de commencer** : architecture, pièges connus, règles qualité.
- Bibliothèque de DNA : `C:\Users\Artefact\naos-library`, dépôt git **séparé** (`<famille>/<id>/dna.json`). Les tests n'utilisent jamais la vraie bibliothèque mais `test/fixtures/library`.
- Mode concerné : `presentation` (`content/modes/presentation/` : `mode.json`, `rules.md`, `patterns/*.html`). Diapos de 1920×1080, une `<section data-slide>` par diapo, runtime `slides` injecté par `wrap.ts`.

## Règles non négociables

1. **Reprise propre** : Naos reprend des idées d'Inspo AI Studio (`c:\Users\Downloads\inspoai-studio-main`, licence PolyForm Noncommercial). N'en copie ni n'en paraphrase **aucun** code, HTML, valeur, prompt ou expression régulière. Tout ce que tu écris est original.
2. **Contrat de tokens** : le corps des écrans et des sections n'utilise que des classes sémantiques (voir `content/rules/core.md`). Pas de hex, pas de couleur Tailwind nommée, pas de `style="color:…"`. Tout le style vit dans le `<head>` généré par `wrapScreen`.
3. **Le code ne teste jamais un id de mode en dur** : un besoin propre à un mode devient un réglage de `mode.json` / `ModeSchema`.
4. **Générique d'abord** : rien de propre à une DNA ou à une famille (ARTEFACT…) dans ce chantier. Les exemples de contenu peuvent venir du deck ARTEFACT, les composants doivent servir n'importe quelle DNA.
5. Contenu, règles, messages d'erreur, commentaires en **français** ; identifiants et code en anglais. Les commentaires expliquent le *pourquoi*.

## Environnement

- Windows, **PowerShell 5.1** : une commande par ligne, pas de `&&`. Si `npm` est bloqué, `npm.cmd`.
- Navigateur headless : Edge via puppeteer-core (Chrome n'est pas installé).
- Commandes : `npm run build`, `npm test`, `npm run audit`, `npm run demo`, `npm run catalog -- --previews` (après modification de DNA).

## Définition de « terminé » (pour chaque prompt)

- `npm test` vert, `npm run build` sans erreur, `npm run audit` sans erreur.
- Chaque section ou bloc ajouté passe le lint du mode **sans erreur ni correction automatique**, avec une DNA claire et une sombre.
- **Vérification visuelle** : rendu regardé sur capture (`preview_screen` ou `npm run demo`) avec au moins `artefact-dark`, `artefact-pillar` et une DNA claire. Les défauts réels de Naos ont presque tous été vus sur capture, pas dans les tests.
- `CLAUDE.md` et `content/modes/presentation/rules.md` mis à jour si le chantier change une règle ou l'architecture.
- **`git status` juste avant `git add`** : d'autres sessions travaillent en parallèle sur Naos et la bibliothèque. Un commit par prompt, message en français. Les modifications de DNA se commitent dans `naos-library`, pas dans Naos.
- Termine par un compte rendu court : ce qui a été fait, ce qui a été vérifié (et comment), ce qui reste ou pose question.
