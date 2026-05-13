#!/usr/bin/env node
/**
 * CLI-Test für NPC-Extraktion — direkte Pipeline ohne Review-UI
 * 
 * Nutzung:
 *   node scripts/test-npc-extraction.mjs /pfad/zum/pdf.pdf
 * 
 * Output: JSON mit allen erkannten NPCs + Statblock-Daten
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Dynamic import for ESM compat
const { buildPdfImportIr } = await import(join(projectRoot, 'packages/mcp-server/dist/adventure-import/pdf/pipeline.js'));
const { createDefaultPdfToolRunner } = await import(join(projectRoot, 'packages/mcp-server/dist/adventure-import/pdf/tooling.js'));

const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error('Usage: node test-npc-extraction.mjs <pdf-path>');
  process.exit(1);
}

console.log(`🔍 Extrahiere NPCs aus: ${pdfPath}`);
console.log('⏳ Das dauert 30-60 Sekunden...\n');

const startTime = Date.now();

try {
  const runner = createDefaultPdfToolRunner();
  const result = await buildPdfImportIr({
    pdfPath,
    outPath: join(projectRoot, '.tmp', `test-${Date.now()}`),
    runner,
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // Filtere nur NPC-Import-Pläne
  const npcPlans = result.ir.importPlan.filter(plan => plan.targetSubtype === 'npc');
  
  console.log(`✅ Fertig in ${duration}s`);
  console.log(`📄 Seiten: ${result.ir.document.pageCount}`);
  console.log(`🎯 NPCs erkannt: ${npcPlans.length}`);
  console.log(`📝 Entity Candidates: ${result.ir.entityCandidates.length}`);
  console.log(`📦 Entity Stubs: ${result.ir.entityStubs.length}`);
  console.log('');

  if (npcPlans.length === 0) {
    console.log('⚠️  Keine NPCs erkannt. Mögliche Gründe:');
    console.log('   - PDF hat keinen Text-Layer (gescanntes PDF)');
    console.log('   - Statblock-Format nicht erkannt');
    console.log('   - OCR-Backend nicht erreichbar');
    console.log('');
    console.log('Versuche OCR mit:');
    console.log('   export PDF_REVIEW_OCR_ENGINE=auto');
    process.exit(0);
  }

  // Detaillierte NPC-Ausgabe
  npcPlans.forEach((plan, i) => {
    console.log(`--- NPC ${i + 1}: ${plan.payload.name} ---`);
    console.log(`   Ziel: ${plan.targetType} (${plan.targetSubtype})`);
    console.log(`   Confidence: ${(plan.confidence * 100).toFixed(0)}%`);
    console.log(`   Review nötig: ${plan.requiresReview ? 'Ja' : 'Nein'}`);
    console.log(`   Fehlende Felder: ${plan.missingFields.join(', ') || 'Keine'}`);
    
    const system = plan.payload.system || {};
    
    if (system.characteristics) {
      const attrs = Object.entries(system.characteristics)
        .map(([k, v]) => `${k.toUpperCase()}: ${v.value}`)
        .join(', ');
      console.log(`   Attribute: ${attrs}`);
    }
    
    if (system.status) {
      const status = system.status;
      const parts = [];
      if (status.wounds) parts.push(`LeP: ${status.wounds.initial}`);
      if (status.astralenergy) parts.push(`AsP: ${status.astralenergy.value}`);
      if (status.karmaenergy) parts.push(`KaP: ${status.karmaenergy.value}`);
      if (status.ini) parts.push(`INI: ${status.ini.value}`);
      if (status.sk) parts.push(`SK: ${status.sk.value}`);
      if (status.zk) parts.push(`ZK: ${status.zk.value}`);
      if (parts.length) console.log(`   Status: ${parts.join(', ')}`);
    }
    
    if (system.combat?.weapons?.length) {
      console.log(`   Waffen:`);
      system.combat.weapons.forEach(w => {
        console.log(`     - ${w.name}: AT ${w.at}, PA ${w.pa || '-'}, TP ${w.tp}, RW ${w.rw}`);
      });
    }
    
    if (system.details?.sonderfertigkeiten?.length) {
      console.log(`   Sonderfertigkeiten: ${system.details.sonderfertigkeiten.join(', ')}`);
    }
    
    console.log('');
  });

  // Optional: Vollständiges JSON speichern
  const jsonPath = join(projectRoot, '.tmp', `npc-extraction-${Date.now()}.json`);
  console.log(`💾 Vollständige Daten: ${jsonPath}`);
  
  // Nur die relevanten Daten
  const exportData = {
    document: {
      sourcePath: result.ir.document.sourcePath,
      pageCount: result.ir.document.pageCount,
    },
    npcs: npcPlans.map(plan => ({
      name: plan.payload.name,
      confidence: plan.confidence,
      requiresReview: plan.requiresReview,
      missingFields: plan.missingFields,
      system: plan.payload.system,
    })),
    // Rohdaten für Debugging
    entityCandidates: result.ir.entityCandidates.map(c => ({
      label: c.label,
      entityType: c.entityType,
      confidence: c.confidence,
    })),
  };
  
  console.log('\n📝 JSON-Export (kompakt):');
  console.log(JSON.stringify(exportData, null, 2));

} catch (error) {
  console.error('❌ Fehler:', error.message);
  console.error(error.stack);
  process.exit(1);
}
