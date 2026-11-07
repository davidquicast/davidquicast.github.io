# Content dates and project activity

Historical date-system delivery. [The section refinement](section-refinement.md) contains the current visual and verification record; the date contract below remains in effect.

Reviewed 2026-11-05 on `redesign/portfolio`. This extends the [research integration](research-integration.md) and is the current verification record. Review [Latest changes](http://localhost:8080/?sort=updated) and [Research](http://localhost:8080/?view=research). Changes remain local; no commit, push or deployment was performed.

## Shared date model

`_plugins/content-dates.rb` normalizes publication, revision, project chronology, verified contribution and repository activity. Shared semantic `<time>` components render cards, archives and detail readers consistently. Full days are shown when known; month-only and year-only sources retain their real precision. Source timestamps remain in `datetime`. Server rendering and the existing locale formatter provide selectable, indexable content without hydration or client-side date parsing.

| Content          | Primary chronology                                      | Separate activity                                               |
| ---------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| Paper            | Original publication/submission                         | A documented later revision                                     |
| Blog             | Authored publication date                               | Authored `last_updated`, when present                           |
| Personal project | Authored `published_at`, `started_at` or original year  | Latest configured repository commit or Hub modification         |
| Contribution     | Earliest verified linked PR merge, or authored fallback | Latest verified linked PR merge; upstream changes stay separate |

CulturalRiddles shows October 21, 2026 and Revised October 27, 2026. RigoChat 2 shows March 11, 2025; Somos600M shows July 1, 2024. [ACL Anthology](https://aclanthology.org/2026.emnlp-main.1344/) identifies INCLUDE-2.0 as October 2026; neither ACL nor Crossref establishes a publication day. Its DOI registration day is deliberately excluded from publication chronology. Canonical author lists, attribution distinctions and citations remain intact.

The repository collector separates creation from activity. GitHub uses the latest default-branch commit's committer date, not repository metadata/stars or arbitrary branch pushes. Hugging Face uses public repository `lastModified`; this is not a Space uptime or deployment assertion. Project-origin years are preserved when no exact authored date exists. The portfolio's repository creation in 2024 does not rewrite its original 2023 project year.

Five linked PR merges were verified as the owner's contributions. Synthetic Data Generator is dated February 20, 2025; Gemma Recipes July 17, 2025. Smol Course retains December 9, 2024 as its first linked contribution and December 16 as its latest linked contribution. Dates describe the configured verified PRs, not exhaustive account history. Native detail disclosures expose repository dates, source links and check times without duplicating the old PR link list.

## Ordering and refresh

Newest and Oldest retain original chronology. Latest changes sorts by the separate verified activity value. Featured remains the default selected order. All sorting uses stable ties, semantic DOM order, interruptible existing motion and URL/history preservation.

The current snapshot covers 19 projects and 24 public resources. Source verification made 48 successful HTTP requests, including the five configured PR checks. `_data/project_activity.json` is build-time data; visitor browsers make no provider API calls.

The existing deployment workflow now runs the bounded read-only refresh before its normal build. It adds no publication schedule and has not been triggered here. Local refresh is `docker compose exec -T jekyll npm run refresh:activity`. Provider failures preserve previous dates and their successful check time; a refresh attempt never becomes content activity. Offline rendering works from the snapshot. See [the refresh contract](../project-activity.md) for request limits, credential handling and atomic writes.

## Verification

- Complete Chromium suite: 155 passed. Python discovery: 16 passed, including 12 shared-date and 16 refresh contracts.
- Responsive matrix: 88 cases across 11 routes, widths 320 through 1440, dark mode and 896×414 landscape. No overflow, broken images, network/page errors or Pretext/browser line-count differences.
- Production build: 68 HTML pages, 1,982 local references checked, six drafts excluded, zero errors.
- The final PR deduplication and narrow-screen sort-label correction were followed by a fresh production build and 25 passing date/content/profile/spatial browser checks. Dedicated assertions require each linked PR to appear once and the complete Latest changes label to fit at 320, 390 and 768 px.
- The real CLI also completed a live isolated refresh for two projects, three GitHub/Hub resources and one own merged PR, without changing the public snapshot. Offline CLI proof preserved all 24 resources' creation/activity/check dates without network access. Failure, quota and security behavior is tested using injected offline HTTP responses.
- Actual desktop, tablet, mobile, dark and landscape captures were inspected. Project disclosures were additionally reviewed open, including personal and contributed work. Private raw evidence and continuity remain under ignored `.local/`.

Official Chrome DevTools MCP 1.12.0 measured cold production navigation with CPU 4× and Fast 4G: LCP 1,603 ms desktop and 1,323 ms mobile, CLS 0.00. Console, network and decoded image/layout checks were clean. These are individual local lab observations, not field measurements or an FPS guarantee.

Fresh Vercel interface rules, the installed design-audit script and taste source/render inspectors were used. Render inspection reports zero failures and six warnings with the three previously documented allowances (`outlined-box`, `body-size`, `small-text`). Compact typography, warm neutral surfaces and the absence of unrelated footage follow the retained owner direction. The percentile frame warning remains recorded; actual wrapper alignment tests pass.

The broader static audit executed 11 checks over four authored CSS/JS files: nine clean, two reviewed finding classes, 17 not applicable. Explicit main/wrapper focus rings and shared hover declarations account for its findings. The broader taste source lint reports 17 raw failures and 19 warnings from existing rules/controls, visually hidden accessibility text, retained archive/prose divisions and native-dialog/selected-tab shadows. These contextual findings are recorded rather than represented as a clean source-lint pass. No additional exemption was added. An independent agent found no blocking date-semantics defect.

Runtime versions remain Node 24.22.1, Ruby 3.4.11, Jekyll 4.3.4, Pretext 1.0.0, Playwright 1.64.1 and Chromium 156.0.8078.79. No new runtime dependency or application backend was introduced. Existing project media, draft status, CV, routes, localization infrastructure and native readers are preserved.
