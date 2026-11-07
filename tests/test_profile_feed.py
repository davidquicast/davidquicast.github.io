"""Verify deterministic public profile feed data, feature flags and date precision."""
from pathlib import Path
import json
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ProfileFeedTests(unittest.TestCase):
    def test_profile_feed_contracts(self):
        result = subprocess.run(
            ["bundle", "exec", "ruby", "tools/test-profile-feed.rb"],
            cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=40,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertTrue(report["passed"], report)
        self.assertEqual(len(report["checks"]), 17)
        for check in report["checks"]:
            with self.subTest(check["name"]):
                self.assertTrue(check["passed"], check)
