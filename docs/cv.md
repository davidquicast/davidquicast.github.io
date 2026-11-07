# CV preview

The source of truth is the existing [`assets/pdf/en-us/cv.pdf`](../assets/pdf/en-us/cv.pdf). Its URL and original bytes are preserved. The portfolio shows deterministic page images and an accessible text version instead of depending on a browser PDF plugin during initial rendering. Open/download PDF actions remain available; page images use the existing nested image viewer.

[`scripts/build-resume-preview.cjs`](../scripts/build-resume-preview.cjs) uses Poppler to render the actual pages and extract their text, then existing ImageMagick to encode lossless WebP. It adds no browser dependency and invents no CV content. Temporary PNG masters stay in private `.local/` storage and are excluded from Git and deployment.

The generator is integrated into `npm run build` and `npm run watch`. A native watch on the PDF directory notices replacements; source hashing and variant checksums skip unchanged builds and deduplicate events. Generated metadata lives in `_data/resume_preview.json`, with source SHA, page count, tool versions, dimensions, byte sizes and image checksums. The template applies base URLs to every responsive candidate.

To update the CV, replace the source PDF in Docker. Normal builds/watch regenerate the preview and transcript. To force regeneration:

```sh
docker compose exec -T jekyll node scripts/build-resume-preview.cjs --force
```

Poppler `22.12.0` and ImageMagick `6.9.11-60` were used. `poppler-utils` is installed in the project Dockerfile; no manual host installation is required.

| Page | Dimensions  | Lossless WebP bytes |
| ---- | ----------- | ------------------- |
| 1    | 800 × 1132  | 84,212 B            |
| 1    | 1600 × 2263 | 188,474 B           |
| 2    | 800 × 1132  | 49,424 B            |
| 2    | 1600 × 2263 | 117,190 B           |

The source PDF is 173,076 B and has two pages. The 800 px variants favor readable text over an arbitrary thumbnail limit; the 1600 px versions serve larger displays and enlargement. The first page loads eagerly, later pages lazily, with reserved dimensions. Text extraction preserves source words and line breaks in semantic preformatted HTML; the native disclosure allows selection and screen-reader access.

Verification includes actual image decoding without JavaScript, source/variant SHA checks, exact extracted words, responsive overflow, cached generation, deduplicated native watch events and nested reader/image-history behavior. The watch contract uses a private fixture and never edits the owner's PDF.
