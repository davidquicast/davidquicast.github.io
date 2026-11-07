# frozen_string_literal: true

require 'uri'
require 'date'
require 'fileutils'

module Portfolio
  # Validate author-maintained data once at build time, before it becomes markup.
  module ResearchData
    LINK_FIELDS = %w[url pdf code dataset slides poster supplementary].freeze
    TEXT_FIELDS = %w[title venue abstract summary relationship_note booktitle journal publisher archiveprefix primaryclass eprint].freeze
    TYPES = %w[article inproceedings book misc].freeze
    RELATIONSHIPS = %w[coauthor cited_work].freeze
    AUTHORSHIP_STATUSES = %w[verified pending_update].freeze
    MONTHS = %w[jan feb mar apr may jun jul aug sep oct nov dec].freeze
    module_function

    def text(value, field, required: false)
      unless value.nil? || value.is_a?(String)
        raise ArgumentError, "#{field} must be a string"
      end
      value = value.to_s.strip
      raise ArgumentError, "#{field} is required" if required && value.empty?
      raise ArgumentError, "#{field} contains control characters" if value.match?(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/)
      value
    end

    def link(value, field, source)
      value = text(value, field)
      return '' if value.empty?
      uri = URI.parse(value)
      if value.start_with?('/') && !value.start_with?('//')
        decoded = URI::DEFAULT_PARSER.unescape(uri.path.to_s)
        if decoded.split('/').include?('..') || decoded.include?("\\") || decoded.match?(/[\x00-\x1f\x7f]/)
          raise ArgumentError, "#{field} cannot contain traversal"
        end
        path = File.expand_path(decoded.delete_prefix('/'), source)
        unless path.start_with?(File.expand_path(source) + File::SEPARATOR) && File.file?(path) && File.realpath(path).start_with?(File.realpath(source) + File::SEPARATOR)
          raise ArgumentError, "#{field} points to a missing local file"
        end
      elsif !%w[http https].include?(uri.scheme) || uri.host.to_s.empty? || uri.userinfo
        raise ArgumentError, "#{field} must be an HTTP(S) URL or existing local path"
      end
      value
    rescue URI::InvalidURIError
      raise ArgumentError, "#{field} is not a valid URL"
    end

    def bib_text(value)
      value = value.to_s
      depth = 0
      balanced = value.each_char.all? do |character|
        depth += 1 if character == '{'
        depth -= 1 if character == '}'
        depth >= 0
      end && depth.zero?
      # BibTeX counts braces even when TeX-escaped. Preserve balanced literal
      # groups, but encode unmatched braces without ending the enclosing field.
      replacements = { "\\" => '\\textbackslash{}',
        '{' => balanced ? '\\{' : '\\textbraceleft{}',
        '}' => balanced ? '\\}' : '\\textbraceright{}',
        '#' => '\\#', '%' => '\\%', '&' => '\\&' }
      value.gsub(/[\\{}#%&]/) { |character| replacements.fetch(character) }
    end

    def date_fields(record, year)
      value = text(record['published_at'], 'published_at')
      return ['', 'year', nil] if value.empty?
      unless value.match?(/\A\d{4}-\d{2}(?:-\d{2})?\z/)
        raise ArgumentError, 'published_at must be an exact YYYY-MM or YYYY-MM-DD date'
      end
      precision = value.length == 7 ? 'month' : 'day'
      date = Date.iso8601(precision == 'month' ? value + '-01' : value)
      raise ArgumentError, 'published_at and year disagree' unless date.year == year
      [value, precision, date.month]
    rescue Date::Error
      raise ArgumentError, 'published_at is not a valid calendar date'
    end

    def month(value, publication_month)
      if value.nil? || value == ''
        return publication_month ? MONTHS.fetch(publication_month - 1) : ''
      end
      index = if value.is_a?(Integer)
                value - 1 if value.between?(1, 12)
              elsif value.is_a?(String)
                MONTHS.index(value.downcase.strip)
              end
      raise ArgumentError, 'month must be 1–12 or a BibTeX month abbreviation' unless index
      if publication_month && index + 1 != publication_month
        raise ArgumentError, 'month and published_at disagree'
      end
      MONTHS.fetch(index)
    end

    def evidence(value, source:)
      return [] if value.nil?
      raise ArgumentError, 'evidence must be a list' unless value.is_a?(Array)
      value.map do |item|
        raise ArgumentError, 'each evidence item must be a mapping' unless item.is_a?(Hash)
        { 'label' => text(item['label'], 'evidence.label', required: true),
          'url' => link(text(item['url'], 'evidence.url', required: true), 'evidence.url', source) }
      end
    end

    def mentions(value, source:)
      return [] if value.nil?
      raise ArgumentError, 'mentions must be a list' unless value.is_a?(Array)
      value.map do |item|
        raise ArgumentError, 'each mention must be a mapping' unless item.is_a?(Hash)
        { 'title' => text(item['title'], 'mention.title', required: true),
          'url' => link(text(item['url'], 'mention.url', required: true), 'mention.url', source),
          'evidence_url' => link(text(item['evidence_url'], 'mention.evidence_url', required: true), 'mention.evidence_url', source),
          'note' => text(item['note'], 'mention.note') }
      end
    end

    def bibliography(result)
      fields = { 'title' => result['title'], 'author' => result['authors'].join(' and '), 'year' => result['year'] }
      case result['type']
      when 'inproceedings'
        fields['booktitle'] = result['booktitle'].empty? ? result['venue'] : result['booktitle']
      when 'article'
        fields['journal'] = result['journal'].empty? ? result['venue'] : result['journal']
      when 'misc'
        fields['howpublished'] = result['venue']
      end
      %w[pages publisher month doi url eprint].each { |field| fields[field] = result[field] }
      fields['archivePrefix'] = result['archiveprefix']
      fields['primaryClass'] = result['primaryclass']
      fields.reject! { |_key, value| value.to_s.empty? }
      "@#{result['type']}{#{result['id']},\n" + fields.map do |key, value|
        formatted = key == 'month' ? value : "{#{bib_text(value)}}"
        "  #{key} = #{formatted}"
      end.join(",\n") + "\n}\n"
    end

    def normalize(record, source:)
      raise ArgumentError, 'each publication must be a mapping' unless record.is_a?(Hash)
      result = {}
      result['id'] = text(record['id'], 'id', required: true)
      unless result['id'].match?(/\A[a-z0-9]+(?:-[a-z0-9]+)*\z/)
        raise ArgumentError, 'id must be a lowercase URL-safe slug'
      end
      TEXT_FIELDS.each { |field| result[field] = text(record[field], field, required: field == 'title') }
      result['type'] = text(record['type'] || 'article', 'type')
      raise ArgumentError, 'type must be article, inproceedings, book or misc' unless TYPES.include?(result['type'])
      result['relationship'] = text(record['relationship'] || 'coauthor', 'relationship')
      unless RELATIONSHIPS.include?(result['relationship'])
        raise ArgumentError, 'relationship must be coauthor or cited_work'
      end
      result['authorship_status'] = text(record['authorship_status'] || 'verified', 'authorship_status')
      unless AUTHORSHIP_STATUSES.include?(result['authorship_status'])
        raise ArgumentError, 'authorship_status must be verified or pending_update'
      end
      if result['authorship_status'] == 'pending_update'
        raise ArgumentError, 'pending_update is only valid for coauthored work' unless result['relationship'] == 'coauthor'
        raise ArgumentError, 'pending_update requires a relationship_note' if result['relationship_note'].empty?
      end
      authors = record['authors']
      unless authors.is_a?(Array) && !authors.empty?
        raise ArgumentError, 'authors must be a nonempty list of full names'
      end
      result['authors'] = authors.map { |author| text(author, 'author', required: true) }
      result['authors_count'] = result['authors'].length
      result['authors_preview'] = result['authors'].first(3).join(', ') + (result['authors_count'] > 3 ? ', et al.' : '')
      year = record['year']
      unless year.is_a?(Integer) && year.between?(1600, 9999)
        raise ArgumentError, 'year must be a four-digit integer'
      end
      result['year'] = year
      result['published_at'], result['date_precision'], publication_month = date_fields(record, year)
      result['last_revised_at'] = text(record['last_revised_at'], 'last_revised_at')
      unless result['last_revised_at'].empty?
        unless result['last_revised_at'].match?(/\A\d{4}-\d{2}-\d{2}\z/)
          raise ArgumentError, 'last_revised_at must be an ISO day'
        end
        revised = Date.iso8601(result['last_revised_at'])
        publication = Date.iso8601(result['published_at'].length == 7 ? result['published_at'] + '-01' : result['published_at']) unless result['published_at'].empty?
        raise ArgumentError, 'revision precedes publication' if publication && revised < publication
      end
      result['month'] = month(record['month'], publication_month)
      result['pages'] = text(record['pages'], 'pages')
      unless result['pages'].empty? || result['pages'].match?(/\A[A-Za-z0-9]+(?:--?[A-Za-z0-9]+)?(?:,\s*[A-Za-z0-9]+(?:--?[A-Za-z0-9]+)?)*\z/)
        raise ArgumentError, 'pages must be a page number or range'
      end
      unless result['archiveprefix'].empty? || result['archiveprefix'].match?(/\A[A-Za-z][A-Za-z0-9._-]*\z/)
        raise ArgumentError, 'archiveprefix must be a public archive identifier'
      end
      unless result['primaryclass'].empty? || result['primaryclass'].match?(/\A[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)?\z/)
        raise ArgumentError, 'primaryclass must be a public subject identifier'
      end
      unless result['eprint'].empty?
        pattern = result['archiveprefix'].casecmp('arxiv').zero? ? /\A(?:\d{4}\.\d{4,5}|[a-z.-]+\/\d{7})(?:v[1-9]\d*)?\z/ : /\A[A-Za-z0-9][A-Za-z0-9._:\/-]*\z/
        if result['archiveprefix'].empty? || !result['eprint'].match?(pattern)
          raise ArgumentError, 'eprint requires a valid archiveprefix and public identifier'
        end
      end
      LINK_FIELDS.each { |field| result[field] = link(record[field], field, source) }
      result['evidence'] = evidence(record['evidence'], source: source)
      result['mentions'] = mentions(record['mentions'], source: source)
      result['doi'] = text(record['doi'], 'doi').sub(%r{\Ahttps?://(?:dx\.)?doi\.org/}i, '')
      unless result['doi'].empty? || result['doi'].match?(/\A10\.\d{4,9}\/[^\s<>"\x00-\x1f]+\z/)
        raise ArgumentError, 'doi must be a DOI identifier or doi.org URL'
      end
      result['doi_url'] = result['doi'].empty? ? '' : 'https://doi.org/' + URI::DEFAULT_PARSER.escape(result['doi'], /[^A-Za-z0-9\-._~\/]/)
      unless record['selected'].nil? || record['selected'] == true || record['selected'] == false
        raise ArgumentError, 'selected must be a boolean'
      end
      if result['relationship'] == 'cited_work' && record['selected'] == true
        raise ArgumentError, 'cited work cannot be selected as an authored publication'
      end
      result['selected'] = record['selected'] == true
      %w[altmetric dimensions].each do |field|
        value = record[field]
        unless value.nil? || value == true || value == false || value.to_s.match?(/\A[0-9]+\z/)
          raise ArgumentError, "#{field} must be a boolean or numeric public identifier"
        end
        if value == true && result['doi'].empty?
          raise ArgumentError, "#{field}: true requires a DOI; otherwise provide a numeric public identifier"
        end
        result[field] = value || false
      end
      %w[google_scholar_id inspirehep_id].each do |field|
        value = text(record[field], field)
        unless value.empty? || value.match?(/\A[A-Za-z0-9_-]+\z/)
          raise ArgumentError, "#{field} must be a public identifier"
        end
        result[field] = value
      end
      result['detail_url'] = '/research/' + result['id'] + '/'
      result['bibtex_url'] = '/assets/bib/' + result['id'] + '.bib'
      result['bibtex'] = bibliography(result)
      result
    end

    def prepare(data, source:)
      data = {} if data.nil?
      unless data.is_a?(Hash) && %w[publications citations].all? { |key| data[key].nil? || data[key].is_a?(Array) }
        raise ArgumentError, 'publications.yml must contain publications and citations lists'
      end
      entries = { 'publications' => 'coauthor', 'citations' => 'cited_work' }.flat_map do |key, relationship|
        (data[key] || []).map do |record|
          raise ArgumentError, 'each publication must be a mapping' unless record.is_a?(Hash)
          if record.key?('relationship') && record['relationship'] != relationship
            raise ArgumentError, "#{key} records must use relationship #{relationship}"
          end
          normalize(record.merge('relationship' => relationship), source: source)
        end
      end
      ids = entries.map { |entry| entry['id'] }
      raise ArgumentError, 'publication ids must be unique' unless ids.uniq.length == ids.length
      entries.sort_by { |entry| [-entry['year'], entry['title'].downcase] }
    end
  end

  # Scholar converts .bib Pages into formatted HTML. A generated StaticFile
  # preserves the actual bibliography bytes and avoids locale duplication.
  class BibliographyFile < Jekyll::StaticFile
    def initialize(site, entry)
      super(site, site.source, 'assets/bib', entry['id'] + '.bib')
      @content = entry['bibtex']
      @modified_time = site.time
    end

    def data
      { 'sitemap' => false }
    end

    def url
      '/assets/bib/' + name
    end

    def write(dest)
      return false if @site.respond_to?(:active_lang) && @site.active_lang != @site.config['default_lang']
      target = destination(dest)
      return false if File.file?(target) && File.binread(target) == @content
      FileUtils.mkdir_p(File.dirname(target))
      temporary = target + '.tmp'
      File.write(temporary, @content)
      File.rename(temporary, target)
      true
    end
  end

  # A genuine static destination supports direct links, indexing and the same
  # fetched-main overlay path as project and article details. No paper is emitted
  # until an author-supplied record has passed the schema above.
  class PublicationPage < Jekyll::PageWithoutAFile
    def initialize(site, entry)
      super(site, site.source, File.join('research', entry['id']), 'index.html')
      self.content = ''
      self.data.merge!('layout' => 'paper', 'title' => entry['title'],
        'description' => [entry['summary'], entry['abstract'], entry['title']].find { |value| !value.empty? },
        'paper' => entry, 'page_id' => 'paper-' + entry['id'],
        'lang' => site.config['default_lang'] || 'en-us', 'permalink' => entry['detail_url'])
    end
  end

  class ResearchGenerator < Jekyll::Generator
    safe true
    priority :high

    def generate(site)
      entries = ResearchData.prepare(site.data['publications'], source: site.source)
      site.data['research'] = {
        'publications' => entries.select { |entry| entry['relationship'] == 'coauthor' },
        'citations' => entries.select { |entry| entry['relationship'] == 'cited_work' },
        'entries' => entries
      }
      site.pages.reject! { |page| page.is_a?(PublicationPage) }
      site.static_files.reject! { |file| file.is_a?(BibliographyFile) }
      entries.each do |entry|
        collision = site.pages.any? { |page| page.url == entry['detail_url'] } ||
                    File.exist?(File.join(site.source, 'research', entry['id'], 'index.html'))
        raise ArgumentError, "paper detail route already exists: #{entry['detail_url']}" if collision
        site.pages << PublicationPage.new(site, entry)
        site.static_files << BibliographyFile.new(site, entry)
      end
    rescue ArgumentError => error
      raise Jekyll::Errors::FatalException, "Publications: #{error.message}"
    end
  end
end
