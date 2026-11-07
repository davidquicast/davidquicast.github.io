#!/usr/bin/env python3
"""Check configured optional CDN files without loading them into the public bundle."""
import base64
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
selected = {
    "mathjax": ["js"], "mermaid": ["js"], "chartjs": ["js"],
    "echarts": ["js.library"], "vega": ["js"], "vega-lite": ["js"],
    "vega-embed": ["js"], "leaflet": ["js", "css"],
    "diff2html": ["js", "css"], "pseudocode": ["js", "css"],
    "img-comparison-slider": ["js", "css"], "swiper": ["js", "css"],
    "jquery": ["js"], "bootstrap-table": ["js", "css"],
    "venobox": ["js", "css"], "masonry": ["js"], "imagesloaded": ["js"],
}
config = json.loads(subprocess.check_output([
    "ruby", "-ryaml", "-rjson", "-rdate", "-e",
    "puts JSON.generate(YAML.safe_load(File.read('_config.yml'), permitted_classes:[Date,Time],aliases:true)['third_party_libraries'])",
], cwd=ROOT, text=True))


def nested(mapping, key):
    for item in key.split("."):
        mapping = mapping.get(item, {}) if isinstance(mapping, dict) else {}
    return mapping if isinstance(mapping, str) else ""


def verify(item):
    name, key = item
    lib = config[name]
    url = nested(lib["url"], key).replace("{{version}}", lib.get("version", ""))
    expected = nested(lib.get("integrity", {}), key)
    result = {"library": name, "resource": key, "version": lib.get("version"), "url": url}
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "PortfolioResourceVerification/1.0"})
        with urllib.request.urlopen(request, timeout=25) as response:
            content = response.read(12_000_000)
            result.update(status=response.status, bytes=len(content))
        cache = ROOT / ".local/redesign/readcv-implementation/optional-resources"
        cache.mkdir(parents=True, exist_ok=True)
        filename = name + "-" + key.replace(".", "-") + (".css" if key == "css" else ".js")
        (cache / filename).write_bytes(content)
        result["cache"] = str((cache / filename).relative_to(ROOT))
        actual = "sha256-" + base64.b64encode(hashlib.sha256(content).digest()).decode()
        result.update(sha256=actual, integrityExpected=expected or None,
                      integrityMatches=not expected or actual == expected, passed=not expected or actual == expected)
    except Exception as error:
        result.update(passed=False, error=str(error))
    return result


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(verify, [(name, key) for name, keys in selected.items() for key in keys]))
output = ROOT / ".local/redesign/readcv-implementation/optional-resource-report.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({"resources": results, "passed": all(r["passed"] for r in results)}, indent=2))
for item in results:
    print(item["library"], item["resource"], "PASS" if item["passed"] else "FAIL", item.get("error", ""))
raise SystemExit(0 if all(r["passed"] for r in results) else 1)
