# Profile and reading system

The portfolio remains a static Jekyll site for GitHub Pages. Its visual reference is read.cv’s compact profile and Front Page media composition. The [reference inventory](readcv-references.md) documents all 44 raster references and three editable Figma frames. GitHub and Hugging Face’s actual profile pages informed the current identity/sidebar arrangement. No social-network registration, fabricated activity, follower metrics or application backend was added.

## Shared shell

Every page uses the shared Work/About navigation and appearance control. On the homepage the original portrait and name appear once, in the profile sidebar. The header and About reader do not repeat the portrait. The sidebar retains the factual introduction, actual connection handles and one CV resource link; About is reached through the shared navigation. Ordinary detail routes retain the same Work/About positions and global search action. The homepage has one visible catalog search; site-wide search remains available through Ctrl/Command+K or `/`.

Connections display actual usernames or email addresses; accessible names retain platform identity. Exact local brand assets use official colors, with theme-sensitive monochrome marks where appropriate. Adding a configured connection does not require a new layout component.

The catalog has four views: **All, Projects, Blog and Research**. All is the default. Featured is a mark on genuinely selected records within All. Categories come first; compact query and order controls align beside them on wide screens and form a second row on phones. Counters are not repeated on every top-level category. Query clearing keeps the current ownership group and order, and returns focus to the input.

Projects exposes contextual **All projects / Personal / Contributions** controls. These restore the original authored categories: `personal` maps to `independent` (15 records) and `collaborations` maps to `contributions` (4 records). Repository ownership is never used to infer authorship. Unknown future categories remain visible in All projects. The preserved `/projects/` archive also offers every authored topic, separately from ownership, so query, ownership and topic can be combined. Legacy `topic=personal` and `topic=collaborations` links retain their meaning.

Recommended order places selected records first and retains deterministic source ranks. Newest/oldest sorting uses honest publication/contribution precision, stable ties and the same semantic DOM order as the visible cards. A separate Latest changes order uses verified resource/editorial activity without rewriting the original chronology. Shared semantic dates show complete days, source-only months and honest year fallbacks; repository creation and upstream commits never become a fabricated project start or owner contribution. [Date and activity policy](../project-activity.md) records source and refresh semantics. Historical `view=writing`, `view=papers` and `view=featured` links remain aliases for Blog, Research and All. The existing `view=blogs` URL is retained while the visible label is singular. Ownership uses `view=projects&project=independent|contributions`. Filtering, sorting and searching update the URL without loading a document.

Content categories own their density: Projects uses four desktop columns, Blog three and Research one row per paper with a consistent left illustration. Research uses compact square artwork; on phones and All, a 72 px thumbnail sits beside dates while the complete title, summary and resources use the full measure. Shared CSS column tokens also drive native animated layout; the archive routes follow their corresponding composition. [Current composition](compact-editorial.md) records responsive breakpoints and actual checks.

Phone project media is contained within a 192 px maximum height; the complete original artwork remains visible and linked. Real project images retain their composition and reserved dimensions. Different proportions and text lengths create independent card heights.

## Frame and spacing

Header, main and footer share one centered, maximum 1440 px frame. Equal outer gutters are 64 px above 1200 px, 48 px through 1200 px, 40 px through 1000 px and 24 px through 580 px, with safe-area insets. The visible Work text aligns with the content edge; its 44 px touch target extends around that edge. There is no page-specific wordmark offset. The fixed header is 72 px high on larger screens and 64 px on phones.

Spacing follows a 4 px base: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 px. The portrait, name and profession form one identity row with a 16 px gap. Biography and connections are distinct groups separated by 20 px; the CV belongs to the connection resources. Handles use the same size on desktop and phone. Long email addresses occupy a full row in the two-column layouts.

The desktop catalog sits beside a 240 px identity column with a 48 px gap; intermediate desktop uses a 224 px column and 32 px gap. Through 1000 px the catalog follows the identity. Tablet places biography and resources in two areas above it; resource columns adapt to a minimum 120 px measure so ordinary usernames stay intact near the breakpoint. Phone stacks the profile groups. A legacy 604 px workspace maximum is explicitly reset. The outer frame remains shared on reading pages, while project/article/paper content is centered within its own reading measure. CV heading and actions align with the actual 900 px preview. Sticky reading navigation clears the real header by 24 px and uses the dialog's own offset when opened in a reader.

## Tokens and typography

Inter is self-hosted in four weights. Shared roles are 22 px for the profile name, 13 px for its profession and connection handles, 14 px / 1.7 for the introduction, 15 px for card titles, 13 px for card excerpts and 12 px for metadata. Page headings are 26 px on desktop and 24 px on phones; article prose retains 16 px / 28 px and an inner reading measure near 600 px. Controls and metadata remain subordinate to authored content. Pretext composes actual profile, card and article text, retaining selectable HTML and links. [Implementation and browser checks](../pretext.md) describe its preparation cache and width-dependent layout.

