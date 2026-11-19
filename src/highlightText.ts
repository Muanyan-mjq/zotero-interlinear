// SPDX-License-Identifier: AGPL-3.0-or-later
// Interlinear — heuristic mapping of a source selection onto its translation.

export interface Span {
  start: number;
  end: number;
  text: string;
}

/** Sentence end followed by a word boundary, so decimals stay intact. */
const TERMINATOR = /[.!?;。！？；…]+["'”’)\]]*(?=\s|$|[A-Z\u4e00-\u9fff])/g;
const ABBREVIATION =
  /(?:^|\s)(?:[a-z]\.){2,}$|(?:^|\s)(?:Mr|Mrs|Ms|Dr|Prof|Fig|Eq|No|Vol|pp|al|vs|etc)\.$|(?:^|\s)[A-Z]\.$/;
const WORD_FALLBACK = /\p{Script=Han}|[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|./gu;

function pushSpan(spans: Span[], text: string, start: number, end: number): void {
  const raw = text.slice(start, end);
  const value = raw.trim();
  if (!value) return;
  const leading = raw.length - raw.trimStart().length;
  spans.push({
    start: start + leading,
    end: start + leading + value.length,
    text: value,
  });
}

export function splitSentences(text: string): Span[] {
  const spans: Span[] = [];
  let start = 0;
  TERMINATOR.lastIndex = 0;
  for (let match = TERMINATOR.exec(text); match; match = TERMINATOR.exec(text)) {
    if (ABBREVIATION.test(text.slice(start, match.index + 1))) continue;
    const end = match.index + match[0].length;
    pushSpan(spans, text, start, end);
    start = end;
  }
  pushSpan(spans, text, start, text.length);
  return spans;
}

/**
 * Words when a segmenter is available, otherwise one Han character per unit so
 * a Chinese translation still gets fine-grained positions.
 */
export function splitWords(text: string): Span[] {
  const spans: Span[] = [];
  if (!text) return spans;
  const win: any = typeof globalThis !== "undefined" ? globalThis : null;
  const Segmenter = (win as any)?.Intl?.Segmenter;
  if (typeof Segmenter === "function") {
    try {
      const segmenter = new Segmenter(undefined, { granularity: "word" });
      for (const part of segmenter.segment(text) as Iterable<{
        segment: string;
        index: number;
        isWordLike?: boolean;
      }>) {
        if (!part?.segment) continue;
        const start = part.index;
        const end = start + part.segment.length;
        if (!part.segment.trim()) continue;
        const leading = part.segment.length - part.segment.trimStart().length;
        spans.push({
          start: start + leading,
          end: start + leading + part.segment.trim().length,
          text: part.segment.trim(),
        });
      }
      if (spans.length) return spans;
    } catch (_) {
      // Fall through to the regex splitter.
    }
  }
  WORD_FALLBACK.lastIndex = 0;
  for (const match of text.matchAll(WORD_FALLBACK)) {
    if (!match[0].trim()) continue;
    spans.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
  }
  return spans;
}

/** Float position of an offset in units: 3.4 means "40% into the fourth unit". */
function unitPosition(text: string, units: Span[], offset: number): number {
  if (!units.length) return text.length ? offset / text.length : 0;
  const index = units.findIndex((unit) => offset < unit.end);
  if (index < 0) return units.length;
  const unit = units[index];
  if (offset <= unit.start) return index;
  const width = Math.max(1, unit.end - unit.start);
  return index + Math.min(1, (offset - unit.start) / width);
}

function offsetAtUnitPosition(text: string, units: Span[], position: number): number {
  if (!units.length) return Math.round(Math.min(1, Math.max(0, position)) * text.length);
  if (position <= 0) return 0;
  if (position >= units.length) return text.length;
  const index = Math.min(units.length - 1, Math.floor(position));
  const fraction = position - index;
  const unit = units[index];
  return Math.round(unit.start + fraction * Math.max(1, unit.end - unit.start));
}

interface Knot {
  source: number;
  target: number;
}

/**
 * Pair sentence boundaries so whole sentences land on whole sentences even when
 * the two texts were split into different numbers of sentences.
 */
function buildKnots(
  sourceText: string,
  translationText: string,
  sourceSentences: Span[],
  translationSentences: Span[],
): Knot[] {
  const sourceLength = sourceText.length;
  const translationLength = translationText.length;
  const knots: Knot[] = [{ source: 0, target: 0 }];

  if (sourceSentences.length === translationSentences.length) {
    for (let index = 0; index < sourceSentences.length; index += 1) {
      knots.push({
        source: sourceSentences[index].end,
        target: translationSentences[index].end,
      });
    }
    return knots;
  }

  let previousTarget = 0;
  for (const sentence of sourceSentences) {
    const fraction = sentence.end / sourceLength;
    let bestTarget = previousTarget;
    let bestDistance = Infinity;
    for (const candidate of translationSentences) {
      if (candidate.end <= previousTarget) continue;
      const distance = Math.abs(candidate.end / translationLength - fraction);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestTarget = candidate.end;
      }
    }
    if (bestTarget > previousTarget) {
      knots.push({ source: sentence.end, target: bestTarget });
      previousTarget = bestTarget;
    }
  }

  const last = knots[knots.length - 1];
  if (last.source < sourceLength) {
    knots.push({ source: sourceLength, target: translationLength });
  } else {
    last.target = translationLength;
  }
  return knots;
}

function mapOffset(
  offset: number,
  knots: Knot[],
  sourceText: string,
  translationText: string,
  sourceUnits: Span[],
  translationUnits: Span[],
): number {
  let low = 0;
  let high = 0;
  for (let index = 1; index < knots.length; index += 1) {
    if (knots[index].source <= offset) {
      low = index;
    } else {
      high = index;
      break;
    }
  }
  if (high === 0) {
    const last = knots[knots.length - 1];
    return last.target;
  }
  const from = knots[low];
  const to = knots[high];
  const width = to.source - from.source;
  if (width <= 0) return to.target;

  // Units keep "three words of twenty" proportional in English while Han
  // characters act as their own units in the translation.
  const sourceUnitsInside = sourceUnits.filter(
    (unit) => unit.start >= from.source && unit.end <= to.source,
  );
  const translationUnitsInside = translationUnits.filter(
    (unit) => unit.start >= from.target && unit.end <= to.target,
  );
  if (sourceUnitsInside.length && translationUnitsInside.length) {
    const fraction =
      unitPosition(sourceText, sourceUnitsInside, offset) / Math.max(1, sourceUnitsInside.length);
    const clamped = Math.min(1, Math.max(0, fraction));
    const absolute = offsetAtUnitPosition(
      translationText,
      translationUnitsInside,
      clamped * translationUnitsInside.length,
    );
    return Math.min(to.target, Math.max(from.target, absolute));
  }
  return Math.round(from.target + ((offset - from.source) / width) * (to.target - from.target));
}

/** Nudge a boundary so a Latin word is never split in the middle. */
function snapToWord(text: string, offset: number, direction: "start" | "end"): number {
  const units = splitWords(text);
  if (!units.length) return offset;
  for (const unit of units) {
    if (offset > unit.start && offset < unit.end) {
      if (/\s/u.test(unit.text) || unit.text.length === 1) return offset;
      return direction === "start" ? unit.start : unit.end;
    }
  }
  return offset;
}

export function mapSelectionToTranslation(
  selectionStart: number,
  selectionEnd: number,
  sourceText: string,
  translationText: string,
): Span | null {
  if (!sourceText || !translationText) return null;
  if (!(selectionEnd > selectionStart)) return null;

  const sourceSentences = splitSentences(sourceText);
  const translationSentences = splitSentences(translationText);
  if (!sourceSentences.length || !translationSentences.length) return null;

  const knots = buildKnots(sourceText, translationText, sourceSentences, translationSentences);
  const sourceUnits = splitWords(sourceText);
  const translationUnits = splitWords(translationText);
  const clampedStart = Math.min(sourceText.length, Math.max(0, selectionStart));
  const clampedEnd = Math.min(sourceText.length, Math.max(clampedStart, selectionEnd));

  const mappedStart = mapOffset(
    clampedStart,
    knots,
    sourceText,
    translationText,
    sourceUnits,
    translationUnits,
  );
  const mappedEnd = mapOffset(
    clampedEnd,
    knots,
    sourceText,
    translationText,
    sourceUnits,
    translationUnits,
  );

  const start = Math.max(0, Math.min(translationText.length - 1, snapToWord(translationText, mappedStart, "start")));
  const end = Math.max(
    start + 1,
    Math.min(translationText.length, snapToWord(translationText, mappedEnd, "end")),
  );
  return { start, end, text: translationText.slice(start, end) };
}
