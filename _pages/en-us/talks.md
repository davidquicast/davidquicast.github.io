---
page_id: talks
layout: default
title: Talks
permalink: /talks/
description: Keynotes, technical workshops, and speaking engagements on AI agent security, systems, and cybersecurity.
nav: true
nav_order: 2
---

<a class="back-link" href="{{ '/' | relative_url }}">← {{ 'navigation.profile' | ui_label }}</a>

<header class="page-heading work-heading">
  <h1 data-pretext="lines">{{ 'navigation.talks' | ui_label: 'Talks' }}</h1>
  <p class="lead" data-pretext>Workshops, technical presentations, and speaking engagements on AI agent security, systems, and cybersecurity.</p>
</header>

<section class="talks-collection wall-collection" aria-label="Talks and workshops">
  <div class="talks-list wall-grid">
    <article class="wall-card talk-card wall-text-card" data-wall-card>
      <div class="wall-card-body">
        <p class="wall-meta">
          {% include icon.liquid name='award' -%}
          Workshop · Nov 7, 2026 · Cusco, Peru
          <span class="featured-mark">
            {%- include icon.liquid name='star' -%}
            DevFest 2026
          </span>
        </p>
        <h2>
          <a href="https://huggingface.co/spaces/davidquicast/devfest-cusco-2026-ai-security" target="_blank" rel="noopener noreferrer" data-pretext>¿Puede Hugging Face manipular a Antigravity? (Can Hugging Face Manipulate Antigravity?)</a>
        </h2>
        <p class="talk-venue" style="font-size: 0.88rem; color: var(--muted); margin: 0.25rem 0 0.75rem;">
          <strong>GDG DevFest Cusco 2026</strong> · Auditorio, Universidad Andina del Cusco (Delivered in Spanish)
        </p>
        <p class="wall-excerpt" data-pretext>
          An empirical, hands-on security workshop exploring whether third-party tool descriptions and Model Context Protocol (MCP) servers can manipulate autonomous coding agents like Google Antigravity. Covered indirect prompt injections via Hugging Face Spaces, <code>agents.md</code> specifications, empirical exfiltration tests, and runtime defenses using <code>PreToolUse</code> lifecycle hooks.
        </p>
        <div class="project-actions" style="margin-top: 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
          <a class="button button-sm" href="https://huggingface.co/spaces/davidquicast/devfest-cusco-2026-ai-security" target="_blank" rel="noopener noreferrer">Interactive Slides ↗</a>
          <a class="button button-sm" href="https://github.com/davidquicast/workshop-hf-antigravity" target="_blank" rel="noopener noreferrer">Code &amp; Harness ↗</a>
          <a class="button button-sm" href="https://huggingface.co/collections/davidquicast/gdg-devfest-cusco-2026-agentic-ai-security" target="_blank" rel="noopener noreferrer">HF Collection ↗</a>
          <a class="button button-sm" href="https://huggingface.co/spaces/davidquicast/generador-imagenes-2" target="_blank" rel="noopener noreferrer">MCP Space ↗</a>
          <a class="button button-sm" href="https://es.linkedin.com/posts/gdgcusco_gdgcusco-devfestcusco-googleantigravity-activity-7524596454246612992-wl2W" target="_blank" rel="noopener noreferrer">LinkedIn Post ↗</a>
          <a class="button button-sm" href="{{ '/blog/2026/can-hugging-face-manipulate-antigravity/' | relative_url }}">Read Article →</a>
        </div>
      </div>
    </article>
  </div>
</section>
