"""Precision, provenance, and meaningful activity boundaries."""
from pathlib import Path
import json
import subprocess
import unittest

class ContentDatesTests(unittest.TestCase):
    def test_shared_content_dates(self):
        root = Path(__file__).resolve().parents[1]
        result = subprocess.run(["bundle", "exec", "ruby", "tools/test-content-dates.rb"], cwd=root, text=True, capture_output=True, timeout=40)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertGreaterEqual(len(report["checks"]), 12)
        self.assertTrue(report["passed"], report)
