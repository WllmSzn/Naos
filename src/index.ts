#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, SERVER_NAME, SERVER_VERSION } from './server.js';
import { getLibrary } from './dna/library.js';
import { getModes } from './modes/modes.js';
import { getPatterns } from './patterns/library.js';

// stdout est réservé au protocole MCP : tous les logs passent par stderr.
const modes = getModes();
const { dnas, errors } = getLibrary();
const patterns = getPatterns();
console.error(`[${SERVER_NAME} ${SERVER_VERSION}] modes : ${[...modes.modes.keys()].join(', ')} · ${dnas.size} DNA · ${patterns.patterns.size} sections`);
for (const e of modes.errors) console.error(`[${SERVER_NAME}] mode invalide ${e.mode} :\n  - ${e.issues.join('\n  - ')}`);
for (const e of errors) console.error(`[${SERVER_NAME}] DNA invalide ${e.file} :\n  - ${e.issues.join('\n  - ')}`);
for (const e of patterns.errors) console.error(`[${SERVER_NAME}] section invalide ${e.file} : ${e.issue}`);

const server = createServer();
await server.connect(new StdioServerTransport());
