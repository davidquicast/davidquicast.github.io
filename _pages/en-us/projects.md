---
page_id: projects
layout: page
title: projects
permalink: /projects/
description:
hide_header: true
nav: true
nav_order: 3
enable_project_categories: false
horizontal: false
---

<!-- pages/projects.md -->
<div class="projects">
<div class="project-filter" aria-label="Project filters">
  <div class="project-filter-topbar">
    <label class="project-search">
      <i class="fa-solid fa-magnifying-glass fa-sm" aria-hidden="true"></i>
      <input id="project-search" type="search" placeholder="Search projects" autocomplete="off">
    </label>
    <div class="project-filter-segment" aria-label="Filter by type">
      <button type="button" class="project-filter-pill active" data-filter-type="all" data-filter-value="all">All</button>
      <span id="project-category-filters"></span>
    </div>
  </div>
  <div id="project-tag-filters" class="project-topic-row" aria-label="Filter by topic"></div>
</div>

{% if site.enable_project_categories and page.display_categories %}
  <!-- Display categorized projects -->
  {% for category in page.display_categories %}
    <a id="{{ site.data[site.active_lang].strings.categories[category] }}" href=".#{{ site.data[site.active_lang].strings.categories[category] }}">
      <h2 class="category">{{ site.data[site.active_lang].strings.categories[category] }}</h2>
    </a>
    {% assign categorized_projects = site.projects | where: "category", category %}
    {% assign sorted_projects = categorized_projects | sort: "importance" %}
    <!-- Generate cards for each project -->
    <div class="row row-cols-1 project-list">
        {% for project in sorted_projects %}
          {% include projects.liquid %}
        {% endfor %}
      </div>
  {% endfor %}

{% else %}
  <!-- Display projects without categories -->
  {% assign sorted_projects = site.projects | sort: "year" | reverse %}
  <div class="row row-cols-1 project-list">
    {% for project in sorted_projects %}
      {% include projects.liquid %}
    {% endfor %}
  </div>
{% endif %}
</div>

<script>
  document.addEventListener("DOMContentLoaded", function () {
    const projects = Array.from(document.querySelectorAll(".project-entry-col"));
    const categoryBox = document.getElementById("project-category-filters");
    const tagBox = document.getElementById("project-tag-filters");
    const searchInput = document.getElementById("project-search");
    let activeType = "all";
    let activeValue = "all";
    let query = "";

    function makeButton(label, type, value) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = type === "tag" ? "project-filter-pill topic-pill" : "project-filter-pill";
      button.dataset.filterType = type;
      button.dataset.filterValue = value;
      button.textContent = label.replace("-", " ");
      button.addEventListener("click", () => {
        activeType = type;
        activeValue = value;
        document.querySelectorAll(".project-filter-pill").forEach((pill) => pill.classList.remove("active"));
        button.classList.add("active");
        applyFilters();
      });
      return button;
    }

    const categories = [...new Set(projects.map((item) => item.dataset.projectCategory).filter(Boolean))].sort();
    const tags = [...new Set(projects.flatMap((item) => (item.dataset.projectTags || "").split(" ").filter(Boolean)))].sort();

    categories.forEach((category) => categoryBox.appendChild(makeButton(category, "category", category)));
    tags.forEach((tag) => tagBox.appendChild(makeButton("#" + tag, "tag", tag)));

    function applyFilters() {
      projects.forEach((item) => {
        const matchesFilter =
          activeType === "all" ||
          (activeType === "category" && item.dataset.projectCategory === activeValue) ||
          (activeType === "tag" && (item.dataset.projectTags || "").split(" ").includes(activeValue));
        const searchable = `${item.dataset.projectTitle || ""} ${item.dataset.projectDescription || ""} ${item.dataset.projectTags || ""}`;
        const matchesSearch = !query || searchable.includes(query);
        item.hidden = !(matchesFilter && matchesSearch);
      });
      document.querySelectorAll(".project-list").forEach((list) => {
        const hasVisible = Array.from(list.querySelectorAll(".project-entry-col")).some((item) => !item.hidden);
        const heading = list.previousElementSibling;
        list.hidden = !hasVisible;
        if (heading && heading.tagName.toLowerCase() === "a") {
          heading.hidden = !hasVisible;
        }
      });
    }

    document.querySelector('[data-filter-type="all"]').addEventListener("click", () => {
      activeType = "all";
      activeValue = "all";
      document.querySelectorAll(".project-filter-pill").forEach((pill) => pill.classList.remove("active"));
      document.querySelector('[data-filter-type="all"]').classList.add("active");
      applyFilters();
    });

    searchInput.addEventListener("input", () => {
      query = searchInput.value.trim().toLowerCase();
      applyFilters();
    });
  });
</script>
