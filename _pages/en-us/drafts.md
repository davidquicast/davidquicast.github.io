---
page_id: drafts
layout: default
title: Draft previews
permalink: /drafts/
published: false
sitemap: false
---

<header class="page-heading"><h1>Draft previews</h1><p class="lead">Unpublished writing, available only in the local preview.</p></header>
<div class="journal-list wall-grid">
  {% for post in site.posts %}
    {% if post.published == false %}
      {% include writing-card.liquid post=post loading='lazy' %}
    {% endif %}
  {% endfor %}
</div>
