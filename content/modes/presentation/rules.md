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

- Les types de diapositives du mode donnent le rythme : title (ouverture), agenda (trajet), statement (idée forte), split (texte et visuel), chart (preuve chiffrée), quote (voix extérieure), comparison (avant/après, deux options), closing (message et décision attendue).
- Varier les compositions : une diapo pleine de texte suivie d'une diapo à un seul chiffre, puis d'une image. Jamais trois diapositives de suite avec la même structure.
- Alignement franc, une ou deux lignes directrices par diapo. Éviter le tout centré : le centrage est réservé aux diapos à une seule affirmation ou à un seul chiffre.
- Le vide fait partie de la composition : mieux vaut une diapo à moitié pleine qu'une diapo remplie jusqu'aux bords.
- Les visuels passent par un emplacement `data-image` décrit (sujet, cadrage, lumière), jamais par une photo aléatoire ni un faux logo.

## Rôles visuels

Sept rôles ont un nom commun dans toutes les DNA du mode, pour que le corps d'une diapo survive à un changement de DNA. Ils se remplissent dans le bloc `presentation.roles` de chaque DNA ; sans déclaration, ils retombent sur l'accent de la DNA.

- `bg-alt` / `text-on-alt` / `text-on-alt-muted` — fond de diapo alterné et ses textes. À utiliser quand la DNA alterne deux fonds dans son deck (diapos de preuve claires, par exemple). Ne jamais poser `text-ink` sur `bg-alt` : le contraste est celui de l'autre fond.
- `bg-highlight` / `text-highlight` / `border-highlight` — mise en avant qui n'est pas une action : chiffre clé, série principale d'un graphique, option retenue. Une seule par diapo.
- `border-emphasis` — trait qui désigne l'élément retenu dans une grille ou une comparaison. Il ne remplace pas une couleur d'état.
- `text-connector` / `text-connector-muted` — liens des schémas (traits SVG en `stroke="currentColor"`). Plein pour un lien actif, `connector-muted` et pointillé pour un lien faible, un délai ou une absence.
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
