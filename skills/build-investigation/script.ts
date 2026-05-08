/**
 * build-investigation — synthesize a top-level Investigation aggregate.
 *
 * Usage: tsx skills/build-investigation/script.ts [--scope <subdir>]
 */

import {
  SemiontClient,
  resourceId as ridBrand,
  type GatheredContext,
} from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

const INVESTIGATION_INSTRUCTIONS =
  process.env.INVESTIGATION_INSTRUCTIONS ??
  `Synthesize an Investigation memo from the gathered context:
- Narrative arc: 3–5 sentence summary of the investigation's central finding
- Key sources: list named figures, organizations, and agencies central to the story
- Key documents: list documents (FOIAs, statements, filings) that anchor the claims
- Most contested claims: claims with multiple supporting OR contradicting sources
- Outstanding questions: passages flagged by comment-action-items
- Recommended next steps for editorial advance
Cite every claim back to the Claim resource it derives from.`;

function parseScope(): string | undefined {
  const i = process.argv.indexOf('--scope');
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60);
}

async function main(): Promise<void> {
  const scope = parseScope();

  const semiont = await SemiontClient.signInHttp({
    baseUrl: process.env.SEMIONT_API_URL ?? 'http://localhost:4000',
    email: process.env.SEMIONT_USER_EMAIL!,
    password: process.env.SEMIONT_USER_PASSWORD!,
  });

  const all = await semiont.browse.resources({ limit: 2000 });

  const claims = all.filter((r) => {
    const types: string[] = (r as any).entityTypes ?? [];
    if (!types.includes('Claim')) return false;
    if (!scope) return true;
    const uri = ((r as any).storageUri ?? '') as string;
    return uri.includes(`/${scope}/`) || uri.includes(`/generated/`);
  });

  if (claims.length === 0) {
    console.log('No Claim resources to investigate.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  console.log(`Will synthesize Investigation from ${claims.length} Claim(s)${scope ? ` (scope: ${scope})` : ''}.`);
  const proceed = await confirm('Proceed?', true);
  if (!proceed) {
    semiont.dispose();
    closeInteractive();
    return;
  }

  // Pick a seed Claim with the most source edges (most-corroborated)
  let seedClaim = claims[0];
  let seedEdgeCount = 0;
  for (const c of claims) {
    const annos = await semiont.browse.annotations(ridBrand(c['@id']));
    const edges = annos.filter((a: any) =>
      (a.body ?? []).some(
        (b: any) =>
          b.type === 'TextualBody' &&
          b.purpose === 'tagging' &&
          (Array.isArray(b.value) ? b.value : [b.value]).includes('supports'),
      ),
    );
    if (edges.length > seedEdgeCount) {
      seedClaim = c;
      seedEdgeCount = edges.length;
    }
  }

  const seedId = ridBrand(seedClaim['@id']);
  const seedAnnos = await semiont.browse.annotations(seedId);
  const seedAnno = seedAnnos[0];
  if (!seedAnno) {
    console.error('Seed Claim has no annotations.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  const gather = await semiont.gather.annotation(seedAnno.id, seedId, { contextWindow: 2000 });
  const context = gather.response as GatheredContext;

  const claimList = claims.slice(0, 30).map((c) => `- ${(c as any).name} (\`${c['@id']}\`)`).join('\n');
  const prepend =
    `# Investigation${scope ? `: ${scope}` : ''}\n\n` +
    `## Claims considered (showing first 30 of ${claims.length})\n\n${claimList}\n\n---\n\n`;

  const yieldEvent = await semiont.yield.fromAnnotation(seedId, seedAnno.id, {
    title: `Investigation${scope ? `: ${scope}` : ''}`,
    storageUri: `file://generated/investigation-${slugify(scope ?? 'all')}.md`,
    context,
    entityTypes: ['Investigation', 'Aggregate'],
    instructions: INVESTIGATION_INSTRUCTIONS,
    prependBody: prepend,
  });
  if (yieldEvent.kind !== 'complete') {
    console.error(`yield.fromAnnotation did not complete: ${yieldEvent.kind}`);
    semiont.dispose();
    closeInteractive();
    return;
  }
  const resourceId = (yieldEvent.data.result as { resourceId?: string } | undefined)?.resourceId;
  console.log(`\n✓ Investigation synthesized: ${resourceId}`);
  console.log(`  Claims considered: ${claims.length}`);

  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
