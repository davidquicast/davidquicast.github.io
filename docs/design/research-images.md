# Research editorial images

The current four illustrations were regenerated on 2026-11-06 with the built-in `image_gen.imagegen` tool. They replace the earlier landscape illustrations. The direction follows the existing Blog covers: tactile cut-paper sculptures, relief-printed charcoal surfaces, warm rag paper, restrained cobalt, fine rust-colored binding threads and grounded shadows. Sparse central objects replace scenic landscapes. Each paper has its own visual argument and remains recognizable as a small thumbnail.

## Abstracts and concepts

The actual abstracts were read before generation. Their extraction and source URLs remain in private continuity under `.local/redesign/section-refinement/research-sources/`.

| Paper           | Primary source                                                  | Illustration                                                                                                                                            |
| --------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INCLUDE-2.0     | [ACL Anthology](https://aclanthology.org/2026.emnlp-main.1344/) | Two independent layered arches, with missing local fragments in the inner arch, distinguish linguistic ability from region-grounded knowledge.          |
| CulturalRiddles | [arXiv abstract](https://arxiv.org/abs/2610.29968)              | Differently printed woven bands reveal one pear-shaped opening, suggesting the answer that emerges by combining culturally situated clues.              |
| Somos600M       | [arXiv abstract](https://arxiv.org/abs/2407.17479)              | Distinct printed pages join an open accordion codex through a shared cobalt binding, expressing a community resource that retains linguistic diversity. |
| RigoChat 2      | [arXiv abstract](https://arxiv.org/abs/2503.08188)              | Selected sheets and a folded manuscript feed a compact bound book, representing adaptation under bounded data and hardware.                             |

These are editorial metaphors, not scientific figures, documentary photographs or product screenshots. The prompts exclude text, flags, logos, artificial people, robots, circuits, glowing objects and generic metallic renders.

## Files and optimization

All four generated PNG masters are 1254×1254. Masters and complete prompts remain private under `.local/redesign/compact-editorial/originals/research/` and `.local/redesign/compact-editorial/research-prompts.json`. Previous masters and optimized assets are retained privately for continuity. No API key, paid API or image CLI was used.

The current public assets are square WebP variants at 320×320, 640×640 and 1200×1200. Mapping, actual dimensions, responsive sources and descriptive alternative text are in `_data/research_covers.yml`. Files live at `assets/img/research/{paper-id}-{width}.webp`; original public image paths are preserved. The optimizer uses ImageMagick 6.9.11-60, strips ancillary profiles and adjusts quality within the 50 KB/100 KB/200 KB budgets.

```sh
docker compose exec -T jekyll python3 bin/optimize-research-images.py
```

| Research ID     | 320 px bytes | 640 px bytes | 1200 px bytes |
| --------------- | -----------: | -----------: | ------------: |
| include-2-0     |       18,222 |       69,830 |       185,648 |
| culturalriddles |       16,436 |       65,000 |       175,300 |
| somos600m       |       22,304 |       87,444 |       194,214 |
| rigochat-2      |       17,634 |       68,958 |       180,972 |

Total public payload across all twelve variants: 1,101,962 bytes. A browser selects an appropriate variant rather than downloading all variants. The private manifest records exact dimensions, bytes, quality and SHA256 for every file.

All four new masters were opened and inspected. Final delivered thumbnails and their actual layout are included in the [compact editorial audit](compact-editorial.md). Native eager/lazy loading, intrinsic dimensions and responsive source selection remain active.
