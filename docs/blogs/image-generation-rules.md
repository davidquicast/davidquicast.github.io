# Blog Image Generation Rules

## Output Folder

Save final blog images in:

```text
assets/img/blog/
```

## Image Count

For a new blog post, generate 3 image options by default.

Process one blog post at a time unless explicitly asked to process all posts.

If a blog already has images, do not overwrite or delete them unless explicitly asked. Continue with the next available number.

Example:

```text
2026-05-10-ai-personas-are-not-masks_1.png
2026-05-10-ai-personas-are-not-masks_2.png
2026-05-10-ai-personas-are-not-masks_3.png
2026-05-10-ai-personas-are-not-masks_4.png
```

Before generating, read the target blog post. The image must represent the blog's actual subject, not only match the general visual style.

Each option should connect to a concrete idea from the post. If the connection is weak or looks reusable for any unrelated post, revise the concept before generating.

Do a concept check before using the image tool:

```text
1. Can this concept be explained in one sentence using the blog title?
2. Is the chosen metaphor specific to this article?
3. Would the image be wrong for a different AI blog?
4. Is the visual style supporting the idea instead of replacing it?
5. Is it visually different from the previous blog images?
6. Did the prompt explicitly choose atmosphere: time, weather/interior condition, lighting, color mood, setting, and camera?
7. Did the prompt explicitly choose character strategy: no character, hands only, object-only, environment-only, or a specific role/action?
```

If any answer fails, rewrite the prompt before generating.

## Naming

Use the exact Markdown filename as the image basename, including the date prefix. Replace `.md` with `.png` and add the option number after the basename.

Example blog file:

```text
2026-05-10-ai-personas-are-not-masks.md
```

Generated images:

```text
2026-05-10-ai-personas-are-not-masks_1.png
2026-05-10-ai-personas-are-not-masks_2.png
2026-05-10-ai-personas-are-not-masks_3.png
```

Do not shorten the name to only the slug. Do not remove the date. Do not use random names, timestamps, or generic names.

## External Blog Posts

External posts from `external_sources` do not have a physical Markdown file in `_posts`. Use this naming mode for them:

```text
YYYY-MM-DD-external-source-slug_1.png
YYYY-MM-DD-external-source-slug_2.png
YYYY-MM-DD-external-source-slug_3.png
```

The generated external basename must match the `blog_image_basename` assigned by `_plugins/external-posts.rb`.

Example:

```text
2025-03-05-external-huggingfaceco-private-synthetic-data-generation_1.png
2025-03-05-external-huggingfaceco-private-synthetic-data-generation_2.png
2025-03-05-external-huggingfaceco-private-synthetic-data-generation_3.png
```

## Technical Format

- Format: PNG.
- Aspect ratio: 16:9.
- Required generation size: `2912x1632`.
- Orientation: horizontal only.
- Do not create square, vertical, or low-resolution images.

## UI Requirements

The same image must work as:

- A large hero image.
- A featured article image.
- A blog card thumbnail.
- A future social preview.

Keep important subjects away from the edges. Leave enough breathing room for responsive cropping. The image must remain readable at thumbnail size.

The UI handles article titles and labels, so the image must not include visible text, fake UI, logos, watermarks, or baked-in titles.

## Variety And Style Limits

The visual identity can include nature and future machinery, but neither should become a default formula.

- Prefer concept-specific scenes over decorative world-building.
- Vary scale, setting, subject, composition, color mood, and metaphor between posts.
- Vary atmosphere intentionally: day/night, weather, season, indoor/outdoor, lighting source, camera angle, material palette, and motion.
- Vary character strategy intentionally: no character, hands only, close figure, distant figure, team, reflected figure, first-person view, or object-only scene.
- Do not reuse the same robot/archive/atrium/valley pattern unless it is clearly the best fit.
- Do not reuse the same generic observer posture across posts.
- Avoid letting any single motif dominate the whole blog image set.

## Source Of Truth

Use the technical visual prompt in:

```text
docs/blogs/image-technical-prompt.md
```

Optional visual references can be placed in:

```text
docs/blogs/references/
```

Use references for inspiration only. Do not copy them directly.
