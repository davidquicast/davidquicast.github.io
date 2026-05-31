# Blog Image Technical Prompt

Use this as a flexible creative brief, not as a fixed scene template.

Every image must be made for the specific blog post. The post's thesis, examples, and emotional tone should decide the subject. The visual identity only gives direction; it should not force the same robot, archive, atrium, valley, or object into every image.

## Base Direction

```text
Create a premium editorial illustration for a technical/personal blog post. The image should be conceptually tied to the article, visually imaginative, and suitable as a wide 16:9 hero image. Use a luminous anime / 2.5D concept-art sensibility with clean depth, painterly texture, strong composition, and a polished but not photorealistic finish. No visible text, no logos, no watermark.
```

## Visual Identity

The preferred visual world is optimistic speculative technology with occasional solarpunk or light biopunk influence. This can include future machinery, architecture, natural systems, data artifacts, tools, materials, landscapes, symbolic objects, abstract structures, or human-scale scenes.

Do not treat these as mandatory ingredients. Use them only when they help the specific article.

Good sources of variation:

- Scale: intimate desk scene, human-scale workshop, city infrastructure, landscape, abstract diagrammatic space, object close-up.
- Subject: machine, place, artifact, process, pathway, interface, material, ritual, tool, environment, or metaphor.
- Mood: precise, calm, curious, tense, reflective, playful, clinical, luminous, nocturnal, minimal, expansive.
- Composition: centered icon, cinematic panorama, split state, process flow, close inspection, threshold, map, exploded view, layered depth.
- Material language: glass, ceramic, brushed metal, paper, stone, fabric, light, water, dust, cables, roots, transparent layers, projected geometry.
- Character presence: no characters, hands only, silhouette, partial figure, close portrait, team, crowd, distant scale figure, first-person view, object-only scene.

## Variation Pass

Before generating, choose a distinct art direction for the post. Do not let the model default to clear daytime. Pick the atmosphere deliberately from the article.

Vary at least 5 of these dimensions between posts:

- Time: dawn, morning, noon, golden hour, dusk, night, midnight, blue hour, eclipse-like light, artificial lab light.
- Weather: clear, mist, rain, storm clouds, snow, dry heat, fog, wind, humid greenhouse air, indoor stillness, underwater haze.
- Season: spring, summer, autumn, winter, dry season, rainy season, nonseasonal interior.
- Setting: room, workshop, observatory, street, archive, garden, desert, coast, mountain, orbital station, underground lab, browser-like abstract space, industrial bay, quiet domestic desk.
- Camera: wide panorama, close-up, top-down, low-angle, isometric, over-the-shoulder, macro object, cutaway, split-screen, process diagram.
- Color mood: pale and clinical, warm amber, cool blue, night violet, soft green, monochrome with accent, high contrast, pastel, smoky, metallic.
- Lighting: backlit, rim light, lantern light, screen glow, reflected water light, cloudy diffuse light, harsh inspection light, neon only if topic demands it.
- Texture: paper, glass, ceramic, fabric, stone, rusted metal, transparent plastic, dust, water, projected particles, organic matter.
- Motion: stillness, flow, collapse, expansion, sorting, pruning, compression, reflection, inversion, branching, alignment.
- Character presence: none, one person, several people, hands only, silhouette, reflected figure, partial face, distant figure, first-person workspace, non-human tool/device as the main actor.
- Character role: maintainer, researcher, curator, reader, builder, auditor, cartographer, archivist, designer, operator, student, mentor, anonymous passerby, no role.
- Character action: repairing, sorting, hesitating, refusing, opening, closing, measuring, carrying, observing, sketching, calibrating, walking, waiting, comparing, pruning, navigating, stepping away.
- Character design: vary clothing silhouette, posture, age impression, hairstyle, body language, accessories, and distance from camera. Do not default to a generic small person standing in front of a machine.
- Abstraction level: literal technical scene, metaphorical scene, symbolic object, architectural metaphor, abstract material study.

The selected atmosphere, character choice, and character action must be included explicitly in the final image prompt. If no character is used, state that the scene is object-only or environment-only.

## Character And Subject Diversity

Characters are optional. Do not add a person just to make the image feel cinematic.

Avoid the repeated pattern of "small generic observer looking at a large machine." If a character appears, give them a specific visual function tied to the blog:

- They perform an action, not only observe.
- Their posture and placement communicate the article's idea.
- Their clothing and silhouette fit the setting.
- Their scale is chosen intentionally: close, medium, distant, cropped, reflected, or absent.

Characters must not all look like the same young anonymous researcher. Vary figure type, clothing, role, pose, distance, and whether the face is visible.

Some posts may work better without characters:

- Object study: one symbolic artifact carries the idea.
- Process view: data, light, material, or tools show the transformation.
- Environmental metaphor: architecture, weather, path, or landscape expresses the concept.
- Diagrammatic scene: abstract forms explain the workflow.

## Relevance Pass

Before writing the image prompt, read the target post and extract:

```text
Article thesis: [one sentence]
Key ideas: [3-5 concrete ideas]
Image job: [what the image should communicate]
Possible metaphors: [3 different visual metaphors]
What to avoid: [what would make it generic or misleading]
```

Pick one metaphor because it fits the article, not because it matches a previous image.

## Prompt Shape

Use this structure when generating:

```text
Blog title: [title]
Blog filename: [exact markdown filename or external basename]
Article thesis: [one sentence]
Image job: [one sentence]
Chosen metaphor: [one clear visual idea]
Atmosphere: [time, weather, season/interior condition, lighting, color mood]
Character/subject choice: [no character / hands only / specific role and action / object-only / environment-only]
Scene: [specific scene, object, environment, or process]
Style: premium editorial illustration, luminous anime / 2.5D concept art, painterly texture, not photorealistic
Composition: [camera/framing choice], wide 16:9 hero image, strong focal point, readable at thumbnail size
Constraints: no readable text, no logos, no watermark, no generic stock imagery
Avoid: [topic-specific cliches]
```

## Style Guardrails

- Keep the image readable as a blog hero and card thumbnail.
- Avoid repeating the same visual solution across different posts.
- Avoid repeating the same time of day, weather, camera, and setting across several posts.
- Avoid repeating the same character type, pose, role, or "observer looking at object" composition across several posts.
- Avoid forcing robots, giant machines, archives, glass towers, or green landscapes unless the article needs them.
- Nature can be present, but it should not automatically dominate the frame.
- Technical articles can be more diagrammatic, object-focused, interface-adjacent, or workshop-like.
- Abstract AI/persona articles can use symbols, spaces, artifacts, thresholds, mirrors, masks, contracts, paths, constraints, memory objects, or self-monitoring devices.
- If a prior image used a human figure, consider whether the next image should use hands, no person, a close object, a team, or a different camera relationship.

## Negative Prompt

```text
No generic AI stock art, no generic lone observer staring at a machine, no repeated anonymous researcher figure, no robot handshakes, no random holographic dashboards, no hacker hoodies, no corporate stock imagery, no literal laptop scene unless the article requires it, no excessive repeated greenery, no default giant robot in a field, no photorealistic render, no glossy 3D product render, no dark cyberpunk cliche, no clutter, no baked-in title, no readable text, no logo, no watermark.
```
