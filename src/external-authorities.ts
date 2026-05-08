/**
 * Adapter stubs for journalism external-authority lookups.
 *
 * Per the layered-data-model framing: external authorities (Wikidata for
 * named figures, agency websites for documents, public-records repositories
 * for FOIA filings) live as a peer layer to the in-corpus canonical nodes.
 *
 * For demonstration purposes the lookups are URL-construction only (no live
 * API calls). A production deployment would replace `lookupWikidataStub`
 * with an actual Wikidata SPARQL or wbsearchentities call.
 */

export interface ExternalReference {
  authority: 'Wikidata' | 'AgencyWebsite' | 'CourtRecords' | 'FOIArecords' | 'CongressionalRecord';
  identifier: string;
  url: string;
  label: string;
}

/** Wikidata wbsearchentities URL for a person/organization name. */
export function wikidataSearchUrl(name: string): string {
  return `https://www.wikidata.org/w/index.php?search=${encodeURIComponent(name)}&fulltext=1`;
}

export function wikidataEntityUrl(qid: string): string {
  return `https://www.wikidata.org/wiki/${encodeURIComponent(qid)}`;
}

/** Stub External Reference for a person or organization name. */
export function lookupWikidataStub(name: string): ExternalReference {
  return {
    authority: 'Wikidata',
    identifier: name,
    url: wikidataSearchUrl(name),
    label: `Wikidata: ${name}`,
  };
}

/** Construct a stub URL for an agency by name (defaults to a Google search of the agency website). */
export function lookupAgencyStub(agencyName: string): ExternalReference {
  return {
    authority: 'AgencyWebsite',
    identifier: agencyName,
    url: `https://www.google.com/search?q=${encodeURIComponent(agencyName + ' official site')}`,
    label: `Agency: ${agencyName}`,
  };
}

/** PACER-style court-records search stub. */
export function lookupCourtRecordsStub(query: string): ExternalReference {
  return {
    authority: 'CourtRecords',
    identifier: query,
    url: `https://pcl.uscourts.gov/pcl/pages/search/findCase.jsf?searchType=&searchTerms=${encodeURIComponent(query)}`,
    label: `Court records: ${query}`,
  };
}

/** Generic FOIA-records search stub. */
export function lookupFOIArecordsStub(query: string): ExternalReference {
  return {
    authority: 'FOIArecords',
    identifier: query,
    url: `https://search.usa.gov/search?affiliate=foia&query=${encodeURIComponent(query)}`,
    label: `FOIA records: ${query}`,
  };
}

/** ProPublica-style congressional records search. */
export function lookupCongressionalRecordStub(query: string): ExternalReference {
  return {
    authority: 'CongressionalRecord',
    identifier: query,
    url: `https://www.congress.gov/search?q=${encodeURIComponent(query)}`,
    label: `Congressional record: ${query}`,
  };
}

export function formatReference(ref: ExternalReference): string {
  return `- [${ref.label}](${ref.url})`;
}

export function formatReferenceSection(refs: ExternalReference[]): string {
  if (refs.length === 0) return '';
  return `## External References\n\n${refs.map(formatReference).join('\n')}\n`;
}
