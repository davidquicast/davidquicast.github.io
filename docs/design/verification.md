> Historical audit of the first design. See the [current read.cv verification](spatial-system.md) and [design system](readcv.md).

# Comprehensive audit and verification

Audited on 2026-10-29, after the first redesign delivery. Work remains on the separate redesign/portfolio branch. Nothing was committed, pushed, merged or deployed during this audit. The local Docker preview is available at http://localhost:8080.

The audit combined source review, generated-output checks, browser interaction tests, independent text geometry measurements, accessibility scans, dependency advisories and visual inspection of actual screenshots. The original 14 tests passed before additional checks found the issues below. Passing a previous suite was not sufficient evidence for these edge cases.

## Corrected findings

| Area               | Finding and correction                                                                                                                                                                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile navigation  | A failed deferred script left a visible but inert menu. Essential menu/theme handlers now initialize independently, while optional controls remain disabled until their handlers exist. Full content stays readable without enhancement.                                                                                         |
| Theme              | Blocked browser storage suppressed the operating system dark preference. Theme resolution now handles storage failure independently and preserves the manual choice in memory.                                                                                                                                                   |
| Text composition   | Inherited fonts and edits made while hidden could retain stale Pretext layouts. Batched invalidation now covers these cases without unnecessary repeated preparation.                                                                                                                                                            |
| Text resilience    | Rich markup replacement retained obsolete diagnostics; document-dispatched content events were ignored; recomposition could erase selection; Canvas failure retried continuously. Native fallbacks, event handling, selection restoration and bounded failure caching address these cases.                                       |
| Firefox headlines  | Four of 48 cross-engine cases rewrapped a line already composed by Pretext. Composed line spans now retain their calculated line; long unbroken tokens still use a native wrapping fallback.                                                                                                                                     |
| Code controls      | A Copy button following an unwrapped pre element used the document body as its positioning ancestor and overlapped the theme control. Every code block now owns a positioned wrapper; geometry and actual clipboard copying are tested.                                                                                          |
| Feed and archives  | The feed exposed a placeholder title and empty author names. Author/title metadata and distinct year/tag/category archive metadata are now generated correctly.                                                                                                                                                                  |
| Production content | Original template announcements, demos and sample resumes reached public output. They are excluded while their source files are preserved. Draft exclusion now checks actual frontmatter dates/permalinks, feed and sitemap entries.                                                                                             |
| Article behavior   | External articles retain a deliberate source link without a timed redirect or fabricated reading duration. The real resume has direct Open PDF and Download links. Three collaboration pages have a corrected heading hierarchy.                                                                                                 |
| Article accuracy   | Unsupported compression/speed guarantees and ambiguous destructive pruning advice in the WSL article were corrected against official Microsoft/Docker sources. The original route/publication date remains intact, with an explicit update date. No Windows commands were executed as part of this review.                       |
| Build dependencies | The initial Ruby dependency scan reported 22 advisories. A controlled locked update reduced the reported count to zero. The application npm scan also reported zero. Optional MCP tooling retains three low-severity upstream findings, detailed below.                                                                          |
| Docker and tooling | The patched development image runs without root, binds preview/draft ports to loopback and persists verified complete skill installations. Tampered or incomplete installations fail verification. Native project MCP configuration and bounded container filesystem access were added and exercised through the SDK.            |
| Automation         | Obsolete upstream image publishers, demo badge jobs and branch-writing formatter jobs were retired. Useful checks use locked Docker tooling. Production validation precedes publication, and build/PR jobs have read-only access. The verification workflow now runs all browser regressions after generating production output. |

## Final verification

