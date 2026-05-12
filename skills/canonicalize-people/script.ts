/**
 * canonicalize-people — promote Person mentions to canonical Person
 * resources with Wikidata-grounded External References.
 *
 * Usage: tsx skills/canonicalize-people/script.ts [--interactive]
 */

import {
  SemiontClient,
  resourceId as ridBrand,
  type AnnotationId,
  type GatheredContext,
  type ResourceId,
} from '@semiont/sdk';
import { confirm, isInteractive, close as closeInteractive } from '../../src/interactive.js';
import { lookupWikidataStub, formatReferenceSection } from '../../src/external-authorities.js';

const MATCH_THRESHOLD = Number(process.env.MATCH_THRESHOLD ?? 30);
const TARGET_TAGS = new Set(['Person', 'PublicFigure']);

function getMediaType(r: any): string | undefined {
  const reps = Array.isArray(r.representations)
    ? r.representations
    : r.representations
      ? [r.representations]
      : [];
  return reps[0]?.mediaType;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

interface PersonAnno {
  rId: ResourceId;
  annId: AnnotationId;
  text: string;
  alreadyBound: boolean;
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

  const personAnnos: PersonAnno[] = [];
  for (const r of markdownResources) {
    const rId = ridBrand(r['@id']);
    const annotations = await semiont.browse.annotations(rId);
    for (const ann of annotations) {
      if (ann.motivation !== 'linking') continue;
      const tags = (ann.body ?? [])
        .filter((b: any) => b.type === 'TextualBody' && b.purpose === 'tagging')
        .flatMap((b: any) => (Array.isArray(b.value) ? b.value : [b.value]));
      if (!tags.some((t: string) => TARGET_TAGS.has(t))) continue;
      const alreadyBound = (ann.body ?? []).some(
        (b: any) => b.type === 'SpecificResource' && b.purpose === 'linking',
      );
      personAnnos.push({
        rId,
        annId: ann.id,
        text: ann.target?.selector?.exact ?? '',
        alreadyBound,
      });
    }
  }

  if (personAnnos.length === 0) {
    console.log('No Person annotations found. Run skills/mark-people-and-orgs/script.ts first.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  const clusters = new Map<string, PersonAnno[]>();
  let alreadyBound = 0;
  for (const a of personAnnos) {
    if (a.alreadyBound) {
      alreadyBound++;
      continue;
    }
    const key = a.text.toLowerCase().trim();
    if (!key) continue;
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key)!.push(a);
  }

  console.log(
    `${personAnnos.length} Person annotations; ${alreadyBound} already bound; ${clusters.size} unbound clusters.`,
  );
  const proceed = await confirm('Proceed?', true);
  if (!proceed) {
    semiont.dispose();
    closeInteractive();
    return;
  }

  let bound = 0;
  let synthesized = 0;
  for (const [key, anns] of clusters) {
    const sample = anns[0];
    const gather = await semiont.gather.annotation(sample.rId, sample.annId, { contextWindow: 1200 });
    const context = gather.response as GatheredContext;
    const matchResult = await semiont.match.search(sample.rId, sample.annId, context, {
      limit: 5,
      useSemanticScoring: true,
    });
    const top = matchResult.response[0];

    let targetResourceId: string;
    if (top && (top.score ?? 0) >= MATCH_THRESHOLD && top.entityTypes?.includes('Person')) {
      targetResourceId = top['@id'];
      console.log(`  ↪ "${sample.text}" → ${top.name} (existing, score ${top.score})`);
    } else {
      const proceedYield = isInteractive()
        ? await confirm(`Synthesize new Person for "${sample.text}"?`, true)
        : true;
      if (!proceedYield) continue;

      const externalRefs = formatReferenceSection([lookupWikidataStub(key)]);
      const yieldEvent = await semiont.yield.fromAnnotation(sample.rId, sample.annId, {
        title: key,
        storageUri: `file://generated/person-${slugify(key)}.md`,
        context,
        entityTypes: ['Person'],
        appendBody: externalRefs,
      });
      if (yieldEvent.kind !== 'complete') continue;
      const newResourceId = (yieldEvent.data.result as { resourceId?: string } | undefined)?.resourceId;
      if (!newResourceId) continue;
      targetResourceId = newResourceId;
      synthesized++;
      console.log(`  + "${sample.text}" → ${newResourceId} (synthesized)`);
    }

    for (const a of anns) {
      await semiont.bind.body(a.rId, a.annId, [
        { op: 'add', item: { type: 'SpecificResource', source: targetResourceId, purpose: 'linking' } },
      ]);
      bound++;
    }
  }

  console.log(`\nDone. Bound ${bound} annotations; ${synthesized} new Person resources synthesized.`);
  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
