# Previous profile-shell verification

The [current spatial and typography review](spatial-system.md) supersedes this historical delivery.

Reviewed on 2026-11-05. This record supersedes the earlier profile-feed delivery. The application remains static Jekyll on branch `redesign/portfolio`; no commit, push or deployment was performed.

## Result and retained content

The shared Work/About shell replaces the retired navigation on every route. Actual account handles and email addresses use local official-color brand assets. All is the default catalog; Projects, Blogs and Research filter that same document. Featured marks identify curated records within All. Search, date sorting, contextual empty states and historical `writing`/`papers`/`featured` query aliases work without replacing the document.

The catalog contains **19 projects and six published articles**. Original project images, URLs, metadata and useful resources remain available. Six unpublished drafts stay outside production. Publication data remains empty until the author supplies it; validated records already generate real research pages, citations and conditional GitHub/Hugging Face actions.

Native reader dialogs preserve the background page and update the actual URL. Back/Forward, outside dismissal, Escape, nested image/media previews, focus, scroll and filters are exercised. Reloading or pasting a detail URL produces a normal static page. About preserves the complete rich biography through viewport-sized pages, including enlarged text in short landscape windows. CV is accessible in the same reader history as deterministic page previews with selectable source text, and as the original downloadable PDF. Its browser-native viewer was confirmed to render after about three seconds; static previews remove that initial blank/loading state without a heavy client viewer. See [CV generation and budgets](../cv.md).

## Executed checks

| Check                                | Recorded result                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Consolidated Chromium browser suite  | 136 passed in 6.3 minutes on the final rebuilt Docker image                                                       |
| Complete responsive matrix           | 75 cases passed; no overflow, broken loaded images, page errors or text-line differences                          |
| Firefox 157 matrix                   | 72 cases passed; no errors or text-line differences                                                               |
| Final Firefox CV checks              | 4 passed: direct pages at 320/390/1440 px without JavaScript, plus the 390 px reader; source line breaks retained |
| Accessibility                        | 16 narrow-page/theme contexts plus a mounted reader; no serious or critical WCAG A/AA findings                    |
| Python project regressions           | 12 passed, including 19 data/resource, 15 build/localization and 12 catalog contracts                             |
| Complete skill installer regressions | 8 passed                                                                                                          |
| Static publication page contracts    | 5 passed                                                                                                          |
| Production output                    | 64 HTML pages; 1,925 local references; six unpublished drafts excluded; zero errors                               |
| JavaScript syntax and formatter      | Syntax checks passed; full-project formatter check passed                                                         |

The 136 unique browser cases cover real image availability, independent DOM line-box comparisons with Pretext, font changes, preparation reuse, source selection and links, dynamic rich content, Canvas fallback, reduced motion, 200% text, no JavaScript, storage failures, keyboard navigation, direct/overlay history, safe clipboard behavior, original images, rapid filter interruption and scoped resource cleanup. New regressions specifically protect native scrollbar behavior, unchanged background composition, first-render image dimensions and the final text-card overlap correction. The CV fallback checks actual selected resource pixels, source/variant checksums, original PDF words and exact page text with line breaks after production minification. Visual inspection exposed the collapsed text; semantic preformatted HTML now preserves its structure.

The responsive matrix spans 15 actual routes at 1440×1000, 768×1000, 390×844, 320×844 and 896×414. Images were scrolled into view and decoded before complete captures. Actual captures were opened, including narrow articles, full project media, About, readers and the first screen. Independent visual review led to the mobile media cap and final action-slot correction. A test count or inspector score was not used as a substitute for looking at the page.

## Performance observations

Official Chrome DevTools MCP recorded cold navigation on the production preview with **4× CPU slowdown and Fast 4G**. Observed LCP was **1,347 ms desktop / 1,420 ms mobile**, with reported CLS **0.00**. Both sessions had no console warnings/errors, no loaded broken images and no horizontal overflow. These are local lab observations against a simple static server, not field timings, hosted GitHub Pages results or physical-device guarantees.

