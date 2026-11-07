"""Validate configured academic profile accounts and semantic group rendering."""
from pathlib import Path
import json
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ResearchProfileTests(unittest.TestCase):
    def test_real_research_profiles_and_boundaries(self):
        result = subprocess.run(["bundle", "exec", "ruby", "tools/test-research-profiles.rb"],
                                cwd=ROOT, text=True, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, timeout=40)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertGreaterEqual(len(report["checks"]), 5)
        for item in report["checks"]:
            with self.subTest(item["name"]):
                self.assertTrue(item["passed"], item)
