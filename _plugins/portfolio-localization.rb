# frozen_string_literal: true

require 'date'

module Portfolio
  module LocalizationFilters
    def localization_site
      @context.registers[:site]
    end

    def active_locale
      site = localization_site
      (site.respond_to?(:active_lang) && site.active_lang) || site.config['active_lang'] || site.config['default_lang'] || 'en-us'
    end

    def locale_tag(value)
      value = active_locale if value.to_s.empty?
      parts = value.to_s.tr('_', '-').split('-')
      parts.map.with_index { |part, index| index.zero? ? part.downcase : (part.length == 2 ? part.upcase : part) }.join('-')
    end

    def og_locale(value)
      locale_tag(value).tr('-', '_')
    end

    # The content language can differ from the active UI locale during fallback.
    def content_locale(page)
      site = localization_site
      explicit = page['lang']
      return explicit unless explicit.to_s.empty?
      key = page['page_id'] || page['url']
      source_locale = site.respond_to?(:file_langs) && site.file_langs && site.file_langs[key]
      source_locale || active_locale
    end

    def localized_date(value, style = 'long')
      date = value.respond_to?(:to_date) ? value.to_date : Date.parse(value.to_s)
      site = localization_site
      language = active_locale
      key = Date::MONTHNAMES[date.month].downcase
      month_style = style.to_s == 'short' ? 'short' : 'long'
      month = site.data.dig(language, 'strings', 'months', month_style, key) ||
              site.data.dig(site.config['default_lang'] || 'en-us', 'strings', 'months', month_style, key) ||
              (month_style == 'short' ? Date::ABBR_MONTHNAMES[date.month] : Date::MONTHNAMES[date.month])
      return date.year.to_s if style.to_s == 'year'
      return date.strftime('%Y-%m-%d') if style.to_s == 'iso'
      defaults = { 'long' => '{month} {day}, {year}', 'short' => '{month} {day}, {year}', 'month_year' => '{month} {year}' }
      # Retain the existing template's Portuguese date order when using its legacy strings.
      legacy = language.to_s.start_with?('pt') && style.to_s == 'long' ? '{day} de {month}, {year}' : nil
      pattern = site.data.dig(language, 'ui', 'date', style.to_s) || legacy || defaults[style.to_s] || defaults['long']
      pattern.gsub('{month}', month.to_s).gsub('{day}', date.day.to_s).gsub('{year}', date.year.to_s)
    rescue ArgumentError, TypeError
      value.to_s
    end

    def ui_dictionary(_value = nil)
      site = localization_site
      default = (site.data[site.config['default_lang'] || 'en-us'] || {})['ui'] || {}
      current = (site.data[active_locale] || {})['ui'] || {}
      merge_ui(default, current)
    end

    def merge_ui(default, current)
      return default unless current.is_a?(Hash)
      default.merge(current) do |_key, original, override|
        original.is_a?(Hash) && override.is_a?(Hash) ? merge_ui(original, override) : override
      end
    end

    def ui_label(key, fallback = nil)
      site = localization_site
      locales = [active_locale, site.config['default_lang'] || 'en-us'].uniq
      locales.each do |language|
        data = site.data[language] || {}
        %w[ui strings].each do |group|
          value = key.to_s.split('.').reduce(data[group]) do |node, part|
            node.is_a?(Hash) ? node[part] : nil
          end
          return value if value.is_a?(String) && !value.empty?
        end
      end
      fallback || key
    end

    # Used only in static_href blocks: Polyglot must not re-prefix language links.
    def locale_url(route, language)
      return route if route.to_s.match?(%r{\A[a-z][a-z0-9+.-]*:}i) || route.to_s.start_with?('//')
      site = localization_site
      base = site.config['baseurl'].to_s.sub(%r{/$}, '')
      path = '/' + route.to_s.sub(%r{\A/+}, '')
      path = path.delete_prefix(base) if !base.empty? && (path == base || path.start_with?(base + '/'))
      Array(site.config['languages']).each do |candidate|
        next if candidate == site.config['default_lang']
        prefix = '/' + candidate
        path = path.delete_prefix(prefix) if path == prefix || path.start_with?(prefix + '/')
      end
      path = '/' if path.empty?
      locale_prefix = language == site.config['default_lang'] ? '' : '/' + language.to_s
      base + locale_prefix + path
    end
  end
end

Liquid::Template.register_filter(Portfolio::LocalizationFilters)
