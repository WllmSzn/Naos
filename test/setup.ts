/**
 * À importer EN PREMIER dans chaque fichier de test : les tests tournent sur la petite
 * bibliothèque de test (test/fixtures/library), jamais sur la bibliothèque réelle de l'utilisateur.
 * Les modules ESM s'évaluent dans l'ordre des imports : la variable est posée avant src/paths.ts.
 */
import { fileURLToPath } from 'node:url';

process.env.NAOS_LIBRARY = fileURLToPath(new URL('./fixtures/library', import.meta.url));
