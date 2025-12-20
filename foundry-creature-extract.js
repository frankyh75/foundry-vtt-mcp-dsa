// ===========================================
// DSA5 Creature Stats Extractor v2.0
// ===========================================
// Führe dieses Script in der Foundry Console (F12) aus
// um vollständige Kreatur-Statistiken zu extrahieren

const actorName = "ACTOR_NAME_HIER"; // Z.B. "Goblin", "Ork", "Wolf"

const actor = game.actors.getName(actorName);

if (!actor) {
  console.error(`❌ Actor "${actorName}" nicht gefunden!`);
  console.log("📋 Verfügbare Actors:");
  game.actors.forEach(a => console.log(`  - ${a.name} (${a.type})`));
} else {
  const system = actor.system;

  const stats = {
    // === BASISDATEN ===
    name: actor.name,
    type: actor.type,

    // === LEBENSENERGIE ===
    lep: {
      max: system.status?.wounds?.max,
      current: system.status?.wounds?.current
    },

    // === ATTRIBUTE ===
    attributes: {
      MU: system.characteristics?.mu?.value,
      KL: system.characteristics?.kl?.value,
      IN: system.characteristics?.in?.value,
      CH: system.characteristics?.ch?.value,
      FF: system.characteristics?.ff?.value,
      GE: system.characteristics?.ge?.value,
      KO: system.characteristics?.ko?.value,
      KK: system.characteristics?.kk?.value
    },

    // === VERTEIDIGUNG ===
    defense: {
      // VW = Verteidigungswert (Ausweichen ohne Waffe)
      VW: system.status?.defense?.value || system.status?.defense,

      // PA = Parade (mit Waffe)
      PA: system.status?.parry?.value || system.status?.parry,

      // Welcher Wert wird verwendet?
      defenseName: system.status?.defense ? 'VW (Ausweichen)' : 'PA (Parade)'
    },

    // === SCHUTZ & BEWEGUNG ===
    rs: system.status?.armour?.value || system.status?.armor?.value,
    gs: system.status?.speed?.value || system.status?.speed,
    size: system.status?.size?.value,

    // === AKTIONEN ===
    actions: system.status?.actions || system.actions || 1, // Fallback auf 1

    // === INITIATIVE ===
    ini: system.status?.initiative?.value || system.status?.initiative,

    // === WAFFEN (AT-Werte!) ===
    weapons: actor.items
      .filter(i => i.type === 'weapon' || i.type === 'meleeweapon' || i.type === 'rangeweapon')
      .map(w => ({
        name: w.name,
        type: w.type,
        at: w.system?.at?.value || w.system?.attack?.value || w.system?.at,
        tp: w.system?.damage?.value || w.system?.tp,
        reach: w.system?.reach?.value || w.system?.reach,
        // Vollständige system-Daten für Analyse
        systemData: w.system
      })),

    // === SONDERFERTIGKEITEN ===
    specialAbilities: actor.items
      .filter(i => i.type === 'specialability')
      .map(s => ({
        name: s.name,
        category: s.system?.category?.value,
        systemData: s.system
      })),

    // === ZAUBER ===
    spells: actor.items
      .filter(i => i.type === 'spell' || i.type === 'liturgy')
      .map(s => ({
        name: s.name,
        type: i.type,
        fw: s.system?.talentValue?.value || s.system?.level,
        systemData: s.system
      })),

    // === TALENTE (für Analyse) ===
    talents: actor.items
      .filter(i => i.type === 'skill' || i.type === 'talent')
      .slice(0, 5) // Nur erste 5 als Beispiel
      .map(t => ({
        name: t.name,
        fw: t.system?.talentValue?.value,
        systemData: t.system
      })),

    // === ROHES SYSTEM OBJECT (für Field Path Analyse) ===
    rawSystem: {
      status: system.status,
      details: system.details,
      // Nicht alles, nur relevante Teile
    }
  };

  console.log("✅ Creature Stats extrahiert:");
  console.log(JSON.stringify(stats, null, 2));

  // In Zwischenablage kopieren
  copy(JSON.stringify(stats, null, 2));
  console.log("📋 Stats in Zwischenablage kopiert!");

  // Zusammenfassung
  console.log("\n=== ZUSAMMENFASSUNG ===");
  console.log(`Name: ${stats.name}`);
  console.log(`Typ: ${stats.type}`);
  console.log(`LeP: ${stats.lep.max}`);
  console.log(`Verteidigung: ${stats.defense.VW || stats.defense.PA} (${stats.defense.defenseName})`);
  console.log(`RS: ${stats.rs}`);
  console.log(`GS: ${stats.gs}`);
  console.log(`Größe: ${stats.size}`);
  console.log(`Aktionen: ${stats.actions}`);
  console.log(`Waffen: ${stats.weapons.length}`);
  stats.weapons.forEach(w => {
    console.log(`  - ${w.name}: AT ${w.at}, TP ${w.tp}`);
  });
  console.log(`Sonderfertigkeiten: ${stats.specialAbilities.length}`);
  console.log(`Zauber: ${stats.spells.length}`);
}
