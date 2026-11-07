# frozen_string_literal: true
require 'active_support'
require 'active_support/number_helper'
require 'net/http'
require 'json'
require 'uri'

module Jekyll
  class InspireHEPCitationsTag < Liquid::Tag
    Citations = {}

    def initialize(tag_name, params, tokens)
      super
      @record_key = params.strip
    end

    def render(context)
      record = context[@record_key].to_s
      return 'N/A' unless record.match?(/\A[0-9]+\z/)
      return Citations[record] if Citations.key?(record)
      uri = URI('https://inspirehep.net/api/literature/')
      uri.query = URI.encode_www_form(fields: 'citation_count', q: 'recid:' + record)
      result = 'N/A'
      begin
        response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 5) do |http|
          http.get(uri.request_uri)
        end
        if response.is_a?(Net::HTTPSuccess)
          data = JSON.parse(response.body)
          number = data.dig('hits', 'hits', 0, 'metadata', 'citation_count')
          if number.is_a?(Integer) && number >= 0
            result = ActiveSupport::NumberHelper.number_to_human(number, format: '%n%u', precision: 2,
              units: { thousand: 'K', million: 'M', billion: 'B' })
          end
        end
      rescue StandardError => error
        Jekyll.logger.debug('INSPIRE metadata:', error.class.to_s)
      end
      Citations[record] = result.to_s
    end
  end
end
Liquid::Template.register_tag('inspirehep_citations', Jekyll::InspireHEPCitationsTag)
