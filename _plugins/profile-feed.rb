# frozen_string_literal: true

require 'date'
require 'time'

module Portfolio
  module ProfileFeed
    module_function

    # Do not turn a year-only project record into a fabricated publication date.
    def timestamp(source, kind)
      data = source.respond_to?(:data) ? source.data : source
      if data.dig('timeline', 'primary')
        point = data['timeline']['primary']
        return [point['timestamp'], point['precision']]
      end
      if kind == 'writing'
        date = source.respond_to?(:date) ? source.date : data['date']
        return [date.to_time.to_i * 1000, 'day']
      end
      unless data['published_at'].to_s.empty?
        date = data['published_at']
        iso_date = date.respond_to?(:iso8601) ? date.iso8601 : date.to_s
        if iso_date.match?(/\A\d{4}-\d{2}\z/)
          date = Date.iso8601(iso_date + '-01')
          return [Time.utc(date.year, date.month, 1).to_i * 1000, 'month']
        elsif iso_date.match?(/\A\d{4}-\d{2}-\d{2}\z/)
          date = Date.iso8601(iso_date)
          return [Time.utc(date.year, date.month, date.day).to_i * 1000, 'day']
        end
        return [Time.iso8601(iso_date).to_i * 1000, 'day']
      end
      year = Integer(data['year'].to_s, exception: false)
      [year && year.between?(1600, 9999) ? Time.utc(year, 1, 1).to_i * 1000 : 0, 'year']
    rescue ArgumentError
      raise ArgumentError, 'profile feed published_at must be an ISO 8601 timestamp'
    end

    def slug(project)
      project.data['slug'] || File.basename(project.relative_path, File.extname(project.relative_path))
    end

    # Ownership is authored metadata, never inferred from a repository URL.
    # Unknown categories remain visible in the complete catalog without
    # presenting an unsupported ownership claim.
    def project_type(category)
      { 'personal' => 'independent', 'collaborations' => 'contributions' }.fetch(category.to_s.strip.downcase, '')
    end

    def entry(source, kind, featured)
      data = source.respond_to?(:data) ? source.data : source
      stamp, precision = timestamp(source, kind)
      id = source.respond_to?(:url) ? source.url : data['id']
      ownership = kind == 'project' ? project_type(data['category']) : ''
      { 'id' => kind + ':' + id.to_s, 'kind' => kind, 'source' => source,
        'date' => stamp, 'precision' => precision,
        'activity' => data.dig('timeline', 'activity', 'timestamp') || stamp, 'featured' => featured, 'project_type' => ownership,
        'search' => [data['title'], data['description'], data['abstract'], data['tags'], data['venue'], data['authors'], data['summary'], data['relationship_note'], data['relationship'], data['category'], ownership].flatten.compact.join(' ') }
    end

    def prepare(projects:, posts:, papers:, talks: [], config:, latest_limit:, selected_papers: true)
      selected = Array(config['featured_projects'])
      spotlight = Array(config['spotlight_projects'])
      spotlight_items = spotlight.filter_map { |id| projects.find { |project| slug(project) == id } }.uniq { |project| project.url }
      spotlight_search = spotlight_items.flat_map { |project| [project.data['title'], project.data['description']] }.compact.join(' ')
      spotlight_date = spotlight_items.map { |project| timestamp(project, 'project').first }.max || 0
      project_records = projects.sort_by do |project|
        spotlight_index = spotlight.index(slug(project))
        selected_index = selected.index(slug(project))
        group = !spotlight_index.nil? ? 0 : !selected_index.nil? ? 1 : 2
        index = spotlight_index || selected_index || project.data['importance'].to_i
        [group, index, project.data['importance'].to_i, project.url]
      end.map do |project|
        entry(project, 'project', selected.include?(slug(project)) || spotlight.include?(slug(project)))
      end
      latest = posts.sort_by { |post| [-post.date.to_time.to_i, post.url] }
      post_records = latest.each_with_index.map { |post, index| entry(post, 'writing', index < latest_limit || post.data['featured'] == true) }
      paper_order = Array(config['featured_papers'])
      paper_records = papers.sort_by.with_index do |paper, index|
        [paper_order.index(paper['id']) || paper_order.length, index]
      end.map { |paper| entry(paper, 'paper', selected_papers == true && paper['selected'] == true) }
      talk_records = Array(talks).map { |talk| entry(talk, 'talk', talk['featured'] == true) }
      # All keeps current work first and writing chronological. Featured filters
      # those same records rather than altering the complete catalog's order.
      # Round-robin keeps content types distinguishable without visitor tracking.
      selected_paper_records = paper_records.sort_by.with_index { |record, index| [record['featured'] ? 0 : 1, index] }
      groups = [selected_paper_records, project_records.dup, post_records.dup, talk_records.dup]
      ordered = []
      until groups.all?(&:empty?)
        groups.each { |group| ordered << group.shift unless group.empty? }
      end
      ordered = ordered.each_with_index.sort_by { |record, index| [record['featured'] ? 0 : 1, index] }.map(&:first)
      ordered.each_with_index { |record, index| record['rank'] = index }
      { 'items' => ordered, 'counts' => { 'all' => ordered.size, 'projects' => project_records.size,
        'writing' => post_records.size, 'papers' => paper_records.size, 'talks' => talk_records.size,
        'coauthored_papers' => paper_records.count { |record| record['source']['relationship'] != 'cited_work' },
        'cited_work' => paper_records.count { |record| record['source']['relationship'] == 'cited_work' },
        'independent' => project_records.count { |record| record['project_type'] == 'independent' },
        'contributions' => project_records.count { |record| record['project_type'] == 'contributions' },
        'unclassified_projects' => project_records.count { |record| record['project_type'].empty? },
        'featured' => ordered.count { |record| record['featured'] } },
        'spotlight' => !spotlight_items.empty?, 'spotlight_items' => spotlight_items,
        'spotlight_search' => spotlight_search, 'spotlight_date' => spotlight_date }
    end
  end

  module ProfileFeedFilters
    def profile_project_type(category)
      ProfileFeed.project_type(category)
    end
  end

  class ProfileFeedGenerator < Jekyll::Generator
    safe true
    priority :lowest
    def generate(site)
      home = site.pages.find { |page| page.data['layout'] == 'about' && page.url == '/' }
      return unless home
      latest = site.config['latest_posts'] || {}
      posts = home.data['latest_posts'] && latest['enabled'] != false ? site.posts.docs.reject { |post| post.data['published'] == false } : []
      limit = latest.fetch('limit', posts.size).to_i
      limit = posts.size if limit.negative?
      projects = site.collections.fetch('projects').docs.reject { |project| project.data['published'] == false }
      site.data['profile_catalog'] = ProfileFeed.prepare(projects: projects, posts: posts,
        papers: site.data.dig('research', 'entries') || site.data.dig('research', 'publications') || [],
        talks: site.data['talks_catalog'] || [],
        config: site.data['profile_feed'] || {}, latest_limit: limit,
        selected_papers: home.data['selected_papers'])
    end
  end
end

Liquid::Template.register_filter(Portfolio::ProfileFeedFilters)
