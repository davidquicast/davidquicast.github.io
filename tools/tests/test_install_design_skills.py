"""Regression checks for partial, changed and mismatched skill installations."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("skill_installer", Path(__file__).resolve().parents[1] / "install-design-skills.py")
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class SkillInstallTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        (self.source / "SKILL.md").write_text("Official guide\n")
        (self.source / "references").mkdir()
        (self.source / "references/guide.md").write_text("Complete reference\n")
        self.target = self.root / "installed"
        self.backups = self.root / "backups"
        self.item = {"name": "example", "repo": "official/example", "path": "skills/example", "commit": "fixture-commit"}

    def install(self, repair=False):
        return installer.install_skill(self.source, self.target, self.item, self.backups, repair)

    def test_existing_empty_directory_is_not_success(self):
        self.target.mkdir()
        with self.assertRaisesRegex(installer.SkillError, "missing SKILL.md"):
            self.install()
        self.assertEqual(list(self.target.iterdir()), [])

    def test_complete_package_is_verified_without_reinstall(self):
        self.install()
        self.assertEqual(self.install(), "Verified existing")
        self.assertEqual((self.target / "references/guide.md").read_text(), "Complete reference\n")

    def test_missing_reference_is_detected(self):
        self.install()
        (self.target / "references/guide.md").unlink()
        with self.assertRaisesRegex(installer.SkillError, "missing package file"):
            self.install()

    def test_wrong_source_version_is_detected(self):
        self.install()
        record = {**self.item, "commit": "another-version"}
        (self.target / ".installed-source.json").write_text(json.dumps(record))
        with self.assertRaisesRegex(installer.SkillError, "locked commit"):
            self.install()

    def test_modified_guide_is_preserved_without_repair(self):
        self.install()
        (self.target / "SKILL.md").write_text("Local modifications\n")
        with self.assertRaisesRegex(installer.SkillError, "modified package file"):
            self.install()
        self.assertEqual((self.target / "SKILL.md").read_text(), "Local modifications\n")

    def test_repair_preserves_modified_package_in_backup(self):
        self.install()
        (self.target / "SKILL.md").write_text("Local modifications\n")
        self.install(repair=True)
        saved = list(self.backups.glob("example-*/SKILL.md"))
        self.assertEqual(len(saved), 1)
        self.assertEqual(saved[0].read_text(), "Local modifications\n")
        installer.verify_install(self.target, self.source, self.item)


    def test_changed_source_cannot_be_labelled_as_pinned_release(self):
        sources = self.root / "repositories"
        (sources / "example/.git").mkdir(parents=True)
        with patch.object(installer.subprocess, "check_output", side_effect=["fixture-commit\n", " M skills/example/SKILL.md\n"]):
            with self.assertRaisesRegex(installer.SkillError, "source package has local changes"):
                installer.ensure_source(sources, self.item)

    def test_failed_download_does_not_leave_a_false_source_cache(self):
        sources = self.root / "repositories"
        failure = installer.subprocess.CalledProcessError(1, ["git", "fetch"])
        with patch.object(installer.subprocess, "run", side_effect=[None, None, failure]):
            with self.assertRaises(installer.subprocess.CalledProcessError):
                installer.ensure_source(sources, self.item)
        self.assertEqual(list(sources.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
