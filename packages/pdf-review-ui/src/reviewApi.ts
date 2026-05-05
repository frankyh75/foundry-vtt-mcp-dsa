const API_BASE = 'http://192.168.178.133:4174';

export type SessionState = {
  sessionId: string;
  hasPdf: boolean;
  hasIr: boolean;
  pageCount: number;
  pdfName?: string;
  irName?: string;
  annotationCount: number;
  projectedIr?: {
    pages?: Array<{ pageNumber: number; width: number; height: number }>;
    blocks?: Array<{
      id: string;
      pageNumber: number;
      bbox: { x: number; y: number; w: number; h: number };
      readingOrder: number;
      blockType: string;
      textRaw: string;
    }>;
    sections?: Array<Record<string, unknown>>;
    entityCandidates?: Array<Record<string, unknown>>;
    entityStubs?: Array<Record<string, unknown>>;
  };
};

export type ConfigState = Record<string, unknown>;

export type ModelDiscovery = {
  providerPreset: string;
  baseUrl: string;
  models: Array<{ name: string; local: boolean; remoteHost?: string }>;
  localModels: string[];
  localChatModels: string[];
  warning?: string;
};

export type EngineStatus = {
  poppler: { available: boolean; tools: string[] };
  tesseract: { available: boolean };
  marker: { available: boolean };
  ollama: { available: boolean };
};

async function api(path: string, init?: RequestInit): Promise<Response> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`API ${path}: ${response.status} ${response.statusText}`);
  }
  return response;
}

export async function getHealth(): Promise<{ status: string; dataDir: string }> {
  const res = await api('/health');
  return res.json();
}

export async function getConfig(): Promise<ConfigState> {
  const res = await api('/config');
  return res.json();
}

export async function putConfig(config: ConfigState): Promise<ConfigState> {
  const res = await api('/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function getModels(): Promise<ModelDiscovery> {
  const res = await api('/models');
  return res.json();
}

export async function getEngines(): Promise<EngineStatus> {
  const res = await api('/engines');
  return res.json();
}

export async function getSession(sessionId: string): Promise<SessionState> {
  const res = await api(`/sessions/${encodeURIComponent(sessionId)}`);
  return res.json();
}

export async function putPdf(sessionId: string, file: File, onProgress?: (progress: number) => void): Promise<{ ok: boolean; sessionId: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/pdf`);
    xhr.setRequestHeader('X-Filename', file.name);
    xhr.setRequestHeader('Content-Type', 'application/pdf');
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(e.loaded / e.total);
        }
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed: network error'));
    xhr.send(file);
  });
}

export async function postAnalyze(sessionId: string, config: ConfigState): Promise<{ ok: boolean; sessionId: string; pageCount: number; projectedIr: unknown }> {
  const res = await api(`/sessions/${encodeURIComponent(sessionId)}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  });
  return res.json();
}

export function getPageImageUrl(sessionId: string, pageNumber: number): string {
  return `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/pages/${pageNumber}.png`;
}
