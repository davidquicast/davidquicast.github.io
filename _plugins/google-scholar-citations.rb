# frozen_string_literal: true
require 'active_support'
require 'active_support/number_helper'
require 'nokogiri'
require 'open-uri'
require 'uri'

module Jekyll
  class GoogleScholarCitationsTag < Liquid::Tag
    Citations = {}

    def initialize(tag_name, params, tokens)
      super
      @scholar_key, @article_key = params.split.map(&:strip)
    end

    def render(context)
      scholar = @scholar_key && context[@scholar_key].to_s
      article = @article_key && context[@article_key].to_s
      return 'N/A' unless [scholar, article].all? { |value| value && value.match?(/\A[A-Za-z0-9_-]+\z/) }
      cache_key = [scholar, article].join(':')
      return Citations[cache_key] if Citations.key?(cache_key)
      query = URI.encode_www_form(view_op: 'view_citation', hl: 'en', user: scholar, citation_for_view: cache_key)
      url = 'https://scholar.google.com/citations?' + query
      result = 'N/A'
      begin
        html = URI.open(url, 'User-Agent' => 'PortfolioCitationMetadata/1.0', open_timeout: 5, read_timeout: 5).read
        doc = Nokogiri::HTML(html)
        text = doc.css('meta[name="description"], meta[property="og:description"]').map { |meta| meta['content'].to_s }.join(' ')
        match = text.match(/Cited by\s+([\d,]+)/i)
        if match
          number = match[1].delete(',').to_i
          result = ActiveSupport::NumberHelper.number_to_human(number, format: '%n%u', precision: 2,
            units: { thousand: 'K', million: 'M', billion: 'B' })
        end
      rescue StandardError => error
        Jekyll.logger.debug('Scholar metadata:', error.class.to_s)
      end
      Citations[cache_key] = result.to_s
    end
  end
end
Liquid::Template.register_tag('google_scholar_citations', Jekyll::GoogleScholarCitationsTag)
