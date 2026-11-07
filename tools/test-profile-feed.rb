#!/usr/bin/env ruby
# Pure feed contracts with isolated in-memory author records; never published.
require 'jekyll'
require 'json'
require_relative '../_plugins/profile-feed'

Record = Struct.new(:data, :url, :relative_path, :date)
Collection = Struct.new(:docs)
FixtureSite = Struct.new(:pages, :config, :collections, :posts, :data)
checks = []
def verify(checks, name)
  yield
  checks << { 'name' => name, 'passed' => true }
rescue => error
  checks << { 'name' => name, 'passed' => false, 'error' => error.message }
end
def assert(value, message)
  raise message unless value
end
def project(slug, year: 2025, importance: 1, **extra)
  Record.new({ 'slug' => slug, 'title' => "Project #{slug}", 'year' => year,
    'importance' => importance }.merge(extra.transform_keys(&:to_s)), "/projects/#{slug}/", "_projects/#{slug}.md", nil)
end
def post(slug, date: Time.utc(2026, 3, 1), **extra)
  Record.new({ 'title' => "Post #{slug}" }.merge(extra.transform_keys(&:to_s)), "/blog/#{slug}/", "_posts/#{slug}.md", date)
end
def prepare(**options)
  defaults = { projects: [], posts: [], papers: [], config: {}, latest_limit: 3 }
  Portfolio::ProfileFeed.prepare(**defaults.merge(options))
end
paper = { 'id' => 'paper-one', 'title' => 'Fixture paper', 'year' => 2024, 'selected' => true,
  'abstract' => 'Distinct abstract', 'venue' => 'Fixture venue', 'authors' => ['Author One', 'Author Two'] }

verify(checks, 'Year-only projects retain year precision and absent years remain unknown') do
  stamp, precision = Portfolio::ProfileFeed.timestamp(project('year-only', year: '2024'), 'project')
  assert(precision == 'year' && stamp == Time.utc(2024, 1, 1).to_i * 1000, 'year precision or sorting key changed')
  [nil, '', 'invalid', 1599, 10000].each do |year|
    assert(Portfolio::ProfileFeed.timestamp(project('unknown', year: year), 'project') == [0, 'year'], 'unknown date was invented')
  end
end
verify(checks, 'Explicit publication timestamps and YAML Time values preserve exact dates') do
  time = Time.utc(2026, 5, 3, 12, 30)
  [time.iso8601, time].each do |value|
    assert(Portfolio::ProfileFeed.timestamp(project('dated', published_at: value), 'project') == [time.to_i * 1000, 'day'], 'explicit date changed')
  end
  begin
    Portfolio::ProfileFeed.timestamp(project('bad', published_at: '2026'), 'project')
    raise 'invalid timestamp was accepted'
  rescue ArgumentError => error
    assert(error.message.include?('ISO 8601'), 'invalid date lacks actionable error')
  end
end
verify(checks, 'Selected-first recommended ranks are consecutive and retain all content with truthful counts') do
  result = prepare(projects: [project('b'), project('a')], posts: [post('one'), post('two')], papers: [paper])
  assert(result['items'].map { |item| item['rank'] } == (0...5).to_a, 'rank gaps or duplicate ranks')
  assert(result['items'].map { |item| item['kind'] } == %w[paper writing writing project project], 'selected-first priority did not preserve stable order within priority groups')
  assert(result['counts'].slice('all', 'projects', 'writing', 'papers') == { 'all' => 5, 'projects' => 2, 'writing' => 2, 'papers' => 1 }, 'counts do not match data')
  assert(result['items'].map { |item| item['id'] }.uniq.length == 5, 'records duplicated')
end
verify(checks, 'Equal-date writing and equal-priority projects have reproducible URL tie ranks') do
  projects = [project('b'), project('a')]
  posts = [post('b'), post('a')]
  forward = prepare(projects: projects, posts: posts)['items'].map { |item| item['id'] }
  backward = prepare(projects: projects.reverse, posts: posts.reverse)['items'].map { |item| item['id'] }
  assert(forward == backward, 'input traversal order changed tied ranks')
end
verify(checks, 'Current and author-selected projects are marked once within the complete All catalog') do
  result = prepare(projects: [project('older', importance: 1), project('selected', importance: 9), project('spotlight', year: 2023, description: 'First spotlight detail'), project('spotlight-two', year: 2028), project('other')],
    config: { 'featured_projects' => %w[selected older spotlight], 'spotlight_projects' => %w[missing spotlight spotlight-two spotlight] })
  assert(result['counts']['all'] == 5 && result['counts']['featured'] == 4, 'curation dropped or duplicated projects')
  assert(result['spotlight'] == true, 'real spotlight not detected')
  assert(result['spotlight_items'].map(&:url) == ['/projects/spotlight/', '/projects/spotlight-two/'], 'spotlight lost configured order, repeated entries or included missing records')
  assert(result['items'].first(2).map { |item| item['source'].url } == ['/projects/spotlight/', '/projects/spotlight-two/'], 'All hid current work behind selected project records')
  assert(result['spotlight_search'].include?('First spotlight detail') && !result['spotlight_search'].include?('missing'), 'spotlight search does not match actual project data')
  assert(result['spotlight_date'] == Time.utc(2028, 1, 1).to_i * 1000, 'spotlight sort date does not match newest actual project precision')
  assert(result['items'].find { |item| item['source'].data['slug'] == 'selected' }['featured'], 'selected project not featured')
  assert(result['items'].select { |item| item['featured'] }.map { |item| item['source'].data['slug'] } == %w[spotlight spotlight-two selected older], 'current/author selection order was replaced by project importance')
  assert(prepare(projects: [project('other')], config: { 'spotlight_projects' => ['missing'] })['spotlight'] == false, 'missing spotlight invented')
