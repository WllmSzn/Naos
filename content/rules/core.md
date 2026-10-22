# Règles communes Naos

Ces règles valent dans **tous les modes** (site web, produit desktop…). Elles sont complétées, dans cet ordre de priorité croissante, par :
1. les règles du mode (`get_rules` avec le mode) ;
2. les règles d'identité de la DNA (`rules`) ;
3. les règles du bloc de mode de la DNA (`modes.<mode>.rules`).

En cas de conflit, la plus spécifique l'emporte.

## 1. Contrat de tokens (non négociable)

Le corps des écrans n'utilise **que** des classes sémantiques. C'est ce qui permet de changer de DNA, et donc de couleurs, de polices, de formes et de dimensions, sans régénérer l'écran.

| Rôle | Classes autorisées |
|---|---|
| Fonds | `bg-base`, `bg-surface`, `bg-raised`, `bg-accent`, `bg-accent2`, `bg-ink` |
| Texte | `text-ink`, `text-muted`, `text-accent`, `text-accent-ink`, `text-inverse` (texte posé sur `bg-ink`) |
| Bordures | `border-line`, `border-ink`, `border-accent` |
| États | `success`, `warning`, `danger` (texte, fond teinté via `/10` ou `/15`, bordure) |
| Polices | `font-display`, `font-body`, `font-mono`, `font-accent` (un ou deux mots d'un titre, ou un wordmark, uniquement si la DNA définit `fonts.accent`) |
| Formes | `rounded-ui` pour les **contrôles** (boutons, champs, pastilles, éléments de menu), `rounded-card` pour les **conteneurs** (cartes, panneaux, images, emplacements d'image), `rounded-full` pour les avatars et les puces ; `shadow-card`, `shadow-overlay`. Certaines DNA ont des contrôles en pilule (`rounded-ui` = 9999px) : un conteneur en `rounded-ui` y deviendrait un ovale. |
| Dimensions (modes produit) | `h-ctl` (contrôle standard), `h-ctl-sm` (contrôle compact), `h-row` (ligne de tableau ou de liste), `w-sidebar` (barre latérale), `h-header` (en-tête d'application), `size-icon` (icône). Elles viennent du bloc de mode de la DNA : la densité suit le retheme. |

Interdits dans le corps : couleurs Tailwind nommées (`bg-blue-500`, `text-gray-600`…), `bg-white`, `text-black`, valeurs arbitraires de couleur (`bg-[#…]`), hex en dur, `style="color:…"`, polices nommées.

Les opacités sont permises sur les tokens (`bg-accent/10`, `text-ink/70`, `border-line/60`).

**Couleurs métier** : une DNA de produit peut déclarer des `extraColors` nommées (ex. `sev-critical`, `status-investigation`). Elles s'utilisent comme les tokens (`text-sev-critical`, `bg-sev-critical/10`, `border-l-sev-critical`) et **uniquement dans le sens que leur donnent les règles de la DNA**. Consulter `get_dna` pour la liste.

**Structure attendue** : seul le contenu du `<body>` est écrit. L'enveloppe (`wrap_screen`) fournit Tailwind, les polices, les icônes et, sur demande, Alpine.js et Chart.js. Pas de `<html>`, `<head>`, `<link>` ni `<script src>` dans le corps.

**Icônes** : `<iconify-icon icon="lucide:calendar"></iconify-icon>`. Un seul jeu par écran (lucide par défaut). La taille suit le `font-size` du parent, ou se règle avec `text-lg`, `size-icon`…

**Sections et blocs** : une section (`get_patterns`) est l'unité d'une page ou d'une diapo ; un bloc (`get_blocks`) est un **fragment** inséré DANS une section : chiffre clé, schéma, grille, emplacement média, mention. Un bloc n'a ni titre principal ni cadre de page : il hérite du titre et du gabarit de la section qui l'accueille, et l'on remplit ses emplacements nommés avec le contenu réel. Ses variantes (attribut `data-variant`) sont des états, pas de nouvelles sections.

**Graphiques** (Chart.js, avec `libs: ["chartjs"]`) : les couleurs de séries viennent de `NAOS.dataPalette[0]`, `[1]`… et celles d'interface de `NAOS.tokens.muted`, `NAOS.tokens.line`. Jamais de hex en dur dans le script : le retheme ne pourrait pas les suivre.

## 2. Typographie : invariants

- La hiérarchie passe d'abord par la taille et la graisse, ensuite par la couleur (`ink` puis `muted`). Jamais plus de deux niveaux de gris.
- Chiffres comparables (tableaux, prix, KPI, durées) en `tabular-nums`.
- Titres : pas de point final ; casse de phrase (« Factures en attente »), pas de Majuscule À Chaque Mot.

## 3. Mise en page : invariants

- Une seule action principale (bouton plein) par vue ou par section. Les actions secondaires sont en contour ou en texte.
- Alignements stricts : un nombre réduit de lignes verticales d'alignement par écran.
- Un conteneur `flex-1` qui contient un tableau ou un bloc large prend `min-w-0` : sans lui, il refuse de rétrécir sous la largeur de son contenu et toute la page déborde. Un tableau large défile dans son propre cadre (`overflow-x-auto`).

## 4. Contenu

- Du vrai contenu, crédible pour le produit : noms, montants, dates, identifiants, statuts réalistes. Jamais de lorem ipsum ni de « Titre ici ».
- Une idée par phrase.
- Les messages d'erreur disent ce qui s'est passé et comment le résoudre.

## 5. États

Tout composant qui affiche des données prévoit : **chargement** (squelette à la forme du contenu), **vide** (explication et action pour en sortir), **erreur** (message utile et action de reprise ; une erreur n'est jamais affichée comme un résultat vide), **partiel** (pagination ou « voir plus »). Les éléments interactifs ont des états survol, focus visible, actif et désactivé.

## 6. Accessibilité

- Contraste minimum 4.5:1 pour le texte, 3:1 pour les grands titres et les composants d'interface. Les DNA sont validées pour ces paires ; ne pas inventer de combinaisons hors tokens.
- Focus clavier toujours visible (`focus-visible:ring-2 ring-accent`, ou l'état `focus` du bloc de mode de la DNA).
- Information jamais portée par la couleur seule : ajouter une icône, un libellé ou un motif.
- Images informatives avec `alt` descriptif ; images décoratives avec `alt=""`.
- Structure sémantique : un `h1` par écran, niveaux de titres sans saut, `button` pour les actions, `a` pour la navigation, `label` relié à chaque champ.

## 7. Icônes et images

- Un seul jeu d'icônes par écran, au trait, de taille constante.
- Les icônes accompagnent un libellé ; une icône seule a un `aria-label`.
- **Jamais d'image aléatoire** (picsum, placeholder…). Sans vraie image fournie, poser un emplacement décrit qui dit précisément quoi montrer :
  `<div data-image="Capture de la chaîne de processus : powershell.exe lancé par winword.exe" class="aspect-[16/9] rounded-card"></div>`
  La description sert de cahier des charges. L'enveloppe affiche une zone hachurée aux couleurs de la DNA.
- Avatars : initiales dans un cercle `bg-raised` plutôt qu'un visage aléatoire.
- Jamais de faux logo d'une marque existante.

## 8. Signes d'une interface générée sans soin (tous modes)

- Emoji utilisés comme icônes.
- Tout de la même taille, tout avec la même ombre, aucune hiérarchie.
- Données fantaisistes ou invérifiables (« 99 % », « 10x »), noms génériques (« Utilisateur 1 », « Item A »).
