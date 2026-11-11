# frozen_string_literal: true
require 'date'
require 'time'
require 'uri'

module Portfolio
  module ContentDates
    module_function

    # Sorting uses a lower bound, but machine/visible dates retain their precision.
    def point(value)
      return point(value['value']) if value.is_a?(Hash)
      return nil if value.nil? || value.to_s.strip.empty?
      raw = value.respond_to?(:iso8601) ? value.iso8601 : value.to_s.strip
      if raw.match?(/\A\d{4}\z/)
        year = Integer(raw)
        raise ArgumentError, 'content year is out of range' unless year.between?(1600, 9999)
        return { 'value' => raw, 'display' => raw, 'precision' => 'year', 'timestamp' => Time.utc(year, 1, 1).to_i * 1000 }
      end
      if raw.match?(/\A\d{4}-\d{2}\z/)
        day = Date.iso8601(raw + '-01')
        return { 'value' => raw, 'display' => raw + '-01', 'precision' => 'month', 'timestamp' => Time.utc(day.year, day.month, 1).to_i * 1000 }
      end
      if raw.match?(/\A\d{4}-\d{2}-\d{2}\z/)
        day = Date.iso8601(raw)
        return { 'value' => raw, 'display' => raw, 'precision' => 'day', 'timestamp' => Time.utc(day.year, day.month, day.day).to_i * 1000 }
      end
      if raw.match?(/\A\d{4}-\d{2}-\d{2}T/)
        time = Time.iso8601(raw)
        return { 'value' => raw, 'display' => Date.iso8601(raw[0, 10]).iso8601, 'precision' => 'day', 'timestamp' => time.to_i * 1000 }
      end
      raise ArgumentError, 'content dates must be ISO year, month, day or timestamp'
    end

    def public_link(value)
      uri = URI.parse(value.to_s)
      return '' unless uri.scheme == 'https' && %w[github.com api.github.com huggingface.co arxiv.org aclanthology.org].include?(uri.host) && !uri.userinfo && uri.port == 443
      return '' if value.to_s.match?(/[\x00-\x20\x7f]/)
      value.to_s
    rescue URI::InvalidURIError
      ''
    end

    def resources(snapshot)
      Array(snapshot['resources']).filter_map do |source|
        next unless source.is_a?(Hash) && %w[github hf_model hf_dataset hf_space].include?(source['kind'])
        url = public_link(source['url'])
        next if url.empty?
        { 'kind' => source['kind'], 'url' => url, 'source_url' => public_link(source['source_url']),
          'name' => URI.parse(url).path.delete_prefix('/'),
          'created' => point(source['created_at']), 'updated' => point(source['updated_at']),
          'checked' => point(source['checked_at']), 'commit_url' => public_link(source['commit_url']),
          'archived' => source['archived'] == true, 'status' => source['status'].to_s }
      rescue ArgumentError
        nil
      end
    end

    def project(data, snapshot = {}, owner: '')
      snapshot = {} unless snapshot.is_a?(Hash)
      origin = point([data['published_at'], data['started_at'], data['year']].find { |value| !value.to_s.empty? })
      items = resources(snapshot)
      repository_update = items.filter_map { |item| item['updated'] }.max_by { |date| date['timestamp'] }
      contributions = Array(snapshot['contributions']).filter_map do |source|
        next unless source.is_a?(Hash) && !owner.to_s.empty? && source['author'].to_s.downcase == owner.to_s.downcase && source['status'] == 'merged'
        url = public_link(source['url'])
        next unless url.match?(%r{\Ahttps://github\.com/[^/]+/[^/]+/pull/[1-9]\d*\z})
        next unless items.any? { |item| item['kind'] == 'github' && url.start_with?(item['url'] + '/pull/') }
        merged = point(source['merged_at'])
        next unless merged && merged['precision'] == 'day'
        { 'url' => url, 'merged' => merged, 'checked' => point(source['checked_at']) }
      rescue ArgumentError
        nil
      end.sort_by { |item| item['merged']['timestamp'] }
      collaboration = data['category'] == 'collaborations'
      first = collaboration && !contributions.empty? ? contributions.first['merged'] : origin
      own_update = collaboration ? contributions.last&.fetch('merged') : repository_update
      # Upstream changes never make an old personal contribution look recent.
      activity = own_update || first
      display_update = own_update
      display_label = collaboration && own_update ? 'dates.latest_contribution' : 'dates.repository_updated'
      { 'primary' => first, 'origin' => origin, 'primary_label' => collaboration && !contributions.empty? ? 'dates.contribution' : 'dates.project_year',
        'updated' => display_update, 'updated_label' => display_label, 'activity' => activity,
        'resources' => items, 'contributions' => contributions }
    end

    def paper(data)
      primary = point([data['published_at'], data['year']].find { |value| !value.to_s.empty? })
      revised = point(data['last_revised_at'])
      if primary && revised && revised['timestamp'] < primary['timestamp']
        raise ArgumentError, 'paper revision cannot precede its publication'
      end
      { 'primary' => primary, 'primary_label' => 'dates.published', 'updated' => revised,
        'updated_label' => 'dates.revised', 'activity' => revised || primary }
    end

    def article(data, date = nil)
      primary = point(date || data['date'])
      updated = point(data['last_updated'])
      { 'primary' => primary, 'primary_label' => 'dates.published', 'updated' => updated,
        'updated_label' => 'dates.updated', 'activity' => updated || primary }
    end
  end

  module ContentDateFilters
    def content_date(value)
      ContentDates.point(value)
    end

    def precise_date(value)
      date = value.is_a?(Hash) ? value : ContentDates.point(value)
      return '' unless date
      return date['display'] if date['precision'] == 'year'
      localized_date(date['display'], date['precision'] == 'month' ? 'month_year' : 'long')
    end

    def content_timeline(value, kind = 'project')
      data = value.respond_to?(:data) ? value.data : value
      return {} unless data.respond_to?(:[])
      return data['timeline'] if data['timeline']
      site = @context.registers[:site]
      case kind
      when 'paper', 'talk' then ContentDates.paper(data)
      when 'writing' then ContentDates.article(data, data['date'])
      else ContentDates.project(data, site.data.dig('project_activity', 'projects', data['page_id']) || {}, owner: site.data.dig('socials', 'github_username'))
      end
    end
  end

  class ContentDateGenerator < Jekyll::Generator
    safe true
    priority :low
    def generate(site)
      site.collections['projects']&.docs&.each do |project|
        project.data['timeline'] = ContentDates.project(project.data,
          site.data.dig('project_activity', 'projects', project.data['page_id']) || {}, owner: site.data.dig('socials', 'github_username'))
      end
      site.posts.docs.each { |post| post.data['timeline'] = ContentDates.article(post.data, post.date) }
      Array(site.data.dig('research', 'entries')).each { |paper| paper['timeline'] = ContentDates.paper(paper) }
      Array(site.data['talks_catalog']).each { |talk| talk['timeline'] = ContentDates.paper(talk) }
    rescue ArgumentError => error
      raise Jekyll::Errors::FatalException, "Content dates: #{error.message}"
    end
  end
end
Liquid::Template.register_filter(Portfolio::ContentDateFilters)
