---
name: ingest-corpus
description: Walk the repo's investigation-corpus and create one Semiont resource per file with appropriate entity types.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, Write
---

You are bootstrapping an investigation corpus into a Semiont knowledge base.

## What it does

1. `discoverCorpus()` walks the repo's top-level subdirectories.
2. Declares the KB's full entity-type vocabulary via `frame.addEntityTypes` (idempotent).
3. For each ingestable file, calls `yield.resource(...)` with format and filename-derived entity types.

| Filename pattern | Entity types |
|---|---|
| `interview` / `transcript` / `conversation` | `InterviewTranscript` |
| `foia` / `public-records` | `FOIAResponse, Document` |
| `press-release` / `release` | `PressRelease, Document` |
| `statement` / `comment` | `OfficialStatement, Document` |
| `memo` / `memorandum` | `Document` |
| `notes` / `reporter-notes` | `ReporterNote` |
| `document` / `filing` / `report` / `exhibit` | `Document` |
| anything else | `JournalismDocument` |

`README.md`, `LICENSE`, `AGENTS.md`, dotfiles, and config dirs are skipped.

## SDK verbs

- `frame.addEntityTypes`
- `yield.resource`

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/ingest-corpus/script.ts'
```

## Output

Per-file resource id and entity types.

## Guidance for the AI assistant

- Re-running creates duplicates.
- PDFs are cataloged but not analyzed by downstream `mark-*` skills.
- Pre-curated context articles in `context/` / `curated/` / `generated/` survive subsequent runs.
