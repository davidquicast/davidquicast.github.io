#!/usr/bin/env python3
"""Install and verify complete pinned skills inside Docker.

Run: docker compose exec jekyll python3 tools/install-design-skills.py
Set DESIGN_SKILLS_DIR for another Codex directory. Existing local modifications
are preserved; --repair saves a backup before replacing an incomplete install.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


class SkillError(Exception):
    """The installed package cannot be claimed to match the requested source."""


def verify_install(target, source, item):
    if not (target / "SKILL.md").is_file():
        raise SkillError("missing SKILL.md")
    try:
        record = json.loads((target / ".installed-source.json").read_text())
    except (OSError, ValueError) as error:
        raise SkillError("missing or invalid installed-source record") from error
    for key in ("name", "repo", "path", "commit"):
        if record.get(key) != item[key]:
            raise SkillError("installed source does not match locked " + key)
    for official in source.rglob("*"):
        if not official.is_file():
            continue
        installed = target / official.relative_to(source)
        if not installed.is_file():
            raise SkillError("missing package file: " + str(official.relative_to(source)))
        if hashlib.sha256(official.read_bytes()).digest() != hashlib.sha256(installed.read_bytes()).digest():
            raise SkillError("modified package file: " + str(official.relative_to(source)))


def install_skill(source, target, item, backups, repair=False):
    if target.exists():
        try:
            verify_install(target, source, item)
            return "Verified existing"
        except SkillError as error:
            if not repair:
                raise SkillError(str(error) + "; preserved existing directory. Use --repair to back it up and reinstall.") from error
    target.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix="." + item["name"] + "-", dir=target.parent))
    try:
        shutil.copytree(source, staging, dirs_exist_ok=True)
        (staging / ".installed-source.json").write_text(json.dumps(item, indent=2) + "\n")
        verify_install(staging, source, item)
        if target.exists():
            backups.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
            shutil.move(str(target), str(backups / (item["name"] + "-" + stamp)))
        staging.replace(target)
        return "Installed complete skill"
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def ensure_source(sources, item):
    source = sources / item["repo"].split("/")[-1]
    if not (source / ".git").exists():
        sources.mkdir(parents=True, exist_ok=True)
        if source.exists():
            raise SkillError("source cache exists without a Git record: " + str(source))
        # An interrupted download cannot leave a cache that looks installed.
        staging = Path(tempfile.mkdtemp(prefix=".fetch-", dir=sources))
        try:
            subprocess.run(["git", "init", str(staging)], check=True, capture_output=True)
            subprocess.run(["git", "-C", str(staging), "remote", "add", "origin", "https://github.com/" + item["repo"] + ".git"], check=True)
            subprocess.run(["git", "-C", str(staging), "fetch", "--depth=1", "origin", item["commit"]], check=True)
            subprocess.run(["git", "-C", str(staging), "checkout", "--detach", item["commit"]], check=True)
            staging.replace(source)
        finally:
            if staging.exists():
                shutil.rmtree(staging)
    actual = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
    if actual != item["commit"]:
        raise SkillError("refusing changed source snapshot: " + item["repo"])
    changed = subprocess.check_output(["git", "-C", str(source), "status", "--porcelain", "--untracked-files=all", "--", item["path"]], text=True)
    if changed.strip():
        raise SkillError("source package has local changes: " + item["repo"])
    package = source / item["path"]
    if not (package / "SKILL.md").is_file():
        raise SkillError("locked source has no SKILL.md: " + item["name"])
    return package


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repair", action="store_true", help="Back up incomplete or changed installs before replacing them.")
    args = parser.parse_args()
    lock = json.loads((ROOT / "tools/design-skills.lock.json").read_text())
    sources = ROOT / ".local/redesign/tools/repos"
    destination = Path(os.environ.get("DESIGN_SKILLS_DIR", str(Path.home() / ".codex/skills")))
    backups = ROOT / ".local/redesign/tools/skill-backups"
    errors = []
    for item in lock["skills"]:
        try:
            source = ensure_source(sources, item)
            result = install_skill(source, destination / item["name"], item, backups, args.repair)
            print(result + ":", item["name"], item["commit"][:12])
        except (SkillError, OSError, subprocess.CalledProcessError) as error:
            errors.append(item["name"] + ": " + str(error))
    for error in errors:
        print("ERROR:", error)
    return bool(errors)


if __name__ == "__main__":
    raise SystemExit(main())