end
verify(checks, 'Latest writing limit affects Featured while all public writing remains available') do
  posts = (1..5).map { |day| post(day.to_s, date: Time.utc(2026, 3, day)) }
  result = prepare(posts: posts, latest_limit: 3)
  writing = result['items'].select { |item| item['kind'] == 'writing' }
  assert(writing.length == 5 && writing.count { |item| item['featured'] } == 3, 'latest limit truncated All or ignored Featured')
  assert(writing.first(3).map { |item| item['source'].url } == ['/blog/5/', '/blog/4/', '/blog/3/'], 'latest dates do not lead Featured')
end
verify(checks, 'An explicit older featured post is retained without deleting unselected writing') do
  result = prepare(posts: [post('older', date: Time.utc(2020, 1, 1), featured: true), post('newer')], latest_limit: 0)
  assert(result['counts']['writing'] == 2 && result['counts']['featured'] == 1, 'explicit author selection or full writing lost')
  assert(result['items'].map { |item| item['source'].url } == ['/blog/older/', '/blog/newer/'], 'selected-first recommended ordering did not retain explicit author choice')
end
verify(checks, 'Selected papers flag controls Featured while all genuine papers remain in Papers') do
  unselected = paper.merge('id' => 'paper-two', 'selected' => false)
  enabled = prepare(papers: [paper, unselected], selected_papers: true)
  disabled = prepare(papers: [paper, unselected], selected_papers: false)
  assert(enabled['counts']['papers'] == 2 && disabled['counts']['papers'] == 2, 'selection flag removed papers')
  assert(enabled['counts']['featured'] == 1 && disabled['counts']['featured'] == 0, 'selected papers gate ignored')
end
verify(checks, 'Search metadata includes supplied tags, authors, venue and abstract') do
  result = prepare(papers: [paper], posts: [post('tagged', tags: %w[safety systems])])
  text = result['items'].map { |item| item['search'] }.join(' ')
  ['Author One', 'Author Two', 'Fixture venue', 'Distinct abstract', 'safety', 'systems'].each do |term|
    assert(text.include?(term), "search metadata lost #{term}")
  end
end
verify(checks, 'Generator applies global/page writing flags and paper selection independently') do
  [false, true].product([false, true]).each do |enabled, page_writing|
    home = Record.new({ 'layout' => 'about', 'latest_posts' => page_writing, 'selected_papers' => false }, '/', '', nil)
    site = FixtureSite.new([home], { 'latest_posts' => { 'enabled' => enabled, 'limit' => 1 } },
      { 'projects' => Collection.new([project('one')]) }, Collection.new([post('one')]),
      { 'research' => { 'publications' => [paper] } })
    Portfolio::ProfileFeedGenerator.new.generate(site)
    result = site.data.fetch('profile_catalog')
    assert(result['counts']['writing'] == (enabled && page_writing ? 1 : 0), 'writing gate ignored')
    assert(result['counts']['papers'] == 1 && !result['items'].find { |item| item['kind'] == 'paper' }['featured'], 'paper flag dropped paper or left it Featured')
  end
end
verify(checks, 'Generator excludes source drafts and negative latest limit selects all public writing') do
  home = Record.new({ 'layout' => 'about', 'latest_posts' => true, 'selected_papers' => true }, '/', '', nil)
  site = FixtureSite.new([home], { 'latest_posts' => { 'enabled' => true, 'limit' => -1 } },
    { 'projects' => Collection.new([project('public'), project('draft', published: false)]) },
    Collection.new([post('one'), post('two'), post('draft', published: false)]), { 'research' => { 'publications' => [paper] } })
  Portfolio::ProfileFeedGenerator.new.generate(site)
  result = site.data.fetch('profile_catalog')
  assert(result['counts']['all'] == 4 && result['counts']['projects'] == 1 && result['counts']['writing'] == 2, 'draft leaked or public content lost')
  assert(result['counts']['featured'] == 3, 'negative latest limit or paper selection ignored')
end
verify(checks, 'Empty catalog has truthful zero counts and no spotlight') do
  result = prepare
  assert(result['items'].empty? && result['counts'].values.all?(&:zero?) && result['spotlight'] == false, 'empty feed fabricated content')
