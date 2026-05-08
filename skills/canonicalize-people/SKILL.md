---
name: canonicalize-people
description: Promote Person mentions to canonical Person resources, grounded against Wikidata via External References. Idempotent.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read
---

You are turning every Person mention in the corpus into a canonical Person resource that carries a Wikidata-grounded External Reference.

## What it does

1. Walks `Person`-tagged annotations across the corpus.
2. Clusters by surface text.
3. For each cluster: gathers context, matches against existing Person resources; if no confident match, synthesizes a new Person resource via `yield.fromAnnotation` with body content from gathered context plus External References pointing at Wikidata.
4. Binds every annotation in the cluster via `bind.body`.

## SDK verbs

`browse.resources`, `browse.annotations`, `gather.annotation`, `match.search`, `yield.fromAnnotation`, `bind.body`.

## Tier-2 parameters

| Var | Default | Purpose |
|---|---|---|
| `MATCH_THRESHOLD` | `30` | Minimum match score for an existing Person to be the canonical target. |

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/canonicalize-people/script.ts'
```

## Guidance for the AI assistant

- Wikidata grounding here is URL-construction only. Production deployments would replace the stub with a Wikidata wbsearchentities API call.
- "PublicFigure" is a secondary entity type — a Person may be both Person and PublicFigure; this skill canonicalizes both consistently.
