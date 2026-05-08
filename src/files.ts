/**
 * Corpus file discovery and ingest input preparation.
 *
 * Walks the repo's top-level subdirectories looking for investigation
 * documents (markdown and PDF), classifies each by filename heuristic, and
 * produces CorpusFile records ready for `yield.resource`.
 *
 * Generic across any investigation corpus that follows a flat
 * `<subdirectory>/<file>` layout. Classification rules look at filename
 * substrings common to journalism workflows (`interview`, `transcript`,
 * `foia`, `press-release`, `statement`, `memo`, `notes`). They never
 * reference any specific person, agency, or investigation name.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

export type CorpusFileSource = 'document' | 'curated-context' | 'other';

export interface CorpusFile {
  path: string;
  name: string;
  format: string;
  entityTypes: string[];
  storageUri: string;
  source: CorpusFileSource;
  subdir: string;
}

const FORMAT_BY_EXT: Record<string, string> = {
  '.md': 'text/markdown',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
};

const SKIP_FILENAMES = new Set([
  'README.md',
  'readme.md',
  'README',
  '.DS_Store',
  'LICENSE',
  'AGENTS.md',
]);

const SKIP_DIRS = new Set([
  '.git',
  '.github',
  '.devcontainer',
  '.semiont',
  '.plans',
  '.cache',
  'src',
  'skills',
  'node_modules',
  'tests',
  'docs',
]);

const CURATED_SUBDIRS = new Set(['context', 'curated', 'generated']);

function nameFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  return base.replace(/^\d+[_-]/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function entityTypesForFilename(filename: string): string[] {
  const lc = filename.toLowerCase();

  if (/interview|transcript|conversation/.test(lc)) return ['InterviewTranscript'];
  if (/foia|public[\s_-]?records/.test(lc)) return ['FOIAResponse', 'Document'];
  if (/press[\s_-]?release|release/.test(lc)) return ['PressRelease', 'Document'];
  if (/statement|comment|public[\s_-]?statement/.test(lc)) return ['OfficialStatement', 'Document'];
  if (/memo|memorandum/.test(lc)) return ['Document'];
  if (/notes|reporter[\s_-]?notes/.test(lc)) return ['ReporterNote'];
  if (/document|filing|report|exhibit/.test(lc)) return ['Document'];

  return ['JournalismDocument'];
}

export function discoverCorpus(repoRoot: string = process.cwd()): CorpusFile[] {
  const out: CorpusFile[] = [];

  for (const subdir of readdirSync(repoRoot)) {
    if (subdir.startsWith('.') && !CURATED_SUBDIRS.has(subdir)) continue;
    if (SKIP_DIRS.has(subdir)) continue;
    const subdirPath = join(repoRoot, subdir);
    if (!existsSync(subdirPath) || !statSync(subdirPath).isDirectory()) continue;

    walkSubdir(subdir, subdirPath, repoRoot, out);
  }

  return out;
}

function walkSubdir(subdir: string, dirPath: string, repoRoot: string, out: CorpusFile[]): void {
  const isCurated = CURATED_SUBDIRS.has(subdir);

  for (const entry of readdirSync(dirPath)) {
    if (SKIP_FILENAMES.has(entry)) continue;
    const entryPath = join(dirPath, entry);
    const stat = statSync(entryPath);

    if (stat.isDirectory()) {
      walkSubdir(subdir, entryPath, repoRoot, out);
      continue;
    }
    if (!stat.isFile()) continue;

    const ext = extname(entry).toLowerCase();
    const format = FORMAT_BY_EXT[ext];
    if (!format) continue;

    const relPath = relative(repoRoot, entryPath);
    const baseTypes = entityTypesForFilename(entry);
    const entityTypes = isCurated ? ['BackgroundContext', 'Curated', ...baseTypes] : baseTypes;

    out.push({
      path: relPath,
      name: nameFromFilename(entry),
      format,
      entityTypes,
      storageUri: `file://${relPath}`,
      source: isCurated ? 'curated-context' : 'document',
      subdir,
    });
  }
}

export function readForUpload(file: CorpusFile, repoRoot: string = process.cwd()): Buffer {
  return readFileSync(join(repoRoot, file.path));
}
