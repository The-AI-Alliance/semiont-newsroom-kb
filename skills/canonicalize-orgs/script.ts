/**
 * canonicalize-orgs — promote Organization / Agency mentions to canonical
 * Organization resources with Wikidata or agency-website External References.
 *
 * Usage: tsx skills/canonicalize-orgs/script.ts [--interactive]
 */

import {
  SemiontSession,
  InMemorySessionStorage,
  httpKb,
  getAnnotationExactText,
  getBodySource,
  getEntityTypes,
  type AnnotationId,
  type ResourceId,
} from '@semiont/sdk';
import { confirm, isInteractive, close as closeInteractive } from '../../src/interactive.js';
import {
  lookupWikidataStub,
  lookupAgencyStub,
  formatReferenceSection,
} from '../../src/external-authorities.js';
import { getMediaType } from '../../src/media-type.js';

const MATCH_THRESHOLD = Number(process.env.MATCH_THRESHOLD ?? 30);


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
  const gateway = new URL(process.env.SEMIONT_API_URL ?? 'http://localhost:4000');
  const session = await SemiontSession.signInDevice({
    kb: httpKb({
      id: 'newsroom-canonicalize-orgs',
      label: 'newsroom canonicalize-orgs',
      host: gateway.hostname,
      port: Number(gateway.port) || 4000,
      protocol: gateway.protocol === 'https:' ? 'https' : 'http',
    }),
    storage: new InMemorySessionStorage(),
    onCode: ({ verificationUri, verificationUriComplete, userCode }) => {
      console.error(`Approve this script at ${verificationUriComplete ?? verificationUri}`);
      if (!verificationUriComplete) console.error(`Code: ${userCode}`);
    },
  });
  const semiont = session.client;

  try {
    const all = (await semiont.browse.resources({ limit: 1000 }).fresh()).resources;
    const markdownResources = all.filter((r) => {
      const mt = getMediaType(r);
      return mt === 'text/markdown' || mt === 'text/plain';
    });

    const orgAnnos: OrgAnno[] = [];
    for (const r of markdownResources) {
      const rId = r['@id'];
      const annotations = await semiont.browse.annotations(rId).fresh();
      for (const ann of annotations) {
        if (ann.motivation !== 'linking') continue;
        const tags = getEntityTypes(ann);
        const isOrg = tags.includes('Organization');
        const isAgency = tags.includes('Agency');
        if (!isOrg && !isAgency) continue;
        const alreadyBound = getBodySource(ann.body) !== null;
        const text = getAnnotationExactText(ann);
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
      closeInteractive();
      return;
    }

    let bound = 0;
    let synthesized = 0;
    for (const [key, anns] of clusters) {
      const sample = anns[0];
      if (!sample) continue;
      const { response: context } = await semiont.gather.annotation(sample.rId, sample.annId, { contextWindow: 1200 });
      const matchResult = await semiont.match.search(sample.rId, sample.annId, context, {
        limit: 5,
        useSemanticScoring: true,
      });
      const top = matchResult.response[0];

      let targetResourceId: ResourceId;
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

        const yieldEvent = await semiont.yield.delegate({
          context,
          title: key,
          storageUri: `file://generated/${isAgency ? 'agency' : 'org'}-${slugify(key)}.md`,
          entityTypes,
          prompt: externalRefs
            ? `Include this references section at the end of the body verbatim:\n\n${externalRefs}`
            : undefined,
          });
        if (!yieldEvent.result || !('resourceId' in yieldEvent.result)) continue;
        const newResourceId = yieldEvent.result && 'resourceId' in yieldEvent.result ? yieldEvent.result.resourceId : undefined;
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
    closeInteractive();
  } finally {
    await session.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
