#!/usr/bin/env node
/**
 * CLI-Test für NPC-Extraktion — Mock-Modus (kein Backend nötig)
 * Direkte Validierung der Pipeline-Komponenten ohne Surya/Marker/OCR
 * 
 * Nutzung:
 *   cd packages/mcp-server
 *   node ../../scripts/test-npc-mock.mjs
 */

import { classifyAdventurePdfIr } from '../packages/mcp-server/dist/adventure-import/pdf/heuristics_classification.js';
import { buildFoundryImportPlan } from '../packages/mcp-server/dist/adventure-import/pdf/foundry_mapping.js';
import { adventureLayoutIrV1Schema } from '../packages/mcp-server/dist/adventure-import/pdf/ir.js';

// === DSA5-Test-Fixture: Deichbauern ===
const testText = `Deichbauern
MU 12 KL 11 IN 12 CH 11
FF 14 GE 13 KO 13 KK 13
LeP 31 AsP - KaP - INI 13+1W6
SK 1 ZK 2 AW 7 GS 8
Deichgabel: AT 10 PA 4 TP 1W6+2 RW mittel
Sonderfertigkeiten: Belastungsgewöhnung I, Wuchtschlag I`;

const block = {
  id: 'block:test:deichbauern',
  pageId: 'page:test:1',
  pageNumber: 1,
  bbox: { x: 0, y: 0, w: 595, h: 400 },
  readingOrder: 1,
  blockType: 'paragraph',
  roleHint: undefined,
  textRaw: testText,
  textNormalized: testText,
  source: 'text_layer',
  sourceBlockIds: ['raw:deichbauern'],
  confidence: 0.95,
  provenance: { producer: 'test', rule: 'fixture.v1' },
  style: {},
  links: {},
};

const section = {
  id: 'section:test:npc',
  title: 'Deichbauern',
  sectionType: 'npc_section',
  sectionDepth: 0,
  blockIds: ['block:test:deichbauern'],
  source: 'text_layer',
  sourceBlockIds: ['raw:deichbauern'],
  confidence: 0.95,
  provenance: { producer: 'test', rule: 'fixture.v1' },
};

console.log('🔧 Building PDF Import IR (Mock)...\n');

// Step 1: Heuristik-Klassifizierung
const classified = classifyAdventurePdfIr('/test/deichbauern.pdf', [block], [section]);
console.log('✅ Phase 1/3: Heuristik-Klassifizierung');
console.log(`   Blöcke: ${classified.blocks.length}`);
console.log(`   Entity Candidates: ${classified.entityCandidates.length}`);
console.log(`   Entity Stubs: ${classified.entityStubs.length}`);
console.log(`   Stub Typen: ${classified.entityStubs.map(s => s.stubType).join(', ')}`);
console.log();

// Step 2: IR zusammenbauen
const ir = adventureLayoutIrV1Schema.parse({
  irVersion: 'adventure-layout-ir.v1',
  document: {
    id: 'doc:test:deichbauern',
    sourcePath: '/test/deichbauern.pdf',
    sourceHash: 'sha256:test',
    pdfType: 'text',
    pageCount: 1,
    defaultLanguage: 'de',
    profile: 'ulisses.heldenwerk.v1',
    createdAt: new Date().toISOString(),
    source: 'text_layer',
    sourceBlockIds: [],
    confidence: 1,
    provenance: { producer: 'test', rule: 'fixture.v1' },
  },
  pages: [{
    id: 'page:test:1',
    documentId: 'doc:test:deichbauern',
    pageNumber: 1,
    width: 595,
    height: 842,
    ocrMode: 'none',
    layoutOcrStatus: 'text_layer',
    textSource: 'text_layer',
    readingOrderVersion: 1,
    source: 'text_layer',
    confidence: 1,
    provenance: { producer: 'test', rule: 'fixture.v1' },
  }],
  blocks: classified.blocks,
  sections: classified.sections,
  entityCandidates: classified.entityCandidates,
  entityStubs: classified.entityStubs,
  annotations: [],
  importPlan: [],
});
console.log('✅ Phase 2/3: IR-Assembly');
console.log(`   IR Version: ${ir.irVersion}`);
console.log(`   NPC Stubs: ${ir.entityStubs.length}`);
console.log();

