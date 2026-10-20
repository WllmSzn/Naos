# Naos

Serveur MCP pour concevoir des interfaces HTML + Tailwind cohérentes et soignées. Il ne contient pas de LLM : il fournit au modèle du client (Claude, Cursor…) des **systèmes de design imposés** (« Design DNA »), des règles et des sections de référence. Il assemble ensuite les écrans, les contrôle (lint, rendu réel) et change leur DNA sans les régénérer.

Tout se fait dans un **mode de conception** :

| Mode | Pour | Particularités |
|---|---|---|
| `website` | Sites vitrines, landings, pages de marque | Récit et moment fort, hiérarchie sur-titre → titre → appui → action, rendu desktop 1440 + mobile 390, lint marketing |
| `product-desktop` | Écrans d'application (SaaS, consoles, back-offices) | Tâches et données, densité et dimensions sémantiques, tous les états, rendu 1280 / 1440 / 1920, cibles denses, libellés produit |

D'autres modes (`product-mobile`…) s'ajoutent par un simple dossier, sans code (voir « Ajouter un mode »).

## Installation

```bash
npm install
npm run build
npm test
```

> **Windows / PowerShell** : si `npm` est bloqué (« l'exécution de scripts est désactivée »), utiliser `npm.cmd` à la place, ou autoriser une fois les scripts locaux pour ton compte : `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Brancher dans Claude Code

```bash
claude mcp add naos --scope user -- node C:/Users/Artefact/Naos/dist/index.js
```

### Brancher dans Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "naos": { "command": "node", "args": ["C:/Users/Artefact/Naos/dist/index.js"] }
  }
}
```

## Utilisation

Dans Claude Code, le plus simple est le prompt `ui_screen` :

```
/mcp__naos__ui_screen   brief: "Détail d'une alerte critique…"   mode: product-desktop   dna: artefact-dark
```

On peut aussi le demander en langage courant : *« Avec Naos, en mode produit desktop et la DNA artefact-dark, crée l'écran de détail d'une alerte. »*

## Ce que le serveur expose

**Modes et DNA**
- `list_modes` : modes disponibles, leurs largeurs d'écran, leurs types de sections et les DNA qui les servent.
- `list_dna(mode?)`, `get_dna(id, mode?)`, `suggest_dna(product, mode?, mood?, theme?)`. Avec un mode, seules les DNA de ce mode sont proposées, et `get_dna` renvoie l'identité plus le seul bloc de ce mode.
- `get_rules(mode?)` : règles communes, et règles propres au mode.

**Écrans**
- `wrap_screen(body, dna_id, mode?, title?, libs?, overrides?, save_as?)` : passe le corps au lint du mode, puis l'assemble en page HTML autonome. La page contient Tailwind configuré sur les tokens **et les dimensions** de la DNA (`h-ctl`, `h-row`, `w-sidebar`…), les polices, les icônes, et sur demande Alpine.js et Chart.js. Le mode est inscrit dans la page.
- `lint_screen(html, dna_id?, mode?, autofix?)` : contrôle déterministe selon le profil du mode. Il corrige ce qui est sans ambiguïté et signale le reste.
- `preview_screen(file | html, mode?, viewports?, max_slices?)` : rendu réel aux largeurs du mode. Il renvoie des captures en tranches et des contrôles : débordement, contraste sur le fond effectif, cibles selon les seuils du mode, images cassées, polices, erreurs JavaScript.
- `retheme(dna_id, html | file, mode?, overrides?, save_as?)` : applique une autre DNA **du même mode** sans régénérer l'écran.
- `read_screen(file)`.

**Sections**
- `list_patterns(mode, kind?, dna?)` / `get_patterns(mode, dna?, ids? | kinds? | query?)`. Les sections sont rangées par mode. Avec `dna`, les sections propres à cette DNA (ex. `artefact-alert-rows`) passent en tête, et celles des autres DNA sont masquées.

**Création de DNA** : `scan_url(url)` (mesures, brouillon d'identité et capture), puis `save_dna(dna, overwrite?)`, qui valide aussi les champs exigés par chaque mode.

**Workflows** (prompts MCP, ou outil `get_workflow`)
- `ui_screen(brief, mode, dna?, save_as?)` : pipeline complet, dont le cadrage, la structure, la composition et la relecture viennent du mode. En produit, il raisonne en tâches, données et états. En site, il raisonne en récit et en sections.
- `ui_component(component, mode?, dna?)` : **planche de composant**. Elle présente l'anatomie, les tailles, les variantes, tous les états (repos, survol, focus, sélectionné, désactivé, chargement, erreur, vide), les contenus limites, l'usage et la traduction vers le code.
- `ui_review(file?, mode?, focus?)` : critique en cinq rubriques, appuyée sur le lint et le rendu réel.
- `dna_from_sites(urls, mode?, notes?)`.

**Resources** : `rules://core`, `dna://catalog`, `dna://{id}`.

## Les DNA : identité commune + un bloc par mode

