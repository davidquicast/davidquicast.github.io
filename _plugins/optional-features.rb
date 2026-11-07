# frozen_string_literal: true

require 'uri'
require 'time'
require 'nokogiri'

module Portfolio
  module OptionalFeatureFilters
    FEATURE_LIBRARIES = {
      'math' => %w[mathjax], 'mermaid' => %w[mermaid],
      'chartjs' => %w[chartjs], 'echarts' => %w[echarts],
      'vega' => %w[vega vega-lite vega-embed], 'map' => %w[leaflet],
      'diff' => %w[diff2html], 'pseudocode' => %w[pseudocode],
      'comparison' => %w[img-comparison-slider], 'slider' => %w[swiper],
      'table' => %w[jquery bootstrap-table], 'media_overlay' => %w[venobox],
      'masonry' => %w[masonry imagesloaded]
    }.freeze

    def newsletter_endpoint(value)
      text = value.to_s.strip
      return '' if text.empty?
      text = 'https://app.loops.so/api/newsletter-form/' + text if text.match?(/\A[A-Za-z0-9_-]+\z/)
      uri = URI.parse(text)
      return '' unless uri.scheme == 'https' && uri.host == 'app.loops.so' && uri.path.start_with?('/api/newsletter-form/') && !uri.userinfo
      text
    rescue URI::InvalidURIError
      ''
    end

    def structured_data(page, title = nil)
      site = @context.registers[:site]
      origin = site.config['url'].to_s.sub(%r{/$}, '')
      base = site.config['baseurl'].to_s.sub(%r{/$}, '')
      home = origin + base + '/'
      route = locale_url(page['url'] || '/', active_locale)
      canonical = origin + route
      name = [site.config['first_name'], site.config['middle_name'], site.config['last_name']].compact.reject(&:empty?).join(' ')
      person = { '@type' => 'Person', '@id' => home + '#person', 'name' => name, 'url' => home }
      profiles = Array(site.data['profile_links']).select { |link| link['external'] == true }.map { |link| link['url'] }
      person['sameAs'] = profiles unless profiles.empty?
      website = { '@type' => 'WebSite', '@id' => home + '#website', 'url' => home, 'name' => site.config['title'].to_s,
                  'author' => { '@id' => person['@id'] } }
      kind = page['layout'] == 'post' ? 'BlogPosting' : (page['layout'] == 'publications' ? 'CollectionPage' : 'WebPage')
      document = { '@type' => kind, '@id' => canonical + '#webpage', 'url' => canonical,
                   'name' => title.to_s.empty? ? (page['title'] || name) : title,
                   'inLanguage' => locale_tag(content_locale(page)),
                   'isPartOf' => { '@id' => website['@id'] }, 'author' => { '@id' => person['@id'] } }
      description = page['description'].to_s
      document['description'] = Nokogiri::HTML.fragment(description).text unless description.empty?
      if kind == 'BlogPosting'
        document['headline'] = page['title']
        document['datePublished'] = page['date'].respond_to?(:iso8601) ? page['date'].iso8601 : page['date'].to_s unless page['date'].nil?
        document['dateModified'] = page['last_updated'].to_s unless page['last_updated'].nil?
      end
      graph = [person, website, document]
      if page['layout'] == 'paper' && page['paper'].is_a?(Hash)
        paper = page['paper']
        publication = { '@type' => 'ScholarlyArticle', '@id' => canonical + '#publication',
          'name' => paper['title'], 'url' => paper['url'],
          'author' => Array(paper['authors']).map { |author| { '@type' => 'Person', 'name' => author } } }
        publication['identifier'] = paper['doi'] unless paper['doi'].to_s.empty?
        publication['description'] = paper['summary'] unless paper['summary'].to_s.empty?
        publication['datePublished'] = paper['published_at'] if paper['date_precision'] == 'day'
        publication['dateModified'] = paper['last_revised_at'] unless paper['last_revised_at'].to_s.empty?
        document['mainEntity'] = { '@id' => publication['@id'] }
        graph << publication
      end
      { '@context' => 'https://schema.org', '@graph' => graph }
    end

    def optional_features(page)
      site = @context.registers[:site]
      chart = page['chart'].is_a?(Hash) ? page['chart'] : {}
      images = page['images'].is_a?(Hash) ? page['images'] : {}
      mermaid = page['mermaid'].is_a?(Hash) ? page['mermaid'] : {}
      papers = site.data.dig('research', 'entries') || site.data.dig('research', 'publications') || []
      enabled = {
        'math' => site.config['enable_math'] && (page['math'] || page['pseudocode']),
        'mermaid' => mermaid['enabled'], 'chartjs' => chart['chartjs'],
        'echarts' => chart['echarts'], 'vega' => chart['vega_lite'],
        'map' => page['map'], 'diff' => page['code_diff'], 'pseudocode' => page['pseudocode'],
        'comparison' => images['compare'], 'slider' => images['slider'],
        'media_overlay' => images['venobox'], 'table' => page['pretty_table'],
        'research' => page['layout'] == 'publications' && site.config['bib_search'] && !papers.empty?,
        'badges' => page['layout'] == 'publications' && papers.any? { |paper| paper['altmetric'] || paper['dimensions'] },
        'tabs' => page['tabs'], 'typograms' => page['typograms'], 'tikz' => page['tikzjax'],
        'masonry' => page['masonry'] && site.config['enable_masonry'],
        'giscus' => page['giscus_comments'] && !site.config.dig('giscus', 'repo').to_s.empty?,
        'disqus' => page['disqus_comments'] && !site.config['disqus_shortname'].to_s.empty?,
        'newsletter' => site.config.dig('newsletter', 'enabled') && !newsletter_endpoint(site.config.dig('newsletter', 'endpoint')).empty?
      }.select { |_key, value| value == true }
      libraries = enabled.keys.flat_map { |key| FEATURE_LIBRARIES.fetch(key, []) }.uniq.each_with_object({}) do |key, result|
        result[key] = site.config.fetch('third_party_libraries', {})[key] || {}
      end
      { 'features' => enabled.keys, 'libraries' => libraries,
        'typogramsUrl' => site.config['baseurl'].to_s + '/assets/js/typograms.js',
        'tikzUrl' => 'https://tikzjax.com/v1/tikzjax.js',
        'tikzCss' => 'https://tikzjax.com/v1/fonts.css' }
    end
  end
end

Liquid::Template.register_filter(Portfolio::OptionalFeatureFilters)
