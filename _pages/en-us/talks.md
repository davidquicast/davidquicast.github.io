---
page_id: talks
layout: default
title: Talks
permalink: /talks/
description: Keynotes, technical workshops, and speaking engagements on AI agent security, systems, and cybersecurity.
---

<a class="back-link" href="{{ '/' | relative_url }}?view=talks">← {{ 'navigation.talks' | ui_label: 'Talks' }}</a>

<header class="page-heading work-heading">
  <h1 data-pretext="lines">{{ 'navigation.talks' | ui_label: 'Talks' }}</h1>
  <p class="lead" data-pretext>Workshops, technical presentations, and speaking engagements on AI agent security, systems, and cybersecurity.</p>
</header>

<section class="talks-collection wall-collection" aria-label="Talks and workshops">
  <div class="talks-list wall-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 24px;">
    {% for talk in site.data.talks_catalog %}
      {% include talk-card.liquid talk=talk entry=talk loading='eager' %}
    {% endfor %}
  </div>
</section>
