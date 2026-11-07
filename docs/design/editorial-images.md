# Editorial images

Twelve original conceptual illustrations were generated with the built-in image generation tool after reading each article, including the external Hugging Face article. No paid API or image CLI was used. The illustrations are editorial metaphors, not documentary photography or product screenshots.

The shared direction combines cut paper and relief-print textures. Stone, charcoal and cobalt connect most covers to the UI; the earlier persona and practical-tool covers retain vermilion or forest accents as topic-specific variation. Each composition depicts its article's argument rather than a generic AI symbol.

All 1536 × 1024 PNG masters and generation prompts are private under .local/redesign and excluded from Git and the public site. Public files are stripped WebP at 480 × 320, 960 × 640 and 1440 × 960. Existing legacy image URLs are preserved. Source mapping and alternative text live in \_data/blog_covers.yml; article frontmatter also points to the corresponding image and thumbnail.

## Optimization

Version: ImageMagick 6.9.11-60 Q16 aarch64 2021-01-25 https://imagemagick.org

Rebuild inside Docker with:

```sh
docker compose exec jekyll python3 bin/optimize-editorial-images.py
```

The script requires private masters and ImageMagick. It starts at quality 82 and adjusts to 50 KB / 120 KB / 200 KB budgets. Full per-file weights, dimensions and quality are written to .local/redesign/image-manifest.json. The visual review contact sheet is .local/redesign/evidence/editorial-contact-sheet.jpg.

## Delivered assets

| Article slug                                                                   | 480 px bytes | 960 px bytes | 1440 px bytes |
| ------------------------------------------------------------------------------ | -----------: | -----------: | ------------: |
| ai-personas-are-not-masks                                                      |        20878 |        82400 |        180582 |
| benchmarks-are-fanfiction-with-numbers                                         |        26472 |        93508 |        166676 |
| instant-dark-theme-browser-devtools                                            |        11390 |        59402 |        146280 |
| personas-are-becoming-the-new-passwords                                        |        26158 |       104842 |        184586 |
| private-synthetic-data-generation                                              |        32522 |       104082 |        185806 |
| shrink-wsl2-docker-virtual-disks                                               |        19074 |        70474 |        148950 |
| the-axis-between-memory-and-agency                                             |        35330 |       106418 |        183192 |
| the-day-your-agent-deletes-the-database-and-apologizes-beautifully             |        22292 |       101210 |        184222 |
| the-problem-with-a-persona-that-cannot-refuse                                  |        27272 |       113604 |        199788 |
| the-weird-grief-of-losing-an-ai-that-never-existed                             |        20144 |        81596 |        183192 |
| why-ai-girlfriends-understand-product-market-fit-better-than-enterprise-agents |        33254 |       113952 |        189352 |
| your-ai-has-a-midlife-crisis-because-you-gave-it-memory                        |        28034 |        94366 |        193784 |

Total public WebP payload across all 36 variants: 3575084 bytes. A responsive browser downloads one suitable variant per displayed image, not all three.

Twelve covers were visually inspected in the contact sheet. The homepage/list/article templates are responsible for srcset, fixed dimensions and eager loading of their first visible image; verify them in the browser after layout changes.
