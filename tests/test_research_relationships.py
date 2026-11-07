"""Verify research provenance, relationship boundaries and canonical exports offline."""
from pathlib import Path
import json
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ResearchRelationshipTests(unittest.TestCase):
    def test_canonical_papers_and_cited_work_remain_distinct(self):
        result = subprocess.run(
            ["bundle", "exec", "ruby", "tools/test-research-relationships.rb"],
            cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=40,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        report = json.loads(result.stdout)
        self.assertTrue(report["passed"], report)
        self.assertGreaterEqual(len(report["checks"]), 20)
        for check in report["checks"]:
            with self.subTest(check["name"]):
                self.assertTrue(check["passed"], check)
