import type { Dna } from './schema.js';

/** Pluriel naïf → singulier, appliqué des deux côtés de la comparaison. */
function singular(word: string): string {
  return word.length > 3 && /[^s]s$/.test(word) ? word.slice(0, -1) : word;
}

/** Minuscules, sans accents ni pluriels, ponctuation remplacée par des espaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map(singular)
    .join(' ');
}

// Les DNA sont décrites en anglais ; on traduit les termes français courants.
const FR_TO_EN: Record<string, string> = {
  'tableau de bord': 'dashboard',
  'back office': 'admin',
  'site vitrine': 'landing',
  'page d atterrissage': 'landing',
  'boutique': 'ecommerce',
  'e commerce': 'ecommerce',
  'sante': 'health',
  'medical': 'health',
  'medecin': 'health',
  'clinique': 'health',
  'kine': 'health',
  'patient': 'patient portal health',
  'bien etre': 'wellness',
  'reservation': 'booking',
  'rendez vou': 'booking',
  'prise de rdv': 'booking',
  'service public': 'public service',
  'administration': 'public service',
  'surveillance': 'monitoring',
  'journaux': 'logs',
  'assurance': 'insurance',
  'juridique': 'legal',
  'avocat': 'legal',
  'paie': 'payroll',
  'photographe': 'photography',
  'architecte': 'architecture',
  'hotel': 'hospitality',
  'bijou': 'jewelry',
  'galerie': 'art gallery',
  'produit local': 'local business',
  'commerce local': 'local business',
  'recette': 'recipe',
  'voyage': 'travel',
  'lancement': 'launch page',
  'musique': 'music',
  'communaute': 'community',
  'banque': 'finance',
  'comptabilite': 'accounting',
  'facturation': 'invoicing',
  'outil developpeur': 'developer tools',
  'developpeur': 'developer',
  'restaurant': 'restaurant',
  'alimentation': 'food',
  'mode': 'fashion',
  'luxe': 'luxury',
  'immobilier': 'real estate',
  'evenement': 'event',
  'festival': 'festival',
  'educatif': 'education',
  'formation': 'education',
  'agence': 'agency',
  'association': 'nonprofit',
  'clair': 'light',
  'sombre': 'dark',
  'calme': 'calm',
  'apaisant': 'calm',
  'rassurant': 'reassuring',
  'accessible': 'accessible',
  'amical': 'friendly',
  'sobre': 'minimal',
  'minimaliste': 'minimal',
  'haut de gamme': 'premium',
  'cinematographique': 'cinematic',
  'dense': 'dense',
  'precis': 'precise',
  'fiable': 'trustworthy',
  'graphique': 'graphic',
  'bruyant': 'loud',
  'organique': 'organic',
  'audacieux': 'bold',
  'chaleureux': 'warm',
  'serieux': 'serious',
  'elegant': 'elegant',
  'technique': 'technical',
  'ludique': 'playful',
};

function translate(text: string): string {
  let out = ` ${normalize(text)} `;
  for (const [fr, en] of Object.entries(FR_TO_EN)) {
    out = out.replaceAll(` ${fr} `, ` ${fr} ${en} `);
  }
  return out.trim();
}

const STOPWORDS = new Set(['a', 'an', 'the', 'for', 'and', 'of', 'app', 'une', 'un', 'de', 'des', 'pour', 'le', 'la', 'les', 'et']);

function tokens(text: string): Set<string> {
  return new Set(text.split(' ').filter((t) => t.length > 1 && !STOPWORDS.has(t)));
}

export interface Suggestion {
  id: string;
  name: string;
  theme: Dna['theme'];
  score: number;
  reasons: string[];
}

export interface SuggestQuery {
  product: string;
  mood?: string;
  theme?: 'light' | 'dark';
}

/** Classe les DNA par adéquation au produit décrit (heuristique déterministe). */
export function suggestDna(dnas: Iterable<Dna>, q: SuggestQuery, limit = 3): Suggestion[] {
  const productText = translate(q.product);
  const productTokens = tokens(productText);
  const moodTokens = q.mood ? tokens(translate(q.mood)) : new Set<string>();

  const results: Suggestion[] = [];
  for (const dna of dnas) {
    let score = 0;
    const reasons: string[] = [];

    for (const use of dna.bestFor) {
      const n = normalize(use);
      if (` ${productText} `.includes(` ${n} `)) {
        score += 3;
        reasons.push(`usage « ${use} »`);
      } else {
        const overlap = [...tokens(n)].filter((t) => productTokens.has(t));
        if (overlap.length) {
          score += overlap.length;
          reasons.push(`proche de « ${use} »`);
        }
      }
    }

    const moods = dna.mood.map(normalize);
    for (const m of moods) {
      if (moodTokens.has(m) || productTokens.has(m)) {
        score += 2;
        reasons.push(`ambiance « ${m} »`);
      }
    }

    if (q.theme) {
      if (dna.theme === q.theme) {
        score += 2;
        reasons.push(`thème ${q.theme}`);
      } else {
        score -= 3;
      }
    }

    results.push({ id: dna.id, name: dna.name, theme: dna.theme, score, reasons: [...new Set(reasons)] });
  }

  return results.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
}
