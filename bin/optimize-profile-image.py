#!/usr/bin/env python3
"""Create local avatar and Open Graph derivatives from the supplied portrait."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('assets/img/profile/david-quispe.png'))
    args = parser.parse_args()
    source = args.source
    if not source.is_file():
        raise SystemExit(f'Missing supplied portrait: {source}')
    source_hash = digest(source)
    dimensions = subprocess.check_output(['identify', '-format', '%w %h', str(source)], text=True).split()
    width, height = map(int, dimensions)
    if width != height or width < 256:
        raise SystemExit('Use an inspected square source at least 256 px wide; the source is preserved unchanged and derivatives are never upscaled.')
    variants = []
    for size in (64, 128, 256):
        target = source.with_name(f'{source.stem}-{size}.webp')
        subprocess.run(['convert', str(source), '-resize', f'{size}x{size}>', '-strip',
                        '-quality', '84', '-define', 'webp:method=6', str(target)], check=True)
        variants.append({'path': '/' + target.as_posix(), 'width': size, 'height': size,
                         'bytes': target.stat().st_size, 'sha256': digest(target)})
    og_size = min(width, 1024)
    og = source.with_name(f'{source.stem}-og.jpg')
    subprocess.run(['convert', str(source), '-resize', f'{og_size}x{og_size}>', '-strip',
                    '-interlace', 'Plane', '-quality', '85', str(og)], check=True)
    if digest(source) != source_hash:
        raise SystemExit('Source portrait unexpectedly changed')
    metadata = {'source': '/' + source.as_posix(), 'source_sha256': source_hash,
                'width': width, 'height': height, 'alt': 'David Quispe',
                'avatar_crop': None,
                'avatar': variants[1]['path'], 'display_size': 64,
                'srcset': ', '.join(f"{v['path']} {v['width']}w" for v in variants),
                'variants': variants,
                'og': {'path': '/' + og.as_posix(), 'width': og_size, 'height': og_size,
                       'bytes': og.stat().st_size, 'sha256': digest(og)}}
    Path('_data/profile_image.yml').write_text(json.dumps(metadata, indent=2) + '\n')
    record = Path('.local/redesign/cv-review/portrait/image-manifest.json')
    record.parent.mkdir(parents=True, exist_ok=True)
    record.write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps(metadata, indent=2))


if __name__ == '__main__':
    main()
