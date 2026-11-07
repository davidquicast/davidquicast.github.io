# Research integration and verification

Historical academic-integration record. [The date and activity revision](date-system.md) contains current chronology, ordering and verification.

Reviewed 2026-11-05 on `redesign/portfolio`. This supersedes the [spatial delivery](spatial-system.md) for content counts and current verification. Review **http://localhost:8080/?view=research** or the preserved `/publications/` archive. No commit, push or deployment.

## Content and attribution

Three supplied academic profiles are configured: ORCID, Google Scholar and OpenReview. They form a separate group beside existing connections, with the complete ORCID and public author name, local official marks, accessible platform labels and retained source/license attribution. Scholar's opaque account identifier is not used as its visible name.

The four research records retain their complete published author lists:

| Record                                                        | Presentation                                                    | Canonical authors                   |
| ------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------- |
| [INCLUDE-2.0](https://aclanthology.org/2026.emnlp-main.1344/) | Coauthored paper, verified in ACL Anthology and PDF             | 41, including David Quispe-Castillo |
| [CulturalRiddles](https://arxiv.org/abs/2610.29968v3)         | Owner-confirmed coauthorship; public author-list update pending | 164, currently without David        |
| [Somos600M](https://arxiv.org/html/2407.17479v1#bib.bib43)    | Cites the owner's KUNTUR and WikiHowES resources                | María Grandury                      |
| [RigoChat 2](https://arxiv.org/html/2503.08188v1#bib.bib33)   | Cites WikiHowES                                                 | 13 original paper authors           |

The official [CulturalRiddles dataset credits](https://huggingface.co/datasets/CohereLabsCommunity/CulturalRiddles#contributors) identify David for Spanish (Peru). This contribution credit is distinguished from the currently published paper author list. The pending statement is explicit; neither the canonical BibTeX nor structured paper metadata inserts David before that list is updated.

Google Scholar was read inside Docker and matched the four supplied records. ORCID's public API confirms INCLUDE-2.0. OpenReview's supplied URL returns its dynamic page shell, while both profile API variants rejected access with HTTP 403; no additional OpenReview paper metadata or account content is claimed to have been verified. Primary papers, PDFs, official publisher metadata, dataset credits and exact reference anchors establish the displayed relationships. The [research contract](../publications.md) contains source details and the update workflow.

## Interface and implementation

- The unified catalog contains 29 records: 19 projects, six published articles and four research entries. Separate internal counts retain two coauthored papers and two cited-work records. The Research archive explicitly separates **Coauthored papers** and **Work cited in research**. Cited work cannot be selected as an authored Featured publication.
- Paper cards show bounded author previews, honest venue/year, source-backed summaries and the pending status where needed. Details preserve complete native author disclosures, attribution, actual cited resources, source links and canonical citation downloads. Repeated pending notices and duplicate reference links were removed.
- All four `/research/<id>/` routes are real static pages. Internal clicks use the shared native reader; copied URLs, reloads, new tabs and no-JavaScript access retain ordinary pages. Search includes the new records, and archive search hides empty relationship groups.
- Pretext composes actual research titles and summaries through its existing preparation cache and scoped reader lifecycle. Author lists, attribution, controls and citation code retain native HTML.
- Conference exports use `@inproceedings`, real proceedings, DOI, publisher, pages and month. arXiv records retain actual preprint metadata. Month/day precision is validated and preserved. The active Scholar bibliography contains the same canonical records; the tests guard against invented pending authorship or citation-record injection.
- Optional structured metadata is enabled. Each scholarly entity uses the published paper authors, including papers that cite the owner's work. Static generation requires no application backend, external API call or account credential at runtime.

The [design system](readcv.md) remains in use. Original project media, articles, six unpublished drafts, source PDF, routes, localization infrastructure and existing feature flags remain preserved. English remains the visible language. No new runtime dependency or generated imagery was introduced.

## Checks executed

| Check                              | Result                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------- |
| Complete Chromium suite            | 151 passed in 9.0 minutes                                               |
| Python discovery                   | 14 passed                                                               |
| New offline relationship contracts | 21 passed                                                               |
| New academic profile contracts     | Five passed                                                             |
| Scoped responsive matrix           | 64 cases, zero errors                                                   |
| Production output                  | 68 HTML pages, 1,982 local references, six drafts excluded, zero errors |
| Source checks                      | Full-project format, JavaScript syntax and Git whitespace passed        |

The responsive matrix covers the homepage, Research filter, archive, all four direct research details and About at 1440, 768, 640, 600, 581, 390 and 320 px, plus 896×414 landscape. It checks status/network/page errors, loaded images, horizontal overflow, About height and actual browser text lines against Pretext. Source tests also cover invalid URLs, credentials, traversal, unsafe source text, date precision, bibliographic types, author preservation, relationship boundaries, static page generation and route collisions.

Browser checks exercise all four native readers, direct URLs, downloads, full author disclosures, profile identities, archive/global search, no-JavaScript content and accessibility. Existing tests retain keyboard/focus, 200% text, filtering, sorting, history, original images, CV, reduced motion and scoped cleanup coverage. Tested accessibility contexts had no serious or critical findings. Initial new test assertions were corrected for the reader's intentional absolute URL rebasing and for a document token that must be reinitialized after a deliberate full-page reload; the final complete suite passed.

Actual captures were opened across desktop, tablet, mobile, dark and landscape views, including the pending reader, cited resources and the complete archive. A separate agent checked the source and seven captures, with explicit limits on its read-only review. Raw/intermediate evidence remains private.

## Performance and audit scope

Official Chrome DevTools MCP measured cold production navigation with **CPU 4× and Fast 4G**. Observed LCP was **1,350 ms desktop / 1,170 ms mobile**; reported CLS was **0.00**. Console/network listings and decoded image/layout checks were clean. These are individual local lab observations, not GitHub Pages field data or a universal FPS guarantee.

The taste render inspector reports **zero failures / six warnings**, retaining the three established owner-context allowances: `outlined-box`, `body-size`, `small-text`. Warnings for the chosen warm palette, secondary ink, absent footage and compact name-title are reviewed against the owner's read.cv direction. The text/media percentile frame warning is retained; dedicated actual wrapper/navigation alignment tests pass. Source taste lint reports zero failures / five warnings for intentional UI boundaries.

The static design audit scanned the two changed authored CSS/JS files: 11 checks executed, eight clean, three finding classes reviewed, 17 not applicable. Shared hover transitions and explicit wrapper focus rings account for the first two classes. Its JavaScript-animation regex matched a resource-load timeout, not an animation loop. Current Vercel interface rules were fetched. No unsupported JSX/Liquid check is called passing, and no external visual certification is claimed.

Actual tools: Docker/Jekyll 4.3.4, Node 24.22.1, Ruby 3.4.11, Pretext 1.0.0, Playwright 1.64.1, Chromium 156.0.8078.79, official Chrome DevTools MCP 1.12.0, primary-source HTTP/PDF inspection and the pinned design inspection scripts. Two subagents handled source/schema verification and academic profile integration; one also performed the independent final visual/source review.

Compose is healthy on 8080 with bind-mounted source and LiveReload. Provider boundaries remain documented; 21st remains deferred without credentials. No purchases, paid generation or external account changes occurred. Physical-device/Safari, assistive-technology certification and hosted CI/deployment were not performed. Private sources, PDFs, traces, captures and restart continuity remain under ignored `.local/redesign/research-integration/`, excluded from Git and publication. The original staged patch and user-owned untracked files remain intact.
