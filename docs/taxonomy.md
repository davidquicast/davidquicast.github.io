# Content classifications

Reviewed 2026-11-10. Counts describe the current authored content.

The portfolio keeps authored metadata separate from its presentation. A hidden navigation item or a different filter layout does not remove an article, project category or archive route.

## Projects

Nineteen real projects retain their source ownership categories:

| Authored `category` | Catalog state   | Visible group | Records |
| ------------------- | --------------- | ------------- | ------: |
| `personal`          | `independent`   | Personal      |      15 |
| `collaborations`    | `contributions` | Contributions |       4 |

Technical `tags` are separate from ownership. The current records use fifteen topics, covering AI, cybersecurity, web, mobile, datasets, language models and related project-specific subjects. `/projects/` derives its topic choices from real project tags and retains ownership/search controls. The home catalog retains the ownership facet and actual project URLs. Unknown future ownership values remain visible in All; update the mapping in `_plugins/profile-feed.rb` when introducing another ownership group.

The initial template's `work`/`fun` demonstration groups were replaced by the owner's `collaborations`/`personal` data. Later compact filters replaced grouped headings while preserving the same records and classifications. Historical commit `dcb450c`, despite its Remove projects.md and publications.md message, only changed those pages' `nav` flags; it did not delete their sources or permalinks.

## Blog

The six published articles have seventeen distinct tags and six categories. Categories currently present in published metadata are `ai`, `external`, `notes`, `system-administration`, `tutorials` and `web-development`. Tags identify finer topics such as AI personas, safety, memory, Docker, WSL2 and specific tools.

Jekyll year, tag and category archives remain enabled:

- `/blog/:year/`
- `/blog/tag/:name/`
- `/blog/category/:name/`

`display_tags` and `display_categories` are curated display preferences, not the complete source taxonomy. The current configured tag shortlist has five values; other post tags remain intact and article headers link to their actual tag archives. A category can retain a valid archive even when the principal interface has no category shortcut. Do not delete category/tag metadata when changing the visible controls.

Six later articles remain drafts and are excluded from the production site, feed and sitemap. Their source classifications remain available for local previews and possible later publication.

## Research

Research metadata distinguishes two coauthored papers from two papers citing the owner's work. `_data/publications.yml` keeps these in separate `publications` and `citations` arrays. The explicit `relationship` values are `coauthor` and `cited_work`; the archive preserves separate groups and the catalog identifies the relationship on each record.

There is no additional authored Research keyword taxonomy to infer or restore. Venue, authors, title, cited resources and attribution remain real searchable data. Featured is curation metadata, not another content category. See [Research data and attribution](publications.md) for authorship and pending-update rules.

## Dormant template areas

The news collection and announcement configuration remain available. The actual `/news/` stub is unpublished and excluded from the sitemap; supplied announcements are `.md.example` demonstrations. The home portfolio does not render a news stream. Reactivation requires actual authored updates rather than invented announcements.

No books collection, bookshelf page, book-review layout or supplied personal reading list was found in the current source or inspected source history. Jupyter notebook demonstrations are unrelated. A capability in another template/version does not establish that it existed in this repository or was removed.

## Authoring and compatibility

Preserve source tags, category fields, research relationship labels, date precision and existing permalinks when revising presentation. Keep ownership distinct from technical topics and coauthorship distinct from citations. The static archive routes and normal detail pages remain usable independently of the enhanced catalog. Historical query aliases such as Writing/Papers are retained for compatibility while the principal visible labels are Blog and Research.

The detailed read-only audit, source inventory and history evidence for this revision remain in private continuity under `.local/redesign/interface-refinement/`; those raw records are excluded from Git and public delivery.
