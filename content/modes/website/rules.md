# Mode « site web »

Une page de site raconte et convainc : le visiteur la parcourt une fois, de haut en bas, et doit repartir avec une promesse claire et une action.

## Espacement

- Grille de 4px. Valeurs courantes : 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Plus deux éléments sont liés, plus ils sont proches : icône et libellé 8px, champs d'un même groupe 12 à 16px, groupes 24 à 32px, **sections 48px et plus** (souvent 96 à 128px sur desktop).
- Padding de carte constant dans toute la page.
- Largeur de lecture : 60 à 75 caractères par ligne pour le texte courant (`max-w-prose` ou équivalent).

## Typographie

- Quatre à cinq tailles par page au maximum. Échelle de référence : 12 · 14 · 16 · 20 · 24 · 32 · 48 · 64, jusqu'à 96+ pour un titre-signature.
- Texte courant 16 à 18px. Interlignage de 1.5 pour le texte, de 1 à 1.25 pour les titres.

## Hiérarchie et récit

- La promesse et l'action principale sont visibles sans défiler.
- Un seul « moment fort » par page : celui défini par la `signature` de la DNA.
- Chaque section suit la hiérarchie en quatre temps : sur-titre, titre, phrase d'appui (deux ou trois lignes au plus), action.
- Varier les compositions d'une section à l'autre (texte et visuel alternés, chiffres, citation, grille) plutôt que d'empiler des blocs identiques.
- Éviter la grille de cartes identiques par défaut : varier les tailles selon l'importance.

## Rédaction

- Les boutons disent ce qu'ils font, avec un verbe : « Demander une démo », pas « Valider » ni « OK ».
- Les titres promettent un résultat concret, les sous-titres expliquent comment.
- Mots bannis, parce qu'ils ne disent rien : *révolutionner, sublimer, booster, sans effort, fluide, next-level, game-changer, débloquer votre potentiel, l'avenir de…* (et leurs équivalents anglais : *unlock, unleash, seamless, effortless, supercharge, elevate, revolutionize*).
- Preuves concrètes et vérifiables : chiffres avec leur contexte, clients nommés, citations attribuées.

## Images

- Emplacements `data-image` décrits avec précision : sujet, cadrage, lumière.
- Les cartes d'interface, chiffres ou badges posés sur un visuel restent du vrai HTML par-dessus l'emplacement (`relative` sur le parent, `absolute` sur la carte).
- Logos clients : leur nom en texte (`font-display text-muted`) tant que les vrais logos ne sont pas fournis.

## Responsive

- Conçu pour le mobile autant que pour le desktop : chaque section se relit en une colonne, les titres géants passent à une taille lisible, les cartes flottantes restent dans le cadre de leur visuel.
- Cibles tactiles de 44px en mobile.

## Clichés de page générée (à éviter)

- Dégradés violet-bleu, orbes floues en arrière-plan, glassmorphism par défaut.
- Trois cartes identiques « icône + titre + deux lignes » sous un hero centré.
- Badges « Nouveau ✨ », témoignages anonymes, logos de clients inventés.
- Tout centré.
