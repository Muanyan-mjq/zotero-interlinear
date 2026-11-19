// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — protect formulas/code and render translation markup safely.

const PROTECTED =
  /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|`[^`\n]+`|https?:\/\/[^\s<>"'）)\]]+)/g;

const TOKEN =
  /⟦\s*IL\s*(\d+)\s*⟧|\[\[\s*IL\s*(\d+)\s*\]\]|【\s*IL\s*(\d+)\s*】/gi;

const INLINE =
  /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g;

export interface ProtectedSpans {
  text: string;
  tokens: string[];
}

export type TranslationTokenType =
  | "text"
  | "strong"
  | "em"
  | "code"
  | "math";

export interface TranslationToken {
  type: TranslationTokenType;
  value: string;
}

/**
 * Replace formulas, inline code and URLs with opaque tokens so a translator
 * cannot rewrite them. Tokens are short ASCII, which survives most engines.
 */
export function maskProtectedSpans(text: string): ProtectedSpans {
  const tokens: string[] = [];
  const masked = text.replace(PROTECTED, (match) => {
    const token = `⟦IL${tokens.length}⟧`;
    tokens.push(match);
    return token;
  });
  return { text: masked, tokens };
}

function tokenIndex(match: string): number {
  return Number(
    match
      .replace(/^[[【⟦\s]+/u, "")
      .replace(/[\]】⟧\s]+$/u, "")
      .replace(/^IL/iu, ""),
  );
}

export function restoreProtectedSpans(text: string, tokens: string[]): string {
  return text.replace(TOKEN, (match) => {
    const index = tokenIndex(match);
    return tokens[index] ?? "";
  });
}

function stripMathDelimiters(raw: string): string {
  if (raw.startsWith("$$")) return raw.slice(2, -2);
  if (raw.startsWith("\\(") || raw.startsWith("\\[")) return raw.slice(2, -2);
  if (raw.startsWith("$")) return raw.slice(1, -1);
  return raw;
}

export function tokenizeTranslation(text: string): TranslationToken[] {
  const tokens: TranslationToken[] = [];
  let last = 0;
  INLINE.lastIndex = 0;
  for (let match = INLINE.exec(text); match; match = INLINE.exec(text)) {
    if (match.index > last) {
      tokens.push({ type: "text", value: text.slice(last, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith("`")) {
      tokens.push({ type: "code", value: raw.slice(1, -1) });
    } else if (raw.startsWith("**")) {
      tokens.push({ type: "strong", value: raw.slice(2, -2) });
    } else if (raw.startsWith("*")) {
      tokens.push({ type: "em", value: raw.slice(1, -1) });
    } else {
      tokens.push({ type: "math", value: stripMathDelimiters(raw) });
    }
    last = match.index + raw.length;
  }
  if (last < text.length) {
    tokens.push({ type: "text", value: text.slice(last) });
  }
  return tokens;
}

/**
 * Build translation content without innerHTML: model output can contain
 * literal HTML, which must stay visible text rather than become markup.
 */
export function renderTranslationFragment(
  doc: Document,
  text: string,
): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  for (const token of tokenizeTranslation(text)) {
    if (token.type === "text") {
      fragment.append(doc.createTextNode(token.value));
      continue;
    }
    const tag =
      token.type === "strong"
        ? "strong"
        : token.type === "em"
          ? "em"
          : token.type === "code"
            ? "code"
            : "span";
    const element = doc.createElement(tag);
    if (token.type === "math") element.className = "interlinear-math";
    element.textContent = token.value;
    fragment.append(element);
  }
  return fragment;
}

const LEADING_LABEL = /^(?:译文|翻译|中文译文|参考译文|Translation|Translated text)\s*[：:]\s*/iu;
const ANSWER_TAG = /<\/?answer\b[^>]*>/giu;
const FENCE = /^```[\w+-]*\s*\n([\s\S]*?)\n?```$/u;
// Only straight ASCII quotes: models add those as wrappers, while curly quotes
// usually belong to the prose itself and must survive.
const QUOTE_PAIRS: Array<[string, string]> = [['"', '"']];

/**
 * Clean the cosmetic wrappers models like to add. Only shapes that are
 * unambiguous are removed, so real prose keeps its punctuation.
 */
export function sanitizeModelOutput(raw: string): string {
  let text = String(raw ?? "").trim();
  if (!text) return "";

  const fenced = FENCE.exec(text);
  if (fenced) text = fenced[1].trim();

  text = text.replace(ANSWER_TAG, "").trim();
  // A nested wrapper such as "<translation>...</translation>" without the
  // answer tag still leaves stray angle tags; drop a single outer tag pair.
  const outer = /^<([a-z][\w-]*)\b[^>]*>([\s\S]*)<\/\1>$/iu.exec(text);
  if (outer && !/<[a-z!]/iu.test(outer[2])) text = outer[2].trim();

  text = text.replace(LEADING_LABEL, "").trim();

  for (const [open, close] of QUOTE_PAIRS) {
    if (
      text.length > 2 &&
      text.startsWith(open) &&
      text.endsWith(close) &&
      !text.slice(1, -1).includes(close)
    ) {
      text = text.slice(1, -1).trim();
      break;
    }
  }

  return text.replace(/\n{3,}/gu, "\n\n").trim();
}