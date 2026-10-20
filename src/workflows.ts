import { getMode, getModes, type Mode } from './modes/modes.js';

/**
 * Workflows guidés : instructions pas à pas que le modèle du client suit en appelant
 * les outils Naos. Exposés en prompts MCP et via l'outil get_workflow.
 * Le contenu propre à un métier (cadrage, structure, composition, relecture) vient du mode.
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

function modeList(): string {
  return [...getModes().modes.values()].map((m) => `« ${m.id} » (${m.name})`).join(', ');
}

/** Mode demandé, ou consigne pour le choisir s'il manque ou est inconnu. */
function resolveMode(id?: string): { mode?: Mode; instruction: string } {
  const mode = id ? getMode(id.trim()) : undefined;
  if (mode) return { mode, instruction: `Mode : « ${mode.id} » (${mode.name}). Passe mode: "${mode.id}" à tous les outils Naos.` };
  const unknown = id ? `Le mode « ${id} » n'existe pas. ` : '';
  return {
    instruction: `${unknown}Choisis d'abord le mode selon la demande parmi ${modeList()} (appelle list_modes si besoin), puis rappelle ce workflow avec ce mode. Sans mode, les règles, sections et contrôles ne seront pas les bons.`,
  };
}

const uiScreen: Workflow = {
  name: 'ui_screen',
  title: 'Créer un écran ou une page',
  description:
    'Pipeline complet adapté au mode : cadrage, choix de DNA, contenu, structure, composition, assemblage avec lint, rendu réel et corrections, livraison.',
  args: {
    brief: { description: 'Ce qu’il faut créer : produit, écran ou page, utilisateurs, objectif', required: true },
    mode: { description: 'Mode : website, product-desktop… (voir list_modes)', required: false },
    dna: { description: 'Id de DNA imposée (sinon suggestion parmi les DNA du mode)', required: false },
    save_as: { description: 'Nom du fichier de sortie', required: false },
  },
  render: (a) => {
    const { mode, instruction } = resolveMode(a.mode);
    const head = `Tu crées ${mode ? mode.workflow.unit : 'une interface'} HTML + Tailwind avec le serveur Naos. Suis les étapes dans l'ordre, sans en sauter.

## Demande
${line('Brief', a.brief)}${line('DNA imposée', a.dna)}${line('Fichier de sortie', a.save_as)}
${instruction}
`;
    if (!mode) return head;
    const m = mode.id;
    return `${head}
## 1. Cadrer
${mode.workflow.frame}
Si le brief ne permet pas de répondre, pose au plus trois questions et arrête-toi là.

## 2. Choisir la DNA
${a.dna ? `Appelle get_dna avec id "${a.dna}" et mode "${m}". Si elle ne sert pas ce mode, dis-le et propose une DNA du mode.` : `Appelle suggest_dna avec le produit, l'ambiance et mode "${m}", puis get_dna sur la DNA retenue avec mode "${m}". Justifie le choix en une phrase.`}
Appelle get_rules avec mode "${m}". Les règles communes, celles du mode, l'identité de la DNA et son bloc de mode font loi, dans cet ordre de priorité croissante : aucune couleur, police, dimension, ombre ou arrondi en dehors d'eux.

## 3. Écrire le contenu AVANT la mise en page
Rédige tous les textes : titres, libellés, actions, données (noms, montants, dates, identifiants, statuts réalistes et cohérents entre eux), messages d'état vide, de chargement et d'erreur. Jamais de lorem ipsum ni de « Titre ici ».

## 4. Structurer
${mode.workflow.structure}
Appelle get_patterns avec les types retenus, mode "${m}" et dna (l'id de la DNA) : ses sections propres passent en tête. Les sections sont des références de STRUCTURE : adapte-les, ne les recopie pas telles quelles.

## 5. Composer le corps
Écris uniquement le contenu du <body>, en classes sémantiques (règles communes, section 1).
${mode.workflow.compose}

## 6. Assembler, contrôler, réparer
Appelle wrap_screen avec le corps, dna_id, mode "${m}", un titre, les libs nécessaires ("alpine" pour l'interactivité, "chartjs" pour les graphiques)${a.save_as ? ` et save_as "${a.save_as}"` : ' et un save_as parlant'}.
Si le lint indique needsRepair, corrige UNIQUEMENT les violations "error" listées puis relance (deux fois au maximum). Traite les avertissements pertinents.

## 7. Regarder le rendu et corriger
Appelle preview_screen sur la page enregistrée (le mode est lu dans la page). Corrige toutes les erreurs du rapport, puis REGARDE chaque capture :
${mode.workflow.review}
Corrige dans le corps, relance wrap_screen puis preview_screen. Deux tours au maximum. Signale ce qui reste.

## 8. Livrer
En quelques lignes : le chemin du fichier, la DNA et pourquoi, les choix de structure, les éléments à fournir (images data-image, données réelles), les avertissements restants.
Propose de comparer avec une autre DNA du même mode via retheme : c'est instantané.`;
  },
};

const uiComponent: Workflow = {
  name: 'ui_component',
  title: 'Planche de composant',
  description:
    'Produit la planche complète d’un composant pour une DNA : anatomie, tailles, variantes et tous les états, avec les règles d’usage.',
  args: {
    component: { description: 'Le composant : « bouton », « ligne d’alerte », « champ de recherche », « carte KPI »…', required: true },
    mode: { description: 'Mode (product-desktop par défaut pour un composant d’interface)', required: false },
    dna: { description: 'Id de DNA', required: false },
    save_as: { description: 'Nom du fichier de sortie', required: false },
  },
  render: (a) => {
    const { mode, instruction } = resolveMode(a.mode ?? (getMode('product-desktop') ? 'product-desktop' : undefined));
    const head = `Tu produis la planche du composant « ${a.component ?? '?'} » avec le serveur Naos.

${line('DNA', a.dna)}${line('Fichier de sortie', a.save_as)}${instruction}
`;
    if (!mode) return head;
    const m = mode.id;
    return `${head}
1. ${a.dna ? `Appelle get_dna avec id "${a.dna}" et mode "${m}"` : `Appelle suggest_dna avec mode "${m}" puis get_dna`}, puis get_rules avec mode "${m}". Cherche avec get_patterns (mode "${m}", dna, query : le nom du composant) s'il existe déjà une section qui l'utilise : la planche doit rester cohérente avec elle.
2. Définis le composant en cinq lignes : son rôle, où il apparaît, ses données, ses interactions, ce qu'il ne doit jamais faire.
3. Compose une page-planche (h1 = nom du composant) avec ces sections, chacune titrée (h2) :
   - **Anatomie** : le composant au repos, ses parties nommées en légende (text-xs text-muted).
   - **Tailles** : avec les dimensions sémantiques de la DNA (h-ctl, h-ctl-sm, h-row… selon le composant).
   - **Variantes** : principale, secondaire, discrète, destructive… seulement celles qui ont un sens pour ce composant.
   - **États**, côte à côte et étiquetés : repos, survol, focus visible, actif ou sélectionné, désactivé, chargement, erreur, vide. Simule survol et focus avec les classes de l'état (« states » du bloc de mode) appliquées en dur, et étiquette-les.
   - **Contenus limites** : libellé très long, valeur absente, nombre à 7 chiffres, deux langues si pertinent.
   - **Usage** : trois « à faire » et trois « à éviter », illustrés par un mini-exemple chacun.
   - **Traduction code** : si la DNA a une règle de traduction vers le code d'un produit, le snippet correspondant (dans un <pre class="font-mono text-xs">).
4. Appelle wrap_screen (mode "${m}", dna_id${a.save_as ? `, save_as "${a.save_as}"` : ', save_as "composant-<nom>"'}), corrige les erreurs du lint, puis preview_screen et regarde : chaque état est-il distinguable de son voisin sans lire l'étiquette ? Le focus est-il visible ? Les contenus limites tiennent-ils ?
5. Livre le chemin du fichier et les décisions prises (variantes retenues, états ajoutés ou écartés).`;
  },
};

const uiReview: Workflow = {
  name: 'ui_review',
  title: 'Relire un écran',
  description: 'Lint et rendu réel selon le mode, puis critique structurée avec corrections priorisées.',
  args: {
    file: { description: 'Nom d’une page du dossier de sortie (ou coller le HTML dans la conversation)', required: false },
    mode: { description: 'Mode, si la page ne l’indique pas', required: false },
    focus: { description: 'Point d’attention particulier', required: false },
  },
  render: (a) => `Tu relis une interface produite avec Naos.

${line('Page', a.file)}${line('Mode', a.mode)}${line('Point d’attention', a.focus)}
1. Obtiens le HTML (${a.file ? `read_screen avec le fichier « ${a.file} »` : 'collé par l’utilisateur, ou read_screen si c’est une page du dossier de sortie'}). Le mode et la DNA sont dans les méta naos-mode et naos-dna ; sinon, utilise le mode indiqué ou déduis-le (${modeList()}).
2. Appelle lint_screen avec autofix: false, get_dna (avec le mode) et get_rules (avec le mode). Si c'est un document complet, appelle preview_screen et regarde toutes les captures.
3. Critique en cinq rubriques, chacune avec au plus trois points, du plus important au moins important :
   - **Structure et hiérarchie** : selon le mode (récit et moment fort pour un site ; tâche, densité et lecture rapide pour un produit) ;
   - **Contenu** : crédibilité des données, libellés, cohérence ;
   - **Fidélité à la DNA** : règles d'identité et du bloc de mode, tokens et dimensions uniquement ;
   - **États et accessibilité** : états manquants, erreurs du lint et du rendu, libellés, ordre des titres, focus ;
   - **Rendu** : ce que montrent les captures aux différentes largeurs (débordements, chevauchements, troncatures, espace mal utilisé).
4. Termine par des corrections concrètes, numérotées, prêtes à appliquer. Ne réécris pas l'écran sauf si on te le demande.`,
};

const dnaFromSites: Workflow = {
  name: 'dna_from_sites',
  title: 'Créer une DNA depuis des sites',
  description: 'Scanne des sites de référence, synthétise leur grammaire visuelle et enregistre une ou plusieurs DNA pour un mode.',
  args: {
    urls: { description: 'Adresses séparées par des espaces ou des retours à la ligne', required: true },
    mode: { description: 'Mode visé par la DNA (website par défaut)', required: false },
    notes: { description: 'Ce qui plaît dans chaque site, client ou inspiration', required: false },
  },
  render: (a) => {
    const modeId = a.mode?.trim() || 'website';
    const mode = getMode(modeId);
    return `Tu crées une ou plusieurs Design DNA à partir de sites de référence, avec Naos.

${line('Sites', a.urls)}${line('Ce qui plaît', a.notes)}- Mode visé : ${mode ? `« ${mode.id} » (${mode.name})` : `« ${modeId} » est inconnu : choisis parmi ${modeList()}`}
1. Appelle scan_url sur chaque site. Regarde les captures : les mesures donnent les valeurs, les captures donnent l'intention.
2. Pour chaque site, note en trois lignes ce qui fait sa qualité (construction, typographie, hiérarchie, couleur, interaction, densité).
3. Dégage la grammaire commune et les différences. Décide combien de DNA créer : fusionne ce qui suit la même logique, sépare ce qui diverge (thème clair ou sombre, registre).
4. Sites d'inspiration (pas le client) : ne clone pas une identité reconnaissable ; décale les teintes et remplace les polices sous licence par des équivalents Google Fonts. Site du client : reste fidèle à sa charte, en corrigeant seulement les contrastes insuffisants.
5. Rédige chaque DNA à partir du brouillon : identité commune (summary, mood, bestFor, tokens, fonts, shape, rules d'identité) et un bloc modes["${mode?.id ?? modeId}"] avec les champs exigés par ce mode${mode ? ` (${mode.dnaRequires.join(', ')})` : ''} et ses règles propres.
6. Appelle get_dna sur une DNA existante du même mode pour copier le format exact, puis save_dna. En cas de refus, corrige le champ signalé et réessaie.
7. Vérifie le rendu : get_patterns (mode "${mode?.id ?? modeId}") puis wrap_screen avec quelques sections sur la nouvelle DNA (mode "${mode?.id ?? modeId}", save_as "apercu-<id>") et preview_screen. Indique le chemin du fichier.
8. Résume : les DNA créées, ce que chacune reprend de quel site, ce qui a été adapté et pourquoi.`;
  },
};

export const WORKFLOWS: Workflow[] = [uiScreen, uiComponent, uiReview, dnaFromSites];

export function getWorkflow(name: string): Workflow | undefined {
  return WORKFLOWS.find((w) => w.name === name);
}
