---
page_id: resume-es
layout: default
title: Currículum
permalink: /es/resume/
description: Currículum Vitae de David Quispe.
nav: false
---

<header class="page-heading">
  <div class="resume-heading-row">
    <div>
      <h1 data-pretext="lines">Currículum</h1>
      <p class="lead">Ingeniería de Sistemas, Ciberseguridad e Inteligencia Artificial.</p>
    </div>
    <nav class="resume-lang-switch" aria-label="Idioma del currículum / Resume language">
      <a class="lang-opt" href="{{ '/resume/' | relative_url }}" hreflang="en" lang="en">EN</a>
      <span class="lang-divider" aria-hidden="true">/</span>
      <span class="lang-opt active" aria-current="page">ES</span>
    </nav>
  </div>
  <div class="project-actions resume-actions">
    <a class="button" href="{{ '/assets/pdf/es/cv.pdf' | relative_url }}">Abrir PDF ↗</a>
    <a class="text-link" href="{{ '/assets/pdf/es/cv.pdf' | relative_url }}" download>Descargar PDF ↓</a>
  </div>
</header>
{% assign cv_preview = site.data.resume_preview_es %}
{% if cv_preview.pages.size > 0 %}
<section class="resume-preview" data-resume-preview data-source-sha256="{{ cv_preview.source.sha256 }}" aria-label="Vista previa del currículum">
  <details class="resume-transcript">
    <summary>Leer CV en texto plano</summary>
    <div class="resume-text-pages">
      {% for cv_page in cv_preview.pages %}
        <section class="resume-text-page" aria-labelledby="resume-text-page-{{ cv_page.number }}">
          <h2 id="resume-text-page-{{ cv_page.number }}">Página {{ cv_page.number }} de {{ cv_preview.page_count }}</h2>
          <pre class="resume-text-content" data-resume-text>{{ cv_page.text | escape }}</pre>
        </section>
      {% endfor %}
    </div>
  </details>
  <div class="resume-preview-pages">
    {% for cv_page in cv_preview.pages %}
      {% capture page_label %}Página {{ cv_page.number }} de {{ cv_preview.page_count }}{% endcapture %}
      {% capture cv_srcset %}{% for variant in cv_page.variants %}{{ variant.src | relative_url }} {{ variant.width }}w{% unless forloop.last %}, {% endunless %}{% endfor %}{% endcapture %}
      <figure class="resume-preview-page">
        <a href="{{ cv_page.image.src | relative_url }}" data-lightbox data-lightbox-group="resume-preview" data-lightbox-caption="{{ page_label | strip | escape }}" aria-label="Abrir imagen del CV: {{ page_label | strip | escape }}">
          <img class="resume-preview-image" src="{{ cv_page.variants.first.src | relative_url }}" srcset="{{ cv_srcset | strip }}" sizes="(min-width: 1000px) 800px, 90vw" width="{{ cv_page.image.width }}" height="{{ cv_page.image.height }}" alt="Currículum: {{ page_label | strip | escape }}" decoding="async" {% if forloop.first %}loading="eager" fetchpriority="high"{% else %}loading="lazy"{% endif %}>
        </a>
        <figcaption>{{ page_label | strip }}</figcaption>
      </figure>
    {% endfor %}
  </div>

</section>
{% endif %}
