# David Quispe

Personal portfolio and technical journal at [davidquicast.github.io](https://davidquicast.github.io). Built with Jekyll and Liquid, semantic HTML, native CSS motion and a shared [Pretext](https://github.com/chenglou/pretext) composition layer. The deployed site is static.

## Develop in Docker

Docker Engine with Compose is the only host prerequisite.

```sh
docker compose up --build
```

Open **http://localhost:8080**. Source files are bind-mounted; Jekyll reloads content and CSS, esbuild watches the editorial JavaScript, and configuration changes restart the site process. The image pins Ruby 3.4.11 and Node 24.22.1. Dependencies use `Gemfile.lock` and `package-lock.json`; startup preserves both.

The container runs as a regular development user. The image defaults to UID/GID 1000; optional build arguments match a different Linux workspace owner, as described in [Docker development](docker.md).

English is the only active language. The multilingual implementation and inactive language sources are retained; there is no language selector.

## Content and publishing

- Profile and catalog: `_pages/en-us/about.md`, `_layouts/about.liquid`, `_data/profile_feed.yml`, `_plugins/profile-feed.rb`
- Full biography: `_pages/en-us/profile.md` at `/about/`, reading the owner content and profile settings from the home source
- Projects: `_projects/en-us/`
- Articles: `_posts/en-us/`
- Navigation and layouts: `_includes/`, `_layouts/`
- Visual tokens and components: `assets/css/portfolio.css`; Front Page, project and journal wall composition: `assets/css/wall.css`
- Native interactions: `assets/js/portfolio.js`, `assets/js/readcv-interactions.js`; catalog layout, filtering and transitions: `assets/js/profile-feed.js`; card actions: `assets/js/card-menu.js`
- Publication data and genuine open research: `_data/publications.yml`, `_data/research_outputs.yml`
- Shared text composition: `assets/js/src/editorial.js`
- Responsive editorial cover data: `_data/blog_covers.yml`

The homepage pairs a persistent profile sidebar with one complete catalog. All is the default view; Projects, Blog and Research filter the same genuine records. Selected projects and recent articles receive a mark within All. Search, date sorting and URL state keep each view directly accessible, with legacy `writing` and `papers` links accepted as Blog and Research. Variable-height cards fill the shortest available column and move when filtering or sorting changes their positions. Individual articles retain a reading layout.

`_data/profile_feed.yml` defines selected projects and current-work priority. New public articles enter the catalog automatically. `latest_posts: true` in the home frontmatter and `latest_posts.enabled` control writing availability. `latest_posts.limit` selects recent articles for a mark without truncating Blog or All; an article's explicit `featured: true` is also honored. Optional `latest_posts.scrollable` bounds only the Blog view in a named, keyboard-focusable region. `selected_papers` controls marks on selected papers while every genuine paper remains in Research. The four supplied research records distinguish coauthorship from citations of the owner's work; canonical author lists and pending attribution are preserved.

Dates use the shared precision-aware timeline. Newest and Oldest preserve original publication/contribution chronology; Latest changes uses separate verified activity. Public repository facts are cached in `_data/project_activity.json` and refreshed before the normal deployment build, or locally with `docker compose exec -T jekyll npm run refresh:activity`. [The activity contract](docs/project-activity.md) explains source meanings, failure preservation and offline operation.

Home profile settings and `social` govern the persistent profile header, and the full biography at `/about/` reuses those settings. Configured connections show actual account handles or email addresses, with locally served official-color icons; platform names remain in accessible labels and tooltips. Project GitHub/Hugging Face buttons are generated only from verified-host links already present in each project's metadata. Card menus provide real image viewing and copy-link actions. Keyboard navigation, dismissal, clipboard errors, reduced motion and no-JavaScript content fallbacks are covered by the browser suite.

Draft posts use **`published: false`**. Development preview enables unpublished content and provides **/drafts/**. Drafts are excluded from the public journal and homepage even in development. Production builds omit the preview flags; the build verification rejects shipped draft routes.

Publishing is handled by the existing GitHub Pages workflow on `main`. Local preview does not publish anything.

## Verification

All commands run inside Docker:

```sh
docker compose exec jekyll npm run check:js
docker compose exec jekyll npx prettier . --check
docker compose exec jekyll bash bin/build-production.sh
docker compose exec -e PORTFOLIO_URL=http://127.0.0.1:8080 jekyll npm test
docker compose exec jekyll python3 -m unittest discover -s tests -p 'test_*.py'
docker compose exec jekyll python3 -m unittest discover -s tools/tests
```

The production builder creates an isolated static preview and checks local URLs, image dimensions, fragments, metadata, feed identity, required routes, draft exclusion and private-file exclusion. It does not publish the result. Build it before running the complete browser suite, which also inspects generated production content.

Chromium is included in the development image. Browser tests cover native line layout against Pretext, font loading, resizing, text enlargement, keyboard navigation, theme persistence, filtering, empty states, code copying and accessibility scans. Automated scans complement visual review.

## Design and tooling

- [Current read.cv design system](docs/design/readcv.md)
- [Current verification](docs/design/section-refinement.md)
- [Template capabilities and activation](docs/template-capabilities.md)
- [Adding genuine publications](docs/publications.md)
- [Earlier infrastructure and behavior audit](docs/design/verification.md)
- [Docker, security and CI maintenance](docs/infrastructure.md)
- [Pretext architecture and tests](docs/pretext.md)
- [Editorial image sources, dimensions and budgets](docs/design/editorial-images.md)
- [Skills, MCP versions, component provenance and deferred integrations](docs/redesign-tools.md)

Optional MCP tooling is isolated in `tools/mcp`; the portfolio runtime does not load it. The official 21st endpoint currently requires a new API key and remains deferred. No credentials belong in source or Git.

Local originals, working notes and browser evidence are excluded from Git, Docker build context and the public site.

## Attribution

The original repository was based on [multi-language al-folio](https://github.com/george-gca/multi-language-al-folio) and [al-folio](https://github.com/alshedivat/al-folio). Existing content, routes and useful integrations are retained. See [LICENSE](LICENSE). Pretext includes upstream notices beside its generated bundle; font OFL licences ship beside the self-hosted WOFF2 files.
