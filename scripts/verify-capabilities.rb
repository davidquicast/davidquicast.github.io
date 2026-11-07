#!/usr/bin/env ruby
# Builds an isolated fixture site; no private fixture is ever put into the public build.
require 'jekyll'
require 'yaml'
require 'json'
require 'date'
require 'fileutils'
require 'nokogiri'

ROOT = File.expand_path('..', __dir__)
WORK = File.join(ROOT, '.local/redesign/readcv-implementation/capability-fixture')
SOURCE = File.join(WORK, 'source')
DEST = File.join(WORK, 'site')
FileUtils.mkdir_p(WORK)
FileUtils.rm_rf([SOURCE, DEST])
FileUtils.mkdir_p(SOURCE)
%w[_plugins _includes _layouts _data].each do |directory|
  FileUtils.cp_r(File.join(ROOT, directory), File.join(SOURCE, directory))
end
%w[_pages/en-us _pages/zz _projects/en-us _projects/zz _posts/en-us assets/pdf].each do |directory|
  FileUtils.mkdir_p(File.join(SOURCE, directory))
end
config = YAML.safe_load(File.read(File.join(ROOT, '_config.yml')), permitted_classes: [Date, Time], aliases: true)
config.merge!('source' => SOURCE, 'destination' => DEST, 'url' => 'https://fixture.example',
  'baseurl' => '/fixture-base', 'languages' => %w[en-us zz], 'default_lang' => 'en-us',
  'parallel_localization' => false, 'show_language_switcher' => true, 'serve_schema_org' => true,
  'external_sources' => [], 'watch' => false, 'incremental' => false, 'quiet' => true)
config['third_party_libraries']['download'] = false
File.write(File.join(SOURCE, '_config.yml'), YAML.dump(config))
ui = { 'navigation' => { 'research' => 'Fixture research' },
       'date' => { 'long' => '{year}/{month}/{day}' },
       'test' => { 'escaped' => '</script><img src=x onerror=alert(1)>' } }
FileUtils.mkdir_p(File.join(SOURCE, '_data/zz'))
File.write(File.join(SOURCE, '_data/zz/ui.yml'), YAML.dump(ui))
File.write(File.join(SOURCE, '_data/zz/strings.yml'), YAML.dump('months' => { 'long' => { 'july' => 'FixtureJuly' } }))
File.write(File.join(SOURCE, 'assets/pdf/fixture.pdf'), "%PDF-1.4\n% Isolated fixture only.\n")
paper = { 'id' => 'fixture-paper', 'title' => 'A <verified> paper & title',
  'authors' => ['Fixture Author', 'Second Author'], 'year' => 2026,
  'venue' => 'Fixture Journal', 'doi' => 'https://doi.org/10.1234/fixture',
  'code' => 'https://github.com/fixture-owner/paper-code', 'url' => 'https://huggingface.co/papers/2601.12345',
  'pdf' => '/assets/pdf/fixture.pdf', 'selected' => true, 'altmetric' => true, 'dimensions' => true, 'abstract' => '<script>unsafe()</script> plain abstract' }
File.write(File.join(SOURCE, '_data/publications.yml'), YAML.dump('publications' => [paper]))
def write_page(relative, data, body)
  File.write(File.join(SOURCE, relative), "---\n#{YAML.dump(data).sub(/\A---\s*\n/, '')}---\n#{body}\n")
end
body = <<~LIQUID
  <h1>Fixture page</h1>
  <p id="localized-label">{{ 'navigation.research' | ui_label }}</p>
  <time id="localized-date">{{ '2026-07-03' | localized_date: 'long' }}</time>
  <a id="internal-link" href="{{ '/projects/fixture/' | relative_url }}">Fixture project</a>