end
verify(checks, 'Project membership follows authored categories without guessing repository ownership') do
  owned = project('own', category: 'personal', github: 'https://github.com/another-org/example')
  contribution = project('contribution', category: 'collaborations', github: 'https://github.com/davidquicast/own-pipeline')
  unknown = project('unclassified', category: 'future-category', github: 'https://github.com/davidquicast/example')
  result = prepare(projects: [owned, contribution, unknown], posts: [post('article', category: 'personal')])
  membership = result['items'].to_h { |item| [item['source'].url, item['project_type']] }
  assert(membership[owned.url] == 'independent', 'repository owner replaced explicit personal category')
  assert(membership[contribution.url] == 'contributions', 'author-hosted collaboration was incorrectly claimed as personal work')
  assert(membership[unknown.url] == '' && membership['/blog/article/'] == '', 'unknown category or article received invented project membership')
  assert(result['counts'].slice('independent', 'contributions', 'unclassified_projects') == { 'independent' => 1, 'contributions' => 1, 'unclassified_projects' => 1 }, 'ownership counts omit unknown or mixed records')
  assert(result['counts']['all'] == 4 && result['items'].map { |item| item['id'] }.uniq.size == 4, 'ownership metadata removed or duplicated source records')
  assert(result['items'].find { |item| item['source'].url == contribution.url }['search'].include?('contributions'), 'membership is not discoverable through search')
end
verify(checks, 'Archive Liquid membership uses the same source category and rejects unknown categories') do
  expected = { 'personal' => 'independent', '  PERSONAL  ' => 'independent', 'collaborations' => 'contributions',
    nil => '', '' => '', 'work' => '', 'personal-contribution' => '', ['personal'] => '' }
  template = Liquid::Template.parse('{{ category | profile_project_type }}')
  expected.each do |category, membership|
    assert(template.render!('category' => category) == membership, "archive membership changed for #{category.inspect}")
  end
end
verify(checks, 'Actual published project metadata retains its personal and contribution distinctions') do
  records = Dir.glob(File.expand_path('../_projects/en-us/*.md', __dir__)).filter_map do |path|
    data = YAML.safe_load(File.read(path).split(/^---\s*$\n?/, 3)[1], permitted_classes: [Date, Time], aliases: true)
    next if data['published'] == false
    slug = File.basename(path, '.md')
    Record.new(data, "/projects/#{slug}/", path, nil)
  end
  assert(!records.empty?, 'actual project source was not read')
  expected_personal = records.count { |record| record.data['category'] == 'personal' }
  expected_contributions = records.count { |record| record.data['category'] == 'collaborations' }
  result = prepare(projects: records)
  assert(expected_personal.positive? && expected_contributions.positive?, 'one of the original source groupings disappeared')
  assert(result['counts']['independent'] == expected_personal && result['counts']['contributions'] == expected_contributions, 'feed counts disagree with actual authored categories')
  assert(result['counts']['all'] == records.size, 'source categorization dropped projects')
  sorry_bench = result['items'].find { |item| item['source'].url == '/projects/mcdaqc_16_sorry_bench_multilingual/' }
  assert(sorry_bench && sorry_bench['project_type'] == 'contributions', 'Cohere Labs contribution was not retained in Contributions')
end
verify(checks, 'Research month and day precision sort deterministically without inventing a displayed day') do
  month = Portfolio::ProfileFeed.timestamp({ 'year' => 2026, 'published_at' => '2026-10' }, 'paper')
  day = Portfolio::ProfileFeed.timestamp({ 'year' => 2026, 'published_at' => '2026-10-21' }, 'paper')
  assert(month == [Time.utc(2026, 10, 1).to_i * 1000, 'month'], 'month sorting key or precision changed')
  assert(day == [Time.utc(2026, 10, 21).to_i * 1000, 'day'], 'calendar date sorting key changed')
end
verify(checks, 'Research relationships retain independent counts and explicit featured order') do
  pending = { 'id' => 'pending', 'year' => 2026, 'title' => 'Pending', 'selected' => true, 'relationship' => 'coauthor' }
  confirmed = pending.merge('id' => 'confirmed', 'title' => 'Confirmed')
  cited = pending.merge('id' => 'cited', 'title' => 'Cited', 'selected' => false, 'relationship' => 'cited_work')
  result = prepare(papers: [pending, cited, confirmed], config: { 'featured_papers' => %w[confirmed pending] })
  assert(result['counts']['papers'] == 3 && result['counts']['coauthored_papers'] == 2 && result['counts']['cited_work'] == 1, 'citations became authored publications')
  assert(result['items'].map { |item| item['source']['id'] } == %w[confirmed pending cited], 'explicit featured research order lost')
end
report = { 'passed' => checks.all? { |check| check['passed'] }, 'checks' => checks }
puts JSON.pretty_generate(report)
exit(report['passed'] ? 0 : 1)
