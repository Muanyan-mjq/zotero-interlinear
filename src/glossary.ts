// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — glossary parsing, serialization and prompt directives.

export interface GlossaryEntry {
  source: string;
  target: string;
}

export const MAX_GLOSSARY_SOURCE_LENGTH = 200;
export const MAX_GLOSSARY_TARGET_LENGTH = 200;
export const MAX_GLOSSARY_ENTRIES = 2000;
export const DEFAULT_GLOSSARY_DIRECTIVE_BUDGET = 3000;

const HEADER_SOURCE_LABELS = new Set(["source", "原文", "术语", "源术语"]);
const HEADER_TARGET_LABELS = new Set(["target", "译文", "译法", "目标术语"]);

function detectDelimiter(text: string): string {
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    return line.includes("\t") ? "\t" : ",";
  }
  return ",";
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let atFieldStart = true;
  let atRecordStart = true;
  let skipLine = false;

  const endField = () => {
    row.push(field);
    field = "";
    atFieldStart = true;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
    atRecordStart = true;
    atFieldStart = true;
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (skipLine) {
      if (char === "\r" || char === "\n") {
        if (char === "\r" && text[index + 1] === "\n") {
          index++;
        }
        skipLine = false;
      }
      continue;
    }

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          inQuotes = false;
          atFieldStart = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && atFieldStart) {
      inQuotes = true;
      atRecordStart = false;
      continue;
    }
    if (char === delimiter) {
      endField();
      atRecordStart = false;
      continue;
    }
    if (char === "\r" || char === "\n") {
      if (char === "\r" && text[index + 1] === "\n") {
        index++;
      }
      endRow();
      continue;
    }
    if (char === "#" && atRecordStart) {
      skipLine = true;
      continue;
    }

    field += char;
    atFieldStart = false;
    atRecordStart = false;
  }

  if (field !== "" || row.length > 0) {
    endRow();
  }
  return rows;
}

function isHeaderRow(row: readonly string[]): boolean {
  if (row.length < 2) {
    return false;
  }
  const source = row[0].trim().toLowerCase();
  const target = row[1].trim().toLowerCase();
  return HEADER_SOURCE_LABELS.has(source) && HEADER_TARGET_LABELS.has(target);
}

export function normalizeGlossary(entries: readonly GlossaryEntry[]): GlossaryEntry[] {
  const normalized = new Map<string, GlossaryEntry>();
  for (const entry of entries) {
    const source = typeof entry?.source === "string" ? entry.source.trim() : "";
    const target = typeof entry?.target === "string" ? entry.target.trim() : "";
    if (!source || !target) {
      continue;
    }
    if (
      source.length > MAX_GLOSSARY_SOURCE_LENGTH ||
      target.length > MAX_GLOSSARY_TARGET_LENGTH
    ) {
      continue;
    }
    // Last duplicate wins and moves to the end so the newest translation is used.
    normalized.delete(source);
    normalized.set(source, { source, target });
  }
  return [...normalized.values()].slice(0, MAX_GLOSSARY_ENTRIES);
}

export function parseGlossary(text: string): GlossaryEntry[] {
  if (!text.trim()) {
    return [];
  }
  const delimiter = detectDelimiter(text);
  const rows = parseDelimited(text, delimiter);
  const entries: GlossaryEntry[] = [];
  let headerChecked = false;

  for (const row of rows) {
    if (row.every((cell) => cell.trim() === "")) {
      continue;
    }
    if (!headerChecked) {
      headerChecked = true;
      if (isHeaderRow(row)) {
        continue;
      }
    }
    if (row.length < 2) {
      continue;
    }
    entries.push({ source: row[0], target: row[1] });
  }
  return normalizeGlossary(entries);
}

function quoteCsvField(value: string): string {
  return /[",\n\r]/u.test(value) ? `"${value.replace(/"/gu, '""')}"` : value;
}

export function serializeGlossary(entries: readonly GlossaryEntry[]): string {
  const normalized = normalizeGlossary(entries);
  const lines = ["source,target"];
  for (const entry of normalized) {
    lines.push(`${quoteCsvField(entry.source)},${quoteCsvField(entry.target)}`);
  }
  return `${lines.join("\n")}\n`;
}

export function glossaryHash(entries: readonly GlossaryEntry[]): string {
  const normalized = normalizeGlossary(entries);
  if (normalized.length === 0) {
    return "";
  }
  const payload = normalized
    .map((entry) => `${entry.source}\u0000${entry.target}`)
    .join("\u0001");
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index++) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

const DIRECTIVE_HEADER =
  "以下是本文档的术语表。翻译时必须严格使用表中的译法，保持术语前后一致：";
const DIRECTIVE_FOOTER =
  "注意：以上术语必须逐条遵守；未列出的术语请按原文含义翻译。";

export function buildGlossaryDirective(
  entries: readonly GlossaryEntry[],
  maxLength: number = DEFAULT_GLOSSARY_DIRECTIVE_BUDGET,
): string {
  const normalized = normalizeGlossary(entries);
  if (normalized.length === 0) {
    return "";
  }

  const lines: string[] = [];
  let used = DIRECTIVE_HEADER.length;
  let omitted = 0;

  for (let index = 0; index < normalized.length; index++) {
    const entry = normalized[index];
    const line = `- ${entry.source} => ${entry.target}`;
    const estimated = used + 1 + line.length + 1 + DIRECTIVE_FOOTER.length;
    if (estimated > maxLength) {
      omitted = normalized.length - index;
      break;
    }
    lines.push(line);
    used += 1 + line.length;
  }

  const parts = [DIRECTIVE_HEADER, ...lines];
  if (omitted > 0) {
    parts.push(`（另有 ${omitted} 条术语未列入）`);
  }
  parts.push(DIRECTIVE_FOOTER);
  return parts.join("\n");
}
