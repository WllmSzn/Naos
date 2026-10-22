# Prompt 05 — Blocs données et contenu (lot 1)

> Colle d'abord `00-contexte.md`. Prérequis : prompts 01 et 02. Peut être mené en parallèle du prompt 04.

## Objectif

Livrer les blocs de données et de contenu qui reviennent dans presque tous les decks. Chacun suit les règles d'écriture de blocs du prompt 02, et la page de démo des blocs les montre tous.

## Blocs `figure` (données)

| id | Contenu | Points d'attention |
|---|---|---|
| `key-figure` | Livré au prompt 02. À compléter si besoin : variante avec tendance (↑/↓ et période) | Valeur en `text-display` ; l'unité ne passe jamais à la ligne seule |
| `before-after` | Deux valeurs avec légende, séparées par une flèche ; la seconde mise en avant (`text-highlight`) | Doit tenir sur une ligne avec des valeurs longues (« 12 à 18 mois », « Quelques semaines ») : prévoir une taille de repli et la tester |
| `split-bar` | Barre de répartition à 100 % (2 à 4 segments), libellés et pourcentages, un segment mis en avant (`bg-highlight`) | Un segment de 5 % reste visible et son libellé lisible (libellé placé hors de la barre si le segment est trop étroit) |
| `bar-series` | Barres verticales en HTML, une barre mise en avant, mention « illustratif » optionnelle | Reprend la section `chart` existante sous forme de bloc. Hauteurs en % d'une même échelle |
| `gauge` | Probabilité ou score (0-100 %), valeur et libellé | Sens porté par le texte, pas par la couleur seule |

## Blocs `grid` (contenu)

| id | Contenu | Points d'attention |
|---|---|---|
| `numbered-points` | 2 à 4 colonnes : n°, titre, description (≤ 3 phrases) ; un point mis en avant (`border-emphasis`) | Le bloc le plus utilisé (objection, playbook, compétences, ROI). Variante 2×2 |
| `module-grid` | N cartes (3 à 9) : nom, description, état (`actif` / `à venir`) | L'état se lit sans la couleur : pastille et mot. Grille qui ne laisse pas de cellule isolée (voir `rules.md`) |
| `tag-cloud` | Liste d'étiquettes (outils, technologies) et un « +N… » final | Étiquettes en `rounded-ui` et police mono si la DNA l'autorise |
| `person-card` | Avatar en initiales, nom, rôle, expertise ; variante liste de 2 à 4 personnes | Jamais de visage aléatoire |
| `callout` | Phrase à retenir, avec trait d'emphase (`border-emphasis`) et source optionnelle | Une seule par diapo |
| `logo-row` | 3 à 8 emplacements de logos décrits (`data-image`) | Jamais de faux logo |

## Blocs `meta` (cadre de diapo)

| id | Contenu |
|---|---|
| `slide-footer` | Mention de confidentialité, partie en cours, numéro « n / total ». Les sections existantes et nouvelles l'utilisent, pour qu'il soit identique partout |
| `contact` | E-mail en texte sélectionnable, lien web, logotype ou nom |

## Critères d'acceptation

- Chaque bloc a été rendu et regardé sur capture :
  - en contenu minimal et maximal ;
  - avec `artefact-dark`, `artefact-pillar` et une DNA claire.
- Tests et audit verts, aucun `frame-overflow`.
- Les sections existantes (`title`, `statement`, `chart`, `closing`, `split`) et celles du prompt 03 utilisent `slide-footer`. Leur rendu ne change pas, à part l'harmonisation du pied.
- `rules.md`, section « Blocs » : un tableau « besoin → bloc » pour que le modèle choisisse sans hésiter.
