# Prompt 02 — Infrastructure des blocs

> Colle d'abord `00-contexte.md`. Prérequis : prompt 01 terminé (les blocs utiliseront les rôles).

## Décision de conception

Les schémas, chiffres clés, grilles, etc. ne sont **pas** de nouvelles sections. Ce sont des **blocs** : des fragments réutilisables que le modèle insère **dans** une section existante (`statement`, `split`, `comparison`…). Une section est une diapo entière ; un bloc en occupe une zone.

## Objectif

Créer la notion de bloc dans Naos, de bout en bout : stockage, métadonnées, chargement, outils MCP, workflow, tests et audit. Ce prompt ne livre **qu'un seul bloc d'exemple**. Les vrais blocs arrivent aux prompts 04 et 05.

## Spécification

### Stockage et métadonnées
- `content/modes/<mode>/blocks/<id>.html`. Même convention d'en-tête que les sections : un commentaire JSON en première ligne. Le schéma zod est séparé (`BlockMetaSchema`) et contient :
  - `id`, `name`, `kind`, `description`, `tags` ;
  - `slots` : liste des emplacements à remplir (nom, description, contrainte de longueur ou de nombre, ex. « 2 à 4 branches ») ;
  - `variants` : variantes nommées et attribut ou classe qui les active ;
  - `fits` : types de sections hôtes conseillés (`statement`, `split`…) ;
  - `minWidth` : largeur minimale en px sous laquelle le bloc se dégrade ;
  - `dna?` : réservé à certaines DNA, même mécanique que les sections.
- `mode.json` gagne `blockKinds`. Pour `presentation` : `diagram`, `figure`, `grid`, `media`, `meta`, ajustables si tu trouves mieux. Un bloc d'un type inconnu est une erreur de chargement, comme pour les sections.
- Blocs propres à une famille ou à une DNA : `naos-library/<famille>/blocks/<mode>/` et `<famille>/<id>/blocks/<mode>/`, même mécanique que les sections (`loadPatterns`). Aucun n'est créé maintenant ; seule la mécanique est demandée.

### Outils MCP
- `list_blocks` (mode, dna?, kind?) : catalogue sans HTML.
- `get_blocks` (mode, dna?, ids?, kinds?, query?, limit?) : HTML et métadonnées, blocs propres à la DNA en tête.
- `reload_library` recharge aussi les blocs.
- `get_workflow ui_screen` en mode présentation : à l'étape « Structurer », dire de choisir pour chaque diapo une section **et** les blocs qui portent son contenu, puis d'appeler `get_blocks`. Le texte vient de `mode.json` (`workflow`), pas du code.

### Règles d'écriture d'un bloc
À documenter dans `content/modes/presentation/rules.md` (section « Blocs ») et à faire respecter par le lint :
- Un bloc est un **fragment** : pas de `<section data-slide>`, pas de titre `h1`/`h2`. Le titre appartient à la section.
- Il s'adapte à la largeur de son conteneur : grille ou flex, pas de position absolue en pixels pour placer du texte. Les connecteurs SVG utilisent `preserveAspectRatio="none"` et `vector-effect="non-scaling-stroke"`.
- Il n'utilise que des classes sémantiques, les rôles du prompt 01 et l'échelle typo du mode (`text-*` de `typeScale`).
- Aucun texte sous `text-caption`.
- Le texte d'exemple est réaliste. Pas de lorem ipsum, pas de « Étape 1 ».

### Lint
Profil `block` : le lint d'un fragment n'exige pas de `h1` ni de `data-slide`, mais applique le contrat de tokens, les tailles et l'accessibilité. Un SVG décoratif doit avoir `aria-hidden="true"`, un SVG porteur de sens un `role="img"` et un `aria-label`.

### Tests et audit
- `test/blocks.test.ts` : chaque bloc du mode, inséré dans une section hôte minimale de test, passe le lint sans erreur ni correction, en DNA claire et sombre (fixtures).
- `npm run audit` : ajoute blocs × DNA. Chaque bloc, dans sa section hôte, est rendu avec chaque DNA du mode, sans débordement du cadre (`frame-overflow`) ni contraste insuffisant.
- `npm run demo` : une page `output/blocks-<dna>.html` qui présente tous les blocs, une diapo par bloc, pour la revue visuelle.

### Bloc d'exemple
Livre un seul bloc simple pour valider la chaîne : `key-figure`, un chiffre clé avec valeur, unité, période et source (ex. « +38 % / an », « Chiffres illustratifs, à consolider »).

## Critères d'acceptation

- `list_blocks` et `get_blocks` répondent, y compris avec un filtre `dna`.
- Un bloc avec un `kind` inconnu ou un en-tête invalide est rejeté au chargement, avec un message clair.
- Tests et audit verts.
- La page de démo des blocs s'affiche et a été regardée sur capture.

## Hors périmètre

Le contenu des blocs (prompts 04 et 05) et les nouvelles sections (prompt 03).
