/**
 * ingest-corpus — walk the repo, create one resource per investigation file.
 *
 * Usage: tsx skills/ingest-corpus/script.ts [--interactive]
 */

import { SemiontSession, InMemorySessionStorage, type KnowledgeBase } from '@semiont/sdk';
import { discoverCorpus, readForUpload } from '../../src/files.js';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

const KB_ENTITY_TYPES = [
  // Document types from src/files.ts filename heuristics
  'InterviewTranscript',
  'FOIAResponse',
  'PressRelease',
  'OfficialStatement',
  'ReporterNote',
  'Document',
  'JournalismDocument',
  // Curated-context markers
  'BackgroundContext',
  'Curated',
  // mark-people-and-orgs entity types
  'Person',
  'Organization',
  'Agency',
  'PublicFigure',
  'Address',
  'Date',
  'MonetaryValue',
  'Topic',
  // tag-source-type entity types (interim — until a registered journalism-source tag schema lands)
  'SourceType_Named',
  'SourceType_Anonymous',
  'SourceType_Document',
  'SourceType_Observation',
  // External-authority shadow types
  'WikidataEntity',
  'AgencyRecord',
  // Synthesized aggregates
  'Claim',
  'FactCheck',
  'BalanceAudit',
  'Investigation',
  'DraftArticle',
  'SourceRelationship',
  'Aggregate',
];

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const files = discoverCorpus(repoRoot);

  console.log(`Discovered ${files.length} corpus files:`);
  const bySubdir: Record<string, number> = {};
  const byFormat: Record<string, number> = {};
  for (const f of files) {
    bySubdir[f.subdir] = (bySubdir[f.subdir] ?? 0) + 1;
    byFormat[f.format] = (byFormat[f.format] ?? 0) + 1;
  }
  console.log('  by subdirectory:');
  for (const [subdir, n] of Object.entries(bySubdir).sort()) {
    console.log(`    ${subdir}: ${n}`);
  }
  console.log('  by format:');
  for (const [fmt, n] of Object.entries(byFormat).sort()) {
    console.log(`    ${fmt}: ${n}`);
  }
  console.log();

  if (files.length === 0) {
    console.log('No ingestable files found. Exiting.');
    closeInteractive();
    return;
  }

  const proceed = await confirm(
    `About to create ${files.length} resources via yield.resource. Proceed?`,
    true,
  );
  if (!proceed) {
    closeInteractive();
    return;
  }

  const baseUrl = process.env.SEMIONT_API_URL ?? 'http://localhost:4000';
  const email = process.env.SEMIONT_USER_EMAIL!;
  const password = process.env.SEMIONT_USER_PASSWORD!;
  const u = new URL(baseUrl);
  const kb: KnowledgeBase = {
    id: 'newsroom-ingest-corpus',
    label: 'newsroom ingest-corpus',
    email,
    endpoint: { kind: 'http', host: u.hostname, port: Number(u.port) || 4000, protocol: u.protocol.replace(':', '') as 'http' | 'https' },
  };
  const session = await SemiontSession.signInHttp({ kb, storage: new InMemorySessionStorage(), baseUrl, email, password });
  const semiont = session.client;

  try {
    console.log(`Declaring ${KB_ENTITY_TYPES.length} entity types via frame...`);
    await semiont.frame.addEntityTypes(KB_ENTITY_TYPES);

    let created = 0;
    let failed = 0;
    for (const file of files) {
      try {
        const buffer = readForUpload(file, repoRoot);
        const { resourceId } = await semiont.yield.resource({
          name: file.name,
          file: buffer,
          format: file.format,
          entityTypes: file.entityTypes,
          storageUri: file.storageUri,
        });
        created++;
        console.log(`  + ${file.path} → ${resourceId} [${file.entityTypes.join(', ')}]`);
      } catch (e) {
        failed++;
        console.warn(`  ! ${file.path} failed: ${(e as Error).message}`);
      }
    }

    console.log(`\nDone. ${created} resources created, ${failed} failed.`);
    closeInteractive();
  } finally {
    await session.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
