# Mode « présentation »

Une présentation se projette : l'audience écoute celui qui parle et lit la diapo d'un coup d'œil. Elle ne se parcourt pas, elle ne défile pas, et personne ne s'approche pour lire un paragraphe.

## Format

- Une diapo = une `<section data-slide class="h-[1080px] overflow-hidden">`, au format 1920×1080. Le corps de page est la suite des sections, sans en-tête ni pied de page propre.
- `overflow-hidden` est un garde-fou de rendu, pas une autorisation de rogner : si du contenu disparaît, la diapo est à refaire, pas à masquer.
- Le contenu reste dans une zone utile large : padding généreux (64 à 96px au moins), rien d'important dans les 48px du bord, aucune information vitale en bas de diapo (elle est souvent cachée par la première rangée).
- Aucune diapo ne défile, aucune diapo n'est plus haute que 1080px.

## Une idée par diapo

- Un seul titre par diapo, court (huit mots au plus), et il dit quelque chose : « Le support coûte 40 % du budget », pas « Contexte » ni « Chiffres ».
- Au plus six lignes de texte au total sur la diapo, titre compris si la diapo est dense. Pas de paragraphe : des lignes courtes, une idée par ligne, sans ponctuation de prose.
- Une seule idée par diapo. Une idée qui a besoin de deux diapositives en prend deux ; deux idées sur une diapo s'annulent.
- Un chiffre qui compte occupe sa propre diapo, avec son unité, sa période et sa source en petit.

## Typographie

- Les tailles viennent de l'échelle `typeScale` de la DNA, exposée en classes : `text-display` (affirmation ou chiffre clé), `text-title` (titre de diapo), `text-subtitle` (sous-titre, unité), `text-body` (texte courant), `text-caption` (source, mention, numéro). Jamais de taille arbitraire sur une diapo.
- La classe porte aussi l'interlignage : les titres se serrent, le corps respire. Ne pas ajouter de `leading-*` par-dessus.
- Grande typographie d'abord : la hiérarchie passe par la taille et la graisse avant la couleur. Quatre tailles au maximum par diapo (titre, sous-titre, corps, mention).
- Les mentions (source, date, numéro) restent lisibles de loin : `text-caption`, jamais une taille plus petite ni un gris pâle. Pas de texte en capitales sur plus de deux lignes.
- Largeur de lecture limitée : une ligne de corps ne traverse pas toute la largeur de la diapo.

## Composition

- Les types de diapositives du mode donnent le rythme : title (ouverture), agenda (trajet), divider (ouverture de partie), statement (idée forte), transition (souffle), split (texte et visuel), chart (preuve chiffrée), quote (voix extérieure ou objection), comparison (avant/après, options), appendix (sources et définitions), closing (message et décision attendue).
- `agenda` sert deux fois : en début de deck pour annoncer les parties, puis en repère avant chaque partie, avec la partie en cours marquée (`border-emphasis`, son nom en `text-highlight`) et les autres atténuées. Un deck de plus de douze diapositives gagne à ouvrir chaque partie par un `divider` ; en dessous, les intercalaires prennent la place du contenu.
- `divider` et `transition` ne disent pas la même chose : le divider nomme une partie et son intention, la transition marque un changement de registre (démo, atelier, pause) et s'écrit en un mot. Aucun des deux ne porte d'argument : s'il faut démontrer, c'est une diapo de contenu.
- `quote` porte une voix extérieure ou une objection. Pour une objection, la citation reste en titre et la réponse tient en trois lignes au plus, sous un trait d'emphase : elle répond au mot employé, pas à une reformulation.
- `comparison` désigne l'option retenue par un trait d'emphase et son libellé, jamais par un fond de couleur ; chaque option garde une zone où insérer le schéma qui la décrit (`get_blocks`, type diagram). L'avant/après se compare sur deux valeurs de même nature et de même unité, avec la base de comparaison en légende.
- `appendix` ne se projette pas pendant le fil : sources, définitions et chiffres à consolider, en deux colonnes, sans grand titre. Elle est annoncée à la clôture, pas parcourue à voix haute.
- Varier les compositions : une diapo pleine de texte suivie d'une diapo à un seul chiffre, puis d'une image. Jamais trois diapositives de suite avec la même structure.
- Alignement franc, une ou deux lignes directrices par diapo. Éviter le tout centré : le centrage est réservé aux diapos à une seule affirmation ou à un seul chiffre.
- Le vide fait partie de la composition : mieux vaut une diapo à moitié pleine qu'une diapo remplie jusqu'aux bords.
- Les visuels passent par un emplacement `data-image` décrit (sujet, cadrage, lumière), jamais par une photo aléatoire ni un faux logo.

