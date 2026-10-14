---
name: extract-claims
description: For every factual assertion in the corpus, synthesize a Claim resource with structured fields (subject, predicate, object, confidence, scope).
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read
---

You are turning every factual assertion into a queryable Claim resource — the unit of editorial work. Drafts and fact-checks reference Claims, not raw text.

## What it does

1. For every markdown resource, browses source-type-tagged annotations from `tag-source-type`.
2. For each annotation, calls `gather.annotation` to pull surrounding context.
3. Calls `yield.delegate` to synthesize a Claim resource with body fields (assertion, subject, supporting language, source-type, source-text, scope).
4. Binds the source annotation to the new Claim resource.

## SDK verbs

`browse.resources`, `browse.annotations`, `gather.annotation`, `yield.delegate`, `bind.body`.

## Tier-2 parameters

| Var | Default | Purpose |
|---|---|---|
| `MIN_CLAIM_LENGTH` | `30` | Skip annotations shorter than this many characters. |
| `CLAIM_INSTRUCTIONS` | (built-in) | Override the per-claim extraction prompt. |

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  node:24-alpine \
  sh -c 'npm ci --no-audit --no-fund && npx tsx skills/extract-claims/script.ts'
```

The script prints an address: open it in a browser and approve the sign-in. [Signing in](https://github.com/The-AI-Alliance/semiont/blob/main/docs/builder/SIGN-IN.md) has the other ways a script can sign in.

## Guidance for the AI assistant

- Run `tag-source-type` first — this skill walks source-typed annotations.
- Each Claim resource is one factual assertion. Multi-sentence quotes that contain several distinct assertions should produce several Claim resources, not one — the LLM is instructed to split.
