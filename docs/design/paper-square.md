# Square research previews

Later compact sizing, regenerated square artwork and Blog cover restoration are documented in [compact editorial audit](compact-editorial.md). This record describes the earlier revision.

Updated 2026-11-06 on `redesign/portfolio`. Preview: [Research](http://localhost:8080/?view=research), with the preserved [archive](http://localhost:8080/publications/).

## Geometry and content

Paper artwork has a square viewport. In Research and the archive, the information preview uses the same height at normal text size. Desktop feed artwork is 280 px, archive artwork 256 px, and compact horizontal previews use 224 px. At 700 px and below, the square sits above a full-width information panel. Both use the available container width up to a 320 px edge, without viewport-width arithmetic.

The information area includes normal-flow resource links with automatic space above them. It can grow with enlarged text or additional content; equal height never takes precedence over readable text. No titles are truncated. Compact previews omit the author/venue repetitions, and the narrowest previews omit the short summary. Full metadata, abstracts and destinations remain available through the paper readers. Archive attribution, abstract and citation disclosures remain after the preview rather than being clipped inside it.

The original landscape illustrations and responsive WebP variants are unchanged. `aspect-ratio: 1` and `object-fit: cover` supply square crops, and responsive source sizes account for the crop. Existing alternative text, reserved dimensions, eager/lazy loading and semantic links remain intact. No dependency or animation runtime was added. Category changes still use the existing native animated layout and shared Pretext composition.

## Implementation

- `assets/css/section-layout.css`: shared square geometry, container sizing and responsive arrangement.
- `_includes/paper-card.liquid`: resources inside the semantic information flow.
- `_includes/research-record.liquid`: square information preview followed by full attribution and disclosures.
- `_includes/research-image.liquid`: responsive crop-aware source selection.
- `tests/section-composition.spec.js`: geometry across breakpoint widths and actual 200% text without resource overlap.

## Verification

Docker production build passed with 68 HTML pages, 2,142 checked local references, six drafts excluded and zero errors. The final targeted Chromium suite passed 24 cases across section composition, original project media, paper integration and date behavior. This includes square/equal-height previews at nine widths from 320 to 1440 px, real 200% text, rapid category changes, overlay URLs/history, missing artwork, citations, no-JavaScript content and serious/critical accessibility checks in the research archive and pending-author reader.

The changed source files pass formatting, JavaScript syntax and Git whitespace checks. Fresh Vercel interface rules were fetched for the review. The design-audit script scanned the changed CSS in isolation: nine clean checks, 18 not applicable, and one global reduced-motion warning because shared files are outside that isolated scope. The existing reduced-motion guard remains in `assets/js/profile-feed.js` and `assets/css/readcv-interactions.css`; this stylesheet adds no animation. Liquid semantics and image/link attributes were reviewed directly because the script does not check Liquid templates.

A separate browser probe verified 104 paper previews across 13 viewport widths from 320 to 1440 px, covering both Research and the preserved archive: every artwork was square, every normal-size information preview matched its height, with no horizontal overflow or page/network errors. Twelve additional enlarged-text checks at 320/390/768 px showed no clipped information or overlapping resource links. Final desktop, phone, dark-mode, archive and enlarged-text captures were opened and visually inspected. Raw evidence and continuity remain ignored under `.local/redesign/paper-square/`. No new frame-rate or performance result is claimed for this scoped layout change. No commit, push or deployment has been performed.
