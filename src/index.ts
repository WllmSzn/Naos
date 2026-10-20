#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, SERVER_NAME, SERVER_VERSION } from './server.js';
import { getLibrary } from './dna/library.js';

// stdout est réservé au protocole MCP : tous les logs passent par stderr.
const { dnas, errors } = getLibrary();
console.error(`[${SERVER_NAME} ${SERVER_VERSION}] ${dnas.size} DNA chargées`);
for (const e of errors) console.error(`[${SERVER_NAME}] DNA invalide ${e.file} :\n  - ${e.issues.join('\n  - ')}`);

const server = createServer();
await server.connect(new StdioServerTransport());
