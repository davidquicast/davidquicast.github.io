#!/usr/bin/env bash
set -Eeuo pipefail

# Never mutate the dependency lockfiles or terminate unrelated Ruby processes.
cd "${JEKYLL_ROOT:-/srv/jekyll}"
bundle check || bundle install --jobs 4
if [[ -f package-lock.json ]]; then
  npm ci --prefer-offline --no-audit --no-fund
  if node -e 'process.exit(require("./package.json").scripts?.build ? 0 : 1)'; then npm run build; fi
fi

jekyll_pid=""
watch_pid=""
cleanup() {
  [[ -z "$jekyll_pid" ]] || kill -TERM "$jekyll_pid" 2>/dev/null || true
  [[ -z "$watch_pid" ]] || kill -TERM "$watch_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 0' INT TERM

if node -e 'process.exit(require("./package.json").scripts?.watch ? 0 : 1)'; then
  npm run watch &
  watch_pid=$!
fi
args=(serve --disable-disk-cache --watch --host=0.0.0.0 --port=8080 --livereload)
# Linux bind mounts support native events. Polling is an opt-in fallback for hosts
# whose shared filesystem does not propagate them, avoiding an expensive full-tree
# scan every second on the normal development path.
if [[ "${PORTFOLIO_FORCE_POLLING:-false}" == true ]]; then args+=(--force_polling); fi
if [[ "${JEKYLL_ENV:-development}" == development && "${JEKYLL_PREVIEW_DRAFTS:-true}" == true ]]; then
  args+=(--drafts --future --unpublished)
fi
start_jekyll() {
  bundle exec jekyll "${args[@]}" &
  jekyll_pid=$!
}
# Jekyll watches content itself; restart only its child after a configuration save.
start_jekyll
while kill -0 "$jekyll_pid" 2>/dev/null; do
  if inotifywait -q -t 2 -e close_write,move_self,delete_self _config.yml >/dev/null 2>&1; then
    kill -TERM "$jekyll_pid" 2>/dev/null || true
    wait "$jekyll_pid" || true
    start_jekyll
  fi
done
# Fatal startup failures reach Compose's restart policy with normal backoff.
wait "$jekyll_pid"
