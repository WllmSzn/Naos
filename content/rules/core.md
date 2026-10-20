# Règles de base Hecate

Ces règles s'appliquent à tout écran, quelle que soit la DNA choisie. Les règles propres à une DNA (`rules.do` / `rules.dont`) les complètent et l'emportent en cas de conflit.

## 1. Contrat de tokens (non négociable)

Le corps des écrans n'utilise **que** des classes sémantiques. C'est ce qui permet de changer de DNA sans régénérer l'écran.

| Rôle | Classes autorisées |
|---|---|
| Fonds | `bg-base`, `bg-surface`, `bg-raised`, `bg-accent`, `bg-accent2`, `bg-ink` |
| Texte | `text-ink`, `text-muted`, `text-accent`, `text-accent-ink`, `text-inverse` (texte posé sur `bg-ink`) |
| Bordures | `border-line`, `border-ink`, `border-accent` |
| États | `success`, `warning`, `danger` (texte, fond teinté via `/10` ou `/15`, bordure) |
| Polices | `font-display`, `font-body`, `font-mono`, `font-accent` (un ou deux mots d'un titre, uniquement si la DNA définit `fonts.accent`) |
| Formes | `rounded-ui` pour les **contrôles** (boutons, champs, pastilles, éléments de menu), `rounded-card` pour les **conteneurs** (cartes, panneaux, images, emplacements d'image), `rounded-full` pour les avatars et les puces ; `shadow-card`, `shadow-overlay`. Certaines DNA ont des contrôles en pilule (`rounded-ui` = 9999px) : un conteneur en `rounded-ui` y deviendrait un ovale. |

Interdits dans le corps : couleurs Tailwind nommées (`bg-blue-500`, `text-gray-600`…), `bg-white`, `text-black`, valeurs arbitraires (`bg-[#…]`), hex en dur, `style="color:…"`, polices nommées.

Les opacités sont permises sur les tokens (`bg-accent/10`, `text-ink/70`, `border-line/60`).

**Structure attendue** : seul le contenu du `<body>` est écrit. L'enveloppe (`wrap_screen`) fournit Tailwind, les polices, les icônes et, sur demande, Alpine.js et Chart.js. Pas de `<html>`, `<head>`, `<link>` ni `<script src>` dans le corps.

**Icônes** : `<iconify-icon icon="lucide:calendar"></iconify-icon>`. Un seul jeu par écran (lucide par défaut). La taille suit le `font-size` du parent, ou se règle avec `text-lg`, `text-xl`…

**Graphiques** (Chart.js, avec `libs: ["chartjs"]`) : les couleurs de séries viennent de `HECATE.dataPalette[0]`, `[1]`… et celles d'interface de `HECATE.tokens.muted`, `HECATE.tokens.line`. Jamais de hex en dur dans le script : le retheme ne pourrait pas les suivre.

## 2. Espacement

- Grille de 4px. Valeurs courantes : 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Plus deux éléments sont liés, plus ils sont proches : icône et libellé 8px, champs d'un même groupe 12 à 16px, groupes 24 à 32px, sections 48px et plus.
- Padding de carte constant dans tout l'écran (choisir 16, 20 ou 24px et s'y tenir).
- Largeur de lecture : 60 à 75 caractères par ligne pour le texte courant (`max-w-prose` ou équivalent).

## 3. Typographie

- Quatre à cinq tailles par écran au maximum. Échelle de référence : 12 · 14 · 16 · 20 · 24 · 32 · 48 · 64.
- Texte courant : 14 à 16px en application, 16 à 18px en site éditorial. Interlignage de 1.5 pour le texte, de 1.1 à 1.25 pour les titres.
- La hiérarchie passe d'abord par la taille et la graisse, ensuite par la couleur (`ink` puis `muted`). Jamais plus de deux niveaux de gris.
- Chiffres comparables (tableaux, prix, KPI) en `tabular-nums`.
- Titres : pas de point final ; casse de phrase (« Factures en attente »), pas de Majuscule À Chaque Mot.

## 4. Mise en page et hiérarchie

- Chaque écran répond à une question : quelle est la tâche principale ? Elle doit être visible sans défiler.
- Une seule action principale (bouton plein) par vue. Les actions secondaires sont en contour ou en texte.
- Un seul « moment fort » par écran : celui défini par la `signature` de la DNA.
- Éviter la grille de cartes identiques par défaut : varier les tailles selon l'importance (une carte large, deux moyennes, une liste).
- Alignements stricts : un nombre réduit de lignes verticales d'alignement par écran.

## 5. Contenu et rédaction

- Du vrai contenu, crédible pour le produit : noms, montants, dates, statuts réalistes. Jamais de lorem ipsum ni de « Titre ici ».
- Les boutons disent ce qu'ils font, avec un verbe : « Envoyer la facture », pas « Valider » ni « OK ».
- Mots bannis, parce qu'ils ne disent rien : *révolutionner, sublimer, booster, sans effort, fluide, next-level, game-changer, débloquer votre potentiel, l'avenir de…* (et leurs équivalents anglais : *unlock, unleash, seamless, effortless, supercharge, elevate, revolutionize*).
- Une idée par phrase. Les titres promettent un résultat concret, les sous-titres expliquent comment.
- Les messages d'erreur disent ce qui s'est passé et comment le résoudre.

## 6. Signes d'une interface générée sans soin (à éviter)

- Dégradés violet-bleu, orbes floues en arrière-plan, glassmorphism par défaut.
- Emoji utilisés comme icônes.
- Trois cartes identiques « icône + titre + deux lignes » sous un hero centré.
- Badges « Nouveau ✨ », témoignages anonymes, logos de clients inventés.
- Tout centré, tout de la même taille, tout avec la même ombre.
- Statistiques rondes et invérifiables (« 10x plus rapide », « 99 % de satisfaction »).

## 7. États

Tout composant qui affiche des données prévoit : **chargement** (squelette à la forme du contenu), **vide** (explication et action pour en sortir), **erreur** (message utile et action de reprise), **partiel** (pagination ou « voir plus »). Les éléments interactifs ont des états survol, focus visible, actif et désactivé.

## 8. Accessibilité

- Contraste minimum 4.5:1 pour le texte, 3:1 pour les grands titres et les composants d'interface. Les DNA sont validées pour ces paires ; ne pas inventer de combinaisons hors tokens.
- Focus clavier toujours visible (`focus-visible:ring-2 ring-accent`).
- Cibles tactiles de 44px minimum sur mobile.
- Information jamais portée par la couleur seule : ajouter une icône, un libellé ou un motif.
- Images informatives avec `alt` descriptif ; images décoratives avec `alt=""`.
- Structure sémantique : un `h1` par écran, niveaux de titres sans saut, `button` pour les actions, `a` pour la navigation, `label` relié à chaque champ.

## 9. Icônes et images

- Un seul jeu d'icônes par écran, au trait, de taille constante (16 ou 20px).
- Les icônes accompagnent un libellé ; une icône seule a un `aria-label`.
- **Images : jamais d'image aléatoire** (picsum, placeholder…). Sans vraie image fournie, poser un emplacement décrit qui dit précisément quoi photographier ou illustrer :
  `<div data-image="Technicienne qui consulte sa tournée sur une tablette, chaufferie, lumière du matin" class="aspect-[4/3] rounded-card"></div>`
  La description sert de cahier des charges pour la photo ou l'illustration finale. L'enveloppe affiche une zone hachurée aux couleurs de la DNA.
- Les cartes d'interface, chiffres ou badges posés sur un visuel restent du vrai HTML par-dessus l'emplacement (`relative` sur le parent, `absolute` sur la carte).
- Logos clients : leur nom en texte (`font-display text-muted`) tant que les vrais logos ne sont pas fournis. Jamais de faux logos de marques existantes.
- Avatars : initiales dans un cercle `bg-raised` plutôt qu'un visage aléatoire.
