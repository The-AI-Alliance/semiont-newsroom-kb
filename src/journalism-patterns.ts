/**
 * Pattern-based pre-filters for journalism source-attribution language.
 *
 * Helps `tag-source-type` pre-filter candidate spans for `mark.assist` to
 * confirm or reject. Generic across any investigation corpus.
 */

/** Named-attribution patterns: "X said", "X told the reporter", "according to X". */
const NAMED_ATTR_RE =
  /\b(?:according to|said|told|stated|noted|wrote|tweeted|posted|testified|confirmed|denied|added|argued|claimed|explained|reported|insisted|countered|asserted|admitted|acknowledged)\b/gi;

/** Anonymous-attribution patterns. Common newsroom shorthand. */
const ANONYMOUS_ATTR_RE =
  /\b(?:senior official|former official|administration official|White House official|career staffer|person familiar with|people familiar with|person briefed|three(?:\s+|-)\w+\s+(?:familiar|briefed)|anonymous (?:source|officials?)|(?:on|under) condition of anonymity|spoke on background|deep background|requested anonymity|not authorized to speak|declined to be named)\b/gi;

/** Document-attribution patterns: "according to a memo", "the document states", FOIA-style references. */
const DOCUMENT_ATTR_RE =
  /\b(?:according to (?:a |an |the )(?:memo|document|filing|report|email|letter|policy|brief|transcript|deposition|affidavit)|the (?:memo|document|filing|report|email|letter|policy|brief|transcript|deposition|affidavit) (?:states|says|notes|reads|reveals)|FOIA[-\s]?(?:response|release|production)|publicly (?:released|disclosed|filed))\b/gi;

/** Observation-based patterns: "the reporter observed", "during the visit". */
const OBSERVATION_ATTR_RE =
  /\b(?:the reporter (?:observed|noticed|saw|witnessed|met)|during the (?:visit|interview|tour|meeting)|in person|on site|on the scene|witnessed (?:firsthand|directly))\b/gi;

/** Redaction markers commonly seen in FOIA-released documents. */
const REDACTION_RE = /\[REDACTED\]|\[(?:redacted|REDACTED)[^\]]*\]|\(b\)\(\d\)/g;

export interface AttributionHit {
  kind: 'named' | 'anonymous' | 'document' | 'observation' | 'redaction';
  text: string;
  start: number;
  end: number;
}

export function findAttributions(text: string): AttributionHit[] {
  const hits: AttributionHit[] = [];
  const push = (kind: AttributionHit['kind'], re: RegExp): void => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      hits.push({ kind, text: m[0], start: m.index, end: m.index + m[0].length });
    }
  };
  push('named', NAMED_ATTR_RE);
  push('anonymous', ANONYMOUS_ATTR_RE);
  push('document', DOCUMENT_ATTR_RE);
  push('observation', OBSERVATION_ATTR_RE);
  push('redaction', REDACTION_RE);
  return hits.sort((a, b) => a.start - b.start);
}

export function summarizeAttributions(hits: AttributionHit[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const h of hits) counts[h.kind] = (counts[h.kind] ?? 0) + 1;
  return counts;
}
