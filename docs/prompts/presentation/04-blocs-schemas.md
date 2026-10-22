# Prompt 04 — Blocs schémas (lot 1)

> Colle d'abord `00-contexte.md`. Prérequis : prompts 01 (rôles) et 02 (infrastructure des blocs).

## Constat

Les présentations métier reposent sur quelques schémas récurrents. Sans composant, le modèle les dessine en positions absolues au pixel près. Le résultat casse dès que le texte change de longueur ou que la DNA change de typo (chevauchements constatés sur des captures réelles).

## Objectif

Livrer 5 blocs de type `diagram`, robustes à la longueur du texte et au changement de DNA, dans `content/modes/presentation/blocks/`.

## Principes de construction (pour tous les blocs)

- **La mise en page se fait en grille CSS.** Les nœuds sont des cellules et les connecteurs un SVG qui remplit une colonne ou une rangée intermédiaire (`preserveAspectRatio="none"`, `vector-effect="non-scaling-stroke"`, `stroke="currentColor"`, classe `text-connector`). Pas de texte placé en `absolute` au pixel.
- **Nœud** : `rounded-card border border-line bg-surface` ; texte `text-subtitle` ou `text-body` pour le nom, `text-caption text-muted` pour le détail. Nœud mis en avant : `border-highlight` ou `border-emphasis`. Nœud « absent » : bordure en pointillés et `text-connector-muted`.
- **Liens** : trait plein = lien actif ; pointillé (`stroke-dasharray`) = lien faible, délai, absence. Ce sens est documenté dans `rules.md`.
- **Accessibilité** : le SVG des connecteurs a `aria-hidden="true"`. Le sens du schéma doit se lire dans le texte des nœuds. Si une flèche porte un sens (« Alertes qualifiées »), ce sens est écrit en clair.
- **Slots** déclarés dans les métadonnées : nombre de nœuds accepté, longueur conseillée de chaque texte.
- **Variantes** activées par un attribut `data-variant` ou une classe, documentées.

## Blocs à livrer

| id | Forme | Slots / variantes | Exemple de contenu (deck ARTEFACT) |
|---|---|---|---|
| `branch` | 1 → N (2 à 4 branches) | source (étiquette d'état, titre) ; branches (étiquette, résultat) ; variante `merge` qui inverse le sens | « Alerte élevée · Fichiers renommés en masse » → Analyste A · lundi → « Poste isolé, incident ouvert » / Analyste B · jeudi → « Classée faux positif » |
| `merge` | N → 1 (2 à 4 entrées) | entrées ; cible (étiquette, phrase forte) | Externaliser / Internaliser / Hybrider → « Même finalité : la réponse dépend de qui traite l'alerte. » |
| `labeled-flow` | N nœuds reliés à une cible, avec un libellé sur chaque lien | entrées ; libellé de lien (court) ; cible (icône ou symbole, légende) ; variante `dashed` | SIEM / XDR / Threat Intel / SOAR → « délai » → « ? L'analyste relie tout à la main » |
| `hub-cycle` | Pivot central et 3 à 5 nœuds sur un anneau | pivot (nom, sous-nom) ; nœuds (nom, détail) ; variante `absent` (pivot et anneau en pointillés) ; sortie optionnelle sous le schéma (« Agir → Menace neutralisée ») | Analyste / Corréler / Plan de réponse / Investiguer autour de « ARTEFACT · Smart Playbook » ; variante : Investiguer IA / Corréler / Plan automatique autour de « Aucun humain » |
| `step-chain` | Étapes numérotées, en 1 ou 2 groupes, avec une transition libellée entre les groupes | groupes (nom, verbes, mention) ; étapes (n°, nom, description) ; transition (libellé) ; 3 à 8 étapes au total | SIEM (Détection, Triage, Qualification) → « Alertes qualifiées » → Smart Playbook (Investigation, Remédiation, Clôture) |

Pour `hub-cycle`, le plus délicat : une grille 3×3 (nœud haut, gauche, pivot, droite, bas) avec un anneau SVG en fond est une piste. Pour 3 ou 5 nœuds, choisis une disposition qui ne chevauche jamais le pivot. Le bloc doit tenir dans une colonne de **540 px** (3 schémas côte à côte dans une diapo) **et** en pleine largeur.

## Critères d'acceptation

- Chaque bloc a été rendu et **regardé sur capture** :
  - à 540 px et en pleine largeur ;
  - avec le texte le plus long autorisé par ses slots ;
  - avec `artefact-dark`, `artefact-pillar`, une DNA claire et une DNA à typo large (Jost ou Manrope).
  Aucun chevauchement, aucun texte sous `text-caption`.
- Test : chaque bloc dans une section hôte passe le lint (prompt 02), et l'audit ne relève aucun `frame-overflow`.
- La page de démo des blocs montre la diapo « trois modèles » complète : `comparison-options` du prompt 03 avec un `labeled-flow` et deux `hub-cycle`, dont un `absent`.
- `rules.md` documente quand choisir chaque schéma et le sens plein / pointillé.

## Hors périmètre

Matrice 2×2, arbre de décision, frise : lot 2 (prompt 07).
