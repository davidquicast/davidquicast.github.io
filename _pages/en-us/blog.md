---
page_id: blog
layout: default
permalink: /blog/
title: Blog
description: Notes and tutorials on AI behavior, safety, software and cybersecurity.
nav: true
nav_order: 1
pagination:
  enabled: true
  collection: posts
  permalink: /page/:num/
  per_page: 20
  sort_field: date
  sort_reverse: true
---

<a class="back-link" href="{{ '/' | relative_url }}?view=writing">← {{ 'navigation.profile' | ui_label }}</a>

<header class="page-heading"><h1 data-pretext="lines">{{ 'navigation.writing' | ui_label }}</h1><p class="lead" data-pretext>Articles and practical notes on AI behavior, security and software.</p></header>
{% if paginator %}{% assign postlist = paginator.posts %}{% else %}{% assign postlist = site.posts %}{% endif %}
{% assign public_posts = postlist | where_exp: 'post', 'post.published != false' %}
<section class="journal wall-collection" aria-label="Blog collection" data-filter-root data-kind="articles">
  <div class="filter-panel blog-filters" data-ui>
    <label class="search-field"><span>{{ 'filters.find_article' | ui_label }}</span><input disabled data-enable-with-js type="search" name="q" placeholder="{{ 'filters.article_placeholder' | ui_label }}" autocomplete="off" data-search></label>
    <fieldset class="filter-options"><legend>{{ 'filters.topic' | ui_label }}</legend><div class="filter-buttons"><button disabled data-enable-with-js type="button" data-filter="all" aria-pressed="true">{{ 'filters.everything' | ui_label }}</button>{% for tag in site.display_tags %}<button disabled data-enable-with-js type="button" data-filter="{{ tag }}" aria-pressed="false">{{ tag | replace: '-', ' ' }}</button>{% endfor %}</div></fieldset>
    <label class="year-filter">{{ 'filters.year' | ui_label }}<select disabled data-enable-with-js name="year" autocomplete="off" data-year><option value="all">{{ 'filters.all_years' | ui_label }}</option>{% assign seen_years = '' %}{% for post in public_posts %}{% assign year = post.date | date: '%Y' %}{% unless seen_years contains year %}<option value="{{ year }}">{{ year }}</option>{% assign seen_years = seen_years | append: year | append: ' ' %}{% endunless %}{% endfor %}</select></label>
    <p class="filter-status" role="status" aria-live="polite" data-status>{{ 'filters.articles_initial' | ui_label }}</p><noscript><p>{{ 'filters.enable_articles' | ui_label }}</p></noscript>
  </div>
  <div class="journal-list wall-grid">
    {% for post in public_posts %}
      {% assign loading = 'lazy' %}{% if forloop.index < 5 %}{% assign loading = 'eager' %}{% endif %}
      {% include writing-card.liquid post=post loading=loading filter=true %}
    {% endfor %}
  </div>
  <div class="empty-state" data-empty hidden><h2>{{ 'filters.no_articles' | ui_label }}</h2><p>Try another word, topic or year.</p><button disabled data-enable-with-js class="button" type="button" data-reset>{{ 'filters.reset' | ui_label }}</button></div>
</section>
{% if paginator.total_pages > 1 %}{% include pagination.liquid %}{% endif %}
