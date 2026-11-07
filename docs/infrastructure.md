# Docker, checks and maintenance

The development service and GitHub Actions builds use the same Ruby 3.4.11 / Node 24.22.1 Docker image. `PORTFOLIO_UID` and `PORTFOLIO_GID` default to 1000 and can match a different Linux workspace owner. The running process is the unprivileged `portfolio` user. Dependency volumes, generated assets and the persistent `design_skills` volume belong to that user.

```sh
docker compose up --build --wait
docker compose exec jekyll bash bin/build-production.sh
docker compose exec -d jekyll python3 -m http.server 8092 --bind 127.0.0.1 --directory .local/production
docker compose exec -e PORTFOLIO_URL=http://127.0.0.1:8092 jekyll npm test
docker compose exec jekyll python3 -m unittest discover -s tests -p 'test_*.py'
docker compose exec jekyll python3 -m unittest discover -s tools/tests -v
```

The development site listens on host loopback port 8080 and LiveReload on loopback 35729. Draft previews stay local by default. LAN testing requires an explicit override; for example, `PORTFOLIO_BIND_ADDRESS=0.0.0.0 JEKYLL_PREVIEW_DRAFTS=false docker compose up -d` allows LAN access while omitting unpublished previews. The production builder creates `.local/production` and checks it before publication; it does not publish. Disk caching is disabled to prevent development and isolated production builds from sharing mutable Jekyll caches. Docker restarts the service after a fatal process exit; configuration changes restart the owned Jekyll child. The source remains available through the workspace bind mount.

## Skills and optional tools

```sh
docker compose exec jekyll python3 tools/install-design-skills.py
docker compose exec jekyll npm ci --prefix tools/mcp
```

The installer verifies the complete package against its pinned source, including `SKILL.md`, references, scripts, the recorded commit and file contents. Empty directories, missing references, another version and local modifications are reported as errors. `--repair` explicitly backs up an existing package before replacing it. Interrupted source downloads are staged outside the final cache and cleaned up, so retrying remains possible. Installed skills persist across container recreation in `design_skills`.

Codex CLI, IDE and desktop clients use the project-scoped `.codex/config.toml` in a trusted project. `.mcp.json` is retained for compatible generic clients. Both contain the same Docker-backed shadcn and Chrome DevTools commands; no global configuration, secrets or approval policy is changed. The [official MCP configuration documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) describes this distinction. Start the client from the repository directory so Docker Compose resolves the project. Chrome DevTools file access is explicitly limited to `/srv/jekyll`, the container copy of this workspace; screenshot paths should be relative to that directory. The 21st native entry is disabled pending credentials. Server initialization and operations were exercised through the MCP SDK; loading the new native client configuration requires reopening/reloading the client and is not represented as already tested in the running session.

The browser/application npm dependencies had zero advisories in the 2026-11-04 audit. Optional MCP tooling still has three low-severity dependency findings from `deepmerge` through the shadcn registry. The earlier 2026-10-29 scan found no compatible patched release; downgrading shadcn to an incompatible historical version was not applied. Current results are recorded in the [read.cv verification](design/readcv-verification.md). These tools are excluded from the static site. See [tool provenance](redesign-tools.md) for versions and component sources.

The Ruby dependency audit was refreshed on 2026-11-04 using bundler-audit 0.9.3 and Ruby Advisory Database commit `516ea4757d5eec778c49af8371c23309c4b70f42`. Newly published findings were resolved through a conservative update of four gems: ActiveSupport 8.0.5.2, Addressable 2.9.2, Loofah 2.25.3 and Nokogiri 1.19.7. All existing Nokogiri platform variants remain in the lockfile. The repeated audit reported zero findings. Gemfile security floors retain the patched versions; ActiveSupport remains on the 8.0 maintenance line. This is a dependency scan result, not a guarantee that every vulnerability is absent.

On Linux, the default watcher uses native filesystem events rather than recursively polling the source tree. Set `PORTFOLIO_FORCE_POLLING=true` only for a shared filesystem that does not deliver events. An actual temporary source edit, browser LiveReload and deletion/404 cycle verified the native configuration.

## GitHub Actions

- `verify.yml` is the reusable production gate and pull-request check. It performs locked formatting, JavaScript, Python/skill-installer checks, production generation and the entire browser suite in Docker. Browser checks target an isolated server on 8092, so local draft previews on 8080 cannot enter the publication checks.
- `deploy.yml` calls that same verification workflow on main pushes, refreshing verified repository activity before building. Only after every check passes is the exact `.local/production` artifact uploaded through `actions/upload-pages-artifact` and published through `actions/deploy-pages`. The deployment job has only `pages: write` and `id-token: write`; builds and pull-request checks have read-only repository access. Pages must use GitHub Actions as its publishing source.
- `broken-links-site.yml` checks the exact successful deployment source with the Docker production builder. Pull-request verification runs do not trigger this follow-up.
- `axe.yml` remains available manually for a selected local production path. It checks three widths in both themes using the project's locked axe/Playwright dependencies. All findings are saved; serious or critical WCAG A/AA findings fail the check. The URL input is passed as data rather than interpolated into shell commands.
- `broken-links.yml` manually checks external URLs from published HTML. Local routes and fragments are checked automatically by the production checker. Unused translations, original template documentation and private authoring material are outside the external crawl.
- `prettier.yml` remains a manual locked formatter check. Automatic formatting checks are consolidated into `verify.yml`; no formatter job writes comments, dispatches events or modifies branches.

The following inherited template automations were retired because they did not operate on this portfolio: `deploy-image.yml`, `deploy-docker-tag.yml` and `docker-slim.yml` published the upstream author's Docker namespace; `lighthouse-badger.yml` measured the upstream demo and attempted badge writes; `prettier-html.yml` rewrote the deployed branch separately from the source build; `prettier-comment-on-pr.yml` was a comment bot for the retired formatter-dispatch flow. No replacement publishes a container image or sends repository messages.

Workflow syntax and expressions were validated locally with actionlint 1.7.12. A clean isolated ARM64 Docker build using UID/GID 1001 verified the CI ownership path and regenerated the frontend bundle/fonts without relying on the running development service. Those earlier audits did not trigger hosted runs; the user-authorized release now verifies the actual pull-request and Pages deployment runs. Build output includes `.nojekyll` and `build-info.json` with the source revision, build context and timestamp so the live release can be matched to its tested commit. No private continuity or generated master is included in the deployment artifact.