| Check                                   | Observed result                                                                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entire Chromium browser suite           | 33 passed, no skips, 1.7 minutes                                                                                                                          |
| Latest accessibility suite              | 16 WCAG A/AA scans at 320/390 px across both themes; zero serious or critical findings                                                                    |
| Separate cold-build accessibility check | Six additional production blog scans across three widths and both themes; zero serious or critical findings                                               |
| Firefox 157, final production files     | 48 route/viewport cases passed at 320/390/768/1440 px, zero line discrepancies, overflow or JavaScript exceptions; keyboard menu/search/reset also passed |
| Static production output                | 63 HTML pages, 1,102 local references, zero errors                                                                                                        |
| Publishing checker regressions          | Nine mutation tests passed                                                                                                                                |
| Skill installer regressions             | Eight tests passed                                                                                                                                        |
| Unpublished content                     | Six drafts excluded from production pages, feed and sitemap                                                                                               |
| Editorial images                        | All 36 responsive WebP files decode and meet documented size budgets; reserved dimensions and responsive requests verified                                |
| Source checks                           | JavaScript/Ruby/shell/Python syntax, Prettier, workflow actionlint and git diff whitespace checks passed                                                  |
| Public runtime/build advisories         | Application npm: zero; Ruby build gems: zero against the recorded advisory database snapshot                                                              |

Browser tests use actual content and APIs: independent character Range line counts, font loading, resize, text selection, Canvas recovery, keyboard navigation, partial/no JavaScript, blocked storage, native clipboard, URL-restored filtering, empty-state reset, section links, reduced motion and actual text enlargement. The production content tests read the final generated files. Nine publishing-checker mutation tests deliberately introduce broken output and verify rejection; eight installer tests exercise incomplete/tampered packages and recovery behavior.

## Visual coverage

A full-content pass captured every published project detail, all six published articles, six local drafts and secondary pages. Baseline evidence contains 86 browser screenshots, followed by corrected-page captures. Screenshots and contact sheets were opened and inspected, including long titles, code, citations, generated covers, project resources, the PDF viewer and the footer. Main surfaces were checked at 320, 390, 768 and 1440 px, plus landscape and enlarged text. Twenty-seven targeted corrected-page viewport checks reported no horizontal overflow or JavaScript exceptions. Chromium covers the rendering engine used by Brave; Firefox provides a separate engine check.

The landscape persona controls were also activated at 896 × 414 while still within the work section. No speculative scrolling override was added. Accessibility scores were used alongside keyboard/touch geometry and visual review; they are not presented as proof of complete accessibility.

## Production lab performance

| Viewport             |      LCP |  CLS |
| -------------------- | -------: | ---: |
| Desktop, 1440 × 1000 | 1,139 ms | 0.00 |
| Mobile, 390 × 844    | 1,064 ms | 0.00 |

The final navigations had no console warnings/errors, failed resources, unexpected external requests, broken images or horizontal overflow. The post-scroll review loaded all visible image content; responsive covers used 960 px desktop and 480 px mobile variants. Both pages prepared and laid out 14 actual Pretext targets, with no measurement errors.

These are local lab navigation measurements with real production content, CPU throttling ×4 and Fast 4G emulation through the official Chrome DevTools MCP. They are not deployed field measurements or an estimate of every visitor's experience. Trace files, network/console output, full-page screenshots and detailed review notes remain private under .local/redesign/audit-2026-10-29.

## Limits and deferred work

- The 21st MCP requires credentials. It remains disabled; no authenticated access/quota lookup or paid generation was performed.
- Optional shadcn MCP tooling has three low-severity transitive findings involving deepmerge. No patched compatible release was available during the audit. These packages are outside the public site's runtime.
- Of 50 unique external content URLs checked, 45 returned successful responses; four scholarly publisher/DOI destinations rejected automated access with HTTP 403 and LinkedIn returned 999. No 404 was observed. The five restricted destinations were preserved and are not represented as fully validated content.
- A clean isolated ARM64 build using UID/GID 1001 verified ownership, fresh dependencies, generated assets and production checks. Workflow syntax/expressions passed actionlint 1.7.12. Hosted GitHub Actions and deployment were not triggered; optional Shellcheck was unavailable.
- MCP server commands, discovery and operations were exercised through the SDK. Automatic loading of the new native client configuration requires a fresh/reloaded client and was not observed in this existing session.
- Upstream template Sass/notebook deprecation warnings remain. The new presentation does not load the legacy stylesheet. No Safari/WebKit or real-device claim is made.
- Dependency scans and the checks above cover known findings and exercised behavior; they do not establish the absence of every possible bug. Drafts remain unpublished, including those whose editorial sources still need author review.

See [tool versions and provenance](../redesign-tools.md), [Docker/security/CI maintenance](../infrastructure.md), [Pretext architecture](../pretext.md), [design decisions](README.md), and [editorial image budgets](editorial-images.md).
