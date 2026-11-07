#!/usr/bin/env ruby
require 'json'
require 'tmpdir'
require_relative '../scripts/refresh-project-activity'
M = Portfolio::ActivityRefresh
NOW = Time.utc(2026, 11, 5, 12)
GITHUB = M.resource('https://github.com/owner/repo')
HF = M.resource('https://huggingface.co/spaces/owner/demo')
SHA = 'a' * 40
class FakeHTTP
  attr_reader :calls
  def initialize(routes)
    @routes, @calls = routes, []
  end
  def call(url, headers)
    @calls << [url, headers.dup]
    value = @routes.fetch(url) { raise IOError }
    value.is_a?(Array) ? value.shift : value
  end
end

def response(body, status = 200, headers = {})
  M::Response.new(status: status, body: body, headers: headers)
end

def metadata
  { 'created_at' => '2025-01-04T12:00:00Z', 'updated_at' => '2026-11-05T10:00:00Z',
    'pushed_at' => '2026-11-05T11:00:00Z', 'default_branch' => 'main', 'archived' => false, 'fork' => true }
end

def commits
  [{ 'sha' => SHA, 'html_url' => 'https://malicious.example/never-used',
    'commit' => { 'author' => { 'date' => '2026-10-01T00:00:00Z' }, 'committer' => { 'date' => '2026-10-02T03:00:00Z' } } }]
end

def fetcher(routes, **opts)
  http = FakeHTTP.new(routes)
  [M::Fetcher.new(client: http, token: 'private-test-token', clock: -> { NOW }, **opts), http]
end

checks = []
def check(checks, name)
  yield
  checks << { 'name' => name, 'passed' => true }
rescue StandardError => error
  checks << { 'name' => name, 'passed' => false, 'error' => error.message }
end

def assert(value, message)
  raise message unless value
end

def rejects
  yield
  raise 'invalid request accepted'
rescue M::Error
  true
end

