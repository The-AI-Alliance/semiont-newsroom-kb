/**
 * balance-audit — per-topic named-vs-anonymous source distribution.
 *
 * Usage: tsx skills/balance-audit/script.ts [--interactive]
 */

import { SemiontSession, InMemorySessionStorage, resourceId as ridBrand, type KnowledgeBase } from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

const NAMED_THRESHOLD = Number(process.env.NAMED_THRESHOLD ?? 0.4);

interface AnnoSpan {
  rId: string;
  start: number;
  end: number;
  tags: string[];
}

function getMediaType(r: any): string | undefined {
  const reps = Array.isArray(r.representations)
    ? r.representations
    : r.representations
      ? [r.representations]
      : [];
  return reps[0]?.mediaType;
}

function parseSpan(ann: any): { start: number; end: number } | null {
  const sel = ann.target?.selector;
  if (sel && typeof sel.start === 'number' && typeof sel.end === 'number') {
    return { start: sel.start, end: sel.end };
  }
  return null;
}

async function main(): Promise<void> {
  const baseUrl = process.env.SEMIONT_API_URL ?? 'http://localhost:4000';
  const email = process.env.SEMIONT_USER_EMAIL!;
  const password = process.env.SEMIONT_USER_PASSWORD!;
  const u = new URL(baseUrl);
  const kb: KnowledgeBase = {
    id: 'newsroom-balance-audit',
    label: 'newsroom balance-audit',
    email,
    endpoint: { kind: 'http', host: u.hostname, port: Number(u.port) || 4000, protocol: u.protocol.replace(':', '') as 'http' | 'https' },
  };
  const session = await SemiontSession.signInHttp({ kb, storage: new InMemorySessionStorage(), baseUrl, email, password });
  const semiont = session.client;

  const all = await semiont.browse.resources({ limit: 1000 });
  const markdown = all.filter((r) => {
    const mt = getMediaType(r);
    return mt === 'text/markdown' || mt === 'text/plain';
  });

  // Collect topic spans and source-type spans, per-resource
  const topicSpans = new Map<string, AnnoSpan[]>();
  const sourceTypeSpans = new Map<string, AnnoSpan[]>();

  for (const r of markdown) {
    const rId = r['@id'];
    const annos = await semiont.browse.annotations(ridBrand(rId));
    const topics: AnnoSpan[] = [];
    const sourceTypes: AnnoSpan[] = [];
    for (const ann of annos) {
      const bodies = Array.isArray(ann.body) ? ann.body : ann.body ? [ann.body] : [];
      const tags = bodies
        .filter((b: any) => b.type === 'TextualBody' && b.purpose === 'tagging')
        .flatMap((b: any) => (Array.isArray(b.value) ? b.value : [b.value])) as string[];
      const span = parseSpan(ann);
      if (!span) continue;
      if (tags.includes('Topic')) {
        const target = ann.target;
        const selectors =
          typeof target === 'string' || !target.selector
            ? []
            : Array.isArray(target.selector)
              ? target.selector
              : [target.selector];
        let exact = '';
        for (const s of selectors) {
          if (s.type === 'TextQuoteSelector') { exact = s.exact; break; }
        }
        topics.push({ rId, ...span, tags: [exact || 'unknown-topic'] });
      }
      const st = tags.find((t) => t.startsWith('SourceType_'));
      if (st) sourceTypes.push({ rId, ...span, tags: [st] });
    }
    topicSpans.set(rId, topics);
    sourceTypeSpans.set(rId, sourceTypes);
  }

  // For each Topic, count overlapping source-type spans
  const counts = new Map<string, Record<string, number>>();
  for (const [rId, topics] of topicSpans) {
    const sources = sourceTypeSpans.get(rId) ?? [];
    for (const topic of topics) {
      const topicLabel = topic.tags[0];
      if (!topicLabel) continue;
      if (!counts.has(topicLabel))
        counts.set(topicLabel, {
          SourceType_Named: 0,
          SourceType_Anonymous: 0,
          SourceType_Document: 0,
          SourceType_Observation: 0,
        });
      const slot = counts.get(topicLabel)!;
      // Overlap if topic span contains or overlaps source span — broad heuristic
      // since topic spans tend to be paragraph-level
      const margin = 200;
      for (const src of sources) {
        const srcLabel = src.tags[0];
        if (!srcLabel) continue;
        const overlap =
          src.start <= topic.end + margin && src.end >= topic.start - margin && src.rId === topic.rId;
        if (overlap) slot[srcLabel] = (slot[srcLabel] ?? 0) + 1;
      }
    }
  }

  // Render markdown
  let body = `# Balance Audit\n\n*Per-topic source-type distribution. Generated against the current corpus.*\n\n`;
  body += `Threshold: topics with named-source proportion below **${(NAMED_THRESHOLD * 100).toFixed(0)}%** are flagged.\n\n`;
  body += `| Topic | Named | Anonymous | Document | Observation | Total | Named % | Flag |\n|---|---|---|---|---|---|---|---|\n`;

  const flagged: string[] = [];
  for (const [topic, slot] of [...counts.entries()].sort()) {
    const named = slot.SourceType_Named ?? 0;
    const anon = slot.SourceType_Anonymous ?? 0;
    const doc = slot.SourceType_Document ?? 0;
    const obs = slot.SourceType_Observation ?? 0;
    const total = named + anon + doc + obs;
    const namedPct = total > 0 ? named / total : 0;
    const flag = total > 0 && namedPct < NAMED_THRESHOLD ? '⚠ low-named' : '';
    if (flag) flagged.push(topic);
    body += `| ${topic} | ${named} | ${anon} | ${doc} | ${obs} | ${total} | ${(namedPct * 100).toFixed(0)}% | ${flag} |\n`;
  }

  body += `\n## Flagged topics\n\n`;
  body += flagged.length === 0
    ? '(none — all topics meet the named-sourcing threshold)\n'
    : flagged.map((t) => `- **${t}** — disproportionate reliance on non-named sourcing\n`).join('');

  console.log('About to synthesize a BalanceAudit resource with the per-topic distribution.');
  const proceed = await confirm('Proceed?', true);
  if (!proceed) {
    await session.dispose();
    closeInteractive();
    return;
  }

  const yieldEvent = await semiont.yield.resource({
    name: 'Balance Audit',
    file: Buffer.from(body, 'utf-8'),
    format: 'text/markdown',
    entityTypes: ['BalanceAudit', 'Aggregate'],
    storageUri: 'file://generated/balance-audit.md',
  });
  console.log(`✓ BalanceAudit synthesized: ${yieldEvent.resourceId}`);
  console.log(`  Topics analyzed: ${counts.size}`);
  console.log(`  Flagged topics: ${flagged.length}`);

  await session.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
