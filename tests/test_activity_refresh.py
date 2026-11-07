"""Offline transport and provenance contracts for public activity snapshots."""
from pathlib import Path
import json
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ActivityRefreshTests(unittest.TestCase):
    def test_public_activity_refresh_boundaries(self):
        result = subprocess.run(["ruby", "tools/test-activity-refresh.rb"], cwd=ROOT,
                                text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=40)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertTrue(report["passed"], report)
        self.assertGreaterEqual(len(report["checks"]), 16)
