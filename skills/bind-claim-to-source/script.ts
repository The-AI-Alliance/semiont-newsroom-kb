/**
 * bind-claim-to-source — wire each Claim to its supporting source resource.
 *
 * Usage: tsx skills/bind-claim-to-source/script.ts [--interactive]
 */

import { SemiontSession, InMemorySessionStorage, resourceId as ridBrand, type KnowledgeBase, type ResourceId } from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

function getMediaType(r: any): string | undefined {
  const reps = Array.isArray(r.representations)
    ? r.representations
    : r.representations
      ? [r.representations]
      : [];
  return reps[0]?.mediaType;
}

async function main(): Promise<void> {
  const baseUrl = process.env.SEMIONT_API_URL ?? 'http://localhost:4000';
  const email = process.env.SEMIONT_USER_EMAIL!;
  const password = process.env.SEMIONT_USER_PASSWORD!;
  const u = new URL(baseUrl);
  const kb: KnowledgeBase = {
    id: 'newsroom-bind-claim-to-source',
    label: 'newsroom bind-claim-to-source',
    email,
    endpoint: { kind: 'http', host: u.hostname, port: Number(u.port) || 4000, protocol: u.protocol.replace(':', '') as 'http' | 'https' },
  };
  const session = await SemiontSession.signInHttp({ kb, storage: new InMemorySessionStorage(), baseUrl, email, password });
  const semiont = session.client;

  try {
    const all = await semiont.browse.resources({ limit: 2000 });
    const claims = all.filter((r) => {
      const types: string[] = (r as any).entityTypes ?? [];
      return types.includes('Claim');
    });

    if (claims.length === 0) {
      console.log('No Claim resources found. Run skills/extract-claims/script.ts first.');
      closeInteractive();
      return;
    }

    console.log(`Will wire source edges for ${claims.length} Claim resource(s).`);
    const proceed = await confirm('Proceed?', true);
    if (!proceed) {
      closeInteractive();
      return;
    }

    // Build a map of canonical resource by source annotation rId — for each
    // Claim, we look for source-typed annotations on the source document and
    // find the bound canonical resources around them.
    let edgesAdded = 0;
    for (const claim of claims) {
      const claimId = ridBrand(claim['@id']);
      // The Claim was synthesized via yield.fromAnnotation — its source annotation
      // lives in the document, and the binding makes it queryable in reverse.
      // Find annotations whose body has a SpecificResource pointing at this Claim.
      let foundSourceTypes: string[] = [];
      let foundBoundCanonicals: string[] = [];

      for (const r of all) {
        const mt = getMediaType(r);
        if (mt !== 'text/markdown' && mt !== 'text/plain') continue;
        const rId = ridBrand(r['@id']);
        const annotations = await semiont.browse.annotations(rId);
        for (const ann of annotations) {
          const annBodies = Array.isArray(ann.body) ? ann.body : ann.body ? [ann.body] : [];
          const targets = annBodies.filter(
            (b: any) => b.type === 'SpecificResource' && b.purpose === 'linking',
          );
          const bindsToClaim = targets.some((b: any) => b.source === claim['@id']);
          if (!bindsToClaim) continue;

          const tags = annBodies
            .filter((b: any) => b.type === 'TextualBody' && b.purpose === 'tagging')
            .flatMap((b: any) => (Array.isArray(b.value) ? b.value : [b.value]));
          for (const t of tags) {
            if (typeof t === 'string' && t.startsWith('SourceType_')) foundSourceTypes.push(t);
          }

          // Look at all other annotations on this same resource — the canonical
          // people / orgs / docs visible nearby become the supporting sources.
          for (const other of annotations) {
            if (other.id === ann.id) continue;
            const otherBodies = Array.isArray(other.body) ? other.body : other.body ? [other.body] : [];
            const otherTargets = otherBodies.filter(
              (b: any) => b.type === 'SpecificResource' && b.purpose === 'linking',
            );
            for (const t of otherTargets) {
              const targetRes = all.find((x) => x['@id'] === (t as any).source);
              const targetTypes: string[] = (targetRes as any)?.entityTypes ?? [];
              if (
                targetTypes.includes('Person') ||
                targetTypes.includes('Organization') ||
                targetTypes.includes('Agency') ||
                targetTypes.includes('Document')
              ) {
                foundBoundCanonicals.push((t as any).source);
              }
            }
          }
        }
      }

      // Dedup and add edges from the Claim resource. The selector field is
      // required by the SDK schema, but these are resource-level relationship
      // edges — there's no span to point at. Use a FragmentSelector with an
      // empty value to satisfy the type while signalling "whole resource."
      const uniq = [...new Set(foundBoundCanonicals)];
      for (const sourceId of uniq) {
        await semiont.mark.annotation({
          target: {
            source: claimId,
            selector: { type: 'FragmentSelector', value: '' },
          },
          motivation: 'linking',
          body: [
            { type: 'SpecificResource', source: sourceId, purpose: 'linking' },
            { type: 'TextualBody', purpose: 'tagging', value: 'supports' },
          ],
        });
        edgesAdded++;
      }
      const sourceTypeNote = [...new Set(foundSourceTypes)].join(', ') || 'unknown';
      console.log(`  Claim ${claimId}: ${uniq.length} source edges (source-type: ${sourceTypeNote})`);
    }

    console.log(`\nDone. Added ${edgesAdded} Claim → Source edges.`);
    closeInteractive();
  } finally {
    await session.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
