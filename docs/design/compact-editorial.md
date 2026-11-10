# Compact Research and complete editorial covers

Historical release record. Current density, controls, full-frame portrait and varied Research illustrations are documented in [interface refinement](interface-refinement.md).

Updated 2026-11-06 on `redesign/portfolio`. Preview [Research](http://localhost:8080/?view=research) and [Blog](http://localhost:8080/?view=blogs).

## Changes

Research rows use 176 px square artwork on desktop and 160 px in compact horizontal layouts. At 700 px and below, and in All, the thumbnail is 72 px. Dates sit beside the small thumbnail; complete titles, summaries and working resources continue across the card width. There is no image-sized blank phone information panel. Normal desktop previews share the artwork height, and enlarged text can grow naturally. Preview author/venue repetition is removed; full paper metadata, attribution, source links, citations and pending author-list status remain available in readers and the preserved archive.

Four newly generated square paper illustrations follow the actual Blog covers' tactile cut-paper/relief-print identity. Their abstract sources, concepts, complete private prompt record and measured WebP weights are documented in [research images](research-images.md). Current public files are `assets/img/research/{paper-id}-{320,640,1200}.webp`, with native responsive source selection and reserved dimensions. No dependency or animation runtime was added.

Missing Blog imagery came from presentation branches, rather than missing image files: the refusal article was explicitly marked text-only, and year/tag/category archives and private drafts used text-only entries. Covered articles now consistently use their real existing artwork. The fallback remains useful when an authored article has no cover; it does not create an empty media element. All twelve source articles, including six drafts, have their three optimized cover variants. Drafts remain excluded from production.

The original nineteen project images, real URLs, dates, language-switching infrastructure, native content readers, history behavior, shared Pretext layer, Projects four-column layout and Blog three-column layout are preserved.

## Audit and verification

All implementation and browser checks ran inside Docker. The complete Chromium suite passed **168 cases across 20 spec files**, with zero skipped, flaky or unexpected results. Sixteen Python tests passed, including the isolated 15-check fixture for dormant capabilities, localization and native fallbacks.

| Verification                                | Actual result                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Browser regression                          | 168 passed                                                                         |
| Python discovery                            | 16 passed                                                                          |
| Responsive matrix                           | 120 cases, zero failures                                                           |
| Real Pretext/browser composition comparison | 1,624 composed texts, zero mismatches                                              |
| Complete direct-page capture checks         | 20 desktop/phone route states, zero page/network errors, overflow or broken images |
| Private draft covers                        | Six configured and six decoded, production exclusion retained                      |
| Category captures                           | 20 states across 1440/1280/768/390/320 px                                          |
| Production output                           | 68 HTML pages, 2,262 local references, six drafts excluded, zero errors            |

The responsive matrix covers fifteen routes across 1440, 768, 640, 600, 581, 390 and 320 px plus 896×414 landscape, including dark mode. The browser regression exercises keyboard/focus, actual 200% text, hidden-content fallback, image loading, searches/filters/sorting, interruption of real animations, reduced motion, reader disposal, overlay/history/direct URLs, citations, original project media and serious/critical accessibility checks. Complete additional captures cover Blog, preserved archives, About, CV, article/project/paper readers and the error page. All six local draft covers were decoded in the development preview without adding drafts to production.

The first visual pass caught a CSS specificity conflict that preserved an older block layout instead of the new compact grid. That rule was corrected before the full regression and final captures. A Python fixture still expected the former text-only refusal article; it now verifies that article's actual configured cover and separately checks the useful fallback on four genuinely coverless control posts. Raw earlier evidence remains private, rather than being relabeled as a pass.

## Performance and source audit

Official Chrome DevTools MCP recorded cold production reloads with CPU 4× and Fast 4G. Observed desktop LCP was **1,459 ms**, mobile LCP **1,332 ms**, and CLS **0.00** in both traces. The corresponding network lists contained 51 and 52 requests with no HTTP errors; console warnings/errors and decoded broken-image lists were empty. These are local lab observations on a shared machine, not field data, a before/after claim or an FPS guarantee. Cache hints from the local Python HTTP server do not describe GitHub Pages CDN caching.

The taste render inspector reports zero failures and six warnings using the established `outlined-box`, `body-size` and `small-text` allowances. Warnings concern the retained warm neutral palette, secondary-text contrast of 6.3:1, compact 22 px name, identity-led heading, absence of unrelated footage and heuristic left-margin detection. Actual shared-frame alignment is covered by browser tests; the profile visibly names the systems-engineering and cybersecurity/AI focus. The compact typography and absence of unrelated media follow the user's direction.

The static design-audit script scanned eighteen authored CSS/JS files: eight clean checks, three finding checks reviewed against source, and seventeen not applicable. Every one of its 44 hover hits was classified; shared transitions, deliberate immediate underline changes and retired rules explain most. Three existing border/background hover changes remain immediate cosmetic choices. The three outline removals have actual `:focus-visible` or wrapper `:focus-within` replacements. The timer hit is a bounded resource-load timeout, not an animation loop. Liquid semantics, actual links and image attributes were reviewed directly because JSX-specific checks do not inspect Liquid.

## Actual tools and evidence

Used: Docker/Jekyll, the built-in image generation tool, ImageMagick 6.9.11-60, Playwright 1.64.1 with Chromium 156.0.8078.79, Pretext 1.0.0, official Chrome DevTools MCP 1.12.0, Prettier 3.1.1, installed taste/design-audit scripts and freshly fetched Vercel interface rules. Runtime versions are Node 24.22.1, Ruby 3.4.11 and Jekyll 4.3.4. No new library or paid external API was introduced. Existing tool/skill installation records remain in the repository's tool documentation.

Parallel agents handled compact layout, Blog cover restoration and independent visual/source review. Root inspection included every new master, delivered thumbnails and actual desktop/phone/dark/reading captures. Screenshots, traces, complete prompts, original masters, exact byte/hash manifests, test JSON and continuity are ignored under `.local/redesign/compact-editorial/`. Private canonical completion is `FINAL.json` in that directory. The existing staged local work and original CV PDF are preserved. No commit, push or deployment was performed.
