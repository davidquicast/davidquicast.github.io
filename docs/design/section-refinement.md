# Section composition and About refinement

Later compact sizing, regenerated square artwork and Blog cover restoration are documented in [compact editorial audit](compact-editorial.md). This record describes the earlier revision.

Reviewed 2026-11-06 on `redesign/portfolio`. This follows the [date and activity system](date-system.md). Review the local portfolio at [localhost:8080](http://localhost:8080/). No commit, push or deployment was performed.

## Composition by content

Research uses one full-width row per paper, with a consistent editorial illustration on the left. Publication type, verified dates, author preview, venue, summary and actual resources retain their order. Coauthorship, pending public attribution and citations of the owner's work remain distinct. Artwork now uses a square viewport. The information preview matches its height at normal text size. Below 701 px the square sits above the full-width information preview; its edge is capped at 320 px and follows the available container width. Enlarged text can extend the information area to preserve reading. The preserved `/publications/` archive follows the same image-led arrangement. A paper without configured artwork falls back to a full-width text row, preserving a readable layout while an illustration is prepared.

Projects uses four columns above 1200 px, three through 1200 px, two through 850 px and one through 580 px. Blog uses three columns above 850 px, two through 850 px and one through 580 px. The original project images remain intact. `/projects/` and `/blog/` follow the same densities. All retains its mixed, variable-height catalog.

CSS `--feed-columns` supplies one contract to the readable grid fallback and the native animated feed. Category changes retain the original document, search/sort state, deterministic DOM order and shareable URL. Existing interruptible transforms and reduced-motion behavior remain in place; no animation runtime was added.

## Paper illustrations

Four original cut-paper/relief-print compositions were generated from the actual paper abstracts, extending the existing blog artwork. The atlas, negative-space riddle, collective archive and compact press are editorial metaphors rather than paper figures or documentary images. The full [image record](research-images.md) explains the sources, prompts and optimization.

The 12 public WebP variants are 320/640/1200 px wide. Thumbnails weigh 11–19 KB and full covers 154–193 KB. The intrinsic image files remain 3:2; templates present square crops with reserved space and responsive sources sized for the crop. Initial media remains eager-loaded, with native lazy loading below the fold. Paper social metadata uses the corresponding artwork unless an explicit page image overrides it. Generated masters and complete prompts remain private outside public delivery.

## Profile and About

Connections use 32 px rows for fine pointers and 44 px touch targets on coarse pointers, with no extra row gap. Academic links remain a distinct compact group; ORCID spans the full row and the complete names/identifiers remain visible. The arrangement adapts as configured links are added, without hardcoded link counts.

About retains every original biography word and rich link. Three semantic authored headings organize AI systems, cybersecurity and current work. A two-column reading spread appears when there is room, keeps paragraphs intact and uses bounded desktop reader/dialog heights. Phones, enlarged text and short windows retain native measured pagination; the full source remains readable without JavaScript and in print. Unused pagination controls disappear. CV viewing and the original PDF download remain together, and overlay/history behavior is preserved.

Pagination considers horizontal and vertical overflow, preserves reading position after recomposition and strips cloned IDs so hidden source headings cannot duplicate visible IDs. Observers and listeners still release on reader disposal. About paragraphs use native rich DOM measurement; the shared Pretext layer continues to compose profile/card/paper headings and excerpts rather than replacing semantic text.

## Verification

The square paper preview adjustment and its subsequent checks are recorded separately in [paper preview geometry](paper-square.md). The full-suite results below describe the preceding section refinement.

The complete browser suite passed **163 cases across 19 sequential spec files**, with zero unexpected, skipped or flaky results. Each spec used a fresh Chromium browser, one worker and a renderer-process limit of two to bound memory on the shared machine; generic case budgets were 60 seconds, and existing explicit case budgets were retained. An earlier memory-pressure run remains in private evidence. Native motion regressions now observe actual animation creation and cancellation instead of racing short visual effects across the browser transport. The retained Blog archive expectation was updated to the requested three columns.

| Check                            | Result                                                                  |
| -------------------------------- | ----------------------------------------------------------------------- |
| Complete Chromium suite          | 163 passed                                                              |
| Python discovery                 | 16 passed                                                               |
| New section composition coverage | Eight browser cases, included above                                     |
| Responsive matrix                | 120 cases, zero failures                                                |
| Production output                | 68 HTML pages, 2,142 local references, six drafts excluded, zero errors |
| Source checks                    | JavaScript syntax, full-project formatting and Git whitespace passed    |

The responsive matrix covers 15 routes across 1440, 768, 640, 600, 581, 390 and 320 px plus 896×414 landscape, including dark mode. It checks loaded images, network/page errors, overflow, About height and actual browser text lines against Pretext. Browser cases also cover 200% text, keyboard/focus, disabled JavaScript, interruption/cancellation, reader history, direct URLs, actual CV content and missing optional artwork. Serious/critical accessibility findings were absent in the tested contexts.

Twenty category captures and ten direct/overlay About captures were recorded. Representative desktop, phone, dark, archive and About views were opened, along with all nine final taste inspection sheets. An independent reviewer separately opened seven final captures. Raw evidence, prompts, masters, traces and continuity remain ignored under `.local/`; the canonical completion record is `.local/redesign/section-refinement/FINAL.json`.

## Performance and audit limits

Official Chrome DevTools MCP 1.12.0 recorded cold production navigation with CPU 4× and Fast 4G. Desktop LCP was **1,389 ms**. The two mobile observations were **3,932 ms** in the desktop-to-mobile session and **1,537 ms** in a separate mobile session using the same build. Both traces are retained; no code changed between them. CLS was **0.00** in all samples, with clean console/network listings and decoded image/layout checks. These are local lab observations from a shared machine, not field data, an FPS guarantee or a before/after optimization claim.

Fresh Vercel interface rules were fetched and reviewed. The static design-audit script executed 11 checks over four authored CSS/JS files: ten clean, one reviewed hover-rule finding and 17 component/markup checks not applicable. The actual shared button rule defines its transition; the local regex does not follow that declaration. Taste source lint retains one raw failure for the visually hidden one-pixel heading in short landscape and one warning for the existing 110 ms exit easing; neither is represented as a clean source-lint pass.

The render inspector reports zero failures and six warnings with the three established allowances (`outlined-box`, `body-size`, `small-text`). Warm neutral surfaces, compact profile typography and the absence of unrelated footage follow the retained design direction. The percentile frame warning is recorded; dedicated shared-frame alignment tests passed. The full About fallback, semantic headings and native links were also reviewed directly because the static script does not validate Liquid markup.

Actual tools used for this revision include Docker/Jekyll, the built-in image generation tool, ImageMagick, Playwright/Chromium, Pretext, official Chrome DevTools MCP, the installed taste/design-audit scripts and freshly fetched Vercel interface rules. Three subagents handled artwork, About and regression coverage; an independent read-only review opened seven final captures and found no blocking defect within that scope.