// Step 3: Foundry-Import-Plan
const importPlan = buildFoundryImportPlan(ir);
console.log('✅ Phase 3/3: Foundry-Mapping');
console.log(`   Import-Pläne: ${importPlan.length}`);
console.log();

// Step 4: Validierung
const npcPlan = importPlan.find(p => p.targetSubtype === 'npc');
console.log('=== VALIDIERUNG ===');

if (!npcPlan) {
  console.error('❌ FEHLER: Kein NPC-Import-Plan gefunden!');
  process.exit(1);
}

const checks = [
  { label: 'Ziel-Typ', pass: npcPlan.targetType === 'foundry_actor', expected: 'foundry_actor', got: npcPlan.targetType },
  { label: 'Subtyp', pass: npcPlan.targetSubtype === 'npc', expected: 'npc', got: npcPlan.targetSubtype },
  { label: 'Operation', pass: npcPlan.operation === 'create', expected: 'create', got: npcPlan.operation },
  { label: 'Name', pass: npcPlan.payload.name === 'Deichbauern', expected: 'Deichbauern', got: npcPlan.payload.name },
  { label: 'Review nötig', pass: npcPlan.requiresReview === true, expected: true, got: npcPlan.requiresReview },
  { label: 'characteristics', pass: !!npcPlan.payload.system.characteristics, expected: 'object', got: typeof npcPlan.payload.system.characteristics },
  { label: 'MU=12', pass: npcPlan.payload.system.characteristics?.mu?.value === 12, expected: 12, got: npcPlan.payload.system.characteristics?.mu?.value },
  { label: 'FF=14', pass: npcPlan.payload.system.characteristics?.ff?.value === 14, expected: 14, got: npcPlan.payload.system.characteristics?.ff?.value },
  { label: 'LeP=31', pass: npcPlan.payload.system.status?.wounds?.initial === 31, expected: 31, got: npcPlan.payload.system.status?.wounds?.initial },
  { label: 'INI=13+1W6', pass: npcPlan.payload.system.status?.ini?.value === '13+1W6', expected: '13+1W6', got: npcPlan.payload.system.status?.ini?.value },
  { label: 'SK=1', pass: npcPlan.payload.system.status?.sk?.value === 1, expected: 1, got: npcPlan.payload.system.status?.sk?.value },
  { label: 'ZK=2', pass: npcPlan.payload.system.status?.zk?.value === 2, expected: 2, got: npcPlan.payload.system.status?.zk?.value },
  { label: 'Waffen', pass: npcPlan.payload.system.combat?.weapons?.length > 0, expected: '>0', got: npcPlan.payload.system.combat?.weapons?.length },
  { label: 'Waffe: Deichgabel', pass: npcPlan.payload.system.combat?.weapons?.[0]?.name === 'Deichgabel', expected: 'Deichgabel', got: npcPlan.payload.system.combat?.weapons?.[0]?.name },
];

let passed = 0;
let failed = 0;

checks.forEach(check => {
  if (check.pass) {
    console.log(`  ✅ ${check.label}`);
    passed++;
  } else {
    console.log(`  ❌ ${check.label}: Erwartet "${check.expected}", erhalten "${check.got}"`);
    failed++;
  }
});

console.log();
console.log(`=== ERGEBNIS: ${passed}/${checks.length} bestanden${failed > 0 ? `, ${failed} fehlgeschlagen` : ''} ===`);

// Detaillierte Payload-Ausgabe
console.log('\n=== PAYLOAD (DSA5-Actor-JSON) ===');
console.log(JSON.stringify({
  name: npcPlan.payload.name,
  type: npcPlan.payload.type,
  system: npcPlan.payload.system,
}, null, 2));

if (failed > 0) process.exit(1);
console.log('\n🎉 Alle Checks bestanden! NPC-Vertical-Slice funktioniert korrekt.');
