---
name: bind-claim-to-source
description: For each Claim, resolve its supporting source (canonical Person, Organization, Agency, or Document) and add a graph edge via bind.body.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read
---

You are wiring the Claim → Source graph. After this skill runs, every Claim resource has a graph edge pointing at its supporting source — a canonical Person (named source), Organization, Agency, or Document.

## What it does

1. Walks every Claim resource.
2. For each Claim, gathers context from its source annotation.
3. Looks for canonical Person / Organization / Agency / Document resources whose annotations live in the same source paragraph.
4. Adds a `mark.annotation` on the Claim resource with `linking` motivation pointing at the supporting source — one annotation per source.

## SDK verbs

`browse.resources`, `browse.annotations`, `gather.annotation`, `mark.annotation`.

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/bind-claim-to-source/script.ts'
```

## Guidance for the AI assistant

- Run `extract-claims`, `canonicalize-people`, `canonicalize-orgs` first.
- Anonymous-source Claims have no canonical Person to bind to — they get a `Source: anonymous` text annotation only.
- Document-source Claims bind to the original `Document` / `FOIAResponse` / `OfficialStatement` resource.
