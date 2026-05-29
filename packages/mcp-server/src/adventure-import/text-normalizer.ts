const isPageMarker = (line: string): boolean => {
  return /^seite\s*\d+$/i.test(line) || /^\d+$/.test(line) || /^-?\s*\d+\s*-?$/.test(line);
};

const isLikelyHeaderFooter = (line: string, count: number): boolean => {
  if (isPageMarker(line)) return true;
  if (count < 2) return false;
  if (line.length > 80) return false;
  return !/[.!?…:]$/.test(line);
};

export const normalizeAdventureText = (rawText: string): string => {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim());

  const frequency = new Map<string, number>();
  for (const line of lines) {
    if (!line) continue;
    frequency.set(line, (frequency.get(line) ?? 0) + 1);
  }

  const cleaned: string[] = [];
  let previousBlank = false;

  for (const line of lines) {
    if (!line) {
      if (!previousBlank && cleaned.length > 0) {
        cleaned.push('');
      }
      previousBlank = true;
      continue;
    }

    previousBlank = false;
    const count = frequency.get(line) ?? 0;
    if (isLikelyHeaderFooter(line, count)) continue;

    cleaned.push(line);
  }

  while (cleaned.length > 0 && cleaned[0] === '') cleaned.shift();
  while (cleaned.length > 0 && cleaned[cleaned.length - 1] === '') cleaned.pop();

  return cleaned.join('\n');
};

export const chunkAdventureText = (rawText: string, maxChunkSize = 4000): string[] => {
  const normalized = normalizeAdventureText(rawText);
  if (!normalized.trim()) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }

    const candidate = `${current}\n\n${paragraph}`;
    if (candidate.length <= maxChunkSize) {
      current = candidate;
    } else {
      chunks.push(current);
      current = paragraph;
    }
  }

  if (current) chunks.push(current);
  return chunks;
};
