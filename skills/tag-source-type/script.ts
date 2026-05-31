/**
 * tag-source-type — classify each claim by source type.
 *
 * mark.assist with motivation 'linking' and four entity types
 * (SourceType_Named / SourceType_Anonymous / SourceType_Document /
 *  SourceType_Observation).
 *
 * Interim until a registered `journalism-source` tag schema lands in
 * @semiont/ontology.
 *
 * Usage: tsx skills/tag-source-type/script.ts [<resourceId>] [--interactive]
 */

import { SemiontSession, InMemorySessionStorage, entityType, resourceId as ridBrand, type KnowledgeBase, type ResourceId } from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';
import { createdCount } from '../../src/mark-result.js';

const SOURCE_ENTITY_TYPES = [
  entityType('SourceType_Named'),
  entityType('SourceType_Anonymous'),
  entityType('SourceType_Document'),
  entityType('SourceType_Observation'),
];

const SOURCE_INSTRUCTIONS =
  process.env.SOURCE_INSTRUCTIONS ??
  `Identify passages in this document that make factual assertions and tag each with the source
type that supports the assertion. Use exactly one of:
  - SourceType_Named: source is named on the record (look for "X said", "X told the reporter", "according to X")
  - SourceType_Anonymous: source is described but not named ("a senior official", "person familiar")
  - SourceType_Document: source is a document (memo, filing, FOIA release, public statement)
  - SourceType_Observation: source is the reporter's first-hand observation
Tag the span where the assertion is made — typically a sentence or short paragraph. Do not tag
attribution-only language (the "according to X" itself); tag the assertion that the attribution supports.`;

function getMediaType(r: any): string | undefined {
  const reps = Array.isArray(r.representations)
    ? r.representations
    : r.representations
      ? [r.representations]
      : [];
  return reps[0]?.mediaType;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const explicitResourceId = args[0];

  const baseUrl = process.env.SEMIONT_API_URL ?? 'http://localhost:4000';
  const email = process.env.SEMIONT_USER_EMAIL!;
  const password = process.env.SEMIONT_USER_PASSWORD!;
  const u = new URL(baseUrl);
  const kb: KnowledgeBase = {
    id: 'newsroom-tag-source-type',
    label: 'newsroom tag-source-type',
    email,
    endpoint: { kind: 'http', host: u.hostname, port: Number(u.port) || 4000, protocol: u.protocol.replace(':', '') as 'http' | 'https' },
  };
  const session = await SemiontSession.signInHttp({ kb, storage: new InMemorySessionStorage(), baseUrl, email, password });
  const semiont = session.client;

  try {
    let targets: ResourceId[];
    if (explicitResourceId) {
      targets = [ridBrand(explicitResourceId)];
    } else {
      const all = await semiont.browse.resources({ limit: 1000 });
      targets = all
        .filter((r) => {
          const mt = getMediaType(r);
          return mt === 'text/markdown' || mt === 'text/plain';
        })
        .map((r) => ridBrand(r['@id']));
    }

    if (targets.length === 0) {
      console.log('No markdown corpus resources found. Run skills/ingest-corpus/script.ts first.');
      closeInteractive();
      return;
    }

    console.log(`Will tag ${targets.length} resource(s) by source type.`);
    const proceed = await confirm('Proceed?', true);
    if (!proceed) {
      closeInteractive();
      return;
    }

    let total = 0;
    for (const rId of targets) {
      const progress = await semiont.mark.assist(rId, 'linking', {
        entityTypes: SOURCE_ENTITY_TYPES,
        instructions: SOURCE_INSTRUCTIONS,
      });
      const n = createdCount(progress);
      total += n;
      console.log(`  ${rId}: ${n} source-type annotations`);
    }

    console.log(`\nDone. Created ${total} source-type annotations.`);
    closeInteractive();
  } finally {
    await session.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
