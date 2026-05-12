/**
 * draft-with-citations — synthesize a DraftArticle scaffold with inline
 * fact-check links per claim.
 *
 * Usage: tsx skills/draft-with-citations/script.ts --investigation <resourceId>
 */

import {
  SemiontClient,
  resourceId as ridBrand,
  type GatheredContext,
} from '@semiont/sdk';
import { close as closeInteractive } from '../../src/interactive.js';

const DRAFT_INSTRUCTIONS =
  process.env.DRAFT_INSTRUCTIONS ??
  `From the gathered Investigation context, draft an article-length narrative.
Every factual assertion in the draft must carry an inline link to its corresponding FactCheck resource
in the format [fact-check](<resourceId>). The draft should:
- Open with a lede paragraph naming the central finding.
- Walk the supporting evidence in narrative order, with inline fact-check links.
- Quote named sources directly where the source text supports it.
- Hedge or qualify claims that the FactCheck rated as single-source or disputed.
- Close with what is still unknown.
Do NOT write claims that aren't backed by a Claim+FactCheck in the corpus.`;

function parseInvestigation(): string | undefined {
  const i = process.argv.indexOf('--investigation');
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60);
}

async function main(): Promise<void> {
  const investigationId = parseInvestigation();
  if (!investigationId) {
    console.error('Usage: --investigation <resourceId>');
    process.exit(1);
  }

  const semiont = await SemiontClient.signInHttp({
    baseUrl: process.env.SEMIONT_API_URL ?? 'http://localhost:4000',
    email: process.env.SEMIONT_USER_EMAIL!,
    password: process.env.SEMIONT_USER_PASSWORD!,
  });

  const all = await semiont.browse.resources({ limit: 2000 });
  const investigation = all.find((r) => r['@id'] === investigationId);
  if (!investigation) {
    console.error(`Investigation ${investigationId} not found.`);
    semiont.dispose();
    closeInteractive();
    return;
  }

  const factChecks = all.filter((r) => {
    const types: string[] = (r as any).entityTypes ?? [];
    return types.includes('FactCheck');
  });
  if (factChecks.length === 0) {
    console.error('No FactCheck resources. Run skills/fact-check/script.ts first.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  // Seed gather from the Investigation itself
  const annos = await semiont.browse.annotations(ridBrand(investigation['@id']));
  const seed = annos[0];
  if (!seed) {
    console.error('Investigation has no annotations.');
    semiont.dispose();
    closeInteractive();
    return;
  }
  const gather = await semiont.gather.annotation(ridBrand(investigation['@id']), seed.id, {
    contextWindow: 2500,
  });
  if (!('response' in gather)) {
    console.error('gather.annotation did not return a Complete event');
    semiont.dispose();
    closeInteractive();
    return;
  }
  const context = gather.response as GatheredContext;

  // Build a manifest of FactChecks for the prompt to reference
  const manifest = factChecks
    .map((fc) => `- \`${fc['@id']}\` ${(fc as any).name}`)
    .join('\n');

  const prepend =
    `# Draft Article\n\n` +
    `## Available FactChecks\n\n${manifest}\n\n` +
    `## Source Investigation\n\n- ${(investigation as any).name} (\`${investigation['@id']}\`)\n\n---\n\n`;

  const yieldEvent = await semiont.yield.fromAnnotation(ridBrand(investigation['@id']), seed.id, {
    title: `Draft: ${(investigation as any).name}`,
    storageUri: `file://generated/draft-${slugify((investigation as any).name)}.md`,
    context,
    entityTypes: ['DraftArticle', 'Aggregate'],
    prompt: `${DRAFT_INSTRUCTIONS}\n\nBegin the body with this preamble verbatim:\n\n${prepend}`,
  });
  if (yieldEvent.kind !== 'complete') {
    console.error(`yield.fromAnnotation did not complete: ${yieldEvent.kind}`);
    semiont.dispose();
    closeInteractive();
    return;
  }
  const resourceId = (yieldEvent.data.result as { resourceId?: string } | undefined)?.resourceId;
  console.log(`\n✓ DraftArticle synthesized: ${resourceId}`);

  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
