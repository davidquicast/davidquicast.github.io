# frozen_string_literal: true

require 'cgi'

module Portfolio
  # Keeps the existing {% tabs %}/{% tab %} author API, with useful no-JS links.
  class AccessibleTabsBlock < Liquid::Block
    def initialize(tag_name, markup, tokens)
      super
      @name = markup.strip.downcase.gsub(/[^a-z0-9]+/, '-').gsub(/\A-|-\z/, '')
      raise SyntaxError, 'tabs requires a nonempty name' if @name.empty?
    end

    def render(context)
      super
      environment = context.environments.first
      tabs = environment["tabs-#{@name}"] || {}
      environment['portfolio-tabs-count'] = environment.fetch('portfolio-tabs-count', 0) + 1
      identifier = "tabs-#{@name}-#{environment['portfolio-tabs-count']}"
      controls = tabs.each_with_index.map do |(name, _content), index|
        panel = "#{identifier}-panel-#{index + 1}"
        "<a href=\"##{panel}\" id=\"#{panel}-tab\" data-tab-control>#{CGI.escapeHTML(name.to_s)}</a>"
      end.join
      panels = tabs.each_with_index.map do |(_name, content), index|
        panel = "#{identifier}-panel-#{index + 1}"
        "<div id=\"#{panel}\" data-tab-panel>#{content}</div>"
      end.join
      "<div class=\"content-tabs\" id=\"#{identifier}\" data-content-tabs><div data-tab-controls>#{controls}</div>#{panels}</div>"
    end
  end
end

Jekyll::Hooks.register :site, :post_read do |_site|
  Liquid::Template.register_tag('tabs', Portfolio::AccessibleTabsBlock)
end
