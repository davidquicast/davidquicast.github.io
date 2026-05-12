---
page_id: blog
layout: default
permalink: /blog/
title: blog
# blog_name: al-folio in english
# description: a simple whitespace theme for academics
# blog_name: davidquicast Blog
# description: Technical tutorials, system administration, and development insights
nav: true # habilitado para mostrar posts de Medium
nav_order: 1
pagination:
  enabled: true
  collection: posts
  permalink: /page/:num/
  per_page: 20
  sort_field: date
  sort_reverse: true
  trail:
    before: 1 # The number of links before the current page
    after: 3 # The number of links after the current page
---

<div class="post">

{% assign blog_name_size = page.blog_name | size %}
{% assign blog_description_size = page.description | size %}

{% if blog_name_size > 0 or blog_description_size > 0 %}

  <div class="header-bar">
    <h1>{{ page.blog_name }}</h1>
    <h2>{{ page.description }}</h2>
  </div>
  {% endif %}

{% if site.display_tags and site.display_tags.size > 0 %}

  <div class="blog-filter" aria-label="Blog filters">
    <div class="blog-filter-topbar">
      <label class="blog-search">
        <i class="fa-solid fa-magnifying-glass fa-sm" aria-hidden="true"></i>
        <input id="blog-search" type="search" placeholder="Search notes" autocomplete="off">
      </label>
      <div class="blog-filter-segment" aria-label="Filter by date">
        <button type="button" class="blog-filter-pill blog-date-pill active" data-blog-year="all">Any date</button>
        {% assign blog_years = site.posts | map: "date" | compact %}
        {% assign previous_year = "" %}
        {% for post in site.posts %}
          {% assign post_year = post.date | date: "%Y" %}
          {% unless post_year == previous_year %}
            <button type="button" class="blog-filter-pill blog-date-pill" data-blog-year="{{ post_year }}">{{ post_year }}</button>
          {% endunless %}
          {% assign previous_year = post_year %}
        {% endfor %}
      </div>
    </div>
    <div class="blog-topic-row" aria-label="Filter by tag">
      <button type="button" class="blog-filter-pill blog-tag-pill active" data-blog-tag="all">All</button>
      {% for tag in site.display_tags %}
        <button type="button" class="blog-filter-pill blog-tag-pill" data-blog-tag="{{ tag | downcase }}">{{ tag }}</button>
      {% endfor %}
    </div>
  </div>
  {% endif %}

{% assign featured_posts = site.posts | where: "featured", "true" %}
{% if featured_posts.size > 0 %}
<br>

<div class="featured-posts">
{% assign post = featured_posts | first %}
<a href="{{ post.url | relative_url }}" class="featured-post">
<span class="featured-pin"><i class="fa-solid fa-thumbtack fa-xs"></i> pinned</span>
<span class="featured-title">{{ post.title }}</span>
<span class="featured-desc">{{ post.description }}</span>

                    {% if post.external_source == blank %}
                      {% assign read_time = post.content | number_of_words | divided_by: 180 | plus: 1 %}
                    {% else %}
                      {% assign read_time = post.feed_content | strip_html | number_of_words | divided_by: 180 | plus: 1 %}
                    {% endif %}
                    {% assign year = post.date | date: "%Y" %}

                    <span class="post-meta">
                      {{ read_time }} min read &nbsp; &middot; &nbsp;
                      <i class="fa-solid fa-calendar fa-sm"></i> {{ year }}
                    </span>
</a>
</div>

{% endif %}

  <ul class="post-list">

    {% if page.pagination.enabled %}
      {% assign postlist = paginator.posts %}
    {% else %}
      {% assign postlist = site.posts %}
    {% endif %}

    {% for post in postlist %}

    {% if post.external_source == blank %}
      {% assign read_time = post.content | number_of_words | divided_by: 180 | plus: 1 %}
    {% else %}
      {% assign read_time = post.feed_content | strip_html | number_of_words | divided_by: 180 | plus: 1 %}
    {% endif %}
    {% assign year = post.date | date: "%Y" %}
    {% assign tags = post.tags | join: "" %}
    {% assign categories = post.categories | join: "" %}

    <li class="blog-post-item" data-blog-title="{{ post.title | downcase }}" data-blog-description="{{ post.description | downcase }}" data-blog-tags="{{ post.tags | join: ' ' | downcase }}" data-blog-year="{{ year }}">

