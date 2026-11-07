> Historical revision. The [current spatial and typography review](spatial-system.md) supersedes these layout measurements.

# Catalog and identity refinement

Reviewed on 2026-11-05, branch `redesign/portfolio`. This supersedes the [previous reader delivery](readcv-verification.md) for the current interface. Review locally at **http://localhost:8080**. No commit, push or deployment was performed.

## What changed

- One original portrait on the homepage. The header and About reader no longer repeat it; the extra standalone handle and sidebar About action are removed. The shared navigation remains Work / About, with one homepage CV resource.
- One visible homepage search, beside category and order controls on desktop. Mobile uses a deliberate second control row. Query clearing preserves the selected group/order and restores input focus. Global search remains available with Ctrl/Command+K or `/`; ordinary detail routes retain its header action.
- **All / Projects / Blog / Research**, with Blog singular in navigation and distinct year/tag/category metadata. Top-level counts are no longer repeated. Featured remains a mark within All.
- **Personal / Contributions** restored from the author's original metadata: **15 personal projects, 4 contributions, 19 total**. No repository-host inference or new authorship claim. Cards distinguish Personal project from Contribution. Unknown future categories remain available in All projects.
- The preserved project archive derives its topic selector from every authored project tag, independently of ownership. Query, topic and ownership combine; original `topic=personal` and `topic=collaborations` links retain their meaning.
- Reader chrome names the section; the complete title is shown once in the content and retained as the dialog's accessible name. About keeps its full rich biography, viewport pagination and CV nesting. Original project images, article routes and PDF bytes are preserved. Card surfaces retain their approved frames with no resting shadows.

## Checks actually executed

| Check                                                      | Result                                                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Complete Chromium browser suite                            | 141 passed in 6.7 minutes                                                                                    |
| Final revision-specific suite after the last visual change | 5 passed                                                                                                     |
| Responsive production matrix                               | 95 route/width cases; zero errors                                                                            |
| Python discovery                                           | 12 passed, including 15 ownership/feed contracts, 19 feature/data contracts and 15 build/localization checks |
| Production output                                          | 64 HTML pages, 1,862 local references, 6 drafts excluded, zero errors                                        |
| Source checks                                              | Full-project formatter, JavaScript syntax and Git whitespace checks passed                                   |

The responsive matrix covers 19 real route states at 320, 390, 768, 1440 px and 896×414 landscape, including ownership deep links and combined archive filters. It checks page errors, failed responses, loaded images, overflow and independent DOM text-line geometry against Pretext. Full homepage media was scrolled into view and decoded before complete captures. Actual desktop, tablet, mobile, dark, reader and landscape captures were opened. A separate agent reviewed source and four captures; it did not claim a browser run.

Browser regressions include original images on all 19 project details; no-JavaScript fallback; keyboard/focus; 200% text; direct/reloaded content URLs; Back/Forward and outside/Escape dismissal; category/query/order/ownership combinations; legacy links; optional renderer disposal and actual CV pages/text. Accessibility checks found no serious or critical WCAG A/AA findings in their tested contexts. This is not physical-device or screen-reader certification.

## Browser observations

Official Chrome DevTools MCP recorded cold production navigation with **CPU 4× and Fast 4G**. Observed LCP was **1,444 ms desktop / 1,701 ms mobile**; reported CLS was **0.00**. Both sessions had no console warnings/errors, loaded broken images or horizontal overflow. These are individual local lab observations, not hosted GitHub Pages field statistics or a universal FPS guarantee. Earlier trace files and the previous reader-cycle diagnostic remain historical evidence.

## Design review and tool scope

Actual tools were Docker/Jekyll, shared Pretext 1.0.0, Playwright 1.64.1, Chromium 156.0.8078.79, official Chrome DevTools MCP 1.12.0, the pinned taste inspector/linter and design-audit script. No new frontend runtime or dependency was added. Inter, the chosen Griffin palette, original media and read.cv reference remain. No new direction draw or stock imagery was needed for this component revision. Two subagents handled metadata/contracts and an independent regression/visual review.

The unfiltered taste inspector initially reported4 FAIL / 5 WARN. Resting shadows were removed. Final render inspection reports0 FAIL / 5 WARN with exactly three declared allowances: outlined-box,body-size,small-text. These honor the owner's approved media cards, compact read.cv typography and explicit rejection of giant type; the raw report is retained. Palette warmth, secondary text, absent footage, compact title and name-title warnings were reviewed against the actual engineering-role text and original brief. No filler video or oversized headline was added to satisfy a marketing-page meter. Internal visual critique is subjective: design 8 / usability 8 / creativity 6.5 / content 8.5, weighted 7.8; no external jury result is claimed.

The source linter reports0 FAIL / 6 WARN after removing unused About-label rules and annotating exact UI exceptions. Its raw report is retained: the regex matched `box-shadow:none`, a real floating dialog, a functional input edge and selection/reader boundaries. Five outlined-control warnings and the short 110 ms exit ease-in remain intentional. The separate static design audit examined 4 authored CSS/JS files: 11 checks executed, 9 clean, 2 reviewed findings, 17 not applicable. Input/select outline resets have explicit wrapper focus rings; hover feedback inherits existing transitions. Unsupported JSX checks were not described as passing. Current Vercel interface rules were fetched before the final review.

The Docker restart closed the initial native MCP transport; the official MCP was then exercised through the existing SDK client inside Docker. The taste browser's initial sandbox startup failure was resolved with a private Chromium launcher using the same container flags as Playwright. Installed skill sources were not modified. No service was purchased; 21st remains deferred without credentials, as requested. Existing provider/account boundaries remain in the [capability matrix](../template-capabilities.md).

## Maintenance and continuity

Change connections in `_data/socials.yml`. Keep original `category: personal` / `category: collaborations` in project frontmatter; normalized ownership, counts and controls are generated. Add topics through the existing tags, rather than editing a second hardcoded option list. Preserve source filenames and real URLs. The [design system](readcv.md), [Pretext layer](../pretext.md) and [CV pipeline](../cv.md) describe the shared implementation.

Compose remains healthy on 8080 with source bind mount and LiveReload. Private captures, traces, failed/intermediate logs, source backups and continuity stay under ignored `.local/redesign/profile-refinement/`, excluded from Git and deployment. The owner's original staged patch and original untracked files remain intact.
