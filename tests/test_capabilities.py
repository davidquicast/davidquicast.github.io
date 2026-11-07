"""End-to-end build fixtures for dormant capabilities and future research data."""
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class CapabilityBuildTests(unittest.TestCase):
    def test_isolated_localization_research_and_opt_in_build(self):
        result = subprocess.run(
            ["bundle", "exec", "ruby", "scripts/verify-capabilities.rb"],
            cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180,
        )
        report_path = ROOT / ".local/redesign/readcv-implementation/capability-fixture/report.json"
        self.assertTrue(report_path.exists(), result.stdout[-6000:])
        report = json.loads(report_path.read_text())
        self.assertEqual(result.returncode, 0, result.stdout[-9000:])
        self.assertTrue(report["passed"], report)
        self.assertGreaterEqual(len(report["checks"]), 7)
