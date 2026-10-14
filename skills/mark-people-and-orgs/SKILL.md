---
name: mark-people-and-orgs
description: Detect formally-named entity spans across the markdown corpus — Person, Organization, Agency, Document, Address, Date, MonetaryValue, Topic.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read
---

You are detecting named entities in the corpus. The output is one annotation per detected span, with `motivation: linking` and an `entityTypes` array carrying the inferred type(s).

## What it does

For every markdown / text resource, calls `mark.delegate(resourceId, 'linking', { entityTypes })`. The model proposes spans and assigns each to one of the requested types.

| Entity type | What it tags |
|---|---|
| `Person` | Named individuals |
| `Organization` | Named non-government organizations, companies, NGOs |
| `Agency` | Government agencies, departments, regulatory bodies |
| `PublicFigure` | Politicians, executives, prominent named figures (often a Person *and* a PublicFigure) |
| `Document` | Named documents referenced in the text — memos, briefs, court filings |
| `Address` | Physical addresses |
| `Date` | Dates |
| `MonetaryValue` | Dollar amounts, contract values, grants, fines |
| `Topic` | Subject-matter topics or beats — "campaign finance", "environmental enforcement", "labor relations" |

Override the type list with `ENTITY_TYPES`.

## SDK verbs

- `browse.resources` — discover the markdown subset
- `mark.delegate` — one call per resource, motivation `linking`

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  node:24-alpine \
  sh -c 'npm ci --no-audit --no-fund && npx tsx skills/mark-people-and-orgs/script.ts'
```

The script prints an address: open it in a browser and approve the sign-in. [Signing in](https://github.com/The-AI-Alliance/semiont/blob/main/docs/builder/SIGN-IN.md) has the other ways a script can sign in.

## Output

Per-resource count of new annotations.

## Guidance for the AI assistant

- This skill does *not* canonicalize the mentions — `canonicalize-people` and `canonicalize-orgs` do that downstream.
- Topic-tagging is intentionally fuzzy here; `balance-audit` and `build-source-graph` use the topics to build per-topic source distributions.
