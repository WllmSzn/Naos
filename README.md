# Hecate

Serveur MCP pour générer des interfaces HTML + Tailwind cohérentes et soignées. Il ne contient pas de LLM : il fournit au modèle du client (Claude, Cursor…) des **systèmes de design imposés** (« Design DNA »), des règles et, à terme, des contrôles déterministes.

## État

| Jalon | Contenu | État |
|---|---|---|
| 1. Socle | Serveur stdio, schéma de DNA validé (contrastes WCAG compris), 6 DNA, règles de base, suggestion | ✅ |
| 2. Déterministe | `wrap_screen`, `lint_screen`, `retheme` (avec surcharges), enregistrement dans `output/` | ✅ |
| 3. Pipeline | Workflows guidés (prompts MCP + `get_workflow`), 20 sections de référence, emplacements d'image décrits | ✅ |
| 4. Scan | `scan_url` (site → mesures + brouillon de DNA + capture), `save_dna` | ✅ (avancé) |

## Installation

```bash
npm install
npm run build
npm test
```

> **Windows / PowerShell** : si `npm` est bloqué (« l'exécution de scripts est désactivée »), utiliser `npm.cmd` à la place, ou autoriser une fois les scripts locaux pour ton compte : `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Brancher dans Claude Code

```bash
claude mcp add hecate --scope user -- node C:/Users/Hecate/dist/index.js
```

### Brancher dans Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "hecate": { "command": "node", "args": ["C:/Users/Hecate/dist/index.js"] }
  }
}
```

## Ce que le serveur expose

**Outils**
- `list_dna` : catalogue compact des DNA.
- `get_dna(id)` : DNA complète, avec l'URL Google Fonts.
- `suggest_dna(product, mood?, theme?, limit?)` : classement des DNA pour un produit décrit en français ou en anglais.
- `get_rules` : règles de base (contrat de tokens, espacement, typo, rédaction, états, accessibilité).
- `reload_library` : relit `content/dna` après une modification.
- `wrap_screen(body, dna_id, title?, lang?, libs?, overrides?, lint?, save_as?)` : passe le corps au lint, puis l'assemble en page HTML autonome (Tailwind configuré sur la DNA, polices, icônes iconify, et sur demande Alpine.js et Chart.js).
- `lint_screen(html, dna_id?, autofix?)` : contrôle déterministe. Il corrige ce qui est sans ambiguïté (gris Tailwind convertis en tokens selon le thème, `text-white` selon le fond, arrondis, ombres, emojis, balises de `<head>`). Il signale le reste : couleurs vives ou en dur, texte de remplissage, formules creuses, `alt` manquants, boutons et champs sans nom accessible, ordre des titres.
- `retheme(dna_id, html | file, from_dna?, overrides?, save_as?)` : applique une autre DNA sans régénérer l'écran.
- `scan_url(url)` : ouvre une page publique dans le Chrome ou l'Edge installé (mode headless), et mesure ses couleurs, polices, échelle typographique, réglages des titres, arrondis, ombres, espacements et variables CSS. Il renvoie un brouillon de DNA, avec les contrastes déjà corrigés et signalés, et une capture du haut de page. Captures et mesures sont rangées dans `output/scans/<site>/`. Le scan ne contourne aucune protection anti-robots.
- `save_dna(dna, overwrite?)` : valide une DNA complète et l'ajoute à la bibliothèque.

Parcours type pour créer une DNA depuis des références : `scan_url` sur chaque site, puis lecture des captures. On rédige ensuite les règles, l'ambiance, les usages et le moment fort, puis on enregistre avec `save_dna` et on vérifie avec `npm run demo -- <id>`. Le brouillon donne les valeurs. Les règles, elles, se rédigent en regardant les captures.

Navigateur : Edge ou Chrome sont détectés automatiquement. Sinon, définir `HECATE_BROWSER` avec le chemin de l'exécutable.

- `list_patterns(kind?, platform?)` / `get_patterns(ids? | kinds? | query?, platform?, limit?)` : sections de référence en classes sémantiques (nav, hero, logos, intro, feature, stats, testimonial, pricing, faq, cta, footer, app-shell, kpi, table, form, empty). Ce sont des références de structure, à adapter. Quand plusieurs types sont demandés, chaque type est couvert avant qu'un type ne reçoive une deuxième variante.
- `preview_screen(file | html, viewports?, max_slices?)` : rend la page dans un vrai navigateur, en desktop 1440px et en mobile 390px. Il renvoie des **captures découpées en tranches lisibles** et les **contrôles du rendu réel** : défilement horizontal, contraste du texte sur son fond effectif (opacités et superpositions comprises), cibles tactiles, images cassées, polices non chargées, erreurs JavaScript. Captures et rapport sont rangés dans `output/previews/<page>/`. Le workflow `ui_screen` l'appelle à l'étape 7 pour regarder et corriger.
- `get_workflow(name, args)` : instructions pas à pas, identiques aux prompts ci-dessous.
- `read_screen(file)` : relit une page du dossier de sortie.

**Prompts MCP** (dans Claude Code : `/mcp__hecate__ui_screen`, etc.)
- `ui_screen(brief, dna?, platform?, save_as?)` : pipeline complet. Cadrage, choix de DNA, rédaction du contenu *avant* la mise en page, structure via les sections de référence, composition, puis `wrap_screen` avec lint et deux réparations au maximum. Livraison avec la liste des images à fournir et une proposition de comparaison par retheme.
- `ui_review(file?, focus?)` : lint sans modification, puis critique en quatre rubriques (hiérarchie, contenu, fidélité à la DNA, accessibilité) et corrections numérotées.
- `dna_from_sites(urls, notes?)` : scans, synthèse de la grammaire commune, rédaction des DNA, `save_dna`, puis aperçu.

**Resources** : `rules://core`, `dna://catalog`, `dna://{id}`.

