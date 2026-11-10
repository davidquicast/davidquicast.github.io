# Interface refinement — 10 November 2026

Implemented on `feature/cv-editorial-review`. The public CV is unchanged: a separate private LaTeX proposal still awaits owner review. All builds, source processing and browser runs take place in Docker. No new JavaScript library or service was introduced.

## Catalog and Research

All uses five columns at desktop widths of at least 1280 px; it steps through four, three, two and one as space decreases. Projects retains four desktop columns and Blog three. CSS column tokens remain the source read by the existing measured, animated feed; filters, sorting, URL state, semantic DOM order and original project artwork are preserved. Featured remains a mark within All rather than a new category.

Research retains one publication per row. Normal desktop artwork/information measures 88×88 px; with 8 px inset the row is approximately 106 px high, compared with 202 px before. Long titles or enlarged text can grow instead of being clipped. Phones use a 56 px square thumbnail with title and resources below. Touch controls retain 44 px targets. Full author lists, summaries, citation resources and relationship disclosures remain in the actual readers and publication archive.

Four newly generated images differ in both subject and medium. [Research image provenance and sizes](research-images.md) records their abstract-based visual arguments and all delivered weights. The originals and prompts remain outside the public bundle.

## Profile connections and photograph

CV sits beside the availability signal, before the biography and connections. RSS is last in the normalized registry and rendered profile links. When more than six connections exist, native details shows the first five and a More links control. Expanding exposes every remaining account, keeping official icons, public usernames and the supplied URLs. Six or fewer connections need no disclosure. Without JavaScript, the native disclosure still works.

Desktop initially shows every account when the sidebar fits the usable viewport height. When it would exceed that height, it offers the same disclosure. Measurement runs on initialization, resize, font loading or content changes, never continuously or on scroll. An explicit expansion choice survives responsive changes. Expanded content uses natural page flow. At 200% text the CV/status row can wrap rather than overflow.

The supplied photograph remains the complete original square frame, resized for 64/128/256 px displays. It has no crop, hover zoom or entrance scaling. The master bytes remain unchanged. See [portrait processing](../profile-image.md).

## Controls and movement

Search and ordering share a precise inset field treatment, category selection has a restrained moving underline, and close/theme controls use consistent outlined icons with visible keyboard focus. Search, query clearing, sorting, ownership filters and reader-close actions remain native controls with actual states and URL behavior. Fine-pointer control density is compact; coarse-pointer controls have 44 px targets.

Theme changes use the native View Transitions API with a short reveal anchored at the theme button. Repeated requests respect the latest intent and the preference survives reload. Reduced motion and browsers without the API update immediately. The tab marker uses interruptible transform animation, avoiding animated width/height. No perpetual animation or animation runtime was added.

## Editorial reading

`reader-typography.css` applies the same semantics to direct pages and fetched overlays: differentiated H1–H6 sizes/weights/spacing, a readable body measure and line height, stronger emphasis, underlined links, quotation panels with attribution, figure captions, tables, reference lists/footnotes, and distinct inline/preformatted code. Syntax colors have explicit light/dark values; old monochrome syntax overrides are corrected only within actual reading scopes. The shared native reader keeps URL/history/focus behavior. Existing content stays unchanged; the semantic fixture tests formatting types absent from shorter real articles rather than inventing public paragraphs or quotes.

## Classifications retained

| Area                          | Retained source and behavior                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Main catalog                  | All, Projects, Blog, Research; recommended/newest/oldest/updated ordering and text search                                       |
| Projects                      | 19 real projects: 15 personal, 4 collaborations; displayed as Personal/Contributions; 15 technical tags; archive topic selector |
| Blog                          | 6 public posts and 6 private drafts; 17 distinct public tags and 6 public categories; year/tag/category archives                |
| Blog curation                 | Configuration currently exposes only 5 display tags and 4 display categories; those are a chosen subset, not deleted metadata   |
| Research                      | 2 coauthored records and 2 papers citing the owner's resources; relationship groups, metadata and search                        |
| Other retained infrastructure | Hidden locale switching, global search, RSS, CV preview/download, contact links and optional content capabilities               |

The older sample project categories `work`/`fun` were replaced with the owner's real `personal`/`collaborations` records. A commit titled “Remove projects.md and publications.md” (`dcb450c`) only changed their navigation flags; both routes remain. The visible Writing/Papers labels were renamed Blog/Research. News is unpublished and its sample records are excluded `.example` files; its announcement configuration remains. No book/review collection was found in the inspected current tree or Git path history, so no removed-books claim is made. Complete source/history inventory and exact tag/category names remain in private continuity.

## Verification records

The first integrated pass identified and corrected a real 320 px / 200% text overflow in the relocated CV row. It also distinguished a 43.999938 px transformed-coordinate rounding artifact from the actual 44 px touch target, and removed redundant nested connection entrance motion. Raw first-round results are retained privately.

Current build, static-reference reports, full browser results, responsive captures, image dimensions/weights, current Vercel interface rules, independent reviews and final outcomes are recorded under ignored `.local/redesign/interface-refinement/`. Prior release documents retain their historical measurements and test totals; those are not substituted for current verification. No field performance, hiring/ATS score, universal accessibility certification or production publication is claimed by these local checks.
