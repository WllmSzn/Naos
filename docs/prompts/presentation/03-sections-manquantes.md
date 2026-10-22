# Prompt 03 — Sections de présentation manquantes

> Colle d'abord `00-contexte.md`. Prérequis : prompt 01 (rôles). Indépendant du prompt 02.

## Constat

`mode.json` déclare les types `agenda`, `quote` et `comparison`, mais aucune section n'existe pour eux. Il n'y a pas non plus de section pour rythmer un deck long : intercalaire, transition, annexe. Le modèle improvise alors ces diapos, de façon différente à chaque fois.

## Objectif

Ajouter des sections génériques dans `content/modes/presentation/patterns/`, valables pour toutes les DNA du mode, et déclarer les nouveaux types dans `mode.json` (`patternKinds` et texte du workflow « structure »).

## Sections à créer

Chaque section : une diapo complète, 1920×1080, avec un en-tête de métadonnées, un contenu d'exemple réaliste et un pied de diapo cohérent avec les sections existantes (mention, numéro).

| id | type | Contenu attendu |
|---|---|---|
| `agenda` | agenda | Liste des parties numérotées (4 à 7). Variante « partie en cours » : une partie mise en avant (`border-emphasis` ou `text-highlight`), les autres atténuées, pour réutiliser la même diapo comme repère en cours de deck. |
| `divider` | divider (nouveau) | Intercalaire de partie : numéro de partie en très grand (`text-display`), nom de la partie, une ligne d'intention. Peut utiliser `bg-alt` ou `bg-brand` selon la signature de la DNA. |
| `quote` | quote | Citation attribuée (nom, rôle, source). Variante « objection » : la citation en titre, puis la réponse en 1 à 3 lignes. Exemple : « Nous avons déjà un SOAR. » suivi de la réponse. |
| `comparison-options` | comparison | 2 ou 3 options côte à côte (nom, sous-titre, description, résultat), une option retenue via `border-emphasis`. Exemple : SOC manuel / ARTEFACT / SOC autonome. Prévoir une zone où insérer un bloc schéma par option (prompt 04). |
| `comparison-before-after` | comparison | Avant → après : deux valeurs fortes et leur légende, flèche entre les deux. Exemple : « 12 à 18 mois » → « Quelques semaines ». Les valeurs longues doivent tenir sur une ligne : prévoir la taille (`text-title` plutôt que `text-display`) et le tester. |
| `transition` | transition (nouveau) | Un seul mot ou une expression en très grand, plus une ligne de contexte. Exemple : « Démo ». |
| `appendix` | appendix (nouveau) | Sources, définitions, chiffres à consolider : liste dense mais lisible (`text-body` / `text-caption`), sans titre décoratif. |

- Utilise les rôles du prompt 01, jamais d'extraColor.
- Tout texte d'au moins 3 lignes reste sous ~70 caractères par ligne.

## Règles du mode

Mets à jour `content/modes/presentation/rules.md`, section « Composition », pour dire quand utiliser chaque nouveau type : un intercalaire au-delà de ~12 diapos, l'agenda repris en repère, l'objection traitée comme une citation. Mets aussi à jour le texte `workflow.structure` de `mode.json`.

## Critères d'acceptation

- Les 7 sections passent le lint sans erreur ni correction, en DNA claire et sombre (`test/patterns.test.ts`).
- `npm run audit` : aucun débordement de cadre avec les 23 DNA. Les cas limites ont été testés à la main : texte long, 7 parties d'agenda, 3 options de comparaison.
- Capture regardée avec `artefact-dark`, `artefact-pillar` et une DNA claire pour chaque section.
- `get_patterns` avec `kinds: ["agenda","divider","quote","comparison"]` renvoie les nouvelles sections.

## Hors périmètre

Les schémas insérés dans `comparison-options` (prompt 04). La section accueille un emplacement prévu pour eux, rempli d'un contenu texte simple pour l'instant.