## Blocs

- Un **bloc** est un fragment : un chiffre clé, un schéma, une grille de trois preuves, un emplacement média. Il s'insère DANS une diapo, sous son titre, et n'apporte jamais son propre titre de diapo. Appeler `get_blocks` (ou `list_blocks` pour le catalogue) avec le mode et la DNA.
- Un bloc se choisit pour ce qu'il porte, pas pour sa forme : le chiffre clé d'un résultat, la chaîne d'étapes d'un processus, le schéma d'une architecture. Deux blocs qui disent la même chose sur une diapo font doublon.
- Il hérite du gabarit de la diapo : même padding, mêmes tailles de l'échelle, mêmes rôles de couleur. Ne pas lui donner de fond, de cadre ou d'ombre qui contredirait la diapo.
- Remplir ses emplacements (le chiffre et son unité, les branches, les étapes) avec le contenu réel ; ses variantes (`data-variant`) sont des états du bloc, pas des diapositives différentes.
- Un schéma reste lisible à 3 mètres : peu de nœuds (sept au plus), des libellés courts, un seul accent par schéma.
- Dans un schéma, les libellés de nœuds restent à l'échelle de légende (`text-caption`), et un nœud tient sur une ou deux lignes. Seul l'élément qui porte une phrase — la cible d'une convergence, la légende d'un flux — passe à `text-body`. La hiérarchie d'un schéma se fait par le trait (`border-highlight`, `border-emphasis`) et le fond (`bg-raised`), pas par la taille : un nœud en corps occupe trois lignes dès que le schéma est posé au tiers d'une diapo, et fait déborder la carte.
- Un schéma doit tenir dans une colonne de 540 px comme en pleine largeur : c'est la largeur d'une carte de comparaison à trois options. À cette largeur, compter une ligne par nœud, et préférer trois satellites à quatre quand le texte s'allonge.
- Un bloc s'adapte à la largeur de son conteneur : grille ou flex, jamais de position absolue en pixels pour placer du texte. Les connecteurs SVG se dessinent avec `preserveAspectRatio="none"` et `vector-effect="non-scaling-stroke"`, en `stroke="currentColor"` et une classe `text-connector` : le trait suit la DNA et le retheme.
- Un SVG décoratif porte `aria-hidden="true"` ; un SVG porteur de sens `role="img"` et un `aria-label`. Aucun texte sous `text-caption`.

### Schémas

Cinq schémas couvrent les cas d'une présentation métier. Choisir par ce qu'il faut faire comprendre, pas par la forme qui plaît :

- `branch` — une situation qui se sépare (une alerte traitée par deux analystes, un dossier qui part en deux issues). `data-variant="merge"` retourne le sens quand la source est à droite. Pour une décision qui se joue sur trois options, préférer une grille de comparaison : un embranchement à trois branches se lit mal.
- `merge` — plusieurs entrées qui aboutissent à la même cible, la phrase de la cible disant ce qu'elles ont en commun. Une seule phrase y tient : si le constat demande deux lignes, ce n'est plus un schéma, c'est une diapo.
- `labeled-flow` — plusieurs sources qui convergent vers un point unique, chaque lien portant le même libellé (le délai, la dépendance, le ressaisie). À réserver au constat d'un manque : quatre sources, un lien, un point d'arrivée vide.
- `hub-cycle` — un noyau et ce qui tourne autour. La variante `absent` (pivot en pointillés, traits atténués) montre le même dispositif sans personne au centre : elle sert à opposer deux fonctionnements, jamais à illustrer un vide au hasard.
- `step-chain` — un processus outillé, en un ou deux groupes, avec la transition libellée entre les deux. Les numéros se suivent d'un groupe à l'autre : c'est le passage d'un outil à l'autre qui se lit, pas deux listes côte à côte.

