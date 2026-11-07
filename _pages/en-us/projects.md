---
page_id: projects
layout: default
title: Projects
permalink: /projects/
description: Projects and open-source contributions in AI systems, safety, cybersecurity and software.
nav: true
nav_order: 3
---

<a class="back-link" href="{{ '/' | relative_url }}?view=projects">← {{ 'navigation.profile' | ui_label }}</a>

<header class="page-heading work-heading"><h1 data-pretext="lines">{{ 'navigation.projects' | ui_label }}</h1><p class="lead" data-pretext>Personal projects and open-source collaborations in AI systems, safety and cybersecurity.</p></header>
    {% assign catalog_projects = site.data.profile_catalog.items | where: 'kind', 'project' %}
    {% assign projects = '' | split: '' %}
    {% for entry in catalog_projects %}{% assign projects = projects | push: entry.source %}{% endfor %}
    {% unless projects.size > 0 %}
      {% assign projects = site.projects | where_exp: 'project', 'project.published != false' | sort: 'importance' %}
    {% endunless %}

<section class="project-index wall-collection" aria-label="Project collection" data-filter-root data-kind="projects">
  <div class="filter-panel" data-ui>
    <label class="search-field"><span>{{ 'filters.find_project' | ui_label }}</span><input disabled data-enable-with-js type="search" name="q" placeholder="{{ 'filters.project_placeholder' | ui_label }}" autocomplete="off" data-search></label>
    {% if site.enable_project_categories %}<fieldset class="filter-options"><legend>{{ 'feed.project_group' | ui_label }}</legend><div class="filter-buttons"><button disabled data-enable-with-js type="button" data-filter="all" aria-pressed="true">{{ 'feed.all_projects' | ui_label }}</button><button disabled data-enable-with-js type="button" data-filter="independent" aria-pressed="false">{{ 'feed.personal' | ui_label }}</button><button disabled data-enable-with-js type="button" data-filter="contributions" aria-pressed="false">{{ 'projects.contributions' | ui_label }}</button></div></fieldset>{% endif %}
    {% assign project_topics = '' | split: '' %}{% for project in projects %}{% if project.tags %}{% assign project_topics = project_topics | concat: project.tags %}{% endif %}{% endfor %}{% assign project_topics = project_topics | uniq | sort %}
    <label class="year-filter project-topic-filter">{{ 'filters.topic' | ui_label }}<select disabled data-enable-with-js name="topic" data-project-topic><option value="all">{{ 'filters.all_topics' | ui_label: 'All topics' }}</option>{% for topic in project_topics %}<option value="{{ topic | downcase | escape }}">{{ topic | replace: '-', ' ' | escape }}</option>{% endfor %}</select></label>
    <p class="filter-status" role="status" aria-live="polite" data-status>{{ 'filters.projects_initial' | ui_label }}</p><noscript><p>{{ 'filters.enable_projects' | ui_label }}</p></noscript>
  </div>
  <div class="project-list wall-grid">
    {% for project in projects %}
      {% assign project_loading = 'lazy' %}
      {% if forloop.first %}{% assign project_loading = 'eager' %}{% endif %}
      {% include project-card.liquid project=project loading=project_loading %}
    {% endfor %}
  </div>
  <div class="empty-state" data-empty hidden><h2>{{ 'filters.no_projects' | ui_label }}</h2><p>{{ 'filters.empty_projects_help' | ui_label }}</p><button disabled data-enable-with-js type="button" class="button" data-reset>{{ 'filters.reset' | ui_label }}</button></div>
</section>
