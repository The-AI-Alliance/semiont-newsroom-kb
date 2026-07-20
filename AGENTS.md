# AGENTS.md — semiont-newsroom-kb (and any investigation-corpus KB)

This is an investigative-journalism Semiont knowledge base. The corpus is interview transcripts, FOIA responses, public statements, official documents, and reporter notes. The skills detect people, organizations, agencies, and documents; classify each claim by source type (named / anonymous / document / observation); canonicalize names against external authorities (Wikidata); extract every factual assertion as a Claim resource; bind each Claim to its supporting source; build a source × topic graph; audit corpus balance for named-vs-anonymous distribution; produce per-claim fact-checks; and synthesize a top-level Investigation aggregate plus a draft-with-citations article scaffold.

If you're an AI assistant working in this repo, this file is your orientation. The skills are **corpus-generic** — drop a different investigation corpus into the same directory layout and they work without modification.

## What's here

- **Top-level subdirectories** (e.g., `<investigation-name>/`) — each holds the documents for one investigation. Each file becomes one resource via skill 1.
- **`context/`, `curated/`, or `generated/`** (optional) — pre-curated context articles (background briefs, beat-reporting summaries). Skill 1 ingests them as `BackgroundContext` resources on day 1.
- **`src/`** — small helper modules:
  - `src/files.ts` — corpus discovery and classification by filename heuristic
  - `src/journalism-patterns.ts` — fast pattern-detection for source attributions ("according to X", "X told the reporter", "[REDACTED]"), used as a pre-filter
  - `src/external-authorities.ts` — adapters for Wikidata-style name lookups, agency-website URL construction
  - `src/interactive.ts` — `confirm` / `pick` / `preview` helpers for tier-3 interactive checkpoints
- **`skills/`** — twelve skills, each shipping a `SKILL.md` plus a `script.ts` that uses `@semiont/sdk` against the running backend.

| Skill | What it does | New SDK verbs |
|---|---|---|
| [`ingest-corpus`](skills/ingest-corpus/) | Walk the repo, declare entity-type vocabulary, create one resource per file | `frame.addEntityTypes`, `yield.resource` |
| [`mark-people-and-orgs`](skills/mark-people-and-orgs/) | Detect Person, Organization, Agency, Document, Date, MonetaryValue, Topic spans | `mark.assist` (linking) |
| [`tag-source-type`](skills/tag-source-type/) | Classify each claim/quote by source type | `mark.assist` (linking + interim entity-type vocabulary; will migrate to registered tag schema) |
| [`canonicalize-people`](skills/canonicalize-people/) | Promote Person mentions to canonical Person resources via Wikidata grounding | `+ match.search`, `+ yield.fromAnnotation`, `+ bind.body` |
| [`canonicalize-orgs`](skills/canonicalize-orgs/) | Promote Organization mentions to canonical Organization resources | same shape as canonicalize-people |
| [`extract-claims`](skills/extract-claims/) | Tag each factual assertion; synthesize Claim resources | `+ yield.fromAnnotation` |
| [`bind-claim-to-source`](skills/bind-claim-to-source/) | Resolve and bind each Claim to its supporting source span | `+ gather.annotation`, `+ bind.body` |
| [`build-source-graph`](skills/build-source-graph/) | Wire Person × Statement × Topic edges; tag relationships | `+ mark.annotation` |
| [`comment-action-items`](skills/comment-action-items/) | Surface follow-up questions, missing corroboration, redaction signals | `mark.assist` (commenting) |
| [`balance-audit`](skills/balance-audit/) | Per-topic named-vs-anonymous source distribution | `browse.annotations`, `yield.resource` |
| [`fact-check`](skills/fact-check/) | Per-Claim aggregate with all supporting/contradicting sources | `+ gather.annotation`, `+ yield.fromAnnotation` |
| [`build-investigation`](skills/build-investigation/) | Top-level investigation aggregate — narrative synthesis | full pipeline composition |
| [`draft-with-citations`](skills/draft-with-citations/) | Article scaffold with inline fact-check links | full pipeline composition |

## What does investigative journalism involve?

Working investigations usually involve several braided activities:

1. **Cataloging** — what interviews, FOIA responses, public statements, and documents exist; what topics each touches.
2. **Source identification** — formally-named people and organizations, plus the descriptive references ("a senior official", "people familiar with the matter") that point at unnamed sources.
3. **Source-type classification** — every claim is supported by a Named source, an Anonymous source, a Document, or an Observation. The four-way classification is the reportorial spine of the investigation; once a corpus is source-typed, balance-audits and fact-checks become tractable.
4. **Canonical-vocabulary grounding** — Wikidata for named figures (so the same person across multiple interviews is one node), agency websites for documents.
5. **Claim extraction** — every factual assertion in the corpus becomes a Claim resource with a unique identifier. Aggregates (fact-checks, draft articles) reference Claims, not raw text.
6. **Provenance binding** — every Claim is bound to its supporting source(s). Multiple sources strengthen a Claim; contradicting sources surface as a flag for editorial review.
7. **Balance audit** — per-topic source distribution. An investigation that quotes only anonymous sources on Topic T while quoting only named sources on Topic U should know that about itself before publication.
8. **Fact-check artifact** — for any draft assertion, the fact-check is a queryable aggregate listing every supporting and contradicting source. Editorial review walks the fact-check, not the raw corpus.

