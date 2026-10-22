# Prompt 01 — Rôles visuels génériques dans les DNA, et retheme sans perte

> Colle d'abord `00-contexte.md`.

## Problème à résoudre

Un retheme `artefact-pillar` → `artefact-dark` a produit des diapos illisibles. Le corps utilisait des couleurs propres à la DNA source (`bg-paper`, `text-inverse` posé sur papier, `bg-brand-indigo`, `from-brand-red`) qui n'existent pas dans la DNA cible. Ces classes sont alors restées sans couleur : fond transparent, texte sombre sur fond sombre. `retheme` n'a rien signalé (`hexReplaced: 0`).

La cause : les **rôles visuels** dont une présentation a besoin (fond alterné, couleur de mise en avant, trait de schéma, dégradé de marque) n'ont pas de nom commun. Chaque DNA les exprime avec ses propres `extraColors`.

## Objectif

1. Donner à ces rôles un **vocabulaire commun**, que chaque DNA remplit avec ses propres valeurs, pour qu'un retheme fonctionne sans table de correspondance.
2. Faire en sorte que `retheme` et `lint_screen` **signalent** toute classe de couleur absente de la DNA cible, au lieu d'échouer en silence.

## Spécification

### Rôles

Ajouter à `ModeBlockSchema` un champ optionnel `roles`. `mode.json` gagne une liste `dnaRoles` : les rôles que ce mode expose. Le code ne connaît pas le mode `presentation`, il lit `dnaRoles`. Rôles à créer, avec la classe générée et la valeur par défaut quand la DNA ne le déclare pas :

| Rôle | Classes générées | Sens | Défaut si absent |
|---|---|---|---|
| `alt` / `onAlt` / `onAltMuted` | `bg-alt`, `text-on-alt`, `text-on-alt-muted`, `border-on-alt` | Fond de diapo alterné et ses textes | `alt` = `base` ; `onAlt` = `ink` ; `onAltMuted` = `muted` (l'alternance est alors simplement désactivée) |
| `highlight` | `bg-highlight`, `border-highlight`, `text-highlight` | Mise en avant hors action : option retenue, barre ou série principale, nœud central | `accent` |
| `emphasis` | `border-emphasis` | Trait qui signale l'élément retenu dans une grille ou une comparaison | `accent` |
| `connector` / `connectorMuted` | `text-connector`, `text-connector-muted` (les SVG utilisent `stroke="currentColor"`) | Liens des schémas : actif / secondaire ou absent | `line` ; `muted` à 60 % |
| `brandGradient` | `bg-brand` (dégradé linéaire vertical) et `bg-brand-radial` | Sphère, orbe, moment de marque | `accent` → `accent2` |

- Les valeurs d'un rôle sont des **hex** ou des **références de token** (`"ref:accent"`, `"ref:paper"` vers une extraColor de la même DNA). Choisis une syntaxe claire et documente-la.
- **Contrastes vérifiés par le schéma**, comme pour les tokens : `onAlt` sur `alt` ≥ 7 ; `onAltMuted` sur `alt` ≥ 4.5 ; `text-highlight` ≥ 4.5 sur `base` **et** sur `alt` ; `highlight` en aplat et `connector` ≥ 3 sur `base` et sur `alt` (indicateurs). Réutilise `ensureContrast` de `src/color.ts` dans les messages d'erreur pour proposer une valeur.
- `wrap.ts` génère les classes dans la config Tailwind et le `<head>`, opacités comprises (`bg-highlight/10`).
- `runtimeData` expose les rôles résolus (`NAOS.roles`) pour les scripts de graphiques.

### Retheme et lint sans perte silencieuse

- `retheme` renvoie `missingClasses` : les classes de couleur du corps qui pointent vers une couleur absente de la DNA cible (extraColor inconnue). L'outil MCP les affiche en avertissement, avec la ligne d'exemple.
- `lint_screen` avec `dna_id` : nouvelle règle `color.unknown` (erreur), pour une classe `bg-|text-|border-|from-|via-|to-|stroke-|fill-<nom>` dont `<nom>` n'est ni un token, ni un rôle, ni une extraColor de la DNA.
- Les rôles ne sont **jamais** signalés : c'est tout leur intérêt.

### Bibliothèque

- Renseigne `roles` dans le bloc `presentation` des DNA où le défaut ne suffit pas. Au minimum :
  - `artefact-pillar` : `alt` = papier, `highlight` = brand-indigo, gradient rouge → prune → indigo ;
  - `artefact-plume` ;
  - `room-and-pillar`, qui a aussi des sections papier ;
  - toute DNA dont la `signature` parle d'alternance, de dégradé ou d'orbe.
- Passe en revue les **23 DNA** et note dans le compte rendu celles laissées aux défauts.
- Mets à jour la `signature` et les `rules` des DNA concernées pour qu'elles parlent en rôles (`bg-alt`, `bg-brand`) et non plus en extraColors.
- Régénère le catalogue.

### Règles et sections

- `content/modes/presentation/rules.md` : section « Rôles » expliquant quand utiliser `bg-alt`, `highlight`, `emphasis`, `connector`, `bg-brand`, et que les extraColors restent réservées au sens métier (sévérité, statut).
- Adapte les 5 sections existantes du mode si l'une d'elles gagne à utiliser un rôle.

## Critères d'acceptation

- Test : un corps écrit avec `bg-alt text-on-alt bg-highlight border-emphasis text-connector bg-brand`, rethemé entre `artefact-pillar`, `artefact-dark` et une DNA claire, ne produit aucun `missingClasses`, et le contraste réel mesuré par `preview_screen` passe.
- Test : un corps qui contient `bg-paper`, rethemé vers une DNA sans `paper`, produit `missingClasses: ['bg-paper']`, et `lint_screen` lève `color.unknown`.
- Test de schéma : une DNA dont `onAlt` sur `alt` est sous 7 est refusée, avec un message qui propose une valeur.
- Une DNA sans `roles` se charge et produit les classes avec les défauts. Aucune DNA existante ne casse.

## Hors périmètre

Les blocs et les nouvelles sections (prompts 02 à 05). Pas de table de correspondance entre DNA.
