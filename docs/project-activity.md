# Public project activity snapshots

`scripts/refresh-project-activity.rb` refreshes metadata for the actual GitHub and Hugging Face repository roots already configured in published English project frontmatter. It is a read-only source collector. It does not commit, push, deploy, modify a provider account or query providers in a visitor's browser. Rendering can use the maintained snapshot without network access.

## Refresh in Docker

From the repository root on the host:

```bash
docker compose exec -T jekyll ruby scripts/refresh-project-activity.rb
```

The default destination is `_data/project_activity.json`. The tool accepts `--source ROOT` and `--output FILE` for isolated working copies. An explicit offline run reuses previous configured records without making requests:

```bash
docker compose exec -T jekyll ruby scripts/refresh-project-activity.rb --offline
```

An optional `GITHUB_TOKEN` environment variable is used only as a GitHub API authorization header. It is never included in logs, snapshots, URLs or Hugging Face requests. Public endpoints work without a token when their public quota permits it. A configured token does not permit private repository metadata to be exported.

## Meaning of dates

The snapshot records provider facts, not personal-history claims:

- GitHub `created_at` is when that repository was created. It may differ from the project's origin or an author's involvement, especially for forks.
- GitHub `updated_at` in this snapshot is the latest default-branch commit's **committer date**. It does not use GitHub's repository `updated_at` or `pushed_at`, which can represent other activity. The verified SHA and a corresponding commit URL are retained. Empty repositories have no synthetic commit date.
- Hugging Face records the public Hub `createdAt` and `lastModified` for the configured model, dataset or Space repository. These are repository metadata; they do not assert a Space deployment date, runtime uptime or the owner's latest contribution.
- Configured `github_prs` and `argilla_prs` are deduplicated. A contribution date is recorded only when the public pull request has a valid `merged_at` and its `user.login` matches `_data/socials.yml`'s `github_username`. Upstream activity is not substituted for the owner's contribution.
- `checked_at` is the successful source-check time. `last_attempted_at` is an operational refresh attempt, never a project update.

Times are validated against real calendar dates, normalized to UTC and rejected if more than five minutes in the future. A fork's latest commit can legitimately predate creation of the fork, so those two facts are not artificially reordered. Missing dates stay missing; there is no epoch or current-time fallback.

## Stored contract

The JSON has `schema_version: 1` and a `projects` mapping keyed by each project's stable `page_id`. A project holds `resources` and, where configured, `contributions`.

Resource fields include `kind` (`github`, `hf_model`, `hf_dataset`, `hf_space`), canonical browser `url`, public API `source_url`, known `created_at` / `updated_at`, optional `sha` and `commit_url`, `checked_at`, `archived` and `status`. Contributions retain the PR `url`, `source_url`, verified `author`, `merged_at`, `checked_at` and `status: merged`.

On a failed refresh, previous dates and the previous `checked_at` are preserved. The result is marked `status: unavailable` with a stable `refresh_error` code and `last_attempted_at`. It must not be presented as newly verified. Unknown sources receive no fabricated dates. Successful updates replace stale operational errors. Deleted project configuration is removed from the resulting snapshot; current known sources remain bound to their configured canonical URLs.

## Request and failure boundaries

The collector accepts only HTTPS GitHub and Hugging Face repository roots, rejects credentials/custom ports/traversal/unknown hosts, drops irrelevant query parameters, and constructs API endpoints itself. Repository UI subpages are not treated as independent repositories. Redirects are not followed; a moved or renamed source should be reviewed and corrected in project metadata.

Requests have connection/read/write timeouts, a two-megabyte response limit, an 80-request budget and a 120-second overall budget. Network failures and transient server failures retry once. Rate-limit or rejected GitHub authorization responses stop further GitHub requests; a Hub rate limit stops further Hub requests. Existing records remain available. Output is atomically replaced in the destination directory, and source/schema failures return a nonzero exit without overwriting the snapshot.

The build need not depend on live provider availability. A CI job may run the same read-only refresh before its normal static build, with the checked-in snapshot as fallback. This tool adds no publication schedule and performs no provider or Git writes.

## Sources and tests

API semantics follow the official [GitHub commits documentation](https://docs.github.com/en/rest/commits/commits#list-commits) and [Hugging Face Hub API reference](https://huggingface.co/docs/hub/api). The current Hub OpenAPI schema was inspected while implementing the collector.

`tools/test-activity-refresh.rb` injects offline HTTP responses. Its 16 contracts cover canonical hosts, GitHub default-branch dates, fork chronology, all Hub resource types, request budgets, transient errors, quota stopping, redirect isolation, private metadata, future/calendar dates, empty repositories, offline/failure preservation, configured owner PR verification and atomic output. `tests/test_activity_refresh.py` integrates these contracts into Python discovery. Tests do not consume live API quotas or require credentials.

## Display and ordering

`_plugins/content-dates.rb` provides the shared normalized timeline. Cards and details use semantic `<time>` values and the same localized format: full day when verified, month when only a month is published, and year when no finer authored date exists. Repository creation is never substituted for the start of a project. Blog dates come from authored publication/update fields; file modification time and the current build time are never publication dates.

Personal projects show the last verified repository change. Contributions with configured, verified merged PRs use the earliest linked merge as the displayed contribution date and the latest linked merge as their activity. Upstream repository changes remain separate in the detail and do not promote old personal contributions in the activity order. An unverified personal contribution date remains at its authored precision. Repository dates, commit destinations, merged PRs, archived state and last successful check are available in the detail's Dates disclosures.

`Newest` / `Oldest` use the original publication or contribution chronology. `Latest changes` is a separate URL-preserving order using real article updates, paper revisions, personal repository changes and verified own contributions. A change to the portfolio itself, repository metadata such as stars/issues, a failed refresh attempt or an upstream community commit does not become an update to the owner's old contribution. For partial dates, the sorting lower bound never changes the displayed precision.

The existing deployment build now runs the read-only collector before the offline static build. Its normal read-only `github.token` is passed transiently through the environment and never stored. No new publication schedule or Git-writing job was added. Dates become current on each normal deployment or manual workflow run; local development can refresh with `docker compose exec -T jekyll npm run refresh:activity`. This is cached static information, with an explicit last-check date, rather than a promise of live real-time activity. `npm run refresh:activity:offline` validates the cached snapshot without provider access.

Tests of UI chronology use the current snapshot for mutable upstream dates. Immutable contribution/publication examples are checked separately. New projects can join the manifest without hardcoding a new repository count in the shared model tests.
