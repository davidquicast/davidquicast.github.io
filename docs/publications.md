# Research records and provenance

Research remains a static Jekyll feature. `_data/publications.yml` is the maintained source for the Research archive, catalog entries, genuine `/research/<id>/` detail pages and downloadable `/assets/bib/<id>.bib` files. Native readers use those same static paths; copying, reloading or opening a new tab preserves ordinary pages.

## Authorship and work cited

The source has two collections:

- `publications`: papers coauthored by David Quispe-Castillo. These may be selected in the profile catalog.
- `citations`: papers by other authors that cite his datasets or other work. These retain their actual paper authors and cannot be selected as authored publications.

`Portfolio::ResearchData.prepare` returns every normalized record. The generator exposes `site.data.research.publications`, `.citations` and `.entries`; the first two are disjoint views of the complete list. Every record, including cited work, receives a real detail page and canonical citation export. All IDs are unique across both collections. Missing collections remain compatible with earlier authoring fixtures; a legacy record defaults to `coauthor`, `verified` and `article`.

### Current source verification

| Record                 | Relationship                                                | Primary evidence                                                                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INCLUDE-2.0            | Verified coauthor; 41 published authors                     | [ACL Anthology](https://aclanthology.org/2026.emnlp-main.1344/) and its PDF list David Quispe-Castillo. October 2026, EMNLP, pp. 30643–30666.                                                                                                              |
| CulturalRiddles        | Owner-confirmed coauthor; public author-list update pending | [Official dataset contributors](https://huggingface.co/datasets/CohereLabsCommunity/CulturalRiddles#contributors) credit David for Spanish (Peru). The [arXiv v3 author list](https://arxiv.org/abs/2610.29968v3) currently has 164 authors and omits him. |
| The #Somos600M Project | Work cited                                                  | [References](https://arxiv.org/html/2407.17479v1#bib.bib43) and [Appendix D](https://arxiv.org/html/2407.17479v1#A4) cite KUNTUR and WikiHowES, credited to David Alonso Quispe Castillo. María Grandury is the paper's sole author.                       |
| RigoChat 2             | Work cited                                                  | [Reference 33](https://arxiv.org/html/2503.08188v1#bib.bib33) credits WikiHowES to David Alonso Quispe Castillo; [Table 1](https://arxiv.org/html/2503.08188v1#S2.T1) includes it among training-data sources. The paper has 13 authors.                   |

Verified on 2026-11-05. Google Scholar contains all four supplied records, so profile membership alone is not used to infer coauthorship. Public ORCID metadata confirms the identity and INCLUDE-2.0 record. OpenReview's supplied profile URL is retained as a connection; its dynamic profile content was not independently verified because the public API returned 403.

CulturalRiddles is included according to the owner's explicit confirmation. `authorship_status: pending_update` and `relationship_note` make the distinction visible. Its canonical author list and citation export preserve the current published 164 names. When a corrected source is published, verify the new author list and order, update the evidence and names, change the status to `verified`, and update the corresponding provenance assertions. Do not add the owner to a canonical citation before that source correction.

## Source schema

```yaml
publications:
  - id: supplied-paper
    title: "Actual publication title"
    authors: ["Published Author One", "Published Author Two"]
    year: 2026
    published_at: "2026-10"
    type: inproceedings
    venue: "Conference 2026"
    booktitle: "Published proceedings title"
    relationship: coauthor
    authorship_status: verified
    selected: true
    summary: "A short factual overview written for the portfolio."
    url: "https://example.org/paper"
    evidence:
      - label: "Publisher author list"
        url: "https://example.org/paper"
citations: []
```

The example documents structure; it is not an additional publication claim.

| Field                                                                | Requirement and behavior                                                                                                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                                 | Required unique lowercase slug; determines detail path, archive anchor and BibTeX filename.                                                             |
| `title`, `authors`, `year`                                           | Required full title, complete ordered list of canonical author names and integer year.                                                                  |
| `relationship`                                                       | `coauthor` under `publications`, `cited_work` under `citations`. Contradictory collection membership fails the build.                                   |
| `authorship_status`                                                  | `verified` or `pending_update`; pending status is limited to coauthored work and requires an explanatory note.                                          |
| `relationship_note`                                                  | Plain text describing the evidence and the author's relationship to the paper.                                                                          |
| `selected`                                                           | Optional boolean; true is rejected for cited work. No citation metrics are inferred.                                                                    |
| `summary`                                                            | Optional short, original factual paraphrase. Display as an overview, independently of the source abstract.                                              |
| `abstract`                                                           | Optional source abstract text; remains plain text and must be escaped. Current records omit full abstracts.                                             |
| `published_at`                                                       | Optional quoted `YYYY-MM` or `YYYY-MM-DD` matching `year`. Preserves exact supplied precision; missing value keeps year precision.                      |
| `type`                                                               | `article` by default; `inproceedings`, `book` and `misc` are also supported.                                                                            |
| `venue`, `journal`, `booktitle`                                      | Published display venue and appropriate citation metadata. Conference exports use `booktitle`; article exports use `journal`; misc uses `howpublished`. |
| `pages`, `publisher`, `month`                                        | Optional real page range, publisher and month. Month accepts 1–12 or `jan`–`dec`, and must agree with any supplied date.                                |
| `doi`                                                                | DOI identifier or doi.org URL. Produces an escaped `doi_url`; no DOI is invented.                                                                       |
| `eprint`, `archiveprefix`, `primaryclass`                            | Optional canonical preprint/archive metadata. arXiv IDs and subject identifiers are validated. Export keys are `archivePrefix` and `primaryClass`.      |
| `url`, `pdf`, `code`, `dataset`, `slides`, `poster`, `supplementary` | Optional HTTP(S) URLs or genuine local files. Empty values do not produce actions.                                                                      |
| `evidence`                                                           | Optional list of `{label, url}` primary-source links; values must be structured text and safe URLs.                                                     |
| `mentions`                                                           | Optional list of `{title, url, evidence_url, note}` for the owner's actual cited artifacts. Both artifact and evidence URLs are required per item.      |

Normalization adds `authors_count`, a bounded `authors_preview` of the first three canonical names followed by `et al.` when needed, `date_precision`, `doi_url`, `detail_url`, `bibtex_url` and `bibtex`. The full `authors` list is always retained. Sorting uses year descending and title as a deterministic tie-break; displayed precision is not fabricated from a sorting timestamp.

All strings remain plain data for mandatory escaping at the template boundary. Build validation rejects unsafe URL schemes, embedded credentials, protocol-relative links, missing local files, encoded traversal, source-escaping symlinks, malformed source lists, duplicate IDs, contradictory relationships/statuses, invalid dates and incorrect rich metadata types. Literal BibTeX markers and unbalanced braces cannot inject additional records. Existing genuine detail routes are never overwritten.

## Citation exports and Scholar

The generated bibliography preserves paper authors rather than the portfolio owner's relationship to a work. INCLUDE-2.0 exports as `@inproceedings` with the real proceedings, publisher, page range and month. arXiv records export their actual `eprint`, archive, subject class, DOI and source URLs. Bibliographic month macros remain proper BibTeX values.

Active `_bibliography/papers.bib` contains the four canonical references, including separately classified cited work, for optional Scholar citations in editorial content. It does not define the Research ownership groups or selected-paper list. The original theme's sample Einstein bibliography remains in `papers.bib.example` and is not published. After editing publication metadata, regenerate the active bibliography from the normalized source so author lists cannot drift:

```bash
bundle exec ruby -rjekyll -ryaml -e '
  require_relative "_plugins/research-data"
  data = YAML.safe_load(File.read("_data/publications.yml"))
  entries = Portfolio::ResearchData.prepare(data, source: Dir.pwd)
  content = "---\n---\n\n" + entries.map { |paper| paper["bibtex"] }.join("\n")
  File.write("_bibliography/papers.bib", content)
'
```

Run this inside the project's existing Docker container. Provider integrations still require real configuration; see the [capability matrix](template-capabilities.md).

## Verification

`tools/test-research-relationships.rb` runs offline contracts for all four real records, canonical author preservation, ownership boundaries, honest dates, supported BibTeX types, source evidence, unsafe/nested links, malformed text, static generator partitioning, collisions and repeated/removed records. `tests/test_research_relationships.py` integrates it with Python discovery. Existing feature-data tests retain their legacy normalization contract. Browser/template integration checks cover escaped output, navigation and the shared readers.

Private source snapshots and PDFs, extraction logs, API responses and continuity stay under ignored `.local/redesign/research-integration/`. No source repository, paper service or scholar profile is modified by this workflow.

## Date precision and revisions

Cards, archive records and direct/native readers now use the same semantic date component as projects and blog entries. Exact primary dates display the full day. INCLUDE-2.0 remains **October 2026**, because ACL supplies no day and Crossref's registration/indexing timestamps are not publication dates. CulturalRiddles retains publication **October 21, 2026** and the separate v3 revision **October 27, 2026**; `last_revised_at: "2026-10-27"` is validated as an ISO day that cannot precede its publication. Somos600M is **July 1, 2024**; RigoChat 2 is **March 11, 2025**. Canonical authors and BibTeX publication metadata remain unchanged by a later revision date. Scholarly structured data exposes the verified revision as `dateModified`.

See [project activity and ordering](project-activity.md) for source checks, cached repository dates, verified PR dates, failure handling and the independent `Latest changes` ordering.
