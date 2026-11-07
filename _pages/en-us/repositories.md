---
page_id: repositories
layout: default
permalink: /repositories/
title: Repositories
description: Code and open-source contributions from David Quispe.
---

<header class="page-heading"><h1 data-pretext="lines">Out in the open.</h1><p class="lead">Selected repositories, contributions and experiments.</p><a class="button" href="https://github.com/davidquicast">GitHub profile ↗</a></header>
<div class="archive-list">{% for repo in site.data.repositories.github_repos %}<article class="archive-entry"><h2><a href="https://github.com/{{ repo }}" data-pretext>{{ repo | split: '/' | last | replace: '-', ' ' }}</a></h2><p>{{ repo }}</p></article>{% endfor %}</div>
