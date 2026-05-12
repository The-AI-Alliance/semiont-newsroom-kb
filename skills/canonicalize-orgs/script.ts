/**
 * canonicalize-orgs — promote Organization / Agency mentions to canonical
 * Organization resources with Wikidata or agency-website External References.
 *
 * Usage: tsx skills/canonicalize-orgs/script.ts [--interactive]
 */

import {
  SemiontClient,
  resourceId as ridBrand,
  type AnnotationId,
  type GatheredContext,
  type ResourceId,
} from '@semiont/sdk';
import { confirm, isInteractive, close as closeInteractive } from '../../src/interactive.js';
import {
  lookupWikidataStub,
  lookupAgencyStub,
  formatReferenceSection,
} from '../../src/external-authorities.js';

const MATCH_THRESHOLD = Number(process.env.MATCH_THRESHOLD ?? 30);

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

interface OrgAnno {
  rId: ResourceId;
  annId: AnnotationId;
  text: string;
  isAgency: boolean;
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

  const orgAnnos: OrgAnno[] = [];
  for (const r of markdownResources) {
    const rId = ridBrand(r['@id']);
    const annotations = await semiont.browse.annotations(rId);
    for (const ann of annotations) {
      if (ann.motivation !== 'linking') continue;
      const bodies = Array.isArray(ann.body) ? ann.body : ann.body ? [ann.body] : [];
      const tags = bodies
        .filter((b: any) => b.type === 'TextualBody' && b.purpose === 'tagging')
        .flatMap((b: any) => (Array.isArray(b.value) ? b.value : [b.value]));
      const isOrg = tags.includes('Organization');
      const isAgency = tags.includes('Agency');
      if (!isOrg && !isAgency) continue;
      const alreadyBound = bodies.some(
        (b: any) => b.type === 'SpecificResource' && b.purpose === 'linking',
      );
      const target = ann.target;
      const selectors =
        typeof target === 'string' || !target.selector
          ? []
          : Array.isArray(target.selector)
            ? target.selector
            : [target.selector];
      let text = '';
      for (const s of selectors) {
        if (s.type === 'TextQuoteSelector') { text = s.exact; break; }
      }
      orgAnnos.push({
        rId,
        annId: ann.id,
        text,
        isAgency,
        alreadyBound,
      });
    }
  }

  if (orgAnnos.length === 0) {
    console.log('No Organization/Agency annotations found. Run skills/mark-people-and-orgs/script.ts first.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  const clusters = new Map<string, OrgAnno[]>();
  let alreadyBound = 0;
  for (const a of orgAnnos) {
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
    `${orgAnnos.length} Organization/Agency annotations; ${alreadyBound} already bound; ${clusters.size} clusters.`,
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
    if (!sample) continue;
    const gather = await semiont.gather.annotation(sample.rId, sample.annId, { contextWindow: 1200 });
    if (!('response' in gather)) continue;
    const context = gather.response as GatheredContext;
    const matchResult = await semiont.match.search(sample.rId, sample.annId, context, {
      limit: 5,
      useSemanticScoring: true,
    });
    const top = matchResult.response[0];

    let targetResourceId: string;
    if (
      top &&
      (top.score ?? 0) >= MATCH_THRESHOLD &&
      (top.entityTypes?.includes('Organization') || top.entityTypes?.includes('Agency'))
    ) {
      targetResourceId = top['@id'];
      console.log(`  ↪ "${sample.text}" → ${top.name} (existing, score ${top.score})`);
    } else {
      const proceedYield = isInteractive()
        ? await confirm(`Synthesize new Organization for "${sample.text}"?`, true)
        : true;
      if (!proceedYield) continue;

      const isAgency = anns.some((a) => a.isAgency);
      const refs = isAgency ? [lookupAgencyStub(key), lookupWikidataStub(key)] : [lookupWikidataStub(key)];
      const externalRefs = formatReferenceSection(refs);
      const entityTypes = isAgency ? ['Organization', 'Agency'] : ['Organization'];

      const yieldEvent = await semiont.yield.fromAnnotation(sample.rId, sample.annId, {
        title: key,
        storageUri: `file://generated/${isAgency ? 'agency' : 'org'}-${slugify(key)}.md`,
        context,
        entityTypes,
        prompt: externalRefs
          ? `Include this references section at the end of the body verbatim:\n\n${externalRefs}`
          : undefined,
      });
      if (yieldEvent.kind !== 'complete') continue;
      const newResourceId = (yieldEvent.data.result as { resourceId?: string } | undefined)?.resourceId;
      if (!newResourceId) continue;
      targetResourceId = newResourceId;
      synthesized++;
      console.log(`  + "${sample.text}" → ${newResourceId} (${isAgency ? 'Agency' : 'Organization'})`);
    }

    for (const a of anns) {
      await semiont.bind.body(a.rId, a.annId, [
        { op: 'add', item: { type: 'SpecificResource', source: targetResourceId, purpose: 'linking' } },
      ]);
      bound++;
    }
  }

  console.log(`\nDone. Bound ${bound} annotations; ${synthesized} synthesized.`);
  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