check(checks, 'only exact HTTPS repository hosts and roots can become source requests') do
  %w[http://github.com/owner/repo https://github.com.evil.example/owner/repo https://user:secret@github.com/owner/repo https://github.com:444/owner/repo https://github.com/owner/../repo https://github.com/owner/%2e%2e https://github.com/owner/repo/tree/main https://huggingface.co/api/models/owner/repo https://huggingface.co/spaces/owner/repo/resolve/main/a].each do |url|
    assert(M.resource(url).nil?, 'unsafe or non-root repository accepted')
  end
  assert(M.resource('https://github.com/owner/repo.git?token=secret')['url'] == GITHUB['url'], 'canonical root lost or secret query retained')
end
check(checks, 'Hugging Face models, datasets and Spaces keep their actual resource types') do
  { 'https://huggingface.co/owner/model' => 'hf_model', 'https://huggingface.co/datasets/owner/data' => 'hf_dataset', HF['url'] => 'hf_space' }.each do |url, kind|
    assert(M.resource(url)['kind'] == kind, 'Hub resource type changed')
  end
end
check(checks, 'GitHub activity uses default-branch committer date rather than repository metadata or author date') do
  f, http = fetcher({GITHUB['source_url'] => response(metadata), GITHUB['source_url'] + '/commits?per_page=1' => response(commits)})
  result = f.fetch(GITHUB)
  assert(result['updated_at'] == '2026-10-02T03:00:00Z', 'wrong activity field selected')
  assert(result['created_at'] == '2025-01-04T12:00:00Z' && result['fork'], 'repo creation/fork facts lost')
  assert(result['commit_url'] == GITHUB['url'] + '/commit/' + SHA, 'untrusted HTML URL used')
  assert(http.calls.last[0].end_with?('/commits?per_page=1'), 'default branch endpoint changed')
end
check(checks, 'fork commit chronology can predate repository creation') do
  c = commits; c.first['commit']['committer']['date'] = '2024-01-01T00:00:00Z'
  f, = fetcher({GITHUB['source_url'] => response(metadata), GITHUB['source_url'] + '/commits?per_page=1' => response(c)})
  assert(f.fetch(GITHUB)['updated_at'] == '2024-01-01T00:00:00Z', 'old upstream commit became a fabricated recent update')
end
check(checks, 'Hub reports source creation and modification without inferring a personal contribution') do
  f, http = fetcher({HF['source_url'] => response({ 'createdAt' => '2024-02-03T00:00:00.000Z', 'lastModified' => '2026-08-09T01:02:03.000Z', 'sha' => SHA })})
  result = f.fetch(HF)
  assert(result['created_at'] == '2024-02-03T00:00:00Z' && result['updated_at'] == '2026-08-09T01:02:03Z', 'Hub source dates changed')
  assert(!http.calls.first[1].key?('Authorization'), 'GitHub credential leaked to Hub')
  assert(!JSON.generate(result).include?('private-test-token'), 'credential entered snapshot')
end
check(checks, 'transient errors retry once and a rate limit stops remaining provider requests') do
  f, http = fetcher({GITHUB['source_url'] => [response({}, 503), response({}, 429)]})
  rejects { f.fetch(GITHUB) }; rejects { f.fetch(GITHUB) }
  assert(http.calls.length == 2, 'rate-limited provider was queried again')
end
check(checks, 'GitHub last available quota does not permit an additional commit request') do
  f, http = fetcher({GITHUB['source_url'] => response(metadata, 200, 'X-RateLimit-Remaining' => '0')})
  rejects { f.fetch(GITHUB) }
  assert(http.calls.length == 1, 'quota exhaustion ignored')
end
check(checks, 'redirects are not followed and credentials never reach another origin') do
  f, http = fetcher({GITHUB['source_url'] => response({}, 302, 'location' => 'http://169.254.169.254/secret')})
  rejects { f.fetch(GITHUB) }
  assert(http.calls.length == 1, 'redirect followed')
  rejects { f.request('https://evil.example/repos/owner/repo') }
end
check(checks, 'failed refresh preserves verified dates and checked_at without claiming new activity') do
  old = GITHUB.merge('created_at' => '2024-01-01T00:00:00Z', 'updated_at' => '2025-01-01T00:00:00Z', 'checked_at' => '2026-10-01T00:00:00Z', 'status' => 'ok')
  f, = fetcher({GITHUB['source_url'] => response({}, 404)})
  result = M.refresh({ 'one' => [GITHUB] }, { 'schema_version' => 1, 'projects' => { 'one' => { 'resources' => [old] } } }, fetcher: f)['projects']['one']['resources'].first
  assert(result['updated_at'] == old['updated_at'] && result['checked_at'] == old['checked_at'], 'old verification was advanced')
  assert(result['status'] == 'unavailable' && result['refresh_error'] == 'http_404', 'failure not explicit')
end
check(checks, 'offline refresh and unknown resources never fabricate dates or make HTTP requests') do
  f, http = fetcher({})
  result = M.refresh({ 'one' => [GITHUB] }, {}, fetcher: f, offline: true)['projects']['one']['resources'].first
  assert(http.calls.empty? && !result.key?('updated_at') && !result.key?('created_at'), 'offline source date invented')
end
check(checks, 'request budget is bounded and private repository metadata is rejected') do
  f, http = fetcher({ GITHUB['source_url'] => response(metadata) }, max_requests: 1)
  rejects { f.fetch(GITHUB) }; assert(http.calls.length == 1, 'request cap ignored')
  f, = fetcher({GITHUB['source_url'] => response(metadata.merge('private' => true))})
  rejects { f.fetch(GITHUB) }
end
check(checks, 'future or malformed source timestamps cannot become a new date') do
  assert(M.timestamp('2028-01-01T00:00:00Z', NOW).nil?, 'future activity accepted')
  assert(M.timestamp('2026-02-31T00:00:00Z', NOW).nil?, 'invalid calendar date accepted')
  assert(M.timestamp('2026-10', NOW).nil?, 'imprecise provider date promoted to timestamp')
end
check(checks, 'empty GitHub repos retain verified creation without inventing a commit') do
  f, = fetcher({GITHUB['source_url'] => response(metadata), GITHUB['source_url'] + '/commits?per_page=1' => response({}, 409)})
  result = f.fetch(GITHUB)
  assert(result['status'] == 'ok' && result['activity_status'] == 'empty' && !result.key?('updated_at'), 'empty repo got a synthetic last update')
end
check(checks, 'only configured merged PRs by the configured owner become contribution activity') do
  target = { 'url' => GITHUB['url'] + '/pull/26', 'source_url' => GITHUB['source_url'] + '/pulls/26', 'expected_author' => 'davidquicast' }
  f, = fetcher({target['source_url'] => response({ 'user' => { 'login' => 'davidquicast' }, 'merged_at' => '2025-02-20T10:11:12Z' })})
  result = f.fetch_contribution(target)
  assert(result['status'] == 'merged' && result['merged_at'] == '2025-02-20T10:11:12Z', 'merged contribution missing')
  f, = fetcher({target['source_url'] => response({ 'user' => { 'login' => 'someone-else' }, 'merged_at' => '2025-02-20T10:11:12Z' })})
  rejects { f.fetch_contribution(target) }
  f, = fetcher({target['source_url'] => response({ 'user' => { 'login' => 'davidquicast' }, 'merged_at' => nil })})
  rejects { f.fetch_contribution(target) }
  f, = fetcher({target['source_url'] => response({ 'user' => { 'login' => 'davidquicast' }, 'merged_at' => '2025-02-20T10:11:12Z', 'base' => { 'repo' => { 'private' => true } } })})
  rejects { f.fetch_contribution(target) }
end
check(checks, 'failed contribution refresh retains the original verified merge date') do
  target = { 'url' => GITHUB['url'] + '/pull/26', 'source_url' => GITHUB['source_url'] + '/pulls/26', 'expected_author' => 'davidquicast' }
  old = target.reject { |k, _| k == 'expected_author' }.merge('merged_at' => '2025-02-20T10:11:12Z', 'author' => 'davidquicast', 'checked_at' => '2026-10-01T00:00:00Z', 'status' => 'merged')
  f, = fetcher({target['source_url'] => response({}, 404)})
  result = M.refresh({ 'one' => [] }, { 'projects' => { 'one' => { 'contributions' => [old] } } }, fetcher: f, contributions: { 'one' => [target] })['projects']['one']['contributions'].first
  assert(result['merged_at'] == old['merged_at'] && result['checked_at'] == old['checked_at'] && result['status'] == 'unavailable', 'merge verification invented')
end
check(checks, 'manifest derives configured resource roots and own PRs while excluding unpublished samples') do
  Dir.mktmpdir do |root|
    FileUtils.mkdir_p(File.join(root, '_projects/en-us')); FileUtils.mkdir_p(File.join(root, '_data'))
    File.write(File.join(root, '_data/socials.yml'), "github_username: davidquicast\n")
    File.write(File.join(root, '_projects/en-us/project.md'), "---\npage_id: one\ngithub: https://github.com/owner/repo\ngithub_prs: [26]\nargilla_prs: [26]\n---\n")
    File.write(File.join(root, '_projects/en-us/private.md'), "---\npage_id: hidden\npublished: false\ngithub: https://github.com/owner/hidden\n---\n")
    assert(M.projects(root).keys == ['one'], 'unpublished source leaked')
    assert(M.contributions(root)['one'].length == 1, 'PR was duplicated')
    path = File.join(root, 'out/snapshot.json'); data = { 'schema_version' => 1, 'projects' => {} }
    M.write(path, data); assert(JSON.parse(File.read(path)) == data, 'atomic JSON write changed data')
    assert(Dir.glob(File.join(root, 'out/.activity-*')).empty?, 'temporary file retained')
  end
end
report = { 'passed' => checks.all? { |item| item['passed'] }, 'checks' => checks }
puts JSON.pretty_generate(report)
exit(report['passed'] ? 0 : 1)
