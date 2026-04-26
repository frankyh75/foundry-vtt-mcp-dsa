import { createHash } from 'node:crypto';

function hashParts(parts: Array<string | number | undefined | null>): string {
  const hash = createHash('sha256');
  for (const part of parts) {
    hash.update('\u001f');
    hash.update(String(part ?? ''));
  }
  return hash.digest('hex').slice(0, 16);
}

export function createDocumentId(sourcePath: string, sourceHash: string): string {
  return `doc:${hashParts([sourcePath, sourceHash])}`;
}

export function createPageId(sourcePath: string, pageNumber: number): string {
  return `page:${pageNumber}:${hashParts([sourcePath, pageNumber])}`;
}

export function createRawBlockId(sourcePath: string, pageNumber: number, blockIndex: number, textRaw: string): string {
  return `rawblock:${pageNumber}:${blockIndex}:${hashParts([sourcePath, pageNumber, blockIndex, textRaw])}`;
}

export function createBlockId(sourcePath: string, pageNumber: number, blockIndex: number, textRaw: string): string {
  return `block:${pageNumber}:${blockIndex}:${hashParts([sourcePath, pageNumber, blockIndex, textRaw])}`;
}

export function createSectionId(sourcePath: string, title: string, sourceBlockIds: string[]): string {
  return `section:${hashParts([sourcePath, title, ...sourceBlockIds])}`;
}

export function createAnnotationId(sourcePath: string, targetId: string, action: string, createdAt: string): string {
  return `annotation:${hashParts([sourcePath, targetId, action, createdAt])}`;
}

export function createEntityCandidateId(
  sourcePath: string,
  entityType: string,
  label: string,
  sourceBlockIds: string[],
): string {
  return `candidate:${entityType}:${hashParts([sourcePath, entityType, label, ...sourceBlockIds])}`;
}

export function createEntityStubId(sourcePath: string, stubType: string, label: string, sourceBlockIds: string[]): string {
  return `stub:${stubType}:${hashParts([sourcePath, stubType, label, ...sourceBlockIds])}`;
}

export function createImportPlanId(sourcePath: string, targetType: string, sourceEntityId: string): string {
  return `import:${targetType}:${hashParts([sourcePath, targetType, sourceEntityId])}`;
}