LIQUID
write_page('_pages/en-us/fixture.md', { 'layout' => 'default', 'lang' => 'en-us', 'page_id' => 'fixture', 'permalink' => '/fixture/' }, body)
write_page('_pages/zz/fixture.md', { 'layout' => 'default', 'lang' => 'zz', 'page_id' => 'fixture', 'permalink' => '/example/' }, body)
write_page('_pages/en-us/fallback.md', { 'layout' => 'default', 'lang' => 'en-us', 'page_id' => 'fallback', 'permalink' => '/fallback/' }, '<h1>English fallback content</h1>')
write_page('_pages/en-us/research.md', { 'layout' => 'publications', 'lang' => 'en-us', 'page_id' => 'publications', 'title' => 'Research', 'permalink' => '/publications/' }, '')
write_page('_projects/en-us/fixture.md', { 'layout' => 'default', 'lang' => 'en-us', 'page_id' => 'fixture-project', 'title' => 'Fixture project', 'permalink' => '/projects/fixture/', 'github' => 'https://github.com/fixture-owner/fixture-repo', 'huggingface' => 'https://huggingface.co/datasets/fixture-owner/fixture-data' }, '<h1>Fixture project</h1>')
write_page('_projects/zz/fixture.md', { 'layout' => 'default', 'lang' => 'zz', 'page_id' => 'fixture-project', 'title' => 'Fixture alternate project', 'permalink' => '/projects/fixture/', 'github' => 'https://github.com/fixture-owner/fixture-repo', 'huggingface' => 'https://huggingface.co/datasets/fixture-owner/fixture-data' }, '<h1>Fixture alternate project</h1>')
write_page('_posts/en-us/2026-01-01-hidden.md', { 'layout' => 'default', 'lang' => 'en-us', 'title' => 'Private fixture draft', 'published' => false }, '<h1>Private fixture draft</h1>')
features = { 'layout' => 'default', 'lang' => 'en-us', 'page_id' => 'capabilities',
  'title' => 'Capability fixture', 'permalink' => '/capabilities/', 'tabs' => true,
  'math' => true, 'map' => true, 'code_diff' => true, 'pseudocode' => true,
  'typograms' => true, 'tikzjax' => true, 'pretty_table' => true,
  'mermaid' => { 'enabled' => true }, 'chart' => { 'chartjs' => true, 'echarts' => true, 'vega_lite' => true },
  'images' => { 'compare' => true, 'slider' => true, 'venobox' => true } }
write_page('_pages/en-us/capabilities.md', features, <<~LIQUID)
  <h1>Capability fixture</h1>
  {% tabs fixture %}
  {% tab fixture First %}First panel content{% endtab %}
  {% tab fixture Second %}Second panel content{% endtab %}
  {% endtabs %}
LIQUID
index_source = File.join(ROOT, '_pages/search-index.liquid')
FileUtils.cp(index_source, File.join(SOURCE, '_pages/search-index.liquid')) if File.file?(index_source)
ENV['JEKYLL_ENV'] = 'production'
fixture_site = Jekyll::Site.new(Jekyll.configuration(config))
Dir.chdir(ROOT) { fixture_site.process }
checks = []
def check(list, name)
  yield
  list << { 'check' => name, 'passed' => true }
rescue => error
  list << { 'check' => name, 'passed' => false, 'error' => error.message }
end
def assert(value, message)
  raise message unless value
end
def page(relative)
  Nokogiri::HTML(File.read(File.join(DEST, relative)))
end
check(checks, 'alternate locale, translated permalink and real canonical') do
  doc = page('zz/example/index.html')
  assert(doc.at_css('html')['lang'] == 'zz', 'alternate document lang')
  assert(doc.at_css('link[rel=canonical]')['href'] == 'https://fixture.example/fixture-base/zz/example/', 'localized canonical or duplicate prefix')
  assert(doc.at_css('#localized-label').text == 'Fixture research', 'UI label did not resolve active locale')
  assert(doc.at_css('#localized-date').text == '2026/FixtureJuly/3', 'date did not use locale data')
  assert(doc.at_css('#internal-link')['href'] == '/fixture-base/zz/projects/fixture/', 'internal link lost active locale')
end
check(checks, 'language menu switches between matching translated routes') do
  doc = page('zz/example/index.html')
  urls = doc.css('.language-switcher a').map { |a| a['href'] }
  assert(urls.sort == ['/fixture-base/fixture/', '/fixture-base/zz/example/'].sort, "wrong language URLs #{urls}")
  assert(doc.at_css('link[hreflang="en-US"]')['href'] == 'https://fixture.example/fixture-base/fixture/', 'English alternate wrong')
  assert(doc.at_css('link[hreflang="zz"]')['href'] == 'https://fixture.example/fixture-base/zz/example/', 'alternate language href wrong')
end
check(checks, 'fallback content keeps its actual source language') do
  doc = page('zz/fallback/index.html')
  assert(doc.at_css('html')['lang'] == 'en-US', 'fallback source language mislabeled')
  assert(doc.at_css('h1').text == 'English fallback content', 'fallback content missing')
