/**
 * build-source-graph — relationship-extraction pass over the markdown corpus.
 *
 * Usage: tsx skills/build-source-graph/script.ts [--interactive]
 */

import { SemiontSession, InMemorySessionStorage, entityType, resourceId as ridBrand, type KnowledgeBase, type ResourceId } from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';
import { createdCount } from '../../src/mark-result.js';

// mark.assist with motivation 'linking' requires a non-empty entityTypes
// array (SDK validation). This relationship pass tags relationships
// between named people / organizations; the entity-type list scopes the
// LLM's expectation. Override with RELATIONSHIP_ENTITY_TYPES env var.
const RELATIONSHIP_ENTITY_TYPES = (
  process.env.RELATIONSHIP_ENTITY_TYPES ?? 'Person,Organization'
)
  .split(',')
  .map((t) => entityType(t.trim()));

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
  const baseUrl = process.env.SEMIONT_API_URL ?? 'http://localhost:4000';
  const email = process.env.SEMIONT_USER_EMAIL!;
  const password = process.env.SEMIONT_USER_PASSWORD!;
  const u = new URL(baseUrl);
  const kb: KnowledgeBase = {
    id: 'newsroom-build-source-graph',
    label: 'newsroom build-source-graph',
    email,
    endpoint: { kind: 'http', host: u.hostname, port: Number(u.port) || 4000, protocol: u.protocol.replace(':', '') as 'http' | 'https' },
  };
  const session = await SemiontSession.signInHttp({ kb, storage: new InMemorySessionStorage(), baseUrl, email, password });
  const semiont = session.client;

  try {
    const all = await semiont.browse.resources({ limit: 1000 });
    const targets: ResourceId[] = all
      .filter((r) => {
        const mt = getMediaType(r);
        return mt === 'text/markdown' || mt === 'text/plain';
      })
      .map((r) => ridBrand(r['@id']));

    if (targets.length === 0) {
      console.log('No markdown corpus resources found.');
      closeInteractive();
      return;
    }

    console.log(`Will extract source-relationships across ${targets.length} resource(s).`);
    const proceed = await confirm('Proceed?', true);
    if (!proceed) {
      closeInteractive();
      return;
    }

    let total = 0;
    for (const rId of targets) {
      const progress = await semiont.mark.assist(rId, 'linking', {
        entityTypes: RELATIONSHIP_ENTITY_TYPES,
        instructions: RELATIONSHIP_INSTRUCTIONS,
      });
      const n = createdCount(progress);
      total += n;
      console.log(`  ${rId}: ${n} relationship annotations`);
    }

    console.log(`\nDone. Created ${total} source-relationship annotations.`);
    closeInteractive();
  } finally {
    await session.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
