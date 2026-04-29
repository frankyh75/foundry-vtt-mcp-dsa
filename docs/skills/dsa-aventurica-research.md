---
title: DSA Aventurica Research Skill
purpose: Local-first research helper for Wiki Aventurica when building DSA adventures with a local LLM
compatibility:
  - LM Studio
  - Open WebUI
  - OpenAI-compatible local clients
  - any chat client that can preload a markdown prompt
mode: local-first
---

# DSA Aventurica Research Skill

This repository skill helps a **local LLM** research DSA lore from **Wiki Aventurica** for adventure writing, NPC prep, location research, chronology, and Foundry VTT support.

## Use this skill when

- you need canon-relevant DSA lore
- you need quick summaries of persons, places, organizations, events, or publications
- you need a stable source-backed answer for adventure prep
- you want to avoid model guesswork

## Do not use this skill as

- a general web-search tool
- a copy-paste machine for large wiki passages
- a replacement for canon checking
- a source for anything that the page itself does not support

## Operating principle

1. Find the most relevant Wiki Aventurica page.
2. Extract only the facts that matter for the current question.
3. Summarize compactly.
4. Mark ambiguities and conflicting information explicitly.
5. Always return sources.

## Local LLM usage

This skill is designed to work **without Hermes**.

### Recommended setup

- Use a local model in LM Studio, Open WebUI, or another OpenAI-compatible local client.
- Load this file as pinned context, custom instructions, or system prompt material.
- Ask the model to follow the skill output format below.

### Example prompt to the local LLM

```text
Benutze die DSA-Aventurica-Research-Regeln aus dem Projekt.
Recherchiere die kanonisch relevanten Infos zu <Begriff> für ein DSA-Abenteuer.
Gib nur eine kurze, quellengestützte Zusammenfassung zurück.
```

## Output format

Return answers in this structure:

- **Query:** original request
- **Match:** best page or pages
- **Summary:** 3–6 bullets
- **Canon notes:** relevant constraints or canon details
- **Uncertainty:** ambiguous or conflicting points
- **Sources:** page URLs

## Quality rules

- Prefer paraphrase over quotation.
- Keep answers short and usable in adventure prep.
- Distinguish canon from fan / inofficial / unclear content.
- If a page does not support a claim, say so.
- Do not invent lore, dates, names, or relationships.

## Best use in this repo

This skill complements the Foundry pipeline by providing a source-backed lore layer before:

- adventure extraction
- NPC creation
- scene prep
- location notes
- journal synthesis
- IR / JSON enrichment

## Example answer shape

```text
Query: Wer ist X?
Match: Wiki Aventurica – X
Summary:
- ...
- ...
Canon notes:
- ...
Uncertainty:
- ...
Sources:
- https://de.wiki-aventurica.de/wiki/...
```
