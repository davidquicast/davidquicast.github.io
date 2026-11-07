---
page_id: resume
layout: default
title: Resume
permalink: /resume/
description: David Quispe's resume.
nav: true
---

<header class="page-heading"><h1 data-pretext="lines">{{ 'navigation.resume' | ui_label }}</h1><p class="lead">{{ 'profile.resume_focus' | ui_label }}</p><div class="project-actions resume-actions"><a class="button" href="{{ '/assets/pdf/en-us/cv.pdf' | relative_url }}">{{ 'labels.open_pdf' | ui_label }} ↗</a><a class="text-link" href="{{ '/assets/pdf/en-us/cv.pdf' | relative_url }}" download>{{ 'labels.download_pdf' | ui_label }} ↓</a></div></header>
{% assign cv_preview = site.data.resume_preview %}
{% if cv_preview.pages.size > 0 %}
<section class="resume-preview" data-resume-preview data-source-sha256="{{ cv_preview.source.sha256 }}" aria-label="{{ 'resume.preview' | ui_label: 'CV preview' }}">
  <details class="resume-transcript">
    <summary>{{ 'resume.read_text' | ui_label: 'Read CV as text' }}</summary>
    <div class="resume-text-pages">
      {% for cv_page in cv_preview.pages %}
        <section class="resume-text-page" aria-labelledby="resume-text-page-{{ cv_page.number }}">
          <h2 id="resume-text-page-{{ cv_page.number }}">{{ 'resume.page' | ui_label: 'Page' }} {{ cv_page.number }} {{ 'resume.of' | ui_label: 'of' }} {{ cv_preview.page_count }}</h2>
          <pre class="resume-text-content" data-resume-text>{{ cv_page.text | escape }}</pre>
        </section>
      {% endfor %}
    </div>
  </details>
  <div class="resume-preview-pages">
    {% for cv_page in cv_preview.pages %}
      {% capture page_label %}{{ 'resume.page' | ui_label: 'Page' }} {{ cv_page.number }} {{ 'resume.of' | ui_label: 'of' }} {{ cv_preview.page_count }}{% endcapture %}
      {% capture cv_srcset %}{% for variant in cv_page.variants %}{{ variant.src | relative_url }} {{ variant.width }}w{% unless forloop.last %}, {% endunless %}{% endfor %}{% endcapture %}
      <figure class="resume-preview-page">
        <a href="{{ cv_page.image.src | relative_url }}" data-lightbox data-lightbox-group="resume-preview" data-lightbox-caption="{{ page_label | strip | escape }}" aria-label="{{ 'resume.open_page' | ui_label: 'Open CV image' }}: {{ page_label | strip | escape }}">
          <img class="resume-preview-image" src="{{ cv_page.variants.first.src | relative_url }}" srcset="{{ cv_srcset | strip }}" sizes="(min-width: 1000px) 800px, 90vw" width="{{ cv_page.image.width }}" height="{{ cv_page.image.height }}" alt="{{ 'navigation.cv' | ui_label: 'CV' }}: {{ page_label | strip | escape }}" decoding="async" {% if forloop.first %}loading="eager" fetchpriority="high"{% else %}loading="lazy"{% endif %}>
        </a>
        <figcaption>{{ page_label | strip }}</figcaption>
      </figure>
    {% endfor %}
  </div>

</section>
{% endif %}
