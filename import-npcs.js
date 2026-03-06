// DSA5 NPC Import - Vorlage für Cline
// Führe dies in Cline Schritt für Schritt aus

console.log(`
=== DSA5 NPC IMPORT ANLEITUNG ===

SCHRITT 1: Compendiums auflisten
---------------------------------
In Cline ausführen:
list-compendium-packs()

Suche nach Actor-Packs (type: "Actor")


SCHRITT 2: Archetypen finden
-----------------------------
Für jeden NPC suchst du einen passenden Archetyp:

BEISPIELE:
- Alsilio (Kind): Such nach "Kind", "Bürger", "Mensch"
- Elidan (Bauer): Such nach "Bauer", "Bürger", "Mensch" 
- Karlitha (Hexe): Such nach "Hexe", "Magier", "Zauberin"
- Thorbold (Krieger): Such nach "Krieger", "Thorwaler", "Söldner"


SCHRITT 3: Such-Beispiele für Cline
------------------------------------
search-compendium(name: "bürger", packType: "Actor")
search-compendium(name: "krieger", packType: "Actor")
search-compendium(name: "hexe", packType: "Actor")
search-compendium(name: "kind", packType: "Actor")


SCHRITT 4: NPCs erstellen (nachdem du IDs gefunden hast)
-----------------------------------------------------------------
create-actor-from-compendium(
  packId: "dsa5.npcs",
  itemId: "<ID aus Suche>",
  names: ["Elidan"]
)

Für mehrere gleiche NPCs (z.B. Thorwaler):
create-actor-from-compendium(
  packId: "dsa5.npcs", 
  itemId: "<Thorwaler Archetyp ID>",
  names: ["Thorwaler 1", "Thorwaler 2", "Thorwaler 3", "Thorwaler 4"]
)
`);
