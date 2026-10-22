# Chantier « composants de présentation » — prompts pour l'agent de développement

Chaque prompt se donne à l'agent **précédé de `00-contexte.md`**. Un prompt = un commit (ou un petit groupe de commits), un compte rendu à la fin.

| Ordre | Prompt | Dépend de | Livrable |
|---|---|---|---|
| 1 | `01-roles-dna.md` | — | Rôles visuels génériques dans les DNA (`bg-alt`, `highlight`, `emphasis`, `connector`, `bg-brand`), retheme et lint qui signalent les couleurs inconnues |
| 2 | `02-blocs-infrastructure.md` | 01 | Notion de bloc : stockage, outils `list_blocks` / `get_blocks`, lint, tests, audit, démo ; un bloc d'exemple |
| 3 | `03-sections-manquantes.md` | 01 | Sections agenda, divider, quote, comparison (options, avant/après), transition, appendix |
| 4 | `04-blocs-schemas.md` | 01, 02 | branch, merge, labeled-flow, hub-cycle, step-chain |
| 5 | `05-blocs-donnees-contenu.md` | 01, 02 | key-figure, before-after, split-bar, bar-series, gauge, numbered-points, module-grid, tag-cloud, person-card, callout, logo-row, slide-footer, contact |
| 6 | `06-runtime-slides.md` | (01) | Notes orateur, navigation au clic et au toucher, export PDF avec notes, pages publiables sans iconify |
| 7 | `07-lot-2.md` | 01, 02, 04 + retour d'usage | comparison-table, matrix-2x2, decision-tree, timeline, platform-stack, annotated-shot, ui-mock-card |

Parallélisable : 03 et 06 peuvent tourner pendant 02 ; 04 et 05 en parallèle une fois 02 terminé.

**Test de réception global**, une fois les prompts 01 à 06 terminés : refaire le deck ARTEFACT (13 diapos d'origine, notes comprises) avec `artefact-dark`, sans aucun HTML écrit à la main hors sections et blocs. Puis le passer en `artefact-pillar` par `retheme`, sans retouche. Tout le contenu d'origine doit y être.