end
check(checks, 'inert UI JSON merges defaults and escapes script boundaries') do
  doc = page('zz/example/index.html')
  element = doc.at_css('#portfolio-ui')
  data = JSON.parse(element.text)
  assert(data.dig('navigation', 'research') == 'Fixture research', 'override missing')
  assert(data.dig('navigation', 'projects') == 'Projects', 'default fallback missing')
  assert(data.dig('test', 'escaped').start_with?('</script>'), 'escaped value lost data')
  assert(doc.css('img[src=x]').empty?, 'UI JSON created HTML')
end
check(checks, 'Research renders real data safely and emits usable BibTeX') do
  doc = page('publications/index.html')
  assert(doc.at_css('.research-paper h3').text.strip == paper['title'], 'paper title changed or missing')
  assert(doc.at_css('.research-abstract').text.include?('<script>unsafe()</script>'), 'abstract was not escaped')
  assert(doc.css('.research-abstract script').empty?, 'abstract executed markup')
  assert(doc.at_css('.research-links a[href="https://doi.org/10.1234/fixture"]'), 'DOI canonical link missing')
  bib = File.read(File.join(DEST, 'assets/bib/fixture-paper.bib'))
  assert(bib.include?('Fixture Author and Second Author'), 'author order missing')
  assert(BibTeX.parse(bib).data.length == 1, 'downloaded bibliography does not parse')
  assert(!doc.text.include?('Einstein'), 'template bibliography leaked')
  detail = page('research/fixture-paper/index.html')
  assert(detail.css('.project-destinations-detail a').map { |link| link['href'] } == [paper['code'], paper['url']], 'generated paper detail lacks real branded actions')
  assert(detail.css('.project-destinations-detail a').map { |link| link.text.strip } == ['GitHub repository', 'Hugging Face publication'], 'paper detail invented resource types')
  [paper['code'], paper['url']].each do |url|
    assert(detail.css('a').count { |link| link['href'] == url } == 1, 'paper detail duplicated generic and branded resources')
  end
  assert(detail.at_css('a[href="https://doi.org/10.1234/fixture"]') && detail.at_css('a[href="/fixture-base/assets/pdf/fixture.pdf"]'), 'branded actions removed genuine DOI/PDF links')
  [false, true].each do |duplicate|
    raw = paper.merge('id' => 'ordinary-fixture', 'code' => 'https://example.org/code',
      'url' => duplicate ? 'https://example.org/code' : 'https://example.org/publication')
    ordinary = Portfolio::ResearchData.normalize(raw, source: SOURCE)
    ordinary['destinations'] = Portfolio::ProjectDestinations.build(ordinary, fields: %w[code url])
    ordinary['destination_fields'] = []
    document = Jekyll::PageWithoutAFile.new(fixture_site, SOURCE, '', "ordinary-paper-#{duplicate}.html")
    document.data = { 'layout' => 'paper', 'paper' => ordinary, 'title' => ordinary['title'], 'lang' => 'en-us' }
    document.content = ''
    rendered = Nokogiri::HTML(Jekyll::Renderer.new(fixture_site, document).run)
    assert(rendered.css('.project-destinations').empty?, 'ordinary paper source acquired an invented brand')
    [ordinary['code'], ordinary['url']].uniq.each do |url|
      assert(rendered.css('a').count { |link| link['href'] == url } == 1, 'ordinary publication/code link was lost or duplicated')
    end
  end
end
check(checks, 'native content tabs have useful anchors before JavaScript') do
  doc = page('capabilities/index.html')
  assert(doc.css('[data-tab-control]').length == 2, 'tab controls missing')
  doc.css('[data-tab-control]').each { |a| assert(doc.at_css(a['href']), 'tab links nowhere') }
  assert(doc.css('[data-tab-panel][hidden]').empty?, 'no-script content hidden')
end
check(checks, 'all advanced feature flags resolve conditional library resources') do
  doc = page('capabilities/index.html')
  payload = JSON.parse(doc.at_css('[data-optional-features]').text)
  %w[math mermaid chartjs echarts vega map diff pseudocode comparison slider table tabs typograms tikz media_overlay].each do |feature|
    assert(payload['features'].include?(feature), "missing feature #{feature}")
  end
  assert(!payload.to_json.include?('{{version}}'), 'unresolved third-party version')
  assert(!doc.to_html.include?('polyfill.io'), 'obsolete polyfill service loaded')
  assert(!page('fixture/index.html').at_css('[data-optional-features]'), 'ordinary page eagerly loads dormant features')