The trace exposed a real initial-layout mismatch: CSS used a different column gap/minimum than the catalog controller. The first image grew after it had loaded, moving the desktop LCP candidate from about 1.33 s to 2.86 s. Shared CSS layout tokens now keep server-rendered and enhanced media at the same size; a regression checks five widths around the column thresholds.

A separate twenty-reader-cycle diagnostic returned to the same **874 mounted elements and 52 registered Pretext targets**. Total composition calls fell from **2,144 to 144** after removing an unnecessary 15 px modal gutter, unchanged-history refiltering, inherited positioning variables and reads between layout writes. Detail-only targets, observers and renderer instances are released on unmount. Fragment caching is limited to six documents; optional SDK resources are bounded and reused.

Seven warm filter samples measured a **16.7 ms median animation-frame interval**, active-phase p95 values of **16.7–33.4 ms**, and no active-phase gap over 34 ms. First native motion began after approximately 95–167 ms in the in-page activation diagnostic. Initial interaction work remains visible in the raw results; this is not a blanket promise of 60 FPS on every device.

## Tools, accessibility and boundaries

Actual tools include Docker/Jekyll, Pretext 1.0.0, Playwright 1.64.1, Chromium 156.0.8078.47 for the lab traces and 156.0.8078.79 for the final rebuilt-image checks, Firefox 157.0 and official Chrome DevTools MCP 1.12.0. Ruby is 3.4.11, Node 24.22.1 and Jekyll 4.3.4. Exact complete skill snapshots, earlier genuine Figma/shadcn operations and component licenses are in [tool provenance](../redesign-tools.md). The [reference inventory](readcv-references.md) covers all 47 supplied Figma states. 21st remains deferred because credentials are unavailable, as requested; no quota or paid generation is claimed.

Current [Vercel interface rules](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) were fetched before review. The official design-audit script examined 16 authored CSS/JS files: 11 checks executed, eight clean, three requiring review, and 17 not applicable. Hover findings inherit explicit transitions or intentionally immediate link decoration; the two outline removals have visible focus replacements; timers bound optional resource loading rather than drive animation. Unsupported JSX/component checks were not described as passing. Secondary text on cards measures 6.34:1 in light mode and 9.30:1 in dark; on the page backgrounds it measures 5.99:1 / 10.37:1. Control and focus boundaries have separate measured tokens.

Application npm audit recorded zero findings. The last recorded optional MCP-tooling scan has three low findings, isolated from the static site; Ruby advisory remediation and exact dependency scope are documented in [infrastructure](../infrastructure.md). This does not certify the absence of every security issue.

Opt-in renderers retain scoped source and cleanup, with actual fixture coverage for tabs, charts, maps, MathJax, native media and delayed SDK completion. Provider accounts and real subscriptions were not exercised. TikZJax v1 has no supported dynamic rescan: its reader preserves selectable source and an ordinary full-page action; the direct page retains the renderer. Provider singleton and live metrics SDK limits are explicit in the [capability matrix](../template-capabilities.md). No physical Safari, screen-reader session, hosted CI or deployment result is claimed.

## Review and continuity

Open **http://localhost:8080**. Docker uses the source bind mount, native file events and LiveReload. A reversible CSS save appeared in **4.47 seconds**, then the exact source bytes were restored. `docker compose up --build` restores the environment after stopping; normal content/style/script edits update the preview, while plugin edits require a controlled restart.

Maintain connections in the existing social data, selection in `_data/profile_feed.yml`, and publications using the [authoring schema](../publications.md). The [design system](readcv.md) and [Pretext architecture](../pretext.md) describe the current implementation. Raw captures, traces, generated masters, backups and operational continuity remain private under ignored `.local/`, outside Git and published output. The owner's original staged file remains intact.
