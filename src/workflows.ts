/**
 * Workflows guidés : instructions pas à pas que le modèle du client suit en appelant
 * les outils Hecate. Exposés en prompts MCP et via l'outil get_workflow.
 */

export interface WorkflowArgs {
  [key: string]: string | undefined;
}

export interface Workflow {
  name: string;
  title: string;
  description: string;
  args: Record<string, { description: string; required: boolean }>;
  render: (args: WorkflowArgs) => string;
}

const line = (label: string, value?: string) => (value?.trim() ? `- ${label} : ${value.trim()}\n` : '');

const uiScreen: Workflow = {
  name: 'ui_screen',
  title: 'Créer un écran',
  description: 'Pipeline complet : cadrage, choix de DNA, rédaction, structure, composition, assemblage avec lint et réparation, livraison.',
  args: {
    brief: { description: 'Ce qu’il faut créer : produit, écran, public, objectif', required: true },
    dna: { description: 'Id de DNA imposée (sinon suggestion)', required: false },
    platform: { description: '"web" (site, landing) ou "app" (écran d’application)', required: false },
    save_as: { description: 'Nom du fichier de sortie', required: false },
  },
  render: (a) => `Tu crées un écran HTML + Tailwind avec le serveur Hecate. Suis les étapes dans l'ordre, sans en sauter.

## Demande
${line('Brief', a.brief)}${line('DNA imposée', a.dna)}${line('Plateforme', a.platform)}${line('Fichier de sortie', a.save_as)}
## 1. Cadrer
Résume en cinq lignes : le produit, l'utilisateur, la tâche principale de cet écran (une seule), le ton, la langue du contenu.
Si le brief ne permet pas de remplir ces lignes, pose au plus trois questions et arrête-toi là.

## 2. Choisir la DNA
${a.dna ? `Appelle get_dna avec "${a.dna}".` : 'Appelle suggest_dna avec le produit et l’ambiance, puis get_dna sur la DNA retenue. Justifie le choix en une phrase.'}
Appelle get_rules. Ces deux documents font loi : aucune couleur, police, ombre ou arrondi en dehors d'eux.

## 3. Écrire le contenu AVANT la mise en page
Rédige tous les textes de l'écran : sur-titres, titres, phrases d'appui, libellés de boutons, chiffres, noms, dates, statuts, messages d'état vide ou d'erreur.
- Du contenu réaliste pour CE produit : des montants, des noms et des dates crédibles. Jamais de lorem ipsum ni de « Titre ici ».
- Les boutons commencent par un verbe et disent ce qu'ils font.
- Aucun mot de la liste bannie des règles (section 5).
- Une idée par phrase ; un titre promet un résultat concret.

## 4. Structurer
Liste les sections dans l'ordre, avec pour chacune son type (${a.platform === 'app' ? 'app-shell, kpi, table, form, empty…' : 'nav, hero, logos, intro, feature, stats, testimonial, pricing, faq, cta, footer…'}) et son rôle dans la page.
Appelle get_patterns avec ces types (plateforme ${a.platform === 'app' ? '"app"' : a.platform === 'web' ? '"web"' : 'adaptée'}). Les patterns sont des références de STRUCTURE : adapte-les au contenu et aux règles de la DNA, ne les recopie pas tels quels. Varie les tailles et les compositions d'une section à l'autre.

## 5. Composer le corps
Écris uniquement le contenu du <body> :
- seulement les classes sémantiques des règles (bg-surface, text-muted, border-line, bg-accent/10, rounded-card, font-display…) ;
- le moment fort défini par la « signature » de la DNA, une seule fois ;
- une seule action principale (bouton plein) par vue ;
- des emplacements d'images décrits (<div data-image="description précise" class="aspect-[4/3] rounded-card"></div>), jamais d'image aléatoire ;
- les états (vide, chargement, erreur) dès qu'un composant affiche des données.

## 6. Assembler, contrôler, réparer
Appelle wrap_screen avec le corps, l'id de DNA, un titre, les libs nécessaires ("alpine" pour l'interactivité, "chartjs" pour les graphiques)${a.save_as ? ` et save_as "${a.save_as}"` : ' et un save_as parlant'}.
Lis le rapport de lint :
- si needsRepair est vrai, corrige UNIQUEMENT les violations de niveau "error" listées, puis relance wrap_screen. Deux réparations au maximum ;
- traite les avertissements pertinents (formules creuses, ordre des titres, libellés génériques).

## 7. Regarder le rendu et corriger
Appelle preview_screen sur la page enregistrée. Lis le rapport puis REGARDE chaque capture, desktop et mobile :
- corrige tous les problèmes "error" du rapport (débordement horizontal, contraste réel, images cassées, erreurs JavaScript) ;
- cherche ce qu'aucun contrôle ne voit : éléments qui se chevauchent ou masquent du texte, sections déséquilibrées ou vides, titre trop long en mobile, cartes flottantes qui sortent du cadre, hiérarchie qui ne se lit pas d'un coup d'œil ;
- corrige dans le corps, relance wrap_screen puis preview_screen. Deux tours au maximum. Signale ce qui reste.

## 8. Relire et livrer
Vérifie : la tâche principale est-elle visible sans défiler, en desktop comme en mobile ? La hiérarchie (sur-titre, titre, appui, action) est-elle nette dans chaque section ? Y a-t-il un seul moment fort ?
Livre en quelques lignes : le chemin du fichier, la DNA et pourquoi, la liste des images à fournir (les descriptions des data-image), les avertissements restants s'il y en a.
Propose enfin de comparer avec une ou deux autres DNA via retheme. C'est instantané et gratuit.`,
};

