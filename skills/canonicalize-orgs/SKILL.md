---
name: canonicalize-orgs
description: Promote Organization / Agency mentions to canonical Organization resources, grounded against Wikidata or agency-website lookups. Idempotent.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read
---

You are turning every Organization / Agency mention in the corpus into a canonical resource that carries Wikidata- or agency-website-grounded External References.

## What it does

Same shape as `canonicalize-people`, but targeting `Organization` and `Agency` annotations. Agencies get an agency-website-search External Reference; Organizations get a Wikidata search reference.

## SDK verbs

`browse.resources`, `browse.annotations`, `gather.annotation`, `match.search`, `yield.delegate`, `bind.body`.

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  node:24-alpine \
  sh -c 'npm ci --no-audit --no-fund && npx tsx skills/canonicalize-orgs/script.ts'
```

The script prints an address: open it in a browser and approve the sign-in. [Signing in](https://github.com/The-AI-Alliance/semiont/blob/main/docs/builder/SIGN-IN.md) has the other ways a script can sign in.

## Guidance for the AI assistant

- Agencies are a sub-type of Organization in this KB — the canonical resource gets both `Organization` and `Agency` entity types when the source annotation is tagged `Agency`.
- Wikidata grounding here is URL-construction only.
