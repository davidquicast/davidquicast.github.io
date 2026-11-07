# Docker development

Run the portfolio with live reload:

```sh
docker compose up --build
```

Open http://localhost:8080. Jekyll and esbuild watch the bind-mounted source; LiveReload uses port 35729. The healthcheck confirms that Jekyll responds. The service uses `restart: unless-stopped`; stop it deliberately with `docker compose stop` or `docker compose down`.

The image runs the `portfolio` user with UID/GID 1000, avoiding root-owned source files. On Linux with different IDs:

```sh
PORTFOLIO_UID=$(id -u) PORTFOLIO_GID=$(id -g) docker compose up --build
```

Dependencies live in named volumes. The lockfiles are preserved. Disk-based Jekyll caches are disabled for development to avoid stale cache permissions and concurrent build races.

VS Code's **Reopen in Container** uses the same Compose service and ports. It does not start a second Jekyll process.

## Static production build

```sh
docker compose exec jekyll bash bin/build-production.sh
```

This writes an isolated preview to `.local/production` and checks it. It omits draft preview flags and does not deploy anything. The default development server continues serving the development build.

## Browser and tool checks

```sh
docker compose exec jekyll npm test
docker compose exec -e PORTFOLIO_URL=http://127.0.0.1:8080 jekyll npm run test:portfolio
docker compose exec jekyll npm ci --prefix tools/mcp
docker compose exec jekyll npm --prefix tools/mcp run probe:chrome
docker compose exec jekyll npm --prefix tools/mcp run probe:shadcn
```

Chromium runs inside Docker. Optional MCP dependencies stay outside the site's runtime. See [tooling details](docs/redesign-tools.md).

For diagnostics use `docker compose ps` and `docker compose logs --tail=100 jekyll`. There is no need to install Ruby, Node or browser packages on the host.

## Watcher performance

Native filesystem events are the default on Linux bind mounts. Set `PORTFOLIO_FORCE_POLLING=true` before `docker compose up` only when a shared filesystem does not deliver change events. This fallback preserves reload on such hosts without imposing recursive polling on ordinary Linux development.
