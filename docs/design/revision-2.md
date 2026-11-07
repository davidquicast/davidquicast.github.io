> Historical second direction. Superseded by the [read.cv design system](readcv.md). Measurements below belong to that earlier implementation.

# Revision 2: compact portfolio

The first delivery's oversized display type, sparse split layout and omitted project thumbnails did not meet the owner's brief. This revision replaces that presentation with a compact bento composition, a single sans-serif family and explicit primary navigation. The earlier audit records describe behavior of the previous design; this document records the subsequent correction.

## Composition and navigation

The desktop canvas is 1120px with 18px gutters. The opening row pairs a factual profile with a small interactive persona model. The next row shows three selected projects using their actual original images. A writing list, professional profile links and the complete biography follow. There is no pinned half-page panel or oversized footer name.

Overview, Projects, Writing, About and Resume use the same navigation on every page. Current-section states also identify project/article details and the About anchor. The introduction has direct project and email actions. Project filtering retains URL state; personal work precedes collaborations by default. Article outlines use native details/summary and start collapsed on mobile. Project details pair their introduction with the original image in a compact desktop row.

Headings use DM Sans, normally 26–34px, with 16px body text and metadata of at least 13px. Real article/project titles remain complete. User requirements for contained typography and bento organization supersede the taste guide's oversized-display and non-grid recommendations.

## Color roles

| Role              | Light   | Dark    |
| ----------------- | ------- | ------- |
| Canvas            | #f2f4f5 | #11181b |
| Surface           | #ffffff | #1a2428 |
| Secondary surface | #e9edef | #253237 |
| Main text         | #1c282b | #edf2f3 |
| Secondary text    | #526267 | #a9b9bf |
| Accent            | #17685b | #96d6c2 |
| Accent surface    | #e5f1ed | #243f38 |
| Text on accent    | #ffffff | #132721 |
| Border            | #dce2e4 | #34444b |
| Control boundary  | #78888d | #80969f |
| Focus             | #0a716b | #96e1ce |
| Code surface      | #eaf0f1 | #142024 |
| Error text        | #a53131 | #ffabab |

## Original project imagery

All 19 real projects retain their original image choice. No source project image was deleted. The failure was in the previous templates, which no longer rendered frontmatter images.

Seventeen remote originals were cached locally; the two existing local originals were retained. The mapping in [\_data/project_media.yml](../../_data/project_media.yml) records original URL, source kind, accurate alternative text, dimensions, fit and responsive variants. All original frontmatter image URLs remain unchanged.

The 52 public WebP variants total 1,703,746 bytes; the largest is 199,618 bytes. Raster sources are not enlarged, and originals containing embedded raster artwork are treated accordingly. All images use contain fitting to preserve existing diagrams, logos, banner text and illustrations. These are the repository's original images, not newly invented product screenshots. Both original and optimized contact sheets were inspected.

## Motion and Pretext

The persona model follows identity, memory, boundaries and action automatically at a five-second rhythm. Native SVG routes follow measured node edges at each viewport, and Web Animations animate the signal; controls allow manual selection and explicit pause/resume. Hover, focus, hidden tabs and offscreen state suspend automatic work. Reduced motion keeps the readable state and manual controls.

The changing explanation uses the shared Pretext layer. Every update dispatches the actual content event, recomposes the real semantic paragraph and retains its readable fallback. Project titles, descriptions and article headings/excerpts also use the same prepared-text cache and width-dependent layout. There is no decorative Pretext badge or separate demo standing in for integration.

A compact two-column node layout handles enlarged text when the diagram labels would overlap. Scroll entrances, image hover feedback and native document transitions complement the autonomous first-screen sequence. No animation framework or 3D runtime was added.

## References and source decisions

[Chánh Đại](https://chanhdai.com/) supplied a reference for compact profile hierarchy; its [MIT repository](https://github.com/ncdai/chanhdai.com) was inspected. [Cosmo](https://cosmoart.dev/) supplied a visual reference for unequal grid areas and source-led project images; no code was copied because a license file was absent from the inspected tree. [Lucas Diniz](https://lucashdo.com/) and its [MIT repository](https://github.com/LucasHenriqueDiniz/bento-portifolio) informed explicit navigation and modular density. Their decorative widgets, counters, oversized names and particle/glow effects were not adopted.

Actual shadcn MCP card examples and component metadata were consulted. The content grouping was implemented as native articles, headings, images and links, compatible with Liquid. No React or third-party template code was added.

## Verification

Verified inside Docker on 2026-10-29:

| Check                               | Result                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete Chromium regression suite  | 40 passed, including four real motion/Pretext tests                                                                                                           |
| Project media after YAML formatting | Three targeted regressions passed again; every original image loads in the collection and all 19 detail pages                                                 |
| Browser composition                 | Independent text Range geometry agrees with Pretext; prepared text is reused on resize and genuine changes are recomposed                                     |
| Responsive production review        | 45 cases across nine routes, plus five targeted corrected-error-state cases; no horizontal overflow, broken images, failed resources or JavaScript exceptions |
| Sizes and orientation               | 320, 390, 768 and 1440px; 896 × 414 landscape; light and dark themes; current primary section and About anchor verified                                       |
| Enlarged text                       | Actual computed text sizes doubled on five pages at 320/390px; no overflow; persona nodes switch to a non-overlapping compact layout                          |
| Accessibility                       | 16 main-surface scans plus six corrected-error-state scans; zero serious or critical WCAG A/AA findings                                                       |
| Final production generation         | 63 HTML pages and 1,276 local references checked, zero errors; six drafts excluded                                                                            |
| Source checks                       | Prettier, JavaScript syntax and whitespace checks passed                                                                                                      |

Firefox 157 passed all 48 production route/viewport combinations at 320, 390, 768 and 1440px, including independent composition measurements, keyboard menu and search/reset checks. Actual final screenshots were opened for the home, collection, project details, articles, resume and error state, plus all six taste inspector fold/page sheets and both MCP full-page captures. The 404 recovery actions received a final spacing correction and were checked separately across five viewports and both themes.

Official Chrome DevTools MCP production navigation traces, CPU ×4 and Fast 4G:

| Viewport             |    LCP |  CLS |
| -------------------- | -----: | ---: |
| Desktop, 1440 × 1000 | 909 ms | 0.00 |
| Mobile, 390 × 844    | 931 ms | 0.01 |

These are individual local lab observations, not deployed field data. Both reviewed navigations had zero console warnings/errors, failed resources, broken images or horizontal overflow. Final full-page screenshots were opened. No extra runtime library was added.

The taste source lint reported zero failures/warnings. The production taste inspector reports two heuristic failures and four warnings, which are not presented as passing: it requests a larger dominant headline/image and counts only three pictures above its area threshold, although the page contains seven actual images. This revision deliberately retains compact typography and writing thumbnails as requested. Its remaining warnings concern absent footage, the profession line being smaller than its 18px threshold, multiple grid text edges and 12 observed moving elements rather than its preferred 16. The visible profession, real image-led grid and controlled autonomous model were reviewed directly; filler video or giant type were not added to satisfy those thresholds.

The earlier [infrastructure/security audit](verification.md) remains applicable to the unchanged Docker and dependency setup. Optional MCP tooling retains three low upstream advisories, and 21st remains disabled pending credentials. Hosted GitHub Actions, deployment and Safari/WebKit were not run.

Detailed screenshots, browser logs, image provenance and machine-readable results remain private under .local/redesign/revision-2. No commit, push or publication was performed. The working preview remains http://localhost:8080 on redesign/portfolio.