| Role                  | Light     | Dark      |
| --------------------- | --------- | --------- |
| Background            | `#f9f5ef` | `#0c0c0b` |
| Card / surface        | `#fdfcf9` | `#1a1918` |
| Secondary surface     | `#f1ece5` | `#363533` |
| Primary text / accent | `#1a1918` | `#f9f5ef` |
| Secondary text        | `#625d58` | `#c2bcb2` |
| Quiet text            | `#625d58` | `#aba69d` |
| Border                | `#d4cfc6` | `#363533` |
| Control border        | `#7c7771` | `#7c7771` |
| Focus                 | `#514e4b` | `#e6e1d9` |
| Error                 | `#962f2f` | `#ffb0b0` |

## Real URLs and overlay readers

Ordinary internal clicks on a project, article, research detail, About or CV open a native modal dialog. Its chrome names the section, while the full heading is shown once in the content; the dialog’s accessible name remains the complete title. The browser address becomes the actual static content path. Back/Forward traverse the reader history. Close, Escape and outside clicks return to the original page and its filters, scroll and focus. A new tab, direct paste, reload or disabled JavaScript renders the ordinary static page at that URL. Existing archive and directory routes remain valid.

The reader fetches same-origin HTML and imports only the sanitized main content. It never imports fetched executable scripts/styles or active embeds. Recognized inert math and TikZ sources become safe text. Generated newsletter forms have an exact provider allowlist and retain only labeled email controls. PDF embedding is restricted to local CV assets with a real fallback link. Aborted/racing fetches cannot overwrite a later selection. A six-document LRU bounds cached fragments. Errors provide Retry and an ordinary full-page link.

Scoped mount/unmount events manage article navigation, copy controls, typography, menus, opt-in content renderers and About pagination. Observers, event listeners, frames, retained gallery references and prepared typography records are disposed when their scope leaves. Opening an image viewer inside a reader preserves nested Escape behavior.

About uses the original rich biography as its source, with three semantic authored sections and a balanced two-column spread where space permits. Paragraphs remain intact across columns; desktop reader and dialog heights are bounded to keep CV actions near the text. Native DOM ranges paginate it into the available viewport, preserving links and emphasis. Resize and font changes recompute pages and preserve the reading position. Previous/Next and arrow keys expose the complete text without vertical scrolling. The complete semantic source remains the fallback without JavaScript and for print. CV opens inside the same reader history with deterministic responsive previews of the actual PDF and a selectable text disclosure. Page images use the nested viewer; the original PDF remains available to open or download. See the [CV pipeline](../cv.md) for generation and byte budgets.

## Publication and destination data

Research records generate real `/research/{id}/` pages with canonical published authors, source links and downloadable BibTeX. The current data distinguishes two coauthored papers from two papers citing the owner's datasets. CulturalRiddles retains a visible pending author-list update; its canonical citation keeps the current published authors. Compact author previews lead to complete native disclosures on details. The Research archive separates the two relationships, while the unified catalog labels each card and marks only coauthored selected records as Featured. The authoring schema, source verification and update workflow are in the [research contract](../publications.md).

ORCID, Google Scholar and OpenReview form a separate academic connection group. Exact ORCID identity and configured public author names remain visible; Scholar's opaque identifier stays in its URL. Brand marks are local, with source/license attribution. Optional structured metadata describes each paper using its published authors, including when the page is about a citation of the owner's work.

Project GitHub/Hugging Face actions derive from existing verified-host URLs. They appear on cards and detail pages only when configured, use exact local brand marks and avoid repeating the same destination among generic resources.

## Motion and performance

Masonry changes use short interruptible native transform/opacity animations. Server HTML and the controller share the same CSS column-width/gap tokens; position changes use direct transforms, with geometry reads completed before the write batch. Offscreen cards are placed directly instead of animating the entire collection. Dialog entry is 220 ms. Typography and visible card entrances are finite, respect reduced motion and never gate reading. There is no scroll hijacking, backdrop blur, perpetual homepage carousel, 3D runtime or animation-library dependency.

Native image lazy loading applies outside the initial visible content. Responsive original project media and editorial WebP variants reserve dimensions. Container development retains bind-mounted hot reload. Production remains independently buildable and testable. Measurements and actual limitations belong in [verification](section-refinement.md); operational continuity and raw captures stay private under `.local/`.

Opt-in article functionality uses a shared scoped dispatcher. Heavy libraries load only for matching enabled content, successful loads are bounded and reused, and scope disposal releases renderer instances and observers. Provider integrations still require real configuration. TikZJax v1 has no supported dynamic rescan API: in a reader its source remains selectable with an ordinary full-page link; the direct page retains the configured renderer. No unsupported API or silent script replay is used. Exact capabilities and test scope are recorded in the [capability matrix](../template-capabilities.md).
