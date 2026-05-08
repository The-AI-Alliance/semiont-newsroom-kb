---
name: tag-source-type
description: Classify each claim or quote by source type — Named, Anonymous, Document, Observation. The reportorial spine of the investigation.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read
---

You are tagging every claim or quote in the corpus by the type of source supporting it. This is the structural classification on which `balance-audit`, `fact-check`, and `build-investigation` all depend.

## What it does

For every markdown / text resource, calls `mark.assist(resourceId, 'linking', { entityTypes: SOURCE_TYPES })`. The model identifies passages making factual assertions and tags each with one of:

| Source type | Entity type | Description |
|---|---|---|
| Named | `SourceType_Named` | Source is identified on the record by name |
| Anonymous | `SourceType_Anonymous` | Source is described but not named — "a senior official", "person familiar with the matter" |
| Document | `SourceType_Document` | Source is a document — a memo, FOIA-released letter, court filing, public statement |
| Observation | `SourceType_Observation` | Source is the reporter's first-hand observation |

## Why entity-type vocabulary instead of a registered tag schema?

Source-type would naturally be a `journalism-source` registered tag schema (parallel to `legal-irac`, `scientific-imrad`, `argument-toulmin`). Until that schema lands in `packages/ontology/src/tag-schemas.ts`, this skill uses entity-type vocabulary plus `mark.assist` linking. Same query shape; only registration differs.

## SDK verbs

- `browse.resources`
- `mark.assist` (linking)

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/tag-source-type/script.ts'
```

## Output

Per-resource source-type-tag counts.

## Guidance for the AI assistant

- A single passage may carry only one source-type tag (the supporting source for that claim). If two sources support a claim — one named, one anonymous — they should be tagged as two separate annotations.
- `bind-claim-to-source` uses these tags to wire each Claim to its supporting source.
- `balance-audit` uses these tags + the `Topic` annotations to compute named-vs-anonymous distribution per topic.
