> Historical layout verification. The [current research integration](research-integration.md) supersedes content counts and delivery measurements; the spatial design system remains in use.

# Spatial and typography system

Reviewed on 2026-11-05, branch `redesign/portfolio`. This supersedes [catalog refinement](catalog-refinement.md) for the current layout. Preview: **http://localhost:8080**. No commit, push or deployment.

## What changed

- Header, main and footer share one centered 1440 px frame and equal responsive gutters of 64 / 48 / 40 / 24 px. Work's visible text aligns with the content edge while retaining its 44 px target. Navigation positions remain consistent across routes.
- The personal profile has one identity group: original 64 px portrait, 22 px name and 13 px profession. Focus, 14 px introduction and 13 px connection handles form separate groups on a four-pixel spacing scale. The biography begins 24 px below the identity. CV belongs to the resources; mobile email occupies a full row.
- Tablet places introduction and connections in two areas above the catalog. Resource columns adapt to a minimum 120 px width so ordinary usernames stay intact at 581–600 px. Grid rows retain the identity's natural height, avoiding stretched gaps. The inherited 604 px workspace maximum is removed.
- Cards use 15 px titles, 13 px excerpts, 12 px metadata and consistent 20 / 24 px insets. Page headings use 26 px on desktop and 24 px on phones. Article prose retains 16 px / 28 px and a bounded reading measure.
- Project, article and paper content is centered within its inner reading measure. CV heading/actions align with the 900 px preview. Sticky reading navigation clears the actual header. About's short-landscape heading leaves room for a complete line at 200% text.

The [design system](readcv.md) records tokens, breakpoints and reading exceptions. Original project images, factual profile information, URLs, six published posts, six unpublished drafts and the source PDF remain. No publications were fabricated. Native filters, ownership groups, reordering, readers, history and Pretext remain functional. No new runtime or dependency was added.

## Verification

| Check                                               | Result                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| Complete consolidated Chromium suite                | 145 passed                                                              |
| Affected regressions after adaptive contact columns | 14 passed                                                               |
| Final regressions after tablet row containment      | 4 passed                                                                |
| Responsive production matrix                        | 114 route/width cases, zero errors                                      |
| Python discovery                                    | 12 passed                                                               |
| Latest production output                            | 64 HTML pages, 1,862 local references, six drafts excluded, zero errors |
| Source checks                                       | Full-project format, JavaScript syntax and Git whitespace passed        |

The matrix covers 19 route states at 1920, 1440, 768, 390 and 320 px plus 896×414 landscape. It checks responses, page errors, horizontal overflow, loaded images, About height and actual DOM line geometry against Pretext. Final supplemental checks include 581, 600, 640, 896, 1000 and 1024 px, precise identity/biography spacing and unbroken ordinary handles. Frame assertions compare header, main, footer and Work text across eight primary route types. Images were scrolled into view and decoded for complete captures.

Actual screenshots were opened, including full catalog/article pages, all eight final inspector sheets, tablet, narrow landscape, dark mobile, About and 12 additional desktop/mobile surfaces covering project/blog archives, a project detail, CV, Research and 404. An independent agent compared measured baselines and eight final captures. Its final review used source and existing images; it did not claim another browser run.

Browser coverage includes keyboard/focus, actual 200% text, direct/reloaded URLs, native readers, Back/Forward, outside/Escape dismissal, category/query/order/ownership combinations, original project media, optional feature disposal, CV pages/text and no-JavaScript fallbacks. Tested accessibility contexts had no serious or critical WCAG A/AA findings.

One intermediate failure came from Chromium's nearest-edge scrolling rounding 0.390625 px of a search input outside a short viewport. Independent geometry reproduction confirmed it with the feed settled. The test now centers the actual field before requiring 100% visibility; the assertion was not relaxed. Targeted navigation and the subsequent complete suite passed. A real enlarged-line issue in short About readers was corrected in heading layout. Failed/intermediate evidence remains private.

## Tools and observations

Actual tools for this revision: Docker/Jekyll, Playwright 1.64.1, Chromium 156.0.8078.79, shared Pretext 1.0.0, official Chrome DevTools MCP 1.12.0, the installed taste inspector/linter and design-audit script. Current Vercel interface rules were fetched before review. The owner's compact read.cv direction, Griffin palette and original media remain the design constraints.

Chrome DevTools MCP recorded cold production navigation with CPU 4× and Fast 4G. Observed LCP was **1,426 ms desktop / 1,491 ms mobile** and reported CLS **0.00**. Console and network listings showed no warnings/errors or failed requests; decoded images and horizontal layout were clean. These are individual local lab observations, not GitHub Pages field results or a universal FPS guarantee.

The taste render inspector reports **0 failures / 6 warnings** with three explicit owner-context allowances: `outlined-box`, `body-size`, `small-text`. The raw report is retained. Warm palette, secondary text, absent footage and compact name-title warnings were reviewed against the explicit reference and actual role/biography. No unrelated footage or giant headline was introduced to satisfy a marketing-page heuristic.

Its remaining `off-centre` warning reports 88 / 65 px using text/media percentiles: frequent resource labels start 24 px after their icons. Actual wrapper bounds and Work text are symmetric at 64 px on a 1440 px viewport, verified independently by DOM assertions. The warning remains visible without another allowance. The visual frame was not distorted to change that percentile.

Source taste lint reports **0 failures / 5 warnings** for real outlined controls/dialog/preview. Static audit scanned four authored CSS/JS files: 11 checks ran, nine clean, two finding classes reviewed, 17 not applicable. Hover feedback inherits shared transitions; search/select outline resets have explicit wrapper focus rings. Unsupported JSX/Liquid checks are not described as passing.

Calculated contrast: primary text 16.16:1 light / 18.02:1 dark; secondary 5.99:1 light / 10.37:1 dark; focus 7.61:1 light / 15.04:1 dark. Quiet dark-surface text is 7.25:1. Interactive boundaries exceed 3:1; decorative card borders are not the sole interactive affordance.

Hosted CI/deployment, physical-device/Safari and assistive-technology certification are not claimed. Existing provider boundaries remain in the [capability matrix](../template-capabilities.md). 21st remains deferred without credentials. No purchase or paid generation occurred.

Compose remains healthy on 8080 with the source bind mount and LiveReload. Raw images, traces, failed logs, backups and continuity stay under ignored `.local/redesign/spatial-system/`, excluded from Git and publication. The owner's original staged patch and existing untracked files remain intact.
