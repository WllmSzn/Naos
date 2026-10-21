# Naos

Serveur MCP (TypeScript, stdio) pour produire des interfaces HTML + Tailwind soignées. Il ne contient **pas de LLM** : il fournit au modèle du client des systèmes de design imposés (« Design DNA »), des règles et des sections de référence. Il assemble, contrôle (lint et rendu réel) et change la DNA d'un écran sans le régénérer. Usage professionnel, travail client compris.

## Règle de reprise : à respecter absolument

Naos reprend des **idées** d'Inspo AI Studio (`c:\Users\Downloads\inspoai-studio-main`). Ce projet est sous licence PolyForm Noncommercial : **aucun code, aucune valeur, aucun prompt, aucune expression régulière ni aucun HTML ne doit en être copié ou paraphrasé**, parce que Naos sert à un usage commercial. On peut lire Inspo pour comprendre un concept, puis on réécrit à notre façon. Les DNA, sections, règles et prompts d'Naos sont tous des créations originales.

## Commandes

L'utilisateur travaille sous **Windows PowerShell 5.1**. Donner une commande par ligne (pas de `&&`). Si `npm` est bloqué par la politique d'exécution, utiliser `npm.cmd`.

```
npm run build      # tsc → dist/ (c'est dist/index.js que Claude Code exécute)
npm test           # tests node:test via tsx (~10 s, dont 2 tests qui ouvrent le navigateur)
npm run demo       # output/demo-<dna>.html et output/landing-<dna>.html
npm run audit      # toutes les sections × toutes les DNA dans le navigateur ; exit 1 s'il reste une erreur
```

Naos est enregistré dans Claude Code (scope user) avec `node C:/Users/Artefact/Naos/dist/index.js`. **Après une modification, lancer `npm run build`** : une session déjà ouverte garde l'ancien serveur, et il faut en ouvrir une nouvelle pour charger le nouveau. La CLI `claude` n'est pas dans le PATH : elle se trouve dans l'extension VS Code (`%USERPROFILE%\.vscode\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe`).

Le navigateur headless (scan, aperçu, audit) est l'Edge installé, piloté par puppeteer-core. Chrome n'est pas installé. La variable `NAOS_BROWSER` permet d'en indiquer un autre.

## Architecture

```
content/                 données éditables, rechargées par l'outil reload_library
  rules/core.md          règles communes à tous les modes
  modes/<mode>/          un mode de conception : mode.json, rules.md, patterns/<id>.html (sections génériques)
naos.config.json         emplacement de la bibliothèque de DNA (local, hors git)
src/
  index.ts               point d'entrée stdio (stdout réservé au protocole, logs sur stderr)
  server.ts              outils, resources et prompts MCP ; resolveMode() arbitre DNA + mode
  modes/                 schéma et chargement des modes
  dna/                   schéma zod (contrastes, blocs de mode), chargement, suggestion, surcharges
  screen/                wrap (enveloppe : <head> généré depuis la DNA et le mode), lint, retheme, sortie
  scan/                  scan d'un site : collecte dans la page, analyse, brouillon de DNA
  preview/               rendu réel aux viewports du mode : captures en tranches et contrôles
  patterns/              chargement et sélection des sections, par mode
  workflows.ts           ui_screen, ui_component, ui_review, dna_from_sites (contenu métier tiré du mode)
examples/                corps d'écran utilisés par npm run demo
output/                  pages, scans, aperçus générés (ignoré par git)
```

## La bibliothèque de DNA (hors de Naos)

Les DNA vivent dans **`C:\Users\Artefact\naos-library`**, un dépôt git séparé, déclaré dans `naos.config.json` (la variable `NAOS_LIBRARY` a priorité, `content/dna` sert de repli historique). Rangement : `<famille>/<id>/dna.json`, avec les familles `artefact`, `inspirations`, `base` et `clients/<client>`. Une section propre à une DNA va dans `<famille>/<id>/patterns/<mode>/`, une section partagée par une famille dans `<famille>/patterns/<mode>/`. `loadLibrary()` renvoie aussi `locations` (famille, dossier, fichier de chaque DNA).

- **Les tests n'utilisent jamais la bibliothèque réelle** : chaque fichier de test importe d'abord `./setup.js`, qui pointe `NAOS_LIBRARY` vers `test/fixtures/library` (11 DNA). Un nouveau test qui a besoin d'une DNA l'y copie.
- **Après une modification de DNA**, régénérer la galerie : `npm run catalog -- --previews`. La bibliothèque se commite **dans son propre dépôt**, pas dans Naos.

