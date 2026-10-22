# Prompt 06 — Runtime des diapos : notes orateur, navigation, publication

> Colle d'abord `00-contexte.md`. Indépendant des prompts 02 à 05. Prérequis conseillé : prompt 01.

## Constat

- Les decks réels ont des **notes orateur**. Naos n'a aucun endroit pour les mettre : elles se perdent lors d'une refonte.
- Le runtime `slides` (`SLIDES_RUNTIME` dans `src/screen/wrap.ts`) ne se pilote qu'au clavier. Au clic et au toucher, rien ne se passe.
- Le `<head>` charge toujours le script iconify depuis `code.iconify.design`, même sans icône. Les hébergeurs à CSP stricte le bloquent, ce qui oblige à retoucher la page à la main avant publication.

## Spécification

### Notes orateur
- Attribut `data-notes` sur `<section data-slide>` : texte brut, retours à la ligne autorisés (`&#10;`).
- Le runtime affiche un panneau de notes, basculé par la touche **N** et par un bouton discret, focus visible et `aria-expanded`. Le panneau suit la diapo courante.
- Ses styles viennent des tokens de la DNA (`surface`, `line`, `ink-soft` ou `muted`) via des variables CSS générées : aucune couleur en dur dans le runtime.
- `lint_screen` (profil présentation) : avertissement `notes.missing` si moins de la moitié des diapos ont des notes. Simple avertissement.
- `export_pdf` : option `notes: true` qui ajoute les notes sous chaque diapo (ou une page de notes par diapo, à choisir et documenter).
- Workflow `ui_screen`, étape « Composer » : écrire une note par diapo, et reprendre tel quel le texte des notes quand on refait un deck existant.

### Navigation
- Clic sur la moitié droite / gauche → diapo suivante / précédente. Ne s'applique pas aux liens, boutons, champs, ni au panneau de notes.
- Balayage horizontal au toucher (seuil d'environ 40 px).
- Indicateur de progression optionnel (fine barre ou « partie en cours »), lu depuis un attribut `data-part` sur les sections. Activé par un réglage du mode, pas en dur.
- `prefers-reduced-motion` respecté si une transition est ajoutée.

### Publication autonome
- N'injecter le script iconify que si le corps contient `<iconify-icon`.
- Option `wrap` (`selfContained: true`) qui remplace les `<iconify-icon>` par leur SVG inline au moment de l'assemblage. Si c'est trop lourd, le documenter et proposer une alternative ; c'est ce qui rend une page publiable sur un hébergeur à CSP stricte.
- Le runtime reste une chaîne JS autonome, sans appel réseau (convention du projet).

## Critères d'acceptation

- Test : un deck de 3 diapos avec `data-notes` → le panneau affiche la note de la diapo courante après navigation clavier, clic et toucher simulé (puppeteer).
- Test : un corps sans `<iconify-icon` → pas de script iconify dans le `<head>`.
- `export_pdf` avec `notes: true` produit un PDF où chaque note est présente. Vérifié sur un PDF réel.
- Vérification visuelle du panneau avec une DNA claire et une sombre.
- `CLAUDE.md` (section runtime) et `rules.md` mis à jour.
