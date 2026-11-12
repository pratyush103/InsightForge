import type { IFPFFileEnvelope, InsightForgeProject } from '../types/project';

function slugify(value: string): string {
  const cleaned = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'project';
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'proj-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
}

/**
 * Packages an InsightForgeProject into an IFPFFileEnvelope, compresses it via GZIP
 * (with fallback to plain UTF-8 JSON if CompressionStream is unavailable), and triggers
 * a browser download as `<slug>.ifpf`.
 */
export async function exportProjectToIFPF(project: InsightForgeProject): Promise<void> {
  const canCompress = typeof CompressionStream !== 'undefined';

  const envelope: IFPFFileEnvelope = {
    format: 'IFPF',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    compressed: canCompress,
    project: {
      ...project,
      isSample: false,
      updatedAt: new Date().toISOString(),
    },
  };

  const jsonString = JSON.stringify(envelope, null, 2);
  let blob: Blob;

  if (canCompress) {
    try {
      const encoder = new TextEncoder();
      const inputBytes = encoder.encode(jsonString);
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(inputBytes);
          controller.close();
        },
      });
      const compressedStream = readable.pipeThrough(new CompressionStream('gzip'));
      const response = new Response(compressedStream);
      const buffer = await response.arrayBuffer();
      blob = new Blob([buffer], { type: 'application/octet-stream' });
    } catch {
      blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    }
  } else {
    blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  }

  const fileName = `${slugify(project.name || 'project')}.ifpf`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Reads an `.ifpf` or `.json` file, detects GZIP magic bytes (0x1f 0x8b) and decompresses
 * if needed, validates the project payload, assigns a fresh UID, and returns the hydrated
 * InsightForgeProject.
 */
export async function importProjectFromIFPF(file: File): Promise<InsightForgeProject> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let jsonText = '';
  const isGzipped = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;

  if (isGzipped) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser does not support DecompressionStream required for compressed .ifpf files.');
    }
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    const decompressedStream = readable.pipeThrough(new DecompressionStream('gzip'));
    const response = new Response(decompressedStream);
    jsonText = await response.text();
  } else {
    const decoder = new TextDecoder('utf-8');
    jsonText = decoder.decode(bytes);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid .ifpf file: Could not parse project JSON payload.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid .ifpf file: Root payload is not a valid object.');
  }

  const record = parsed as Record<string, unknown>;
  let rawProject: Partial<InsightForgeProject>;

  if (record.format === 'IFPF' && record.project && typeof record.project === 'object') {
    rawProject = record.project as Partial<InsightForgeProject>;
  } else if (typeof record.name === 'string' || Array.isArray(record.pages)) {
    rawProject = record as Partial<InsightForgeProject>;
  } else {
    throw new Error('Unrecognized .ifpf format: Missing IFPF envelope or project schema.');
  }

  const now = new Date().toISOString();
  const newId = generateUUID();

  const defaultPageId = 'page-1';
  const pages =
    Array.isArray(rawProject.pages) && rawProject.pages.length > 0
      ? rawProject.pages.map((p, idx) => ({
          id: p.id || `page-${idx + 1}`,
          title: p.title || `Page ${idx + 1}`,
          layoutPreset: p.layoutPreset || 'executive',
          widgets: Array.isArray(p.widgets) ? p.widgets : [],
          layouts: p.layouts && typeof p.layouts === 'object' ? p.layouts : {},
          crossFilter: p.crossFilter ?? null,
          widgetScopes: p.widgetScopes && typeof p.widgetScopes === 'object' ? p.widgetScopes : {},
        }))
      : [
          {
            id: defaultPageId,
            title: 'Page 1',
            layoutPreset: 'executive' as const,
            widgets: [],
            layouts: {},
            crossFilter: null,
            widgetScopes: {},
          },
        ];

  const activePageId =
    rawProject.activePageId && pages.some((p) => p.id === rawProject.activePageId)
      ? rawProject.activePageId
      : pages[0].id;

  const hydrated: InsightForgeProject = {
    id: newId,
    name: rawProject.name?.trim() || file.name.replace(/\.(ifpf|json)$/i, '') || 'Imported Project',
    description:
      rawProject.description ??
      'Imported from .ifpf project archive with semantic schema, relations, and visual layouts.',
    createdAt: rawProject.createdAt || now,
    updatedAt: now,
    isSample: false,
    activeConnectorId: rawProject.activeConnectorId || 'default_sqlite_commerce',
    dataSources: Array.isArray(rawProject.dataSources) ? rawProject.dataSources : [],
    embeddedCsvTables: Array.isArray(rawProject.embeddedCsvTables) ? rawProject.embeddedCsvTables : [],
    schemaCatalog: rawProject.schemaCatalog ?? null,
    virtualRelations: Array.isArray(rawProject.virtualRelations) ? rawProject.virtualRelations : [],
    pages,
    activePageId,
    conversationHistory: Array.isArray(rawProject.conversationHistory) ? rawProject.conversationHistory : [],
    manifest: rawProject.manifest ?? null,
  };

  return hydrated;
}