## Les modes

Naos distingue des **métiers de conception** : `website` (sites, landings) et `product-desktop` (écrans d'application). Un mode est **entièrement décrit par son dossier**. Le code ne doit jamais tester un id de mode en dur : il lit `mode.json` (viewports, seuils de cibles, profil de lint, `dnaRequires`, `patternKinds`, textes du workflow). Ajouter un mode (`product-mobile`…) = un dossier + des blocs dans les DNA concernées. Si un besoin semble exiger du code propre à un mode, c'est un réglage manquant dans `ModeSchema`.

Une DNA sert un mode seulement si elle a le bloc `modes.<mode>`, avec les champs exigés par ce mode. Les sections portant `"dna": [...]` sont réservées à ces DNA. Le mode est inscrit dans la page (`<meta name="naos-mode">`) : le lint, le rendu et le retheme le relisent.

## Le principe qui tient tout

Le corps d'un écran n'utilise **que des classes sémantiques** : `bg-base`, `bg-surface`, `bg-raised`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, `text-accent-ink`, `text-inverse`, `font-display`, `font-body`, `font-mono`, `font-accent`, `rounded-ui`, `rounded-card`, `shadow-card`, `shadow-overlay`, les couleurs métier de la DNA (`sev-critical`…), et les dimensions du mode (`h-ctl`, `h-ctl-sm`, `h-row`, `w-sidebar`, `h-header`, `size-icon`). Tout le style vit dans le `<head>` généré par `wrapScreen`. Changer de DNA revient donc à reconstruire le `<head>`, et c'est ce que fait `retheme`, sans appel au LLM.

Pièges connus :
- `text-base` est la taille de police par défaut de Tailwind. La couleur `base` n'est donc définie que pour `bg-*`, et le texte posé sur `bg-ink` utilise `text-inverse`.
- `rounded-ui` sert aux **contrôles** (dans certaines DNA, il vaut 9999px, donc une pilule) et `rounded-card` aux **conteneurs et images**. Un conteneur en `rounded-ui` devient un ovale, et le lint le signale.
- `text-accent` utilise `tokens.accentText` s'il existe. Un accent saturé peut être un bon aplat et un mauvais texte. Sur un fond inversé, utiliser `bg-base text-ink` plutôt que `bg-accent-ink text-accent`.
- Jamais d'image aléatoire (picsum, etc.) : utiliser un emplacement décrit, `<div data-image="description précise" class="aspect-[4/3] rounded-card">`.

## Qualité : ce qui doit rester vert

- **Le schéma DNA refuse un contraste insuffisant** : ink ≥ 7 ; muted, accentInk/accent ≥ 4.5 ; couleurs d'état et accent en texte ≥ 4.5 sur le fond **et sur leur propre teinte /15**. Pour corriger une couleur, la rapprocher de ink (`ensureContrast` dans `src/color.ts`) plutôt que d'en inventer une autre.
- **Chaque section passe le lint de son mode sans erreur ni correction**, en clair et en sombre (vérifié dans `test/patterns.test.ts`).
- **Pas de texte coloré ou gris sur une teinte posée sur une autre teinte** (badge sur ligne sélectionnée, compteur dans un item actif) : la double teinte fait tomber le contraste. Utiliser une pastille pleine ou retirer le fond de la ligne.
- **`npm run audit` ne relève aucune erreur.** Les avertissements de cibles tactiles sont tolérés.
- **Toujours vérifier visuellement.** Après une modification de DNA, de section ou d'enveloppe, regarder le rendu (`npm run demo`, ouvrir dans Brave, ou l'outil `preview_screen`). Plusieurs défauts réels n'ont été vus que sur une capture : un badge illisible, une image ovale, une carte flottante qui masquait du texte.

## Conventions

- Contenu, règles, messages d'erreur et commentaires en **français**. Identifiants et code en anglais.
- Scripts injectés dans le navigateur (`collect.ts`, `checks.ts`) : écrits en **chaînes JS autonomes**, parce qu'une fonction TS transpilée peut embarquer des helpers absents de la page.
- Les commentaires expliquent le *pourquoi* (contrainte, piège, décision), pas le *quoi*.
- Ne jamais écrire en dehors de la bibliothèque (outil `save_dna`, catalogue) et de `output/` (pages, scans, aperçus). Les noms de fichiers passent par `safeScreenName`, et les familles par la validation de `saveDna`.
- Avant un commit, **vérifier `git status` juste avant `git add`** : d'autres sessions peuvent travailler en parallèle sur Naos ou la bibliothèque.
