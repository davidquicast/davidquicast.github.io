# frozen_string_literal: true

require 'date'

module Portfolio
  module TalksData
    module_function

    def normalize(record)
      id = record['id'].to_s.strip
      raise ArgumentError, 'talk id is required' if id.empty?

      title = record['title'].to_s.strip
      raise ArgumentError, 'talk title is required' if title.empty?

      date_str = record['published_at'] || record['date']
      date = Date.iso8601(date_str.to_s.slice(0, 10))

      record.merge(
        'id' => id,
        'title' => title,
        'date' => record['date'] || date.to_s,
        'published_at' => date.to_s,
        'year' => date.year,
        'detail_url' => record['detail_url'] || "/talks/#{id}/"
      )
    end

    def prepare(data)
      entries = Array(data.is_a?(Hash) ? data['talks'] : data).map do |record|
        normalize(record)
      end
      entries.sort_by { |entry| [-entry['year'], entry['title'].downcase] }
    end
  end

  class TalkPage < Jekyll::PageWithoutAFile
    def initialize(site, entry)
      super(site, site.source, File.join('talks', entry['id']), 'index.html')
      self.content = ''
      self.data.merge!(
        'layout' => 'talk',
        'title' => entry['title'],
        'description' => entry['summary'] || entry['abstract'] || entry['title'],
        'talk' => entry,
        'page_id' => 'talk-' + entry['id'],
        'lang' => site.config['default_lang'] || 'en-us',
        'permalink' => entry['detail_url']
      )
    end
  end

  class TalksGenerator < Jekyll::Generator
    safe true
    priority :high

    def generate(site)
      raw = site.data['talks']
      entries = TalksData.prepare(raw)
      site.data['talks_catalog'] = entries

      entries.each do |entry|
        site.pages << TalkPage.new(site, entry)
      end
    end
  end
end
