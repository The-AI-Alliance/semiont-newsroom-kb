/**
 * fact-check — per-Claim FactCheck aggregate.
 *
 * Usage: tsx skills/fact-check/script.ts [--claim <resourceId>]
 */

import {
  SemiontClient,
  resourceId as ridBrand,
  type GatheredContext,
} from '@semiont/sdk';
import { confirm, close as closeInteractive } from '../../src/interactive.js';

const FACT_CHECK_INSTRUCTIONS =
  process.env.FACT_CHECK_INSTRUCTIONS ??
  `Synthesize a FactCheck for the Claim in the gathered context:
- Claim assertion: restate the claim as a single sentence
- Supporting sources: list every source that corroborates the claim (with type: named / anonymous / document / observation)
- Contradicting sources: list every source that contradicts the claim
- Tensions: surface unresolved tensions in the source language
- Confidence: rate the claim (well-supported / single-source / disputed / poorly-supported)
- Recommended editorial action: include / qualify / hold / drop`;

function parseClaimArg(): string | undefined {
  const i = process.argv.indexOf('--claim');
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60);
}

async function main(): Promise<void> {
  const claimArg = parseClaimArg();

  const semiont = await SemiontClient.signInHttp({
    baseUrl: process.env.SEMIONT_API_URL ?? 'http://localhost:4000',
    email: process.env.SEMIONT_USER_EMAIL!,
    password: process.env.SEMIONT_USER_PASSWORD!,
  });

  const all = await semiont.browse.resources({ limit: 2000 });
  const claims = claimArg
    ? all.filter((r) => r['@id'] === claimArg)
    : all.filter((r) => {
        const types: string[] = (r as any).entityTypes ?? [];
        return types.includes('Claim');
      });

  if (claims.length === 0) {
    console.log('No Claim resources to fact-check.');
    semiont.dispose();
    closeInteractive();
    return;
  }

  console.log(`Will produce FactCheck for ${claims.length} Claim resource(s).`);
  const proceed = await confirm('Proceed?', true);
  if (!proceed) {
    semiont.dispose();
    closeInteractive();
    return;
  }

  let synthesized = 0;
  for (const claim of claims) {
    const claimId = ridBrand(claim['@id']);
    const claimName = (claim as any).name ?? 'untitled-claim';

    // Find an annotation on the Claim resource to seed the gather call
    const annos = await semiont.browse.annotations(claimId);
    const seed = annos[0];
    if (!seed) {
      console.warn(`  No annotations on ${claimId} — skipping`);
      continue;
    }

    const gather = await semiont.gather.annotation(claimId, seed.id, { contextWindow: 1500 });
    if (!('response' in gather)) continue;
    const context = gather.response as GatheredContext;

    // Find all source-edges from this Claim
    const supports = annos
      .filter((a: any) => {
        const bodies = Array.isArray(a.body) ? a.body : a.body ? [a.body] : [];
        return bodies.some(
          (b: any) =>
            b.type === 'TextualBody' &&
            b.purpose === 'tagging' &&
            (Array.isArray(b.value) ? b.value : [b.value]).includes('supports'),
        );
      })
      .flatMap((a: any) => {
        const bodies = Array.isArray(a.body) ? a.body : a.body ? [a.body] : [];
        return bodies
          .filter((b: any) => b.type === 'SpecificResource' && b.purpose === 'linking')
          .map((b: any) => b.source as string);
      });

    const sourceList = supports
      .map((id) => {
        const r = all.find((x) => x['@id'] === id);
        return `- ${(r as any)?.name ?? id} (\`${id}\`, types: ${((r as any)?.entityTypes ?? []).join(', ')})`;
      })
      .join('\n');

    const prepend =
      `# Fact-Check: ${claimName}\n\n` +
      `## Sources bound to this Claim\n\n${sourceList || '(none — Claim is unsourced; flag for editorial)'}\n\n---\n\n`;

    const yieldEvent = await semiont.yield.fromAnnotation(claimId, seed.id, {
      title: `Fact-Check: ${claimName}`,
      storageUri: `file://generated/fact-check-${slugify(claimName)}.md`,
      context,
      entityTypes: ['FactCheck', 'Aggregate'],
      prompt: `${FACT_CHECK_INSTRUCTIONS}\n\nBegin the body with this preamble verbatim:\n\n${prepend}`,
    });
    if (yieldEvent.kind !== 'complete') continue;
    const newResourceId = (yieldEvent.data.result as { resourceId?: string } | undefined)?.resourceId;
    if (!newResourceId) continue;

    synthesized++;
    console.log(`  + FactCheck ${newResourceId} for Claim "${claimName}" (${supports.length} sources)`);
  }

  console.log(`\nDone. Synthesized ${synthesized} FactCheck resources.`);
  semiont.dispose();
  closeInteractive();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