Sens des traits, dans tous les schémas : **trait plein** = lien actif, le flux passe ; **trait pointillé** = lien faible, délai, dépendance à un humain ou absence. Un schéma dont tous les traits sont pointillés ne montre plus rien : garder au moins un lien plein, sauf quand l'absence est justement le sujet.

Les connecteurs se dessinent dans une colonne ou une rangée de la grille, jamais par-dessus les nœuds. Un nœud n'est jamais placé en position absolue : c'est la grille qui répartit, et le trait s'y adapte.

## Rôles visuels

Onze classes ont un nom commun dans toutes les DNA du mode, pour que le corps d'une diapo survive à un changement de DNA. Elles se remplissent dans le bloc `presentation.roles` de chaque DNA ; sans déclaration, elles retombent sur l'accent de la DNA.

- `bg-alt` / `text-on-alt` / `text-on-alt-muted` — fond de diapo alterné et ses textes. À utiliser quand la DNA alterne deux fonds dans son deck (diapos de preuve claires, par exemple). Ne jamais poser `text-ink` sur `bg-alt` : le contraste est celui de l'autre fond.
- `bg-highlight` / `text-highlight` / `border-highlight` — mise en avant qui n'est pas une action : chiffre clé, série principale d'un graphique, option retenue. Une seule par diapo.
- `border-emphasis` — trait qui désigne l'élément retenu dans une grille ou une comparaison. Il ne remplace pas une couleur d'état.
- `text-connector` / `text-connector-muted` — liens des schémas (traits SVG en `stroke="currentColor"`). Plein pour un lien actif, `connector-muted` et pointillé pour un lien faible, un délai ou une absence. Ces deux classes ne servent qu'à un trait : un libellé de nœud reste en `text-muted`, même sur un nœud absent (c'est la bordure pointillée qui dit l'absence).
- `bg-brand` / `bg-brand-radial` — dégradé de marque (sphère, orbe, moment de marque). Une seule occurrence par deck, à l'ouverture ou à la clôture.

Sur un fond `bg-alt` de luminance opposée à `base` (papier clair sur un thème sombre), la mise en avant passe par `bg-alt` et `border-emphasis`, jamais par `text-highlight` : aucune couleur ne peut être lisible en texte sur un fond très sombre et sur un fond très clair. `preview_screen` mesure le contraste réel et le signalera.

Les `extraColors` restent réservées au **sens métier** (sévérité, statut, workflow, identité de marque). Une alternance, une mise en avant ou un dégradé décoratif se dit en rôle, pas en couleur métier : c'est ce qui permet de changer de DNA sans table de correspondance.

## Fil narratif

- Le message clé s'entend à l'ouverture et se retrouve à la clôture, dans les mêmes mots.
- Les titres, lus seuls à la suite, racontent l'argument. Si le fil ne tient pas sans le commentaire oral, la structure est à revoir.
- Une diapo de transition ne sert à rien si elle ne dit rien : préférer une affirmation courte à une diapo « Étape 2 ».

## Rédaction

- Les titres affirment, les lignes soutiennent. Pas de « Introduction », « Sommaire », « Merci de votre attention » : la clôture dit ce qu'on attend de l'audience.
- Pas de lorem ipsum, pas de texte de remplissage, pas de liste de mots sans verbe.
- Chiffres sourcés et datés ; les comparaisons annoncent leur base (« sur 12 mois », « par rapport à 2024 »).
- Mots à éviter parce qu'ils ne disent rien : *révolutionnaire, disruptif, innovant, solution, écosystème, synergie, next-level* (et leurs équivalents anglais : *game-changer, seamless, cutting-edge, leverage*).

## Revue avant de livrer

- Lisible à 3 mètres : reculer, ou regarder la capture en petit ; si le corps devient illisible, la taille est trop faible.
- Rien qui déborde, rien de coupé, rien de superposé, aucune ligne orpheline sous un bloc.
- Contraste suffisant pour un vidéoprojecteur : les gris clairs et les teintes posées sur une autre teinte ne passent pas.
- Une seule idée par diapo, un titre par diapo, six lignes de texte au plus.
- Le fil se suit à la lecture des seuls titres, et la clôture ramène au message clé.