### Images

Jamais d'image aléatoire. Sans vraie image fournie, l'écran contient un emplacement décrit :

```html
<div data-image="Ostéopathe en séance, cabinet clair, lumière douce" class="aspect-[4/5] rounded-card"></div>
```

L'enveloppe l'affiche comme une zone hachurée aux couleurs de la DNA, avec la description en légende. Le style suit donc le retheme. Le lint ajoute `role="img"` et `aria-label`, et signale les images de picsum, placeholder, etc. La description sert de cahier des charges pour la photo ou l'illustration finale.

### Ajouter une section

Créer `content/patterns/<id>.html`. La première ligne est un commentaire JSON : `{"id","name","kind","platform","description","tags","libs"}`. Le reste est du HTML en classes sémantiques uniquement. `npm test` vérifie que chaque section passe le lint sans erreur, en clair comme en sombre.

### Comment ça tient ensemble

Le corps d'un écran n'utilise que des classes sémantiques (`bg-surface`, `text-muted`, `border-line`, `bg-accent/10`…). Tout le style vit dans le `<head>` produit par `wrap_screen`, qui contient une config Tailwind générée depuis la DNA et un objet `window.HECATE` pour les graphiques. Changer de DNA revient donc à reconstruire le `<head>`.

Les surcharges (par exemple `{"tokens":{"accent":"#0057B8"}}` pour une couleur de marque) sont revalidées, contrastes compris, et enregistrées dans la page. Un retheme ultérieur les retrouve.

Les pages vont dans `output/`, ou dans le dossier défini par `HECATE_OUTPUT_DIR`. Le serveur n'écrit et ne lit jamais en dehors de ce dossier.

### Audit de rendu

```bash
npm run audit                  # toutes les sections × toutes les DNA, dans le navigateur
npm run audit -- cobalt-night  # une seule DNA
```

L'audit assemble toutes les sections de la bibliothèque avec chaque DNA, puis passe les contrôles de `preview_screen` sans captures. Le code de sortie vaut 1 s'il reste une erreur. Lancez-le après chaque modification d'une DNA ou d'une section : il attrape ce que les tests unitaires ne voient pas, comme un badge illisible sur sa propre teinte ou un tableau qui déborde en mobile.

### Démo

```bash
npm run demo                  # output/demo-<dna>.html pour chaque DNA
npm run demo -- linen-ledger  # une seule DNA
```

Deux écrans d'exemple sont rendus avec chaque DNA : un tableau de bord ([examples/invoices-dashboard.body.html](examples/invoices-dashboard.body.html)) donne `output/demo-<dna>.html`, et une landing page ([examples/landing.body.html](examples/landing.body.html)) donne `output/landing-<dna>.html`. Ça permet de juger une DNA nouvelle ou modifiée.

## Ajouter ou modifier une DNA

1. Créer `content/dna/<id>.json`. Le nom du fichier est l'`id`, en kebab-case. Partir d'une DNA existante.
2. Lancer `npm test`. Le schéma ([src/dna/schema.ts](src/dna/schema.ts)) vérifie les champs et les contrastes minimaux :
   - ink sur fond ≥ 7 ;
   - ≥ 4.5 pour muted sur fond et pour accentInk sur accent ;
   - ≥ 4.5 pour success, warning, danger et l'accent utilisés **en texte**, sur le fond comme sur leur propre teinte (badges `bg-success/10 text-success`, jusqu'à /15).

   Si l'accent de la marque est un bon aplat mais un mauvais texte, ce qui est souvent le cas d'un bleu ou d'un rouge saturé, gardez `accent` pour l'aplat et ajoutez `accentText` pour le texte. `text-accent` utilise alors `accentText`, et `bg-accent` garde la couleur de la marque.
3. Lancer `npm run demo -- <id>` et ouvrir la page pour juger le rendu, puis `npm run audit -- <id>`.
4. Si le serveur tourne déjà, appeler `reload_library`.

Pour utiliser un autre dossier de contenu, définir la variable d'environnement `HECATE_CONTENT_DIR`.

## Structure

```
content/
  dna/          une DNA par fichier JSON
  patterns/     une section de référence par fichier HTML
  rules/core.md règles communes
src/
  index.ts      point d'entrée stdio
  server.ts     outils et resources MCP
  dna/          schéma, chargement, suggestion, surcharges
  screen/       wrap (enveloppe), lint, retheme, sortie fichiers
  scan/         collecte dans la page, analyse, pilotage du navigateur
  preview/      rendu réel : captures en tranches et contrôles dans la page
  patterns/     chargement et sélection des sections
  workflows.ts  workflows guidés (prompts MCP)
  color.ts      contraste WCAG
examples/       corps d'écran de démonstration
scripts/        demo.ts (démos), audit.ts (audit de rendu)
test/           tests node:test (via tsx)
```
