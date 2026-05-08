---
name: draft-with-citations
description: Article scaffold — prose paragraphs with inline FactCheck links per assertion, ready for editorial review.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read
---

You are producing the publication-shaped artifact: an article-length scaffold where every assertion in the prose carries an inline link to its FactCheck resource. The editor walks the draft top-to-bottom; clicking any link surfaces the FactCheck (with all supporting and contradicting sources) without leaving the draft.

## What it does

For a given investigation:

1. Walks the Investigation aggregate produced by `build-investigation`.
2. Walks every Claim referenced by the investigation; loads its FactCheck.
3. `yield.fromAnnotation` synthesizes a `DraftArticle` resource — narrative prose where each assertion carries an inline `[fact-check](resource-id)` link.

## SDK verbs

`browse.resources`, `gather.annotation`, `yield.fromAnnotation`.

## CLI args

```
--investigation <resourceId>   # Required. The Investigation resource produced by build-investigation.
```

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/draft-with-citations/script.ts --investigation <id>'
```

## Output

A `DraftArticle` resource. Its body is the article scaffold; every claim carries an inline link to a FactCheck resource. The editor reviews the draft in the Semiont UI, clicking through citations as needed.