end
check(checks, 'opt-in JSON-LD identifies the real author, localized URL and document language') do
  doc = page('zz/example/index.html')
  graph = JSON.parse(doc.at_css('script[type="application/ld+json"]').text)['@graph']
  person = graph.find { |entry| entry['@type'] == 'Person' }
  document = graph.find { |entry| entry['@type'] == 'WebPage' }
  assert(person['name'] == 'David Quispe', 'structured author changed')
  assert(person['sameAs'].include?('https://github.com/davidquicast'), 'configured real profile missing')
  assert(document['url'] == 'https://fixture.example/fixture-base/zz/example/', 'structured URL lost active locale')
  assert(document['inLanguage'] == 'zz', 'structured document language wrong')
end
check(checks, 'Research search and explicitly requested DOI badges are wired without invented counts') do
  doc = page('publications/index.html')
  assert(doc.at_css('[data-research-search]'), 'bib_search control missing')
  assert(doc.at_css('.altmetric-embed')['data-doi'] == '10.1234/fixture', 'Altmetric DOI not connected')
  assert(doc.at_css('.__dimensions_badge_embed__')['data-doi'] == '10.1234/fixture', 'Dimensions DOI not connected')
  features = JSON.parse(doc.at_css('[data-optional-features]').text)['features']
  assert(features.include?('research') && features.include?('badges'), 'required optional hooks absent')
end
if File.file?(File.join(DEST, 'zz/search-index.json'))
  check(checks, 'alternate search index uses localized routes and excludes drafts') do
    data = JSON.parse(File.read(File.join(DEST, 'zz/search-index.json')))
    entries = data.is_a?(Array) ? data : data.fetch('items', [])
    assert(!entries.to_json.include?('Private fixture draft'), 'draft leaked into public search')
    project = entries.find { |entry| entry['title'].to_s.include?('Fixture alternate project') }
    assert(project, 'localized project not indexed')
    assert(project['url'] == '/fixture-base/zz/projects/fixture/', "localized search URL wrong #{project && project['url']}")
  end
end
# Render the real shared templates with alternate configuration, without another
# full build or adding these synthetic controls to the public portfolio.
fixture_site.active_lang = 'en-us'
fixture_site.config['active_lang'] = 'en-us'
def render_variant(site, layout, options = {}, body = '<p>Fixture content.</p>')
  # Jekyll caches parsed Liquid by document path; each synthetic body needs its own path.
  @control_fixture_sequence = (@control_fixture_sequence || 0) + 1
  document = Jekyll::PageWithoutAFile.new(site, SOURCE, '', "control-fixture-#{@control_fixture_sequence}.html")
  document.data = { 'layout' => layout, 'title' => 'Control fixture', 'url' => '/control-fixture/',
    'date' => Time.utc(2026, 7, 3), 'profile' => {} }.merge(options)
  document.content = body
  if layout == 'about'
    # The catalog is generated at build time; each flag variant must regenerate
    # from its matching home metadata rather than reuse an earlier snapshot.
    home = Jekyll::PageWithoutAFile.new(site, SOURCE, '', 'variant-home.html')
    home.data = document.data.merge('permalink' => '/')
    site.pages.unshift(home)
    begin
      Portfolio::ProfileFeedGenerator.new.generate(site)
    ensure
      site.pages.delete(home)
    end
  end
  Nokogiri::HTML(Jekyll::Renderer.new(site, document).run)
end
fixture_site.config['latest_posts'] = { 'enabled' => false, 'limit' => 1, 'scrollable' => true }
fixture_site.config['enable_navbar_social'] = false
fixture_site.config['enable_medium_zoom'] = false
check(checks, 'disabled writing and image zoom preserve the universal Work/About shell') do
  doc = render_variant(fixture_site, 'about', { 'latest_posts' => true })
  assert(doc.css('[data-feed-kind="writing"], a[href="#recent-writing"]').empty?, 'disabled writing still exposed catalog items or obsolete anchor')
  assert(fixture_site.data['profile_catalog']['counts']['writing'] == 0, 'global writing flag did not reach catalog generator')
  assert(doc.css('.rail-social').empty?, 'disabled navbar socials still exposed')
  assert(doc.at_css('body')['data-image-zoom'] == 'false', 'disabled zoom did not reach native controller')
