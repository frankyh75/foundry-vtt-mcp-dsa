# Adventure Import Example

> Beispiel für die Adventure-Import-Pipeline. Das ist ein synthetisches Beispiel, keine echte Copyright-Vorlage.

## Input

```text
Titel: Deiches Schatten

Im Hafenviertel von Al'Anfa sprechen die Fischer von seltsamen Lichtern im Nebel.
Die Wirtin Hilde weiß mehr, als sie zunächst zugibt.
Ein alter Kontorraum am Kai verbirgt den eigentlichen Einstieg in die Verschwörung.
```

## Erwartete Extraktion

```json
{
  "metadata": {
    "title": "Deiches Schatten",
    "type": "adventure",
    "language": "de",
    "source": "text-import",
    "system": "DSA5"
  },
  "chapters": [
    {
      "title": "Einstieg am Hafen",
      "summary": "Die Helden erfahren von merkwürdigen Lichtern im Nebel.",
      "linkedNpcs": ["Hilde"]
    }
  ],
  "npcs": [
    {
      "name": "Hilde",
      "role": "Wirtin",
      "motivation": "Schützt jemanden im Hafenviertel"
    }
  ],
  "warnings": [
    "Ort und Motiv sind aus dem Text nur indirekt ableitbar"
  ]
}
```

## Empfohlene Folgeaktionen

1. `import-dsa5-adventure-from-text` im Modus `dry-run`
2. Ergebnis prüfen
3. `import-dsa5-adventure-from-text` im Modus `import`
4. Resultat in Foundry kontrollieren

## Warum das Beispiel absichtlich simpel ist

- Es demonstriert die Schema-Form, nicht die ganze DSA5-Regelwelt.
- Es vermeidet Halluzinationen von Stats oder Fertigkeiten.
- Es eignet sich als Test-Fixture für die Pipeline.
