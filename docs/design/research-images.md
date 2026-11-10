# Research editorial images

Regenerated on 2026-11-10 using the built-in image generation tool after reading all four actual primary-source abstracts. Four different visual techniques now distinguish the papers at small sizes; these are editorial metaphors, not scientific figures or documentary images.

| Paper           | Primary source                                                  | Concept and medium                                                                                                                           |
| --------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| INCLUDE-2.0     | [ACL Anthology](https://aclanthology.org/2026.emnlp-main.1344/) | Screenprint: an independent measurement grid crosses regional forms, separating language ability from local knowledge.                       |
| CulturalRiddles | [arXiv](https://arxiv.org/abs/2610.29968)                       | Imagined textile still life: different pieces form a keyhole, with a wooden key representing a solution reached by combining cultural clues. |
| Somos600M       | [arXiv](https://arxiv.org/abs/2407.17479)                       | Woodcut: distinct voices in green, orange and charcoal compose a community resource.                                                         |
| RigoChat 2      | [arXiv](https://arxiv.org/abs/2503.08188)                       | Gouache: a compact hand press and selected sheets express adaptation within data/hardware constraints.                                       |

The subjects, media, silhouettes and compositions vary. A warm paper ground and restrained color keep the relationship to the Blog artwork. No generated portraits, product screenshots, figures, flags, logos, or invented research measurements are presented.

## Delivered assets

| Paper           | 320×320 bytes | 640×640 bytes | 1200×1200 bytes |
| --------------- | ------------: | ------------: | --------------: |
| include-2-0     |        19,132 |        53,266 |         177,498 |
| culturalriddles |        20,122 |        86,660 |         197,510 |
| somos600m       |        34,766 |        98,252 |         199,112 |
| rigochat-2      |         5,464 |        17,786 |          60,516 |

Every source PNG is 1254×1254. Originals and complete separate prompts remain private under `.local/redesign/interface-refinement/originals/research/` and `research-prompts.json`. The image tool produced the original assets; ImageMagick 6.9.11-60 created the optimized WebP derivatives in Docker. The tool default originals remain at their generated-image source path as well. Public paths stay `assets/img/research/{id}-{320,640,1200}.webp`. Metadata and actual descriptive alternatives live in `_data/research_covers.yml`. Each variant is below its 50/100/200 KB budget; no generated master enters the public bundle.

Rebuild inside Docker:

```sh
docker compose exec -T jekyll python3 bin/optimize-research-images.py
```

The default optimizer points at the current private masters; its manifest records dimensions, quality, weights and SHA256. Older paper-sculpture masters remain in the earlier private continuity directory rather than being mixed with this set. No API key or paid external image API was used.
