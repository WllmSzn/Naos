# Mode « produit desktop »

Un écran d'application n'est pas lu une fois : il est **utilisé**, souvent des dizaines de fois par jour, par quelqu'un qui connaît le produit et veut aller vite. La qualité se mesure à la vitesse de lecture, à la régularité et à la fiabilité des états, pas à l'effet produit au premier regard.

## Densité et dimensions

- Respecter la densité de la DNA (`density`) et ses dimensions : `h-ctl` pour les boutons et champs, `h-ctl-sm` pour les contrôles des barres d'outils et des tableaux, `h-row` pour les lignes, `w-sidebar` pour la barre latérale, `size-icon` pour les icônes. **Ne pas inventer d'autres hauteurs.**
- Grille de 4px. Espacements courants : 4, 8, 12, 16, 24. Au-delà de 32px, c'est une respiration de page, rare.
- Padding constant par type de conteneur : toutes les cartes au même padding, toutes les cellules au même padding.
- Texte courant 13 à 14px, dense 12px. Pas de titre au-delà de 24px hors tableau de bord.

## Structure d'écran

- **Coque** : barre latérale de navigation (`w-sidebar`, élément actif avec l'état `selected` de la DNA, `aria-current="page"`), éventuel en-tête d'application (`h-header` : recherche globale, notifications, compte).
- **En-tête de page** : titre (`h1`), contexte court (périmètre, période, nombre d'éléments), action principale à droite. Les actions secondaires dans un menu ou en contour.
- **Zones de travail** : filtres au-dessus de ce qu'ils filtrent ; liste ou tableau ; détail en panneau latéral ou en page dédiée. Une zone = une responsabilité.
- Utiliser la largeur : en 1440 et au-delà, préférer maître-détail ou colonnes à une colonne unique étirée. Mais borner les **lignes de texte** (`max-w-prose`) même dans un grand panneau.
- Seules les zones de données défilent (`overflow-auto` sur le tableau ou le panneau), l'en-tête et la barre latérale restent fixes.

## Tableaux et listes

- En-têtes discrets (petites capitales ou `text-xs text-muted`), alignement : texte à gauche, nombres et montants à droite en `tabular-nums`, statuts en badge.
- Hauteur de ligne `h-row` constante. Survol de ligne visible. Ligne sélectionnée avec l'état `selected`.
- Colonnes à largeur pensée pour les vraies données : identifiants en `font-mono`, valeurs longues tronquées avec ellipse **et** titre complet en infobulle (`title`) ; jamais un libellé d'état tronqué.
- Tri, filtres actifs et nombre de résultats visibles (« 24 sur 1 280 »). Pagination ou chargement progressif explicite.
- Actions de ligne au survol ou dans un menu `…`, actions groupées quand des lignes sont cochées.

## Formulaires

- Libellé au-dessus du champ, aide sous le champ, erreur sous le champ en `text-danger` avec la solution, `aria-invalid` sur le champ fautif.
- Champs groupés en sections titrées. Largeur de champ proportionnée à la donnée (un code postal n'occupe pas toute la ligne).
- Barre d'actions en bas ou collante : action principale nommée par son effet (« Enregistrer la règle »), « Annuler » en secondaire.
- Prévenir la perte de données : confirmation avant d'abandonner des modifications non enregistrées.

## États et retours

- Chaque zone de données a ses états : chargement en squelette qui garde la structure (mêmes colonnes, mêmes hauteurs), vide expliqué avec une action, erreur distincte du vide avec une reprise, partiel.
- Retour immédiat de chaque action : toast pour une confirmation non bloquante, bannière dans la zone pour un problème qui persiste, dialogue seulement pour une confirmation destructive ou irréversible.
- Les actions longues montrent leur progression et ne bloquent pas tout l'écran.

## Navigation et clavier

- L'utilisateur sait toujours où il est : élément de navigation actif, fil d'Ariane pour les niveaux profonds, titre de page explicite.
- Raccourcis clavier pour les actions répétées, affichés à côté de l'action (`<kbd>`). Ordre de tabulation logique, focus toujours visible.
- Les dialogues piègent le focus, se ferment avec Échap, rendent le focus à l'élément d'origine.

## Microcopie

- Libellés courts et **cohérents entre écrans** : la même action porte le même verbe partout (« Classer » ne devient pas « Archiver » ailleurs).
- « Enregistrer », « Annuler », « Supprimer » sont des libellés corrects en produit. Préciser l'objet quand l'action n'est pas évidente (« Supprimer la règle »).
- Pas de ton marketing dans l'interface. Les nombres ont leur unité et leur contexte.

## Couleur et sens

- La couleur porte un sens (statut, sévérité, sélection) et toujours doublé d'un libellé, d'une icône ou d'une forme.
- Fonds neutres pour les conteneurs ; la couleur vit dans les badges, points, barres et icônes.

## Clichés d'interface générée (à éviter)

- Hero, grand titre accrocheur ou illustration décorative dans un écran de travail.
- Cartes KPI énormes qui repoussent les données utiles sous le pli.
- Tableaux de trois lignes aux données parfaites : montrer le volume et les cas limites.
- Boutons pleins partout, couleurs vives sans signification.
