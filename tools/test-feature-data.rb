#!/usr/bin/env ruby
require 'jekyll'
require 'json'
require 'tmpdir'
require 'fileutils'
require 'stringio'
require 'nokogiri'
require 'yaml'
require_relative '../_plugins/google-scholar-citations'
require_relative '../_plugins/inspirehep-citations'
require_relative '../_plugins/research-data'
require_relative '../_plugins/profile-links'
require_relative '../_plugins/project-destinations'
require_relative '../_plugins/portfolio-localization'
require_relative '../_plugins/localization-exists'

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
def rejects
  yield
  raise 'Invalid data was accepted'
rescue ArgumentError
  true
end
Dir.mktmpdir('portfolio-data-fixture-') do |source|
  record = { 'id' => 'real-paper', 'title' => 'A {safe} paper', 'authors' => ['First Author', 'Second Author'], 'year' => 2026 }
  normalize = ->(data) { Portfolio::ResearchData.normalize(data, source: source) }
  verify(checks, 'Research preserves ordered authors and BibTeX delimiters') do
    paper = normalize.call(record)
    assert(paper['authors'] == ['First Author', 'Second Author'], 'authors changed')
    assert(paper['bibtex'].include?('First Author and Second Author'), 'BibTeX author order wrong')
    assert(paper['bibtex'].include?('\{safe\}'), 'literal braces were not escaped')
  end
  verify(checks, 'Research rejects script URLs and URL userinfo') do
    rejects { normalize.call(record.merge('url' => 'javascript:alert(1)')) }
    rejects { normalize.call(record.merge('pdf' => 'https://username:password@example.org/paper.pdf')) }
    rejects { normalize.call(record.merge('code' => '//example.org/source')) }
  end
  verify(checks, 'Research rejects missing authors, bad year and unsafe identifiers') do
    rejects { normalize.call(record.merge('authors' => [])) }
    rejects { normalize.call(record.merge('year' => '2026')) }
    rejects { normalize.call(record.merge('id' => '../../private')) }
    rejects { normalize.call(record.merge('authors' => [''])) }
  end
  verify(checks, 'Research rejects duplicate publication anchors') do
    rejects { Portfolio::ResearchData.prepare({ 'publications' => [record, record] }, source: source) }
  end
  verify(checks, 'Research canonicalizes DOI URLs and escapes path fragments') do
    paper = normalize.call(record.merge('doi' => 'https://doi.org/10.1234/part#fragment'))
    assert(paper['doi_url'] == 'https://doi.org/10.1234/part%23fragment', 'DOI fragment escaped incorrectly')
    rejects { normalize.call(record.merge('doi' => 'a fake DOI')) }
  end
  verify(checks, 'Research local files cannot traverse or escape through symlinks') do
    FileUtils.mkdir_p(File.join(source, 'assets'))
    File.write(File.join(source, 'assets/paper.pdf'), '%PDF-fixture')
    assert(normalize.call(record.merge('pdf' => '/assets/paper.pdf'))['pdf'] == '/assets/paper.pdf', 'valid local PDF failed')
    rejects { normalize.call(record.merge('pdf' => '/assets/../private.pdf')) }
    Dir.mktmpdir('portfolio-external-fixture-') do |outside|
      File.write(File.join(outside, 'secret.pdf'), 'private fixture')
      File.symlink(File.join(outside, 'secret.pdf'), File.join(source, 'assets/escape.pdf'))
      rejects { normalize.call(record.merge('pdf' => '/assets/escape.pdf')) }
    end
  end
  verify(checks, 'All template profile identifier mappings produce native HTTP links') do
    Portfolio::ProfileLinks::PREFIXES.each do |key, (_name, prefix)|
      value = key == 'openreview_id' ? '~Fixture_User1' : 'a b/?&'
      result = Portfolio::ProfileLinks.build({ key => value }, source: source)
      assert(result.length == 1, "missing #{key}")
      assert(result.first['url'].start_with?(prefix), "wrong prefix #{key}")
      assert(result.first['url'].include?('%2F%3F%26'), "identifier was not escaped #{key}") unless key == 'openreview_id'
    end
  end
  verify(checks, 'Unconfigured, malformed and unsafe profile URLs stay absent') do
    links = Portfolio::ProfileLinks.build({ 'github_username' => false, 'orcid_id' => nil,
      'work_url' => 'javascript:alert(1)', 'custom_social' => { 'title' => 'Unsafe', 'url' => 'data:text/html,test' } }, source: source)
    assert(links.empty?, 'unsafe or unconfigured profile was rendered')
  end
  verify(checks, 'Configured email, custom profile, QR and RSS preserve real targets') do
    FileUtils.mkdir_p(File.join(source, 'assets/img'))
    File.write(File.join(source, 'assets/img/qr.png'), 'fixture')
    links = Portfolio::ProfileLinks.build({ 'email' => 'david+research@example.org',
      'custom_social' => { 'title' => 'Custom', 'url' => 'https://example.org/profile' },
      'wechat_qr' => 'qr.png' }, source: source, baseurl: '/base', feed: true)
    assert(links.find { |x| x['id'] == 'email' }['url'] == 'mailto:david%2Bresearch@example.org', 'email target incorrect')
    assert(links.find { |x| x['id'] == 'rss' }['url'] == '/base/feed.xml', 'feed baseurl incorrect')
    assert(links.find { |x| x['id'] == 'wechat_qr' }['url'] == '/base/assets/img/qr.png', 'QR target incorrect')
    assert(links.find { |x| x['id'] == 'custom-0' }['url'] == 'https://example.org/profile', 'custom target incorrect')
  end
  verify(checks, 'Configured platform marks use exact local brands and unknown custom logos fail closed') do
    profiles = Portfolio::ProfileLinks.build({ 'email' => 'owner@example.org', 'github_username' => 'owner',
      'linkedin_username' => 'owner', 'x_username' => 'owner',
      'custom_social' => { 'title' => 'Hugging Face', 'url' => 'https://huggingface.co/owner', 'logo' => 'https://example.org/icon.svg' } }, source: source, feed: true)
    assert(profiles.map { |profile| profile['icon'] } == %w[email github linkedin x huggingface rss], 'real platform icon metadata incorrect')
    %w[javascript:alert(1) data:image/svg+xml,test //example.org/icon.svg https://user:secret@example.org/icon.svg ../secret.svg].each do |logo|
      assert(Portfolio::ProfileLinks.safe_logo(logo, source: source).nil?, "unsafe custom image accepted #{logo}")
    end
    assert(Portfolio::ProfileLinks.safe_logo('/assets/img/qr.png', source: source, baseurl: '/base') == '/base/assets/img/qr.png', 'local custom logo lost baseurl')
    assert(Portfolio::ProfileLinks.safe_logo('https://example.org/icon.svg', source: source) == 'https://example.org/icon.svg', 'HTTPS owner logo rejected')
    Dir.mktmpdir('portfolio-logo-outside-') do |outside|
      File.write(File.join(outside, 'private.svg'), '<svg/>')
      File.symlink(File.join(outside, 'private.svg'), File.join(source, 'assets/img/escaped.svg'))
      assert(Portfolio::ProfileLinks.safe_logo('escaped.svg', source: source).nil?, 'custom image symlink escaped source')
    end
  end
  verify(checks, 'Compact and full profile links retain visible names, correct targets and decorative brand SVGs') do
    includes = File.join(source, '_includes')
    FileUtils.mkdir_p(includes)
    %w[profile-links.liquid profile-link.liquid brand-icon.liquid].each do |file|
      FileUtils.cp(File.expand_path('../_includes/' + file, __dir__), includes)
    end
    site = Jekyll::Site.new(Jekyll.configuration('source' => source, 'destination' => File.join(source, 'output'),
      'default_lang' => 'en-us', 'languages' => ['en-us'], 'quiet' => true, 'plugins' => []))
    real_socials = YAML.safe_load(File.read(File.expand_path('../_data/socials.yml', __dir__)))
    profiles = Portfolio::ProfileLinks.build(real_socials, source: source, feed: true)
    site.data['profile_links'] = profiles
    notice = File.read(File.expand_path('../assets/brand-icons-NOTICE.txt', __dir__))
    assert(notice.include?('CC0 1.0') && notice.include?('CC BY 4.0') && notice.include?('Font Awesome Free 6.7.2'), 'public brand license notice incomplete')
    [true, false].each do |compact|
      document = Jekyll::PageWithoutAFile.new(site, source, '', "brand-fixture-#{compact}.html")
      document.content = "{% include profile-links.liquid compact=#{compact} %}"
      document.data = {}
      html = Nokogiri::HTML(Jekyll::Renderer.new(site, document).run)
      assert(html.css('.profile-social-link').length == profiles.length, 'profile link dropped during rendering')
      assert(!html.css('.profile-social-links').empty? == compact, 'compact class does not match requested mode')
      html.css('.profile-social-link').zip(profiles).each do |link, profile|
        assert(link['href'] == profile['url'] && link['aria-label'] == profile['aria_label'], 'profile target/name changed')
        assert(link.at_css('.profile-link-label').text.strip == profile['display'], 'visible platform name missing')
        assert(link.at_css('[data-brand][width="20"][height="20"][aria-hidden="true"][focusable="false"]'), "exact decorative brand SVG missing #{profile['label']}")
      end
      assert(html.css('img').all? { |image| ['/assets/icons/huggingface-color.svg', '/assets/icons/openreview.png'].include?(image['src']) }, 'recognized platforms requested a remote logo image')
      assert(html.css('script').empty?, 'brand include introduced executable markup')
      assert(html.to_html.include?('/assets/brand-icons-NOTICE.txt'), 'public icon attribution reference missing')
    end
  end
  verify(checks, 'Connections show actual handles or email and extensible custom labels never invent usernames') do
    real_socials = YAML.safe_load(File.read(File.expand_path('../_data/socials.yml', __dir__)))
    links = Portfolio::ProfileLinks.build(real_socials, source: source, feed: true)
    assert(links.find { |link| link['id'] == 'email' }['display'] == real_socials['email'], 'email visible text was replaced by platform name')
    %w[github_username linkedin_username x_username].each do |key|
      assert(links.find { |link| link['id'] == key }['display'] == '@' + real_socials[key], "real handle missing #{key}")
    end
    assert(links.find { |link| link['icon'] == 'huggingface' }['display'] == '@davidquicast', 'Hugging Face profile URL did not supply actual account handle')
    custom = Portfolio::ProfileLinks.build({ 'custom_social' => [
      { 'label' => 'Research network', 'url' => 'https://example.org/profile', 'username' => 'researcher' },
      { 'title' => 'Archive', 'url' => 'https://example.org/records/42' },
      { 'title' => 'HF resource', 'url' => 'https://huggingface.co/spaces/owner/demo' },
      { 'title' => 'Safe fallback', 'url' => 'https://example.org/profile', 'handle' => '<script>unsafe</script>' }
    ] }, source: source)
    assert(custom.map { |link| link['display'] } == ['@researcher', 'Archive', 'HF resource', 'Safe fallback'], 'custom account handle was invented or unsafe input rendered')
    assert(custom.first['aria_label'] == 'Research network: @researcher', 'accessible platform and handle label missing')
  end
  verify(checks, 'Project destinations derive only real verified hosts and deduplicate authored resources') do
    data = { 'github' => 'https://github.com/owner/repo', 'huggingface' => 'https://huggingface.co/datasets/owner/data',
      'redirect' => 'https://unrelated.example/product', 'project_items' => [
        { 'url' => 'https://www.github.com/owner/repo/#readme' },
        { 'url' => 'https://huggingface.co/spaces/owner/demo' },
        { 'url' => 'https://github.com.evil.example/owner/repo' },
        { 'url' => 'javascript:alert(1)' }, { 'url' => 'https://user:secret@github.com/owner/repo' },
        { 'url' => 'https://github.com:8443/owner/repo' }
      ] }
    destinations = Portfolio::ProjectDestinations.build(data)
    assert(destinations.length == 3, 'unrelated, unsafe or duplicate project destination exposed')
    assert(destinations.map { |item| item['url'] } == [data['github'], data['huggingface'], data['project_items'][1]['url']], 'destination href was invented or changed')
    assert(destinations.map { |item| item['detail_label'] } == ['GitHub repository', 'Hugging Face dataset', 'Hugging Face space'], 'resource label does not follow real route')
    assert(Portfolio::ProjectDestinations.build({}).empty?, 'missing destinations created a false action')
    publication = Portfolio::ProjectDestinations.destination('https://huggingface.co/papers/2601.12345')
    assert(publication['detail_label'] == 'Hugging Face publication', 'HF publication was mislabeled as a model')
    assert(Portfolio::ProjectDestinations.destination('https://huggingface.co/docs/transformers')['detail_label'] == 'Hugging Face', 'unknown resource received an invented model/profile label')
    document = Struct.new(:data).new(data.dup)
    fixture_site = Struct.new(:collections, :data).new({ 'projects' => Struct.new(:docs).new([document]) }, {})
    Portfolio::ProjectDestinationsGenerator.new.generate(fixture_site)
    assert(document.data['destinations'] == destinations && document.data['github'] == data['github'], 'generator did not attach destinations or altered authored metadata')
  end
  verify(checks, 'Project destination card and detail controls use colored brands with safe working anchors') do
    FileUtils.cp(File.expand_path('../_includes/project-destinations.liquid', __dir__), File.join(source, '_includes/project-destinations.liquid'))
    site = Jekyll::Site.new(Jekyll.configuration('source' => source, 'destination' => File.join(source, 'output'),
      'default_lang' => 'en-us', 'languages' => ['en-us'], 'quiet' => true, 'plugins' => []))
    item = { 'title' => 'A <safe> project', 'destinations' => Portfolio::ProjectDestinations.build(
      { 'github' => 'https://github.com/owner/repo', 'huggingface' => 'https://huggingface.co/owner/model' }) }
    site.data['fixture_project'] = item
    %w[card detail].each do |context|
      document = Jekyll::PageWithoutAFile.new(site, source, '', "destination-fixture-#{context}.html")
      document.content = "{% include project-destinations.liquid project=site.data.fixture_project context='#{context}' %}"
      document.data = {}
      html = Nokogiri::HTML(Jekyll::Renderer.new(site, document).run)
      assert(html.css('a.project-destination').length == 2, 'real project actions missing')
      assert(html.css('script').empty?, 'project title executed HTML')
      assert(html.at_css('[data-brand="github"] svg')['style'].include?('--brand-color'), 'colored mode not requested for project brand')
      assert(html.at_css('img[data-brand="huggingface"]')['src'] == '/assets/icons/huggingface-color.svg', 'official local HF logo missing')
      if context == 'detail'
        assert(html.at_css('a.project-destination span').text.strip == 'GitHub repository', 'detail label lost resource meaning')
      else
        assert(html.at_css('a.project-destination span').text.strip == 'GitHub', 'card action is not compact')
      end
    end
  end
  verify(checks, 'Normalized papers share branded destinations with generated pages without duplicate generic links') do
    normalized = Portfolio::ResearchData.normalize(record.merge(
      'code' => 'https://github.com/owner/paper-code',
      'url' => 'https://huggingface.co/papers/2601.12345'), source: source)
    fixture_site = Struct.new(:collections, :data).new({}, { 'research' => { 'publications' => [normalized] } })
    page_paper_reference = normalized
    Portfolio::ProjectDestinationsGenerator.new.generate(fixture_site)
    assert(page_paper_reference['destinations'].map { |item| item['detail_label'] } == ['GitHub repository', 'Hugging Face publication'], 'normalized paper or shared page hash did not receive real resource actions')
    assert(normalized['destination_fields'] == %w[code url], 'handled generic fields not recorded for deduplication')
    duplicate = Portfolio::ResearchData.normalize(record.merge(
      'code' => 'https://github.com/owner/paper-code', 'url' => 'https://www.github.com/owner/paper-code/#readme'), source: source)
    fixture_site.data['research']['publications'] = [duplicate]
    Portfolio::ProjectDestinationsGenerator.new.generate(fixture_site)
    assert(duplicate['destinations'].length == 1 && duplicate['destination_fields'] == %w[code url], 'duplicate branded paper resources were retained as separate actions')
    ordinary = Portfolio::ResearchData.normalize(record.merge('code' => 'https://example.org/code', 'url' => 'https://example.org/publication'), source: source)
    fixture_site.data['research']['publications'] = [ordinary]
    Portfolio::ProjectDestinationsGenerator.new.generate(fixture_site)
    assert(ordinary['destinations'].empty? && ordinary['destination_fields'].empty?, 'ordinary publication/code URL was replaced by an invented brand')
  end
end
verify(checks, 'Missing localization data returns false rather than raising') do
  site = Struct.new(:config, :data, :active_lang).new({ 'default_lang' => 'en-us', 'languages' => ['en-us'] }, {}, 'zz')
  rendered = Liquid::Template.parse('{% localization_exists missing.key %}').render({}, registers: { site: site })
  assert(rendered == 'false', 'missing locale result incorrect')
end

verify(checks, 'Scholar unavailable metadata stays N/A and author-specific cache remains distinct') do
  original = URI.method(:open)
  calls = []
  URI.define_singleton_method(:open) do |url, *args, **options|
    calls << [url, options]
    html = calls.length == 1 ? '<meta name="description" content="No citation count here">' : '<meta name="description" content="Cited by 25">'
    StringIO.new(html)
  end
  Jekyll::GoogleScholarCitationsTag::Citations.clear
  template = Liquid::Template.parse('{% google_scholar_citations author article %}')
  assert(template.render('author' => 'first-author', 'article' => 'same-paper') == 'N/A', 'missing metadata invented zero')
  assert(template.render('author' => 'second-author', 'article' => 'same-paper') == '25', 'cross-author cache collision')
  assert(calls.length == 2 && calls.all? { |_url, options| options[:open_timeout] == 5 && options[:read_timeout] == 5 }, 'HTTP timeout contract missing')
ensure
  URI.define_singleton_method(:open, original) if original
end
verify(checks, 'Invalid Scholar identifiers never make an HTTP request') do
  original = URI.method(:open)
  URI.define_singleton_method(:open) { |*_args| raise 'Network should not be called' }
  value = Liquid::Template.parse('{% google_scholar_citations author article %}').render('author' => 'bad&user', 'article' => 'paper')
  assert(value == 'N/A', 'invalid ID did not fail closed')
ensure
  URI.define_singleton_method(:open, original) if original
end
verify(checks, 'INSPIRE distinguishes empty results from a real zero and bounds HTTP') do
  original = Net::HTTP.method(:start)
  calls = []
  response = Net::HTTPOK.new('1.1', '200', 'OK')
  response.instance_variable_set(:@read, true) # A fully received response, as Net::HTTP#get returns.
  http = Object.new
  http.define_singleton_method(:get) { |_path| response }
  Net::HTTP.define_singleton_method(:start) do |_host, _port, **options, &block|
    calls << options
    block.call(http)
  end
  Jekyll::InspireHEPCitationsTag::Citations.clear
  template = Liquid::Template.parse('{% inspirehep_citations record %}')
  response.body = '{"hits":{"hits":[]}}'
  assert(template.render('record' => '100') == 'N/A', 'empty results invented zero')
  response.body = '{"hits":{"hits":[{"metadata":{"citation_count":0}}]}}'
  zero = template.render('record' => '101')
  assert(zero == '0', 'genuine zero was not retained: ' + zero.inspect)
  assert(calls.length == 2 && calls.all? { |options| options[:open_timeout] == 5 && options[:read_timeout] == 5 }, 'INSPIRE timeout contract missing')
ensure
  Net::HTTP.define_singleton_method(:start, original) if original
end
puts JSON.pretty_generate({ 'passed' => checks.all? { |check| check['passed'] }, 'checks' => checks })
exit(checks.all? { |check| check['passed'] } ? 0 : 1)
