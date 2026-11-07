#!/usr/bin/env python3
"""Rebuild editorial WebP variants from private generated PNG masters using ImageMagick."""
import argparse
import json
import subprocess
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--originals", type=Path, default=Path(".local/redesign/originals"))
    args = parser.parse_args()
    covers = json.loads(Path("_data/blog_covers.yml").read_text())
    manifest = []
    for slug, cover in covers.items():
        source = args.originals / (slug + ".png")
        if not source.is_file():
            raise SystemExit(f"Missing private master: {source}")
        variants = []
        for width, budget in [(480, 50000), (960, 120000), (1440, 200000)]:
            destination = Path("assets/img/editorial") / f"{slug}-{width}.webp"
            destination.parent.mkdir(parents=True, exist_ok=True)
            height = width * 2 // 3
            quality = 82
            while True:
                subprocess.run([
                    "convert", str(source), "-resize", f"{width}x{height}^",
                    "-gravity", "center", "-extent", f"{width}x{height}",
                    "-strip", "-quality", str(quality), "-define", "webp:method=6",
                    str(destination)
                ], check=True)
                if destination.stat().st_size <= budget or quality <= 50:
                    break
                quality -= 4
            variants.append({
                "path": "/" + str(destination), "width": width, "height": height,
                "bytes": destination.stat().st_size, "quality": quality
            })
        manifest.append({"slug": slug, "alt": cover["alt"], "original": str(source), "variants": variants})
    report = Path(".local/redesign/image-manifest.json")
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Rebuilt {len(manifest)} covers and {len(manifest) * 3} variants; manifest: {report}")

if __name__ == "__main__":
    main()
