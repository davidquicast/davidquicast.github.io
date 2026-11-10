# Profile portrait

The supplied `pfp2v4.png` was moved unchanged to `assets/img/profile/david-quispe.png`. Its original dimensions are 1024×1024 and its SHA256 is `4674f9faa95b4b35d16adc3577d42020283615b25b3d71abb34f3cbbd6b1e80c`. The previous owner portrait and its three stale WebP derivatives were removed. Original project illustrations and legacy Einstein sample content/assets were not replaced.

## Rebuild

Run the deterministic local processing pipeline inside Docker:

```sh
docker compose exec -T jekyll python3 bin/optimize-profile-image.py
```

The original PNG is never rewritten. All derivatives preserve the complete original square frame: no crop, zoom or face repositioning is applied. The avatar uses `object-fit: contain` with a quiet square corner radius; hover and entrance transforms are disabled for the photograph. A future photograph can use `--source`. The pipeline requires a square image of at least 256 px, avoids upscaling, strips metadata from derivatives and verifies the unchanged master SHA256. `_data/profile_image.yml` records `avatar_crop: null`.

The homepage displays a single 64×64 portrait. Three responsive WebP sources cover ordinary through high-density displays; the fallback is 128 px. The semantic image has explicit dimensions, an owner-identifying alternative text, eager loading, asynchronous decoding and high fetch priority. Configured alternate/custom profile images still use their actual supplied URL. Generic fixture tests retain that behavior.

The default social image is an uncropped 1024×1024 JPEG derived from the supplied photograph, configured in `_config.yml`. Project, paper and article images continue to take precedence on their own routes. The PNG master is not requested for the ordinary avatar.

## Delivered derivatives

| Asset                                       | Dimensions |   Bytes |
| ------------------------------------------- | ---------- | ------: |
| `/assets/img/profile/david-quispe-64.webp`  | 64×64      |   1,228 |
| `/assets/img/profile/david-quispe-128.webp` | 128×128    |   4,280 |
| `/assets/img/profile/david-quispe-256.webp` | 256×256    |  13,286 |
| `/assets/img/profile/david-quispe-og.jpg`   | 1024×1024  | 137,696 |

ImageMagick 6.9.11-60 performs the resizing/compression. The WebP avatar quality is 84; the progressive social JPEG uses quality 85. Replacements require the user's supplied or authorized photograph; no generated face, identity reconstruction or external image was used. The full-frame derivatives are inspected at their delivered sizes.

`tests/profile-portrait.spec.js` checks actual responsive image selection/decoding at three pixel densities, a visible no-JavaScript avatar without zoom or cropping, exact master preservation, image dimensions and the real social JPEG. Existing identity tests use semantic avatar selectors, and interaction fixtures use the maintained derivative assets rather than a deleted filename. Runtime execution is coordinated with the main Docker verification.