```jsonc
{
  "id": "artefact-dark",
  "tokens": { … }, "extraColors": { … }, "fonts": { … }, "shape": { … }, "rootFontSize": "15px",
  "rules": { "do": [ … ], "dont": [ … ] },           // identité : vraie dans tous les modes
  "modes": {
    "product-desktop": {
      "density": "compact",
      "sizes": { "control": "2.25rem", "controlSm": "2rem", "row": "2.5rem", "sidebar": "224px", "icon": "1rem" },
      "states": { "selected": "…", "hover": "…", "focus": "…", "disabled": "…" },
      "rules": { … },                                 // règles d'écran propres au mode
      "patterns": ["artefact-sidebar", "artefact-alert-rows", …]
    },
    "website": { "signature": "…", "rules": { … } }
  }
}
```

- Une DNA sert un mode **seulement si elle contient son bloc**. Chaque mode déclare les champs qu'il exige (`dnaRequires`) : `signature` pour `website`, `density` et `sizes` pour `product-desktop`.
- Les **dimensions** deviennent des classes sémantiques (`h-ctl`, `h-ctl-sm`, `h-row`, `w-sidebar`, `h-header`, `size-icon`). La densité se règle donc dans la DNA et suit le retheme.
- Les **règles** s'empilent par spécificité croissante : règles communes, règles du mode, identité de la DNA, bloc de mode de la DNA.

Le schéma ([src/dna/schema.ts](src/dna/schema.ts)) vérifie aussi les contrastes :
- ink sur fond ≥ 7 ;
- ≥ 4.5 pour muted et pour accentInk sur accent ;
- ≥ 4.5 pour success, warning, danger et l'accent utilisés **en texte**, sur le fond comme sur leur propre teinte ;
- ≥ 3 pour les couleurs métier (`extraColors`).

Un accent qui fait un bon aplat mais un mauvais texte garde `accent` et ajoute `accentText`. Les champs `extraColors` (couleurs métier comme `sev-critical`), `rootFontSize` et les polices système (`ui-monospace`) servent à coller au design system d'un produit existant. Exemple complet : `artefact-dark.json` et `artefact-light.json`.

### Ajouter ou modifier une DNA

1. Créer ou modifier `content/dna/<id>.json`. Le nom du fichier est l'`id`. Partir d'une DNA du même mode.
2. `npm test` : schéma, contrastes, champs exigés par les modes, sections déclarées.
3. `npm run demo -- <id>`, ouvrir la page, puis `npm run audit -- <id>`.
4. Si le serveur tourne déjà : `reload_library`.

## Ajouter un mode

Un mode est un dossier `content/modes/<id>/` :

```
mode.json      réglages : viewports, seuils de cibles, profil de lint, champs exigés des DNA,
               types de sections, textes du workflow (cadrage, structure, composition, relecture)
rules.md       règles propres au mode
patterns/      sections du mode
```

Le plus simple est de copier un mode proche. Pour `product-mobile`, par exemple : copier `product-desktop`, puis mettre les viewports à 390/430 avec `"mobile": true`, des cibles de 44px, et écrire les règles et sections mobiles (barre d'onglets, feuilles…). Ajouter ensuite un bloc `modes["product-mobile"]` aux DNA concernées. Aucun code n'est à modifier : `npm test` vérifie la cohérence.

### Ajouter une section

Créer `content/modes/<mode>/patterns/<id>.html`. La première ligne est un commentaire JSON : `{"id","name","kind","description","tags","libs","dna"?}`, où `kind` doit faire partie des `patternKinds` du mode et `dna` réserve la section à certaines DNA. Le reste est du HTML en classes sémantiques uniquement. `npm test` vérifie le lint en clair et en sombre, et `npm run audit` vérifie le rendu.

## Images

Jamais d'image aléatoire. Sans vraie image, l'écran contient un emplacement décrit :

```html
<div data-image="Capture de la chaîne de processus : powershell.exe lancé par winword.exe" class="aspect-[16/9] rounded-card"></div>
```

L'enveloppe l'affiche en zone hachurée aux couleurs de la DNA, avec la description en légende.

## Contrôles

```bash
npm test                       # tests unitaires et d'intégration (~15 s)
npm run audit                  # chaque DNA × chacun de ses modes × toutes ses sections, dans le navigateur
npm run audit -- artefact-dark # une seule DNA
npm run demo                   # écrans d'exemple : landing (website), demo et soc (product-desktop)
```

Les pages vont dans `output/`, ou dans le dossier défini par `NAOS_OUTPUT_DIR`, et les captures dans `output/previews/`. Le serveur n'écrit et ne lit jamais en dehors de ce dossier, ni en dehors de `content/` pour `save_dna`. `NAOS_CONTENT_DIR` permet d'utiliser un autre dossier de contenu, et `NAOS_BROWSER` un autre navigateur (Edge ou Chrome sont détectés automatiquement).

## Structure

```
content/
  rules/core.md         règles communes à tous les modes
  modes/<mode>/         mode.json, rules.md, patterns/
  dna/                  une DNA par fichier JSON (identité + modes)
src/
  index.ts              point d'entrée stdio
  server.ts             outils, resources et prompts MCP
  modes/                chargement et schéma des modes
  dna/                  schéma, chargement, suggestion, surcharges
  screen/               wrap (enveloppe), lint, retheme, fichiers de sortie
  preview/              rendu réel : captures en tranches et contrôles dans la page
  scan/                 scan d'un site → brouillon de DNA
  patterns/             chargement et sélection des sections
  workflows.ts          workflows guidés
examples/               corps d'écran de démonstration
scripts/                demo.ts, audit.ts, migrate-modes.mjs (migration ponctuelle vers les modes)
test/                   tests node:test (via tsx)
```
