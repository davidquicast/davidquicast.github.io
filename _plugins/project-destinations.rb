# frozen_string_literal: true

require 'uri'

module Portfolio
  module ProjectDestinations
    module_function

    def destination(value)
      return nil unless value.is_a?(String)
      uri = URI.parse(value.strip)
      return nil unless %w[https http].include?(uri.scheme) && uri.host && !uri.userinfo
      return nil unless uri.port == (uri.scheme == 'https' ? 443 : 80)
      host = uri.host.downcase.sub(/\Awww\./, '')
      icon, label = case host
                    when 'github.com' then ['github', 'GitHub']
                    when 'huggingface.co' then ['huggingface', 'Hugging Face']
                    else return nil
                    end
      path = uri.path.sub(%r{/+\z}, '')
      return nil if path.empty? || path == '/'
      parts = path.split('/').reject(&:empty?)
      resource = if icon == 'github'
                   if parts.length >= 2 && !%w[orgs users topics collections features settings login signup].include?(parts.first)
                     'Repository'
                   elsif parts.length == 1 && !%w[orgs users topics collections features settings login signup].include?(parts.first)
                     'Profile'
                   end
                 elsif parts.first == 'spaces' && parts.length >= 3
                   'Space'
                 elsif parts.first == 'datasets' && parts.length >= 3
                   'Dataset'
                 elsif parts.first == 'papers' && parts.length == 2
                   'Publication'
                 elsif parts.length == 2 && !%w[docs blog organizations collections spaces datasets models papers api settings login join posts pricing brand].include?(parts.first)
                   'Model'
                 elsif parts.length == 1 && !%w[docs blog organizations collections spaces datasets models papers api settings login join posts pricing brand].include?(parts.first)
                   'Profile'
                 end
      { 'icon' => icon, 'label' => label, 'detail_label' => resource ? label + ' ' + resource.downcase : label,
        'detail_key' => 'destinations.' + icon + (resource ? '_' + resource.downcase : ''),
        'url' => value.strip, 'dedup_key' => host + path }
    rescue URI::InvalidURIError
      nil
    end

    def build(data, fields: %w[github huggingface redirect])
      return [] unless data.is_a?(Hash)
      urls = fields.flat_map { |key| Array(data[key]) }
      Array(data['project_items']).each do |item|
        urls << item['url'] if item.is_a?(Hash)
      end
      seen = {}
      urls.filter_map do |url|
        record = destination(url)
        next unless record
        key = record.delete('dedup_key')
        next if seen[key]
        seen[key] = true
        record
      end
    end
  end

  class ProjectDestinationsGenerator < Jekyll::Generator
    safe true
    priority :normal

    def generate(site)
      collection = site.collections['projects']
      collection&.docs&.each do |project|
        project.data['destinations'] = ProjectDestinations.build(project.data)
      end
      # ResearchGenerator runs first. These are the same normalized hashes held
      # by generated publication pages and consumed later by ProfileFeedGenerator.
      Array(site.data.dig('research', 'entries') || site.data.dig('research', 'publications')).each do |paper|
        paper['destinations'] = ProjectDestinations.build(paper, fields: %w[code dataset url])
        paper['destination_fields'] = %w[code dataset url].select { |field| ProjectDestinations.destination(paper[field]) }
      end
    end
  end
end