The Semiont SDK is well-suited for all eight. The skills are organized to demonstrate that — turning a raw set of investigation documents into a navigable network of Person, Organization, Agency, Document, Topic, Claim, FactCheck, BalanceAudit, and Investigation resources, all anchored back to the source paragraphs.

## Pre-curated context articles are preserved

Drop a markdown file into `context/`, `curated/`, or `generated/` and skill 1 ingests it as a `BackgroundContext` resource on day 1. Skills that synthesize new context articles `match.search` against existing ones first, so any hand-curated content survives subsequent runs.

## Entity types used in this KB

- **People & orgs**: `Person`, `Organization`, `Agency`, `PublicFigure`
- **Documents**: `Document`, `FOIAResponse`, `PressRelease`, `OfficialStatement`, `InterviewTranscript`, `ReporterNote`, `JournalismDocument`
- **Where & when & how much**: `Address`, `Date`, `MonetaryValue`, `Topic`
- **Source-type vocabulary** (interim until a registered `journalism-source` tag schema lands): `SourceType_Named`, `SourceType_Anonymous`, `SourceType_Document`, `SourceType_Observation`
- **Synthesized aggregates**: `Claim`, `FactCheck`, `BalanceAudit`, `Investigation`, `DraftArticle`, `SourceRelationship`, `Aggregate`
- **External-authority shadows**: `WikidataEntity`, `AgencyRecord`
- **Curated content marker**: `BackgroundContext`, `Curated`

## Worked example: investigating an unnamed senior official

The seeded corpus contains an investigation where a fictional agency policy is challenged in interview transcripts and FOIA-released memos. Some sources are named; others are described only as "a senior official" or "a person familiar with the deliberations." After running the pipeline:

1. `ingest-corpus` → resources for each document.
2. `mark-people-and-orgs` → annotations on named entities.
3. `tag-source-type` → annotations classifying each claim by source type.
4. `canonicalize-people` → Person resources for every named figure.
5. `canonicalize-orgs` → Organization / Agency resources.
6. `extract-claims` → Claim resources for every factual assertion.
7. `bind-claim-to-source` → each Claim bound to its supporting source span (named or anonymous).
8. `build-source-graph` → Person × Statement × Topic edges.
9. `fact-check` → per-Claim aggregates listing supporting and contradicting sources.
10. `balance-audit` → per-topic named-vs-anonymous distribution.
11. `build-investigation` → top-level narrative synthesis citing every Claim, Source, Document.

The `Investigation` is the demonstration — a queryable artifact that shows *what the investigation reports*, citing the exact source spans, with each Claim's source type explicit. This pattern works on any investigation corpus.

## Why source-type is implemented as entity-type vocabulary, not a registered tag schema

Tag schemas registered upstream (`legal-irac`, `scientific-imrad`, `argument-toulmin`) are the architecturally correct fit for source-type — Named / Anonymous / Document / Observation are exactly the structured-tagging shape IRAC and IMRAD are. Until a `journalism-source` schema lands in `packages/ontology/src/tag-schemas.ts`, this KB uses entity-type vocabulary (`SourceType_Named`, etc.) plus `mark.assist` linking. The query shape is identical; the only difference is registration.

## Working in containers — do not install npm packages on the host

This template assumes a containerized workflow. The backend stack runs in containers (`semiont start` brings it up); the skills run in containers too. There is **no need** to install Node, the SDK, or any other tooling on the host machine.

## Backend setup

Before running any skill, the Semiont backend stack must be up. Two paths:

### Local: `semiont start`

```bash
brew install the-ai-alliance/semiont/semiont   # once
semiont start
semiont useradd --email admin@example.com --password password --admin
```

### Codespaces

Open the repo in a Codespace — `post-create.sh` pulls the stack's images, `post-start.sh` brings it up, admin credentials auto-generate into `.devcontainer/admin.json`. Forward the port: `gh codespace ports forward 4000:4000`.

## Parameterization and interactivity

Skills are parameterized in three tiers — environment configuration (`SEMIONT_API_URL` / `SEMIONT_USER_EMAIL` / `SEMIONT_USER_PASSWORD`), skill-invocation parameters (per-skill env vars and CLI args), and tier-3 interactive checkpoints (off by default; enable with `--interactive` or `SEMIONT_INTERACTIVE=1`).

## A note on PDFs

`mark.assist` operates on `text/markdown` and `text/plain`. PDFs are ingested by skill 1 as `application/pdf` resources — they're cataloged and visible in the KB but downstream `mark-*` skills skip them.

## Background reading

| Where | What |
|---|---|
| [`@semiont/sdk` README](https://github.com/The-AI-Alliance/semiont/tree/main/packages/sdk) | The TypeScript surface — eight verbs (frame, yield, mark, match, bind, gather, browse, beckon) plus admin/auth/job. |
| [SDK Usage docs](https://github.com/The-AI-Alliance/semiont/tree/main/packages/sdk/docs) | Cache semantics, reactive model, state units, error handling. |
| [Semiont protocol skills](https://github.com/The-AI-Alliance/semiont/tree/main/docs/protocol/skills) | Reference skill packs. |
| [Wikidata](https://www.wikidata.org/) | Canonical authority `canonicalize-people` grounds against. |
| [SPJ Code of Ethics](https://www.spj.org/ethicscode.asp) | Source-handling principles that inform the source-type vocabulary. |
