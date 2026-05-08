/**
 * build-source-graph — relationship-extraction pass over the markdown corpus.
 *
 * Usage: tsx skills/build-source-graph/script.ts [--interactive]
 */

import { SemiontClient, resourceId as ridBrand, type ResourceId } from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

const RELATIONSHIP_INSTRUCTIONS = `
Identify passages where one source's claim relates to another's. For each such passage, tag it
with one of:
  - corroborates   (an independent source confirms the claim)
  - contradicts    (a source denies or rebuts the claim)
  - supersedes     (a more recent source replaces an earlier claim)
  - derived-from   (the source's claim is itself sourced from another in the corpus)
Only tag relationships supported by explicit language. Do not infer relationships not on the page.
`.trim();

function getMediaType(r: any): string | undefined {
  const reps = Array.isArray(r.representations)
    ? r.representations
    : r.representations
      ? [r.representations]
      : [];
  return reps[0]?.mediaType;
}

async function main(): Promise<void> {
  const semiont = await SemiontClient.signInHttp({
    baseUrl: process.env.SEMIONT_API_URL ?? 'http://localhost:4000',
    email: process.env.SEMIONT_USER_EMAIL!,
    password: process.env.SEMIONT_USER_PASSWORD!,
  });

  const all = await semiont.browse.resources({ limit: 1000 });
  const targets: ResourceId[] = all
    .filter((r) => {
      const mt = getMediaType(r);
      return mt === 'text/markdown' || mt === 'text/plain';
    })
    .map((r) => ridBrand(r['@id']));

  if (targets.length === 0) {
    console.log('No markdown corpus resources found.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  console.log(`Will extract source-relationships across ${targets.length} resource(s).`);
  const proceed = await confirm('Proceed?', true);
  if (!proceed) {
    semiont.dispose();
    closeInteractive();
    return;
  }

  let total = 0;
  for (const rId of targets) {
    const progress = await semiont.mark.assist(rId, 'linking', {
      instructions: RELATIONSHIP_INSTRUCTIONS,
    });
    const n = progress.progress?.createdCount ?? 0;
    total += n;
    console.log(`  ${rId}: ${n} relationship annotations`);
  }

  console.log(`\nDone. Created ${total} source-relationship annotations.`);
  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
