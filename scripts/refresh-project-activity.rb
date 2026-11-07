#!/usr/bin/env ruby
# Public source metadata only. Nothing is pushed, committed or queried in a visitor's browser.
require 'json'
require 'yaml'
require 'date'
require 'time'
require 'uri'
require 'net/http'
require 'fileutils'
require 'tempfile'
require 'optparse'

module Portfolio
  module ActivityRefresh
    class Error < StandardError; end
    Response = Struct.new(:status, :body, :headers, keyword_init: true)
    SEGMENT = /\A[A-Za-z0-9_.-]+\z/
    SHA = /\A[0-9a-f]{7,64}\z/i
    module_function

    # Only repository roots on these two public hosts become API requests.
    def resource(value)
      return nil unless value.is_a?(String)
      uri = URI.parse(value.strip)
      return nil unless uri.scheme == 'https' && !uri.userinfo && uri.port == 443
      host = uri.host.to_s.downcase
      return nil unless %w[github.com huggingface.co].include?(host)
      parts = uri.path.split('/').reject(&:empty?).map { |part| URI::DEFAULT_PARSER.unescape(part) }
      return nil unless parts.all? { |part| SEGMENT.match?(part) && !%w[. ..].include?(part) }
      if host == 'github.com'
        return nil unless parts.length == 2 && !%w[orgs users topics collections settings features login signup].include?(parts.first)
        parts[-1] = parts.last.delete_suffix('.git')
        return nil if parts.last.empty?
        kind = 'github'
        canonical = 'https://github.com/' + parts.join('/')
        endpoint = 'https://api.github.com/repos/' + parts.join('/')
      else
        group = { 'spaces' => 'hf_space', 'datasets' => 'hf_dataset' }
        if parts.length == 3 && group.key?(parts.first)
          prefix = parts.shift
          kind = group[prefix]
        elsif parts.length == 2 && !%w[docs blog api papers settings organizations collections models datasets spaces].include?(parts.first)
          kind = 'hf_model'
        else
          return nil
        end
        route = { 'hf_space' => 'spaces/', 'hf_dataset' => 'datasets/', 'hf_model' => '' }.fetch(kind)
        canonical = 'https://huggingface.co/' + route + parts.join('/')
        api_route = { 'hf_space' => 'spaces', 'hf_dataset' => 'datasets', 'hf_model' => 'models' }.fetch(kind)
        endpoint = 'https://huggingface.co/api/' + api_route + '/' + parts.join('/')
      end
      { 'kind' => kind, 'url' => canonical, 'source_url' => endpoint }
    rescue URI::InvalidURIError, ArgumentError
      nil
    end

    def projects(source)
      raise Error, 'project_source_missing' unless File.directory?(File.join(source, '_projects/en-us'))
      Dir.glob(File.join(source, '_projects/en-us/*.md')).sort.each_with_object({}) do |path, result|
        frontmatter = File.read(path).split(/^---\s*$\n?/, 3)[1]
        next unless frontmatter
        data = YAML.safe_load(frontmatter, permitted_classes: [Date, Time], aliases: true) || {}
        next if data['published'] == false
        id = data['page_id'].to_s
        raise Error, 'published project requires a stable page_id' unless id.match?(/\A[A-Za-z0-9_-]+\z/)
        raise Error, 'duplicate project page_id' if result.key?(id)
        urls = %w[github huggingface redirect].flat_map { |key| Array(data[key]) }
        urls.concat(Array(data['project_items']).filter_map { |item| item['url'] if item.is_a?(Hash) })
        result[id] = urls.filter_map { |url| resource(url) }.uniq { |item| item['url'].downcase }
      end
    end

    def contributions(source)
      socials_path = File.join(source, '_data/socials.yml')
      socials = File.file?(socials_path) ? YAML.safe_load(File.read(socials_path)) : {}
      owner = socials.is_a?(Hash) ? socials['github_username'].to_s : ''
      return {} unless owner.match?(/\A[A-Za-z0-9-]+\z/)
      Dir.glob(File.join(source, '_projects/en-us/*.md')).sort.each_with_object({}) do |path, result|
        frontmatter = File.read(path).split(/^---\s*$\n?/, 3)[1]
        next unless frontmatter
        data = YAML.safe_load(frontmatter, permitted_classes: [Date, Time], aliases: true) || {}
        next if data['published'] == false
        repo = resource(data['github'])
        next unless repo && repo['kind'] == 'github'
        ids = (Array(data['github_prs']) + Array(data['argilla_prs'])).uniq
        result[data['page_id'].to_s] = ids.filter_map do |value|
          number = Integer(value.to_s, exception: false)
          next unless number && number.positive?
          { 'url' => repo['url'] + '/pull/' + number.to_s,
            'source_url' => repo['source_url'] + '/pulls/' + number.to_s,
            'expected_author' => owner }
        end
      end
    end

    def timestamp(value, now)
      return nil unless value.is_a?(String) && value.match?(/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\z/)
      Date.iso8601(value[0, 10])
      time = Time.iso8601(value)
      return nil if time > now + 300
      time.utc.iso8601
    rescue ArgumentError
      nil
    end

    class HTTP
      MAX_BODY = 2 * 1024 * 1024
      def call(url, headers)
        uri = URI.parse(url)
        request = Net::HTTP::Get.new(uri.request_uri, headers)
        output = nil
        Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 7, write_timeout: 7) do |http|
          http.request(request) do |response|
            body = +''
            response.read_body do |chunk|
              raise Error, 'response_too_large' if body.bytesize + chunk.bytesize > MAX_BODY
              body << chunk
            end
            output = Response.new(status: response.code.to_i, body: body, headers: response.each_header.to_h)
          end
        end
        output
      end
    end

    class Fetcher
      attr_reader :requests
      def initialize(client: HTTP.new, token: ENV['GITHUB_TOKEN'], max_requests: 80, max_seconds: 120, clock: -> { Time.now.utc })
        @client, @token, @max_requests, @max_seconds, @clock = client, token, max_requests, max_seconds, clock
        @requests, @stopped = 0, {}
        @started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      end

      def now
        @clock.call.utc
      end

      def request(url)
        uri = URI.parse(url)
        raise Error, 'invalid_endpoint' unless uri.scheme == 'https' && !uri.userinfo && uri.port == 443 &&
          ((uri.host == 'api.github.com' && uri.path.start_with?('/repos/')) ||
           (uri.host == 'huggingface.co' && uri.path.match?(%r{\A/api/(?:models|datasets|spaces)/})))
        raise Error, 'provider_rate_limited' if @stopped[uri.host]
        headers = { 'Accept' => 'application/json', 'User-Agent' => 'portfolio-public-activity-refresh' }
        if uri.host == 'api.github.com'
          headers['Accept'] = 'application/vnd.github+json'
          headers['X-GitHub-Api-Version'] = '2026-03-10'
          headers['Authorization'] = 'Bearer ' + @token if @token.is_a?(String) && !@token.empty?
        end
        2.times do |attempt|
          raise Error, 'request_budget_exhausted' if @requests >= @max_requests || Process.clock_gettime(Process::CLOCK_MONOTONIC) - @started > @max_seconds
          @requests += 1
          begin
            response = @client.call(url, headers)
          rescue StandardError
            next if attempt.zero?
            raise Error, 'network_error'
          end
          code = response.status.to_i
          response_headers = (response.headers || {}).transform_keys { |key| key.to_s.downcase }
          if code == 429 || (uri.host == 'api.github.com' && [401, 403].include?(code))
            @stopped[uri.host] = true
            raise Error, code == 401 ? 'provider_auth_rejected' : 'provider_rate_limited'
          end
          @stopped[uri.host] = true if response_headers['x-ratelimit-remaining'] == '0'
          next if [500, 502, 503, 504].include?(code) && attempt.zero?
          # Redirects intentionally are not followed: a renamed source must be reviewed.
          raise Error, "http_#{code}" unless code == 200
          begin
            return response.body.is_a?(String) ? JSON.parse(response.body) : response.body
          rescue JSON::ParserError
            raise Error, 'invalid_json'
          end
        end
      end

      def fetch_contribution(target)
        checked = now
        data = request(target.fetch('source_url'))
        raise Error, 'invalid_pull_request' unless data.is_a?(Hash)
        raise Error, 'private_repository' if data.dig('base', 'repo', 'private') == true
        author = data.dig('user', 'login')
        raise Error, 'different_contributor' unless author.is_a?(String) && author.casecmp(target.fetch('expected_author')).zero?
        merged = ActivityRefresh.timestamp(data['merged_at'], checked)
        raise Error, 'not_merged' unless merged
        { 'url' => target['url'], 'source_url' => target['source_url'], 'merged_at' => merged,
          'author' => author, 'checked_at' => checked.iso8601, 'status' => 'merged' }
      end

      def fetch(resource)
        checked = now
        data = request(resource.fetch('source_url'))
        raise Error, 'invalid_repository_metadata' unless data.is_a?(Hash) && data['private'] != true
        result = resource.merge('checked_at' => checked.iso8601, 'status' => 'ok')
        if resource['kind'] == 'github'
          created = ActivityRefresh.timestamp(data['created_at'], checked)
          raise Error, 'invalid_creation_date' unless created
          result['created_at'] = created
          result['archived'] = data['archived'] == true
          result['fork'] = data['fork'] == true
          result['default_branch'] = data['default_branch'] if data['default_branch'].is_a?(String) && !data['default_branch'].match?(/[\x00-\x1f]/)
          begin
            commits = request(resource['source_url'] + '/commits?per_page=1')
          rescue Error => error
            if error.message == 'http_409'
              return result.merge('activity_status' => 'empty')
            end
            raise
          end
          commit = commits.is_a?(Array) ? commits.first : nil
          updated = ActivityRefresh.timestamp(commit&.dig('commit', 'committer', 'date'), checked)
          sha = commit.is_a?(Hash) ? commit['sha'] : nil
          raise Error, 'invalid_commit_metadata' unless updated && sha.is_a?(String) && SHA.match?(sha)
          result['updated_at'], result['sha'] = updated, sha
          result['commit_url'] = resource['url'] + '/commit/' + sha
        else
          created = ActivityRefresh.timestamp(data['createdAt'], checked)
          updated = ActivityRefresh.timestamp(data['lastModified'], checked)
          raise Error, 'missing_source_dates' unless created || updated
          result['created_at'] = created if created
          result['updated_at'] = updated if updated
          if data['sha'].is_a?(String) && SHA.match?(data['sha'])
            result['sha'] = data['sha']
            result['commit_url'] = resource['url'] + '/commit/' + data['sha']
          end
          result['archived'] = false
        end
        result
      end
    end

    # A failed refresh never advances checked_at or replaces verified dates with now.
    def refresh(manifest, previous, fetcher:, offline: false, contributions: {})
      raise Error, 'unsupported_snapshot_schema' unless previous.is_a?(Hash) && [nil, 1].include?(previous['schema_version'])
      old_projects = previous['projects'].is_a?(Hash) ? previous['projects'] : {}
      output = { 'schema_version' => 1, 'projects' => {} }
      manifest.each do |id, resources|
        old = Array(old_projects.dig(id, 'resources'))
        output['projects'][id] = { 'resources' => resources.map do |item|
          prior = old.find { |entry| entry.is_a?(Hash) && entry['url'].to_s.casecmp(item['url']).zero? }
          if offline
            prior || item.merge('status' => 'unavailable', 'refresh_error' => 'offline_no_snapshot')
          else
            begin
              fetcher.fetch(item)
            rescue Error
              error = $!.message
              # Only stable error codes are persisted, never server text or credentials.
              error = 'refresh_failed' unless error.match?(/\A[a-z_]+(?:_[0-9]{3})?\z/)
              (prior || item).merge('status' => 'unavailable', 'refresh_error' => error,
                'last_attempted_at' => fetcher.now.iso8601)
            end
          end
        end }
        old_contributions = Array(old_projects.dig(id, 'contributions'))
        targets = Array(contributions[id])
        unless targets.empty?
          output['projects'][id]['contributions'] = targets.map do |target|
            prior = old_contributions.find { |entry| entry.is_a?(Hash) && entry['url'] == target['url'] }
            canonical = target.reject { |key, _| key == 'expected_author' }
            if offline
              prior || canonical.merge('status' => 'unavailable', 'refresh_error' => 'offline_no_snapshot')
            else
              begin
                fetcher.fetch_contribution(target)
              rescue Error => error
                (prior || canonical).merge('status' => 'unavailable', 'refresh_error' => error.message,
                  'last_attempted_at' => fetcher.now.iso8601)
              end
            end
          end
        end
      end
      output
    end

    def write(path, data)
      FileUtils.mkdir_p(File.dirname(path))
      Tempfile.create(['.activity-', '.json'], File.dirname(path)) do |file|
        file.write(JSON.pretty_generate(data) + "\n")
        file.flush
        file.fsync
        File.rename(file.path, path)
      end
    end

    def cli(argv = ARGV)
      options = { source: Dir.pwd, offline: false }
      OptionParser.new do |parser|
        parser.banner = 'Usage: ruby scripts/refresh-project-activity.rb [--source ROOT] [--output FILE] [--offline]'
        parser.on('--source PATH') { |value| options[:source] = File.expand_path(value) }
        parser.on('--output PATH') { |value| options[:output] = File.expand_path(value) }
        parser.on('--offline') { options[:offline] = true }
      end.parse!(argv)
      source = options[:source]
      output = options[:output] || File.join(source, '_data/project_activity.json')
      previous = File.file?(output) ? JSON.parse(File.read(output)) : { 'schema_version' => 1, 'projects' => {} }
      result = refresh(projects(source), previous, fetcher: Fetcher.new, offline: options[:offline], contributions: contributions(source))
      write(output, result)
      resources = result['projects'].values.flat_map { |project| project['resources'] }
      puts JSON.generate('projects' => result['projects'].length, 'resources' => resources.length,
        'verified' => resources.count { |item| item['status'] == 'ok' },
        'unavailable' => resources.count { |item| item['status'] == 'unavailable' }, 'offline' => options[:offline])
      0
    rescue Error, JSON::ParserError, Psych::Exception, OptionParser::ParseError => error
      warn 'Activity refresh failed: ' + error.class.name
      1
    end
  end
end

exit Portfolio::ActivityRefresh.cli if $PROGRAM_NAME == __FILE__