end
# Documents are genuine Jekyll objects with production-style drops, but are not
# inserted into source/public output or indexed as owner content.
original_posts = fixture_site.posts.docs.dup
begin
  5.times do |index|
    post = Jekyll::Document.new(File.join(SOURCE, "_posts/en-us/2026-01-0#{index + 1}-control.md"),
      { :site => fixture_site, :collection => fixture_site.posts })
    post.data.merge!('title' => "Control post #{index + 1}", 'date' => Time.utc(2026, 1, index + 1),
      'description' => 'Isolated fixture description.', 'layout' => 'post', 'published' => true)
    post.data['slug'] = 'the-problem-with-a-persona-that-cannot-refuse' if index == 3
    post.content = 'Fixture body.'
    fixture_site.posts.docs << post
  end
  fixture_site.config['latest_posts'] = { 'enabled' => true, 'limit' => 4, 'scrollable' => true }
  fixture_site.config['enable_navbar_social'] = true
  fixture_site.config['enable_medium_zoom'] = true
  check(checks, 'All catalog retains complete content and marks selected records within four categories') do
    doc = render_variant(fixture_site, 'about', { 'latest_posts' => true, 'social' => true, 'selected_papers' => true,
      'profile' => { 'image' => 'fixture-portrait.png', 'align' => 'right', 'image_circular' => false, 'more_info' => '<p>Fixture profile detail.</p>' } })
    assert(doc.css('[data-feed-kind="writing"]').length == 5, 'configured limit incorrectly truncated the Writing catalog')
    assert(doc.css('[data-feed-kind="writing"][data-feed-featured="true"]').length == 4, 'latest_posts.limit did not bound Featured writing')
    assert(doc.at_css('[data-profile-feed]')['data-feed-writing-scroll'] == 'true', 'explicit Writing-view scroll flag missing')
    assert(doc.css('.wall-writing-group').empty?, 'scroll configuration recreated nested legacy writing cards')
    assert(doc.css('[data-feed-kind="writing"]').first.at_css('h2').text.strip == 'Control post 5', 'newly published post did not reach catalog')
    refusal_card = doc.css('[data-feed-kind="writing"]').find { |card| card.at_css('h2').text.strip == 'Control post 4' }
    refusal_cover = fixture_site.data.dig('blog_covers', 'the-problem-with-a-persona-that-cannot-refuse')
    refusal_image = refusal_card && refusal_card.at_css('.writing-image img')
    assert(refusal_cover && refusal_image && refusal_image['src'] == fixture_site.config['baseurl'] + refusal_cover['image'], 'configured refusal article cover is missing or uses the wrong source')
    assert(!refusal_card['class'].split.include?('wall-text-card'), 'covered article still has the text-only treatment')
    coverless_cards = doc.css('[data-feed-kind="writing"].wall-text-card')
    assert(coverless_cards.length == 4 && coverless_cards.all? { |card| card.css('.writing-image, .writing-image img').empty? && !card.at_css('h2 a')['href'].to_s.empty? }, 'articles without configured covers lost their readable text/link fallback or expose empty media')
    assert(doc.at_css('.profile-person-right .profile-avatar.profile-portrait-square')['src'] == '/fixture-base/assets/img/fixture-portrait.png', 'profile filename/align/shape flags ignored')
    assert(doc.at_css('.profile-sidebar .profile-more-info').text.include?('Fixture profile detail.'), 'profile extra information missing')
    assert(doc.css('.profile-sidebar .profile-social-link').length == fixture_site.data['profile_links'].length, 'real sidebar account connections missing')
    assert(doc.css('.profile-sidebar .profile-resources a').length == 1, 'profile resource CV link missing or duplicated')
    assert(doc.css('.identity-card').empty?, 'unified profile was incorrectly rendered as a feed tile')
    assert(doc.css('[data-feed-kind="paper"]').length == 1 && doc.at_css('[data-feed-kind="paper"]')['data-feed-featured'] == 'true', 'selected papers flag did not enable Featured paper')
    assert(doc.css('.paper-card .project-destinations-card a').map { |link| link['href'] } == [paper['code'], paper['url']], 'paper card omitted shared real GitHub/HF actions')
    catalog = fixture_site.data['profile_catalog']
    assert(doc.css('[data-feed-item]:not([data-feed-only-featured])').length == catalog['counts']['all'], 'rendered catalog and data counts diverged')
    assert(doc.at_css('[data-feed-count]').text.to_i == catalog['counts']['all'], 'All count does not match actual catalog data')
    assert(doc.at_css('[data-profile-feed]')['data-feed-default'] == 'all', 'default view is not the complete catalog')
    assert(doc.css('.feed-tabs [data-feed-view]').map { |button| button['data-feed-view'] } == %w[all projects blogs research], 'shell has missing or extra category tabs')
    assert(doc.at_css('.feed-tabs [data-feed-view="all"]')['aria-pressed'] == 'true', 'default All control is not selected')
    assert(doc.css('[data-feed-item][hidden]').empty? && doc.css('[data-feed-only-featured]').empty?, 'SSR catalog hid real records or duplicated spotlight')
    assert(doc.css('.featured-mark').length == catalog['counts']['featured'], 'selected metadata and visible marks diverged')
    doc.css('.profile-sidebar .profile-social-link').zip(fixture_site.data['profile_links']).each do |link, profile|
      assert(link.at_css('.profile-link-label').text.strip == profile['display'] && link['aria-label'] == profile['aria_label'], 'sidebar connection lost actual handle or platform accessibility')
    end
    profile_source = File.read(File.join(ROOT, '_pages/en-us/profile.md')).split(/^---\s*$\n?/, 3).last
    owner = Jekyll::PageWithoutAFile.new(fixture_site, SOURCE, '', 'owner-fixture.html')
    owner.data = { 'page_id' => 'about', 'social' => true, 'profile' => { 'more_info' => '<p>Full profile extra detail.</p>' } }
    owner.content = "## Fixture biography\n\nReal owner biography fixture."
    fixture_site.pages << owner
    begin
      full_profile = render_variant(fixture_site, 'page', {}, profile_source)
      assert(full_profile.at_css('[data-about-source]').text.include?('Real owner biography fixture.'), 'About reader lost the actual owner content')
      assert(full_profile.at_css('.about-reader-actions a[download]')['href'] == '/fixture-base/assets/pdf/en-us/cv.pdf', 'About reader lost native CV download')
      assert(full_profile.css('.main-navigation > a').map { |link| link.text.strip } == %w[Work About], 'About page changed universal navigation')
      assert(full_profile.text.include?('Full profile extra detail.'), 'full About page lost profile more_info')
      owner.data['social'] = false
      private_profile = render_variant(fixture_site, 'page', {}, profile_source)
      assert(private_profile.at_css('[data-about-source]').text.include?('Real owner biography fixture.'), 'profile social preference affected biography reading')
    ensure
      fixture_site.pages.delete(owner)
    end
    assert(doc.css('.main-navigation > a').map { |link| link.text.strip } == %w[Work About], 'home changed universal navigation')
    project_document = fixture_site.collections['projects'].docs.find { |item| item.data['page_id'] == 'fixture-project' }
    assert(project_document && project_document.data['destinations'].length == 2, 'project destination generator did not attach real source links')
    project_page = render_variant(fixture_site, 'project', project_document.data.merge('layout' => 'project', 'destinations' => project_document.data['destinations']), '<p>Real project body fixture.</p>')
    assert(project_page.css('.main-navigation > a').map { |link| link.text.strip } == %w[Work About], 'project detail changed universal navigation')
    assert(project_page.css('.project-destinations-detail a').map { |link| link['href'] } == project_document.data['destinations'].map { |item| item['url'] }, 'detail actions lost or invented authored project destinations')
    assert(project_page.css('.project-destinations-detail a').map { |link| link.text.strip } == ['GitHub repository', 'Hugging Face dataset'], 'detail actions lost contextual resource labels')
    assert(doc.at_css('body')['data-image-zoom'] == 'true', 'enabled zoom did not reach native controller')
  end
  fixture_site.config['latest_posts']['limit'] = 1
  fixture_site.config['latest_posts']['scrollable'] = false
  check(checks, 'writing availability, selected limits, research marks and profile opt-outs remain independent') do
    doc = render_variant(fixture_site, 'about', { 'latest_posts' => true, 'selected_papers' => false })
    assert(doc.css('[data-feed-kind="writing"]').length == 5, 'smaller Featured limit removed public Writing records')
    assert(doc.css('[data-feed-kind="writing"][data-feed-featured="true"]').length == 1, 'smaller Featured limit ignored')
    assert(doc.at_css('[data-profile-feed]')['data-feed-writing-scroll'] == 'false', 'scrollable false ignored')
    assert(doc.css('[data-feed-kind="paper"]').length == 1 && doc.at_css('[data-feed-kind="paper"]')['data-feed-featured'] == 'false', 'selected_papers false removed paper from catalog or left it Featured')
    hidden = render_variant(fixture_site, 'about', { 'latest_posts' => false })
    assert(hidden.css('[data-feed-kind="writing"]').empty?, 'page writing opt-out ignored')
    assert(fixture_site.data['profile_catalog']['counts']['writing'] == 0, 'page opt-out did not reach catalog generation')
    fixture_site.config['latest_posts']['limit'] = 3
    catalog_doc = render_variant(fixture_site, 'about', { 'latest_posts' => true })
    assert(catalog_doc.css('[data-feed-kind="writing"][data-feed-featured="true"]').length == 3, 'default Featured limit ignored')
    titles = catalog_doc.css('[data-feed-kind="writing"]').map { |item| item.at_css('h2').text.strip }
    assert(titles == ['Control post 5', 'Control post 4', 'Control post 3', 'Control post 2', 'Control post 1'], 'Writing catalog does not preserve newest public posts in order')
    remote = render_variant(fixture_site, 'about', { 'latest_posts' => false, 'social' => false,
      'profile' => { 'image' => 'https://fixture.example/portrait.png', 'image_circular' => true } })
    assert(remote.at_css('.profile-avatar')['src'] == 'https://fixture.example/portrait.png', 'remote profile URL prefixed incorrectly')
    assert(remote.css('.profile-avatar.profile-portrait-square, .profile-connections').empty?, 'profile shape/social opt-out ignored')
  end
  fixture_site.config['related_blog_posts'] = { 'enabled' => false, 'max_related' => 2 }
  check(checks, 'related writing obeys enabled, configured count and zero count') do
    assert(render_variant(fixture_site, 'post').css('.article-next').empty?, 'disabled related section present')
    fixture_site.config['related_blog_posts']['enabled'] = true
    assert(render_variant(fixture_site, 'post').css('.article-next .next-post').length == 2, 'related max_related ignored')
    fixture_site.config['related_blog_posts']['max_related'] = 0
    assert(render_variant(fixture_site, 'post').css('.article-next').empty?, 'zero related limit exposed empty section')
  end
  project_source = File.read(File.join(ROOT, '_pages/en-us/projects.md')).split(/^---\s*$\n?/, 3).last
  check(checks, 'project category flag hides only categories while preserving search and items') do
    fixture_site.config['enable_project_categories'] = false
    disabled = render_variant(fixture_site, 'default', {}, project_source)
    assert(disabled.css('.filter-options').empty?, 'disabled category fieldset present')
    assert(render_variant(fixture_site, 'about').css('[data-project-filters]').empty?, 'disabled ownership facets present on home')
    File.write(File.join(WORK, 'category-disabled-render.html'), disabled.to_html)
    assert(disabled.at_css('[data-search]') && disabled.at_css('.project-list'), 'disabled categories removed project search/list')
    fixture_site.config['enable_project_categories'] = true
    enabled = render_variant(fixture_site, 'default', {}, project_source)
    controls = enabled.css('.filter-options [data-filter]').map { |button| button['data-filter'] }
    assert(controls == %w[all independent contributions], 'enabled ownership controls missing')
    assert(enabled.at_css('select[data-project-topic]'), 'authored topic selector missing')
    assert(render_variant(fixture_site, 'about').at_css('[data-project-filters]'), 'enabled ownership facets missing on home')
    assert(disabled.at_css('select[data-project-topic]'), 'category opt-out removed independent topic filtering')
  end
ensure
  fixture_site.posts.docs.replace(original_posts)
end
report = { 'checks' => checks, 'passed' => checks.all? { |item| item['passed'] }, 'output' => DEST }
File.write(File.join(WORK, 'report.json'), JSON.pretty_generate(report))
puts JSON.pretty_generate(report)
exit(report['passed'] ? 0 : 1)
