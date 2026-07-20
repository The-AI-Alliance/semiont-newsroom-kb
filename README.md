# Newsroom Knowledge Base (Synthetic Documents)

[![Lint](https://github.com/The-AI-Alliance/semiont-newsroom-kb/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/The-AI-Alliance/semiont-newsroom-kb/actions/workflows/lint.yml?query=branch%3Amain)
[![License](https://img.shields.io/github/license/The-AI-Alliance/semiont-newsroom-kb)](https://github.com/The-AI-Alliance/semiont-newsroom-kb/blob/main/LICENSE)

A collection of **synthetic but realistic investigative-journalism documents** — interview transcripts, FOIA-style agency memos, public statements, official documents — formatted for demonstration of newsroom annotation, source-tracking, and fact-checking workflows with [Semiont](https://github.com/The-AI-Alliance/semiont).

## About This Dataset

This repository contains synthetic newsroom materials. **All people, organizations, agencies, claims, sources, dates, dollar amounts, and document identifiers are entirely fictional.** The documents resemble real investigative materials in form and tone but report no actual events, no actual people, and no actual organizations.

The materials incorporate standard journalism conventions and source-handling patterns — named-on-record sources, anonymous-with-attribution sources, document-derived assertions, observation-based statements; FOIA-response formatting; redaction conventions; press-release language; and multi-source corroboration.

This corpus is well-suited for testing extraction of named sources and organizations; structural classification by source type (named / anonymous / document / observation); canonicalization to external authorities (Wikidata for named figures, agency websites for documents); claim extraction and per-claim provenance binding; balance-audit aggregates that compare named-vs-anonymous sourcing per topic; and fact-check artifacts that ground every assertion in a draft article back to its source.

> **Disclaimer:** These documents are synthetic training materials. They should NOT be cited as factual reporting, do NOT describe actual events or people, have NOT been reviewed for editorial accuracy, and are NOT suitable for any actual journalism workflow on a non-synthetic story. They are purely educational tools designed to demonstrate natural language processing and information extraction techniques on investigation-corpus content.

## Skills

This repo ships twelve skills that build a layered investigation KB on top of the Semiont SDK. See [AGENTS.md](AGENTS.md) for the full design discussion.

| Skill | What it does |
|---|---|
| [`ingest-corpus`](skills/ingest-corpus/SKILL.md) | Walk the repo's investigation corpus (markdown and PDF); create one resource per file. |
| [`mark-people-and-orgs`](skills/mark-people-and-orgs/SKILL.md) | Detect Person, Organization, Agency, Document, Date, MonetaryValue, and Topic spans across investigation text. |
| [`tag-source-type`](skills/tag-source-type/SKILL.md) | Classify each claim or quote by source type — Named / Anonymous / Document / Observation. |
| [`canonicalize-people`](skills/canonicalize-people/SKILL.md) | Promote Person mentions to canonical Person resources, grounded against Wikidata via External References. |
| [`canonicalize-orgs`](skills/canonicalize-orgs/SKILL.md) | Promote Organization / Agency mentions to canonical Organization resources. |
| [`extract-claims`](skills/extract-claims/SKILL.md) | Tag every factual assertion in the corpus; synthesize per-claim Claim resources with structured fields. |
| [`bind-claim-to-source`](skills/bind-claim-to-source/SKILL.md) | For each Claim, resolve its supporting source (Person / Document / Observation) and bind the edge. |
| [`build-source-graph`](skills/build-source-graph/SKILL.md) | Wire Person × Statement × Topic edges; tag inter-source relationships (corroborates / contradicts / supersedes). |
| [`comment-action-items`](skills/comment-action-items/SKILL.md) | Surface follow-up questions, missing corroboration, redacted-section signals across the corpus. |
| [`balance-audit`](skills/balance-audit/SKILL.md) | Aggregate the corpus by topic; compare named-vs-anonymous source distribution per topic; flag imbalances. |
| [`fact-check`](skills/fact-check/SKILL.md) | Per-Claim aggregate listing every supporting and contradicting source with provenance edges. |
| [`build-investigation`](skills/build-investigation/SKILL.md) | Top-level investigation aggregate — narrative-shaped synthesis citing every supporting Claim, Source, Document. |
| [`draft-with-citations`](skills/draft-with-citations/SKILL.md) | Article scaffold: prose paragraphs with inline fact-check links per assertion, ready for editorial review. |

## Quick Start

Explore this dataset using [Semiont](https://github.com/The-AI-Alliance/semiont), an open-source knowledge base platform for annotation and knowledge extraction.

This repo follows the same layout and startup flow as [`semiont-template-kb`](https://github.com/The-AI-Alliance/semiont-newsroom-kb). See its README for full setup instructions:

- [Quick Start: Local](https://github.com/The-AI-Alliance/semiont-newsroom-kb#quick-start-local)
- [Quick Start: Codespaces](https://github.com/The-AI-Alliance/semiont-newsroom-kb#quick-start-codespaces)
- [Inference Configuration](https://github.com/The-AI-Alliance/semiont-newsroom-kb#inference-configuration)

### Open in Codespaces

**Prerequisites:** the [Semiont launcher](https://github.com/The-AI-Alliance/semiont/tree/main/apps/launcher) (`brew install the-ai-alliance/semiont/semiont`) and the [GitHub CLI (`gh`)](https://cli.github.com/), signed in with `gh auth login`.

> **Before creating:** add `ANTHROPIC_API_KEY` as a [user secret](https://github.com/settings/codespaces) with this repo selected. Otherwise the backend comes up but inference is non-functional until you add the secret and rebuild the container.

One command creates the codespace (or resumes the one you already have), waits for the stack to answer, forwards the KB to your machine, and prints the auto-generated admin credentials:

```bash
semiont start --runtime codespace --repo The-AI-Alliance/semiont-newsroom-kb
```

The browser runs **locally** and connects to any number of knowledge bases — cloud or local:

```bash
semiont start --service frontend
```

Open **http://localhost:3000** and add the KB in the **Knowledge Bases** panel, using the port and credentials the launcher printed (`semiont status` re-prints them). `semiont stop --repo The-AI-Alliance/semiont-newsroom-kb` halts billing and keeps your state; add `--delete` to destroy the codespace.

<details>
<summary>Without the launcher: the raw <code>gh</code> recipe</summary>

```bash
gh codespace create --repo The-AI-Alliance/semiont-newsroom-kb --machine premiumLinux
gh codespace ports forward 3000:3000 4000:4000   # leave running
gh codespace ssh -- cat .devcontainer/admin.json # in another terminal
```

This forwards the codespace's own browser as well, so you open **http://localhost:3000** and sign in with those credentials. If `gh` rejects the forward with `must have admin rights to Repository`, grant the scope once: `gh auth refresh -h github.com -s codespace`.

</details>

## License

Apache 2.0 — See [LICENSE](LICENSE) for details.
