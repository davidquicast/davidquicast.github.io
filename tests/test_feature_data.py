"""Exercise publication input boundaries and every configured-profile mapping."""
from pathlib import Path
import json
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class FeatureDataTests(unittest.TestCase):
    def test_publication_and_connection_boundaries(self):
        result = subprocess.run(["bundle", "exec", "ruby", "tools/test-feature-data.rb"],
                                cwd=ROOT, text=True, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, timeout=40)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        for item in report["checks"]:
            with self.subTest(item["name"]):
                self.assertTrue(item["passed"], item)
        self.assertGreaterEqual(len(report["checks"]), 10)
