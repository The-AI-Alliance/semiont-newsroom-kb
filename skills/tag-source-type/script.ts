/**
 * tag-source-type — classify each claim by source type.
 *
 * mark.delegate with motivation 'linking' and four entity types
 * (SourceType_Named / SourceType_Anonymous / SourceType_Document /
 *  SourceType_Observation).
 *
 * Interim until a registered `journalism-source` tag schema lands in
 * @semiont/ontology.
 *
 * Usage: tsx skills/tag-source-type/script.ts [<resourceId>] [--interactive]
 */

import { SemiontSession, InMemorySessionStorage, httpKb, entityType, resourceId as ridBrand, type ResourceId } from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';
import { getMediaType } from '../../src/media-type.js';

const SOURCE_ENTITY_TYPES = [
  entityType('SourceType_Named'),
  entityType('SourceType_Anonymous'),
  entityType('SourceType_Document'),
  entityType('SourceType_Observation'),
];

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const explicitResourceId = args[0];

  const gateway = new URL(process.env.SEMIONT_API_URL ?? 'http://localhost:4000');
  const session = await SemiontSession.signInDevice({
    kb: httpKb({
      id: 'newsroom-tag-source-type',
      label: 'newsroom tag-source-type',
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
    let targets: ResourceId[];
    if (explicitResourceId) {
      targets = [ridBrand(explicitResourceId)];
    } else {
      const all = (await semiont.browse.resources({ limit: 1000 }).fresh()).resources;
      targets = all
        .filter((r) => {
          const mt = getMediaType(r);
          return mt === 'text/markdown' || mt === 'text/plain';
        })
        .map((r) => r['@id']);
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
      const done = await semiont.mark.delegate(rId, {
        motivation: 'linking',
        entityTypes: SOURCE_ENTITY_TYPES,
      });
      const n = done.result && 'persisted' in done.result ? done.result.persisted : 0;
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
