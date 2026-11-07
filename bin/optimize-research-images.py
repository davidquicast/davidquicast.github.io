#!/usr/bin/env python3
"""Rebuild research WebP variants from private generated masters with ImageMagick."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--originals", type=Path, default=Path(".local/redesign/compact-editorial/originals/research"))
    parser.add_argument("--manifest", type=Path, default=Path(".local/redesign/compact-editorial/research-image-manifest.json"))
    args = parser.parse_args()
    covers = json.loads(subprocess.check_output([
        "ruby", "-rjson", "-ryaml", "-e", "puts JSON.generate(YAML.safe_load_file(ARGV[0]))",
        "_data/research_covers.yml"
    ], text=True))
    manifest = []
    for paper_id, cover in covers.items():
        source = args.originals / (paper_id + ".png")
        if not source.is_file():
            raise SystemExit(f"Missing private master: {source}")
        dimensions = subprocess.check_output(["identify", "-format", "%wx%h", str(source)], text=True)
        variants = []
        for width, budget in [(320, 50000), (640, 100000), (1200, 200000)]:
            destination = Path("assets/img/research") / f"{paper_id}-{width}.webp"
            destination.parent.mkdir(parents=True, exist_ok=True)
            height = round(width * cover["height"] / cover["width"])
            quality = 82
            while True:
                subprocess.run([
                    "convert", str(source), "-resize", f"{width}x{height}^",
                    "-gravity", "center", "-extent", f"{width}x{height}",
                    "-strip", "-quality", str(quality), "-define", "webp:method=6",
                    str(destination)
                ], check=True)
                if destination.stat().st_size <= budget:
                    break
                if quality <= 50:
                    raise SystemExit(f"Budget exceeded: {destination}")
                quality -= 4
            variants.append({"path": "/" + str(destination), "width": width, "height": height,
                             "bytes": destination.stat().st_size, "quality": quality,
                             "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()})
        manifest.append({"paper_id": paper_id, "alt": cover["alt"], "master_dimensions": dimensions,
                         "private_master": str(source), "variants": variants})
    report = args.manifest
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Rebuilt {len(manifest)} research covers and {len(manifest) * 3} variants; manifest: {report}")


if __name__ == "__main__":
    main()
