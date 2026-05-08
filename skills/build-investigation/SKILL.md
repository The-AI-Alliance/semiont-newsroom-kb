---
name: build-investigation
description: Top-level investigation aggregate — narrative-shaped synthesis citing every supporting Claim, Source, Document.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read
---

You are producing the headline aggregate of the investigation — a memo-shaped narrative that ties every Claim, every named Source, every Document into a single transferable artifact.

## What it does

For a given investigation (a top-level subdirectory in the corpus), or for the whole corpus by default:

1. Walks every Claim resource scoped to the investigation.
2. Walks every canonical Person, Organization, Agency, Document referenced by those Claims.
3. `gather.annotation` over the most material claims to assemble context.
4. `yield.fromAnnotation` synthesizes an Investigation aggregate: narrative arc, key sources, key documents, contested claims, recommended next steps.

## SDK verbs

`browse.resources`, `browse.annotations`, `gather.annotation`, `yield.fromAnnotation`.

## CLI args

```
--scope <subdirectory>   # Optional. Restrict to claims sourced from a specific investigation directory.
```

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/build-investigation/script.ts'
```
