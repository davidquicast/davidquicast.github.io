#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
npm run build
export JEKYLL_ENV=production
bundle exec jekyll build --disable-disk-cache --destination .local/production
python3 - <<'BUILD_INFO'
import datetime
import json
import os
import re
import subprocess
from pathlib import Path

revision = os.environ.get("PORTFOLIO_BUILD_SHA", "")
if revision and not re.fullmatch(r"[0-9a-f]{40}", revision):
    raise SystemExit("PORTFOLIO_BUILD_SHA must be a complete Git commit SHA")
source = "github-actions" if revision else "local"
if not revision:
    result = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True)
    revision = result.stdout.strip() if result.returncode == 0 else None
info = {"revision": revision, "source": source,
        "built_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}
Path(".local/production/build-info.json").write_text(json.dumps(info, indent=2) + "\n")
Path(".local/production/.nojekyll").touch()
BUILD_INFO
python3 scripts/check-site.py --site .local/production
