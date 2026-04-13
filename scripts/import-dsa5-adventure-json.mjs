#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const inputPath = process.argv[2] || process.env.DSA5_ADVENTURE_JSON_FILE;

if (!inputPath) {
  console.error('Usage: node scripts/import-dsa5-adventure-json.mjs <path-to-json>');
  process.exit(1);
}

const createScenes = process.env.DSA5_ADVENTURE_CREATE_SCENES !== 'false';
const createActors = process.env.DSA5_ADVENTURE_CREATE_ACTORS !== 'false';
const resolveActorItems = process.env.DSA5_ADVENTURE_RESOLVE_ACTOR_ITEMS !== 'false';

const mcpServer = new Client(
  { name: 'dsa5-adventure-json-importer', version: '1.0.0' },
  { capabilities: {} }
);

const transport = new StdioClientTransport({
  command: 'node',
  args: ['packages/mcp-server/dist/index.js'],
  stderr: 'inherit',
});

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toStringValue(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function paragraph(text) {
  if (!text) return '';
  return `<p>${escapeHtml(text)}</p>`;
}

function htmlList(values) {
  const items = values.map((value) => `<li>${escapeHtml(value)}</li>`).join('');
  return items.length > 0 ? `<ul>${items}</ul>` : '<p>-</p>';
}

function normalizeAdventurePayload(raw) {
  const metadata = isObject(raw.metadata) ? raw.metadata : {};
  const journalSections = toArray(raw.journalSections).filter(isObject);
  const scenes = toArray(raw.scenes).filter(isObject);
  const npcs = toArray(raw.npcs).filter(isObject);
  const items = toArray(raw.items).filter(isObject);
  const locations = toArray(raw.locations).filter(isObject);
  const warnings = toArray(raw.warnings).filter((entry) => typeof entry === 'string');

  return { metadata, journalSections, scenes, npcs, items, locations, warnings };
}

function buildJournalContent(payload) {
  const title = toStringValue(payload.metadata.title) || 'Imported Adventure';
  const blocks = [
    `<h1>${escapeHtml(title)}</h1>`,
  ];

  const metadataRows = [
    ['Genre', toStringValue(payload.metadata.genre)],
    ['Complexity', toStringValue(payload.metadata.complexity)],
    ['Player Count', toStringValue(payload.metadata.playerCount)],
    ['Timeframe', toStringValue(payload.metadata.timeframe)],
  ].filter(([, value]) => value.length > 0);

  if (metadataRows.length > 0) {
    const rows = metadataRows
      .map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`)
      .join('');
    blocks.push(`<table>${rows}</table>`);
  }

  const description = toStringValue(payload.metadata.description);
  if (description) {
    blocks.push('<h2>Summary</h2>');
    blocks.push(paragraph(description));
  }

  if (payload.warnings.length > 0) {
    blocks.push('<h2>Source Warnings</h2>');
    blocks.push(htmlList(payload.warnings));
  }

  return blocks.join('\n');
}

function buildSectionPages(payload) {
  const pages = [];

  for (const section of payload.journalSections) {
    const heading = toStringValue(section.heading) || 'Section';
    const printedPage = toStringValue(section.printedPage);
    const name = printedPage ? `${printedPage} - ${heading}` : heading;
    const text = toStringValue(section.text);
    pages.push({
      name: name.slice(0, 180),
      content: `<h2>${escapeHtml(heading)}</h2>\n${paragraph(text)}`,
    });
  }

  if (payload.scenes.length > 0) {
    const sceneLines = payload.scenes.map((scene) => {
      const title = toStringValue(scene.title) || `Scene ${scene.id ?? ''}`.trim();
      const type = toStringValue(scene.type);
      const description = toStringValue(scene.description);
      return `<li><strong>${escapeHtml(title)}</strong>${type ? ` (${escapeHtml(type)})` : ''}<br>${escapeHtml(description)}</li>`;
    });
    pages.push({
      name: 'Scene Outline',
      content: `<h2>Scenes</h2><ul>${sceneLines.join('')}</ul>`,
    });
  }

  if (payload.locations.length > 0) {
    const locationLines = payload.locations.map((location) => {
      const name = toStringValue(location.name) || 'Location';
      const type = toStringValue(location.type);
      const description = toStringValue(location.description);
      return `<li><strong>${escapeHtml(name)}</strong>${type ? ` (${escapeHtml(type)})` : ''}<br>${escapeHtml(description)}</li>`;
    });
    pages.push({
      name: 'Locations',
      content: `<h2>Locations</h2><ul>${locationLines.join('')}</ul>`,
    });
  }

  if (payload.items.length > 0) {
    const itemLines = payload.items.map((item) => {
      const name = toStringValue(item.name) || 'Item';
      const type = toStringValue(item.type);
      const description = toStringValue(item.description);
      return `<li><strong>${escapeHtml(name)}</strong>${type ? ` (${escapeHtml(type)})` : ''}<br>${escapeHtml(description)}</li>`;
    });
    pages.push({
      name: 'Item Notes',
      content: `<h2>Items</h2><ul>${itemLines.join('')}</ul>`,
    });
  }

  return pages;
}

function buildNpcDescription(npc) {
  const lines = [];
  const name = toStringValue(npc.name);
  if (name) lines.push(`Name: ${name}`);

  const role = toStringValue(npc.role);
  if (role) lines.push(`Rolle: ${role}`);

  const description = toStringValue(npc.description);
  if (description) lines.push(`Beschreibung: ${description}`);

  const motivation = toStringValue(npc.motivation);
  if (motivation) lines.push(`Motivation: ${motivation}`);

  const secrets = toStringValue(npc.secrets);
  if (secrets) lines.push(`Geheimnisse: ${secrets}`);

  const equipment = toArray(npc.equipment).filter((entry) => typeof entry === 'string');
  if (equipment.length > 0) lines.push(`Ausrustung: ${equipment.join(', ')}`);

  if (typeof npc.LeP === 'number') lines.push(`LeP ${npc.LeP}`);
  if (typeof npc.AsP === 'number') lines.push(`AsP ${npc.AsP}`);
  if (typeof npc.KaP === 'number') lines.push(`KaP ${npc.KaP}`);

  const attributes = isObject(npc.attributes) ? npc.attributes : {};
  const attrTokens = Object.entries(attributes)
    .map(([key, value]) => (typeof value === 'number' ? `${key.toUpperCase()} ${value}` : null))
    .filter(Boolean);
  if (attrTokens.length > 0) lines.push(`Attribute: ${attrTokens.join(', ')}`);

  const skills = toArray(npc.skills).filter(isObject);
  const skillTokens = skills
    .map((skill) => {
      const skillName = toStringValue(skill.name);
      if (!skillName) return null;
      if (typeof skill.value === 'number') return `${skillName} ${skill.value}`;
      return skillName;
    })
    .filter(Boolean);
  if (skillTokens.length > 0) lines.push(`Fertigkeiten: ${skillTokens.join(', ')}`);

  return lines.join('\n');
}

function toNumberOrUndefined(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function mapNpcAttributesToCustom(attributes) {
  const source = isObject(attributes) ? attributes : {};
  const read = (keys, fallback) => {
    for (const key of keys) {
      if (key in source) {
        const numeric = toNumberOrUndefined(source[key]);
        if (numeric !== undefined) return Math.round(numeric);
      }
    }
    return fallback;
  };

  return {
    mut: read(['mut', 'MU', 'mu'], 10),
    klugheit: read(['klugheit', 'KL', 'kl'], 10),
    intuition: read(['intuition', 'IN', 'in'], 10),
    charisma: read(['charisma', 'CH', 'ch'], 10),
    fingerfertigkeit: read(['fingerfertigkeit', 'FF', 'ff'], 10),
    gewandheit: read(['gewandheit', 'GE', 'ge'], 10),
    konstitution: read(['konstitution', 'KO', 'ko'], 10),
    koerperkraft: read(['koerperkraft', 'körperkraft', 'KK', 'kk'], 10),
  };
}

function buildCustomDsa5PayloadFromNpc(npc) {
  const name = toStringValue(npc.name) || 'Imported NPC';
  const role = toStringValue(npc.role);
  const description = toStringValue(npc.description);
  const motivation = toStringValue(npc.motivation);
  const secrets = toStringValue(npc.secrets);

  const equipment = toArray(npc.equipment)
    .filter((entry) => typeof entry === 'string')
    .map((entry) => ({ name: entry }));

  const skills = toArray(npc.skills).filter(isObject);
  const talente = skills
    .map((skill) => {
      const skillName = toStringValue(skill.name);
      if (!skillName) return null;
      const value = toNumberOrUndefined(skill.value);
      return value === undefined
        ? { name: skillName }
        : { name: skillName, talentwert: Math.round(value) };
    })
    .filter(Boolean);

  const noteParts = [description, motivation ? `Motivation: ${motivation}` : '', secrets ? `Secrets: ${secrets}` : '']
    .filter(Boolean);

  return {
    name,
    spezies: '',
    kultur: '',
    profession: role,
    sozialstatus: '',
    attribute: mapNpcAttributesToCustom(npc.attributes),
    energien: {
      lebensenergie: toNumberOrUndefined(npc.LeP) ?? 20,
      astralenergie: toNumberOrUndefined(npc.AsP) ?? 0,
      karmaenergie: toNumberOrUndefined(npc.KaP) ?? 0,
      schicksalspunkte: 3,
    },
    gmNotes: noteParts.join('\n'),
    talente,
    ['gegenst\u00e4nde']: equipment,
  };
}

function extractText(result) {
  if (!isObject(result) || !Array.isArray(result.content)) return '';
  return result.content
    .filter((entry) => isObject(entry) && typeof entry.text === 'string')
    .map((entry) => entry.text)
    .join('\n');
}

async function callTool(name, args) {
  const result = await mcpServer.callTool({ name, arguments: args });
  const text = extractText(result);
  if (!text) return null;
  if (text.startsWith('Error:')) {
    throw new Error(`${name} failed: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function tryTool(name, args) {
  try {
    const data = await callTool(name, args);
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function isMissingFoundryHandler(message) {
  return typeof message === 'string' && message.includes('No handler found for query');
}

function isLlmUnavailable(message) {
  if (typeof message !== 'string') return false;
  return (
    message.includes('Adventure extraction failed') ||
    message.includes('fetch failed') ||
    message.includes('LLM request failed')
  );
}

function extractCharacterNames(listCharactersResponse) {
  if (isObject(listCharactersResponse) && Array.isArray(listCharactersResponse.characters)) {
    return listCharactersResponse.characters
      .map((entry) => toStringValue(entry?.name))
      .filter(Boolean);
  }
  return [];
}

function extractSceneNames(listScenesResponse) {
  if (Array.isArray(listScenesResponse)) {
    return listScenesResponse.map((entry) => toStringValue(entry?.name)).filter(Boolean);
  }
  if (isObject(listScenesResponse) && Array.isArray(listScenesResponse.scenes)) {
    return listScenesResponse.scenes.map((entry) => toStringValue(entry?.name)).filter(Boolean);
  }
  return [];
}

function extractJournalNames(listJournalsResponse) {
  if (isObject(listJournalsResponse) && Array.isArray(listJournalsResponse.journals)) {
    return listJournalsResponse.journals
      .map((entry) => toStringValue(entry?.name))
      .filter(Boolean);
  }
  return [];
}

async function main() {
  console.log(`[START] Adventure import from JSON: ${inputPath}`);
  console.log(`[CONFIG] createScenes=${createScenes}, createActors=${createActors}, resolveActorItems=${resolveActorItems}`);

  const rawText = await readFile(inputPath, 'utf8');
  const rawPayload = JSON.parse(rawText);
  const payload = normalizeAdventurePayload(rawPayload);
  const title = toStringValue(payload.metadata.title) || basename(inputPath, '.json');

  await mcpServer.connect(transport);
  console.log('[OK] Connected to MCP server');

  const tools = await mcpServer.listTools();
  const availableToolNames = new Set((tools.tools || []).map((tool) => tool.name));
  const requiredTools = ['create-journal-entry', 'list-journals', 'list-characters', 'list-scenes'];
  if (createScenes) requiredTools.push('create-scene-placeholder');
  if (createActors) requiredTools.push('create-actor-from-description', 'import-dsa5-actor-from-json');

  const missing = requiredTools.filter((name) => !availableToolNames.has(name));
  if (missing.length > 0) {
    throw new Error(`Required tools missing: ${missing.join(', ')}`);
  }

  const journalPayload = {
    name: title,
    content: buildJournalContent(payload),
    additionalPages: buildSectionPages(payload),
  };

  const journalResult = await callTool('create-journal-entry', journalPayload);
  console.log(`[OK] Journal created: ${title}`);

  const sceneResults = [];
  let scenesUnsupported = false;
  if (createScenes) {
    for (const scene of payload.scenes) {
      const sceneTitle = toStringValue(scene.title);
      if (!sceneTitle) continue;
      const sceneDescriptionParts = [
        toStringValue(scene.description),
        toStringValue(scene.locationDescription),
      ].filter(Boolean);
      const response = await tryTool('create-scene-placeholder', {
        name: `${title} - ${sceneTitle}`,
        description: sceneDescriptionParts.join('\n\n'),
      });
      if (response.ok) {
        sceneResults.push({ name: `${title} - ${sceneTitle}`, result: response.data });
        console.log(`[OK] Scene created: ${title} - ${sceneTitle}`);
        continue;
      }

      if (isMissingFoundryHandler(response.error)) {
        scenesUnsupported = true;
        console.warn(`[WARN] Scene creation unsupported by current Foundry bridge handler. Skipping remaining scenes.`);
        break;
      }

      throw new Error(response.error);
    }
  }

  const actorResults = [];
  const actorErrors = [];
  if (createActors) {
    for (const npc of payload.npcs) {
      const name = toStringValue(npc.name);
      if (!name) continue;
      const description = buildNpcDescription(npc);
      const response = await tryTool('create-actor-from-description', {
        description,
        mode: 'import',
        resolveItems: resolveActorItems,
      });
      if (response.ok) {
        actorResults.push({ name, result: response.data });
        console.log(`[OK] Actor imported: ${name}`);
      } else {
        if (isLlmUnavailable(response.error)) {
          const fallbackPayload = buildCustomDsa5PayloadFromNpc(npc);
          const fallbackResponse = await tryTool('import-dsa5-actor-from-json', {
            jsonPayload: fallbackPayload,
            strategy: 'custom_dsa5',
            resolveItems: resolveActorItems,
            addToScene: false,
            updateExisting: false,
            strict: false,
          });
          if (fallbackResponse.ok) {
            actorResults.push({ name, result: fallbackResponse.data, fallback: 'import-dsa5-actor-from-json' });
            console.log(`[OK] Actor imported via fallback: ${name}`);
            continue;
          }
          actorErrors.push({ name, error: fallbackResponse.error, source: 'fallback' });
          console.warn(`[WARN] Actor fallback failed for ${name}: ${fallbackResponse.error}`);
          continue;
        }

        actorErrors.push({ name, error: response.error, source: 'create-actor-from-description' });
        console.warn(`[WARN] Actor import failed for ${name}: ${response.error}`);
      }
    }
  }

  const journalsAfter = await callTool('list-journals', {});
  const charactersAfter = await callTool('list-characters', {});
  const scenesAfterResult = await tryTool('list-scenes', {});

  const journalNames = extractJournalNames(journalsAfter);
  const characterNames = new Set(extractCharacterNames(charactersAfter));
  const sceneNames = new Set(
    scenesAfterResult.ok ? extractSceneNames(scenesAfterResult.data) : []
  );

  const successfullyImportedNpcNames = actorResults.map((entry) => entry.name);
  const missingNpcNames = successfullyImportedNpcNames
    .filter(Boolean)
    .filter((name) => !characterNames.has(name));

  const expectedSceneNames = payload.scenes
    .map((scene) => toStringValue(scene.title))
    .filter(Boolean)
    .map((sceneTitle) => `${title} - ${sceneTitle}`);
  const missingSceneNames = expectedSceneNames
    .filter(Boolean)
    .filter((sceneName) => !sceneNames.has(sceneName));

  const quality = {
    journalCreated: journalNames.includes(title),
    expectedNpcCount: payload.npcs.length,
    importedNpcCalls: actorResults.length,
    actorErrors,
    missingNpcNames,
    expectedSceneCount: payload.scenes.length,
    importedSceneCalls: sceneResults.length,
    sceneCheckAvailable: scenesAfterResult.ok,
    scenesUnsupported,
    missingSceneNames: scenesAfterResult.ok ? missingSceneNames : [],
  };

  console.log('\n[SUMMARY]');
  console.log(JSON.stringify({
    title,
    sourcePath: inputPath,
    journal: journalResult,
    scenesCreated: sceneResults.length,
    actorsImported: actorResults.length,
    quality,
    sceneListCheckError: scenesAfterResult.ok ? null : scenesAfterResult.error,
  }, null, 2));

  const qualityOk =
    quality.journalCreated &&
    quality.actorErrors.length === 0 &&
    quality.missingNpcNames.length === 0 &&
    (quality.sceneCheckAvailable ? quality.missingSceneNames.length === 0 : true);

  if (!qualityOk) {
    console.warn('\n[WARN] Import completed with quality gaps. See summary.');
  } else {
    console.log('\n[OK] Import quality checks passed.');
  }

  await mcpServer.close();
}

main().catch(async (error) => {
  console.error('[ERROR]', error instanceof Error ? error.message : String(error));
  try {
    await mcpServer.close();
  } catch {
    // ignore close errors
  }
  process.exit(1);
});