const uiReview: Workflow = {
  name: 'ui_review',
  title: 'Relire un écran',
  description: 'Lint déterministe puis critique structurée (hiérarchie, contenu, accessibilité) avec corrections priorisées.',
  args: {
    file: { description: 'Nom d’une page du dossier de sortie (ou coller le HTML dans la conversation)', required: false },
    focus: { description: 'Point d’attention particulier', required: false },
  },
  render: (a) => `Tu relis un écran produit avec Hecate.

${line('Page', a.file)}${line('Point d’attention', a.focus)}
1. Obtiens le HTML (${a.file ? `read_screen avec le fichier « ${a.file} »` : 'collé par l’utilisateur, ou read_screen si c’est une page du dossier de sortie'}), puis appelle lint_screen avec autofix: false pour un rapport sans modification.
2. Appelle get_dna (DNA indiquée dans la méta hecate-dna) et get_rules. Si la page est un document complet, appelle preview_screen et regarde les captures desktop et mobile.
3. Critique en cinq rubriques, chacune avec au plus trois points, du plus important au moins important :
   - **Hiérarchie** : tâche principale, moment fort unique, rythme des sections, une seule action principale ;
   - **Contenu** : crédibilité, verbes des boutons, formules creuses, longueur des textes ;
   - **Fidélité à la DNA** : règles do/dont respectées, tokens uniquement ;
   - **Accessibilité** : erreurs du lint et du rendu (contraste réel, cibles tactiles), libellés, ordre des titres ;
   - **Responsive** : ce que montrent les captures mobiles (débordements, chevauchements, textes trop longs).
4. Termine par une liste de corrections concrètes, numérotées, prêtes à appliquer. Ne réécris pas l'écran sauf si on te le demande.`,
};

const dnaFromSites: Workflow = {
  name: 'dna_from_sites',
  title: 'Créer une DNA depuis des sites',
  description: 'Scanne des sites de référence, synthétise leur grammaire visuelle et enregistre une ou plusieurs DNA.',
  args: {
    urls: { description: 'Adresses séparées par des espaces ou des retours à la ligne', required: true },
    notes: { description: 'Ce qui plaît dans chaque site, client ou inspiration', required: false },
  },
  render: (a) => `Tu crées une ou plusieurs Design DNA à partir de sites de référence, avec Hecate.

${line('Sites', a.urls)}${line('Ce qui plaît', a.notes)}
1. Appelle scan_url sur chaque site. Regarde les captures : les mesures donnent les valeurs, les captures donnent l'intention.
2. Pour chaque site, note en trois lignes ce qui fait sa qualité (construction, typographie, hiérarchie, couleur, interaction).
3. Dégage la grammaire commune et les différences. Décide combien de DNA créer : fusionne les sites qui suivent la même logique, sépare ceux qui divergent vraiment (thème clair ou sombre, registre).
4. Sites d'inspiration (pas le client) : ne clone pas une identité reconnaissable. Décale les teintes et remplace les polices sous licence par des équivalents Google Fonts. Site du client : reste fidèle à sa charte, en corrigeant seulement les contrastes insuffisants.
5. Pour chaque DNA, pars du brouillon (draft) et rédige ce que le scan ne sait pas faire : summary, mood, bestFor, signature (le moment fort), rules.do et rules.dont (concrets, avec les classes sémantiques), headings (graisse, interlettrage, interlignage) et fonts.accent si un mot de titre change de police.
6. Appelle get_dna sur une DNA existante pour copier le format exact, puis save_dna. En cas de refus pour contraste, ajuste la couleur signalée et réessaie.
7. Vérifie le rendu : appelle get_patterns (hero-split, intro-statement, stats-band, cta-panel), assemble ces sections avec wrap_screen sur la nouvelle DNA et save_as "apercu-<id>". Indique le chemin du fichier.
8. Résume : les DNA créées, ce que chacune reprend de quel site, ce qui a été adapté et pourquoi.`,
};

export const WORKFLOWS: Workflow[] = [uiScreen, uiReview, dnaFromSites];

export function getWorkflow(name: string): Workflow | undefined {
  return WORKFLOWS.find((w) => w.name === name);
}
