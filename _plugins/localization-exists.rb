# frozen_string_literal: true

module Jekyll
  class LocalizationExistsTag < Liquid::Tag
    def initialize(tag_name, key, tokens)
      super
      @key = key.strip
    end

    def render(context)
      key = Liquid::Template.parse(@key).render(context).strip
      site = context.registers[:site]
      language = (site.respond_to?(:active_lang) && site.active_lang) || site.config['active_lang'] || site.config['default_lang'] || Array(site.config['languages']).first
      node = (site.data[language] || {})['strings']
      key.split('.').each { |part| node = node.is_a?(Hash) ? node[part] : nil }
      (!key.empty? && !node.nil?).to_s
    end
  end
end

Liquid::Template.register_tag('localization_exists', Jekyll::LocalizationExistsTag)
