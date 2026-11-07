---
page_id: profile
layout: default
title: About
permalink: /about/
description: David Quispe, systems engineer working across cybersecurity and AI safety.
---

{% assign owner_profile = site.pages | where: 'page_id', 'about' | first %}

<section
  class="about-reader"
  data-about-reader
  aria-label="{{ 'navigation.about' | ui_label }}"
>
  <header class="about-reader-heading"><div><h1 data-pretext="lines">David Quispe</h1><p>{{ 'profile.role' | ui_label }}</p></div></header>
  <div class="about-reader-body"><div class="about-copy prose" data-about-source>{{ owner_profile.content | markdownify }}</div><div class="about-page-view prose" data-about-view hidden></div></div>
  <footer class="about-reader-controls" data-about-controls hidden aria-label="{{ 'about_reader.navigation' | ui_label }}"><button type="button" data-about-previous>{{ 'about_reader.previous' | ui_label }}</button><span data-about-status role="status" aria-live="polite"></span><button type="button" data-about-next>{{ 'about_reader.next' | ui_label }}</button></footer>
  <nav class="about-reader-actions" aria-label="{{ 'labels.profile_resources' | ui_label }}"><a href="{{ '/resume/' | relative_url }}" data-content-overlay>{% include icon.liquid name='resume' %}{{ 'about_reader.cv' | ui_label }}</a><a href="{{ '/assets/pdf/en-us/cv.pdf' | relative_url }}" download>{% include icon.liquid name='arrow' %}{{ 'about_reader.download' | ui_label }}</a></nav>
  {% if owner_profile.profile.more_info %}<div class="profile-more-info">{{ owner_profile.profile.more_info }}</div>{% endif %}
</section>
