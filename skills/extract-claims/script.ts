/**
 * extract-claims — turn every source-typed annotation into a Claim resource.
 *
 * Usage: tsx skills/extract-claims/script.ts [--interactive]
 */

import {
  SemiontClient,
  resourceId as ridBrand,
  type AnnotationId,
  type GatheredContext,
  type ResourceId,
} from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

const MIN_CLAIM_LENGTH = Number(process.env.MIN_CLAIM_LENGTH ?? 30);
const SOURCE_TYPE_TAGS = new Set([
  'SourceType_Named',
  'SourceType_Anonymous',
  'SourceType_Document',
  'SourceType_Observation',
]);

const CLAIM_INSTRUCTIONS =
  process.env.CLAIM_INSTRUCTIONS ??
  `From the gathered context, produce a structured Claim:
- Assertion: a single-sentence statement of what is being claimed
- Subject: the entity (person, organization, agency) the claim is about
- Predicate / object: what is asserted about the subject
- Source type: one of named / anonymous / document / observation (from the source-type tag)
- Source text: the verbatim source language supporting the claim
- Scope: any qualifiers (time period, jurisdiction, etc.)
- Notes: tensions or hedges in the source text the claim depends on
Cite the source paragraph the data came from.`;

function getMediaType(r: any): string | undefined {
  const reps = Array.isArray(r.representations)
    ? r.representations
    : r.representations
      ? [r.representations]
      : [];
  return reps[0]?.mediaType;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60);
}

interface ClaimAnno {
  rId: ResourceId;
  annId: AnnotationId;
  text: string;
  sourceType: string;
}

async function main(): Promise<void> {
  const semiont = await SemiontClient.signInHttp({
    baseUrl: process.env.SEMIONT_API_URL ?? 'http://localhost:4000',
    email: process.env.SEMIONT_USER_EMAIL!,
    password: process.env.SEMIONT_USER_PASSWORD!,
  });

  const all = await semiont.browse.resources({ limit: 1000 });
  const markdownResources = all.filter((r) => {
    const mt = getMediaType(r);
    return mt === 'text/markdown' || mt === 'text/plain';
  });

  const claims: ClaimAnno[] = [];
  for (const r of markdownResources) {
    const rId = ridBrand(r['@id']);
    const annotations = await semiont.browse.annotations(rId);
    for (const ann of annotations) {
      if (ann.motivation !== 'linking') continue;
      const bodies = Array.isArray(ann.body) ? ann.body : ann.body ? [ann.body] : [];
      const tags = bodies
        .filter((b: any) => b.type === 'TextualBody' && b.purpose === 'tagging')
        .flatMap((b: any) => (Array.isArray(b.value) ? b.value : [b.value]));
      const sourceType = tags.find((t: string) => SOURCE_TYPE_TAGS.has(t));
      if (!sourceType) continue;
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
      if (exact.length < MIN_CLAIM_LENGTH) continue;
      claims.push({ rId, annId: ann.id, text: exact, sourceType });
    }
  }

  if (claims.length === 0) {
    console.log('No source-typed annotations found. Run skills/tag-source-type/script.ts first.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  console.log(`Found ${claims.length} source-typed annotation(s) to extract.`);
  const proceed = await confirm('Proceed?', true);
  if (!proceed) {
    semiont.dispose();
    closeInteractive();
    return;
  }

  let synthesized = 0;
  for (const c of claims) {
    const gather = await semiont.gather.annotation(c.rId, c.annId, { contextWindow: 1500 });
    if (!('response' in gather)) continue;
    const context = gather.response as GatheredContext;

    const yieldEvent = await semiont.yield.fromAnnotation(c.rId, c.annId, {
      title: `Claim: ${c.text.slice(0, 80)}`,
      storageUri: `file://generated/claim-${slugify(c.text)}.md`,
      context,
      entityTypes: ['Claim', 'Aggregate'],
      prompt: CLAIM_INSTRUCTIONS,
    });
    if (yieldEvent.kind !== 'complete') continue;
    const newResourceId = (yieldEvent.data.result as { resourceId?: string } | undefined)?.resourceId;
    if (!newResourceId) continue;

    await semiont.bind.body(c.rId, c.annId, [
      { op: 'add', item: { type: 'SpecificResource', source: newResourceId, purpose: 'linking' } },
    ]);
    synthesized++;
    console.log(`  + ${newResourceId} from ${c.sourceType} claim "${c.text.slice(0, 50)}..."`);
  }

  console.log(`\nDone. Synthesized ${synthesized} Claim resources.`);
  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
