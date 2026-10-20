import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';

async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

function text(result: Awaited<ReturnType<Client['callTool']>>): string {
  const first = (result.content as Array<{ type: string; text?: string }>)[0];
  return first?.text ?? '';
}

test('le serveur expose les outils attendus', async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), [
    'get_dna', 'get_patterns', 'get_rules', 'get_workflow', 'lint_screen', 'list_dna', 'list_patterns', 'preview_screen', 'read_screen',
    'reload_library', 'retheme', 'save_dna', 'scan_url', 'suggest_dna', 'wrap_screen',
  ]);
});

test('prompts MCP : liste et rendu avec arguments', async () => {
  const client = await connect();
  const { prompts } = await client.listPrompts();
  assert.deepEqual(prompts.map((p) => p.name).sort(), ['dna_from_sites', 'ui_review', 'ui_screen']);
  const res = await client.getPrompt({ name: 'ui_screen', arguments: { brief: 'Page tarifs pour un logiciel de paie', dna: 'linen-ledger' } });
  const msg = res.messages[0]?.content as { type: string; text: string };
  assert.match(msg.text, /Page tarifs pour un logiciel de paie/);
  assert.match(msg.text, /get_dna avec "linen-ledger"/);
});

test('get_workflow : exige les arguments requis', async () => {
  const client = await connect();
  const missing = await client.callTool({ name: 'get_workflow', arguments: { name: 'ui_screen' } });
  assert.equal(missing.isError, true);
  const ok = await client.callTool({ name: 'get_workflow', arguments: { name: 'dna_from_sites', args: { urls: 'https://exemple.com' } } });
  assert.match(text(ok), /scan_url/);
});

test('get_patterns et list_patterns', async () => {
  const client = await connect();
  const list = JSON.parse(text(await client.callTool({ name: 'list_patterns', arguments: { platform: 'app' } })));
  assert.ok(list.patterns.every((p: { platform: string; html?: string }) => p.platform === 'app' && p.html === undefined));
  const html = text(await client.callTool({ name: 'get_patterns', arguments: { ids: ['cta-panel'] } }));
  assert.match(html, /<!-- cta-panel · cta ·/);
  assert.match(html, /bg-accent/);
});

function parts(result: Awaited<ReturnType<Client['callTool']>>): [any, string] {
  const content = result.content as Array<{ text: string }>;
  return [JSON.parse(content[0]!.text), content[1]?.text ?? ''];
}

test('wrap_screen : lint puis assemblage', async () => {
  const client = await connect();
  const [report, html] = parts(
    await client.callTool({
      name: 'wrap_screen',
      arguments: { body: '<h1 class="text-gray-900">Bonjour 👋</h1>', dna_id: 'signal-clinic', title: 'Accueil' },
    }),
  );
  assert.equal(report.dna, 'signal-clinic');
  assert.equal(report.lint.needsRepair, false);
  assert.match(html, /<h1 class="text-ink">Bonjour <\/h1>/);
  assert.match(html, /<meta name="hecate-dna" content="signal-clinic">/);
});

test('wrap_screen refuse des surcharges illisibles', async () => {
  const client = await connect();
  const res = await client.callTool({
    name: 'wrap_screen',
    arguments: { body: '<h1>x</h1>', dna_id: 'linen-ledger', overrides: { tokens: { muted: '#EEEEEE' } } },
  });
  assert.equal(res.isError, true);
  assert.match(text(res), /contraste muted/);
});

test('lint_screen lit la DNA dans le document', async () => {
  const client = await connect();
  const [, wrapped] = parts(await client.callTool({ name: 'wrap_screen', arguments: { body: '<h1>x</h1>', dna_id: 'graphite-console', lint: false } }));
  const doc = wrapped.replace('<h1>x</h1>', '<h1 class="text-gray-100">x</h1>');
  const [report, html] = parts(await client.callTool({ name: 'lint_screen', arguments: { html: doc } }));
  assert.equal(report.errorCount, 0);
  assert.equal(html, '<h1 class="text-ink">x</h1>');
});

test('retheme via le serveur', async () => {
  const client = await connect();
  const [, wrapped] = parts(await client.callTool({ name: 'wrap_screen', arguments: { body: '<h1>x</h1>', dna_id: 'field-notes' } }));
  const [report, html] = parts(await client.callTool({ name: 'retheme', arguments: { html: wrapped, dna_id: 'gallery-noir' } }));
  assert.equal(report.from, 'field-notes');
  assert.equal(report.to, 'gallery-noir');
  assert.match(html, /Cormorant\+Garamond/);
});

test('list_dna puis get_dna', async () => {
  const client = await connect();
  const list = JSON.parse(text(await client.callTool({ name: 'list_dna', arguments: {} })));
  assert.equal(list.count, 9);

  const dna = JSON.parse(text(await client.callTool({ name: 'get_dna', arguments: { id: 'field-notes' } })));
  assert.equal(dna.tokens.accent, '#B4502A');
  assert.match(dna.googleFontsUrl, /^https:\/\/fonts\.googleapis\.com\/css2\?/);
});

test('get_dna signale une DNA inconnue', async () => {
  const client = await connect();
  const res = await client.callTool({ name: 'get_dna', arguments: { id: 'nope' } });
  assert.equal(res.isError, true);
  assert.match(text(res), /DNA inconnue/);
});

test('suggest_dna renvoie des suggestions classées', async () => {
  const client = await connect();
  const res = JSON.parse(text(await client.callTool({ name: 'suggest_dna', arguments: { product: 'outil de logs pour développeurs' } })));
  assert.equal(res.suggestions[0].id, 'graphite-console');
});

test('resources : règles, catalogue et template dna://{id}', async () => {
  const client = await connect();
  const { resources } = await client.listResources();
  const uris = resources.map((r) => r.uri);
  assert.ok(uris.includes('rules://core'));
  assert.ok(uris.includes('dna://catalog'));
  assert.ok(uris.includes('dna://gallery-noir'));

  const rules = await client.readResource({ uri: 'rules://core' });
  assert.match(String(rules.contents[0]?.text), /Contrat de tokens/);

  const dna = await client.readResource({ uri: 'dna://poster-block' });
  assert.equal(JSON.parse(String(dna.contents[0]?.text)).shape.radius, '0');
});