{% if post.thumbnail %}

<div class="row">
          <div class="col-sm-9">
{% endif %}
        <h3>
        {% if post.redirect == blank %}
          <a class="post-title" href="{{ post.url | relative_url }}">{{ post.title }}</a>
        {% elsif post.redirect contains '://' %}
          <a class="post-title" href="{{ post.redirect }}" target="_blank">{{ post.title }}</a>
          <svg width="2rem" height="2rem" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 13.5v6H5v-12h6m3-3h6v6m0-6-9 9" class="icon_svg-stroke" stroke="#999" stroke-width="1.5" fill="none" fill-rule="evenodd" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        {% else %}
          <a class="post-title" href="{{ post.redirect | relative_url }}">{{ post.title }}</a>
        {% endif %}
      </h3>
      <p>{{ post.description }}</p>
      <p class="post-meta">
        {{ read_time }} min read &nbsp; &middot; &nbsp;
        {% include date_format.liquid format="long" date=post.date %}
        {% if post.external_source %}
        &nbsp; &middot; &nbsp; {{ post.external_source }}
        {% endif %}
      </p>
      <p class="post-tags">
        <a href="{{ year | prepend: '/blog/' | prepend: site.baseurl}}">
          <i class="fa-solid fa-calendar fa-sm"></i> {{ year }}
        </a>
        {% if tags != "" %}
          &nbsp; &middot; &nbsp;
          {% for tag in post.tags limit:2 %}
            <a href="{{ tag | slugify | prepend: '/blog/tag/' | prepend: site.baseurl}}"><i class="fa-solid fa-hashtag fa-sm"></i>{{ tag }}</a>{% unless forloop.last %}&nbsp;{% endunless %}
          {% endfor %}
          {% if post.tags.size > 2 %}&nbsp;<span class="post-tags-more">+{{ post.tags.size | minus: 2 }}</span>{% endif %}
        {% endif %}
      </p>

{% if post.thumbnail %}

</div>

  <div class="col-sm-3">
    <img class="card-img" src="{{ post.thumbnail | relative_url }}" style="object-fit: cover; height: 90%" alt="image">
  </div>
</div>
{% endif %}
    </li>

    {% endfor %}

  </ul>

{% if page.pagination.enabled %}
{% include pagination.liquid %}
{% endif %}

</div>

<script>
  document.addEventListener("DOMContentLoaded", function () {
    const posts = Array.from(document.querySelectorAll(".blog-post-item"));
    const searchInput = document.getElementById("blog-search");
    const tagButtons = Array.from(document.querySelectorAll(".blog-tag-pill"));
    const yearButtons = Array.from(document.querySelectorAll(".blog-date-pill"));
    let activeTag = "all";
    let activeYear = "all";
    let query = "";

    function applyBlogFilters() {
      posts.forEach((post) => {
        const tags = (post.dataset.blogTags || "").split(" ");
        const searchable = `${post.dataset.blogTitle || ""} ${post.dataset.blogDescription || ""} ${post.dataset.blogTags || ""}`;
        const matchesTag = activeTag === "all" || tags.includes(activeTag);
        const matchesYear = activeYear === "all" || post.dataset.blogYear === activeYear;
        const matchesSearch = !query || searchable.includes(query);
        post.hidden = !(matchesTag && matchesYear && matchesSearch);
      });
    }

    tagButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeTag = button.dataset.blogTag;
        tagButtons.forEach((pill) => pill.classList.remove("active"));
        button.classList.add("active");
        applyBlogFilters();
      });
    });

    yearButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activeYear = button.dataset.blogYear;
        yearButtons.forEach((pill) => pill.classList.remove("active"));
        button.classList.add("active");
        applyBlogFilters();
      });
    });

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        query = searchInput.value.trim().toLowerCase();
        applyBlogFilters();
      });
    }
  });
</script>
