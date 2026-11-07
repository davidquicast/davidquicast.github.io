#!/usr/bin/env ruby
# Author-supplied publication detail contracts; fixtures stay private and offline.
require 'jekyll'
require 'fileutils'
require 'yaml'
require 'json'
require 'nokogiri'
ROOT = File.expand_path('..', __dir__)
WORK = File.join(ROOT, '.local/redesign/content-overlays/independent/paper-fixture')
SOURCE = File.join(WORK, 'source')
DEST = File.join(WORK, 'site')
FileUtils.rm_rf(WORK)
%w[_layouts _includes _plugins _data/en-us assets/pdf].each { |dir| FileUtils.mkdir_p(File.join(SOURCE, dir)) }
FileUtils.cp(File.join(ROOT, '_layouts/paper.liquid'), File.join(SOURCE, '_layouts/paper.liquid'))
%w[content-dates.rb research-data.rb portfolio-localization.rb project-destinations.rb].each { |file| FileUtils.cp(File.join(ROOT, '_plugins', file), File.join(SOURCE, '_plugins', file)) }
FileUtils.cp(File.join(ROOT, '_data/en-us/ui.yml'), File.join(SOURCE, '_data/en-us/ui.yml'))
%w[project-destinations.liquid brand-icon.liquid research-links.liquid research-authors.liquid research-attribution.liquid content-date.liquid content-updated.liquid].each { |file| FileUtils.cp(File.join(ROOT, '_includes', file), File.join(SOURCE, '_includes', file)) }
File.write(File.join(SOURCE, '_layouts/default.liquid'), '<!doctype html><html lang="en"><head><meta name="description" content="{{ page.description | escape }}"></head><body><main id="main">{{ content }}</main></body></html>')
File.write(File.join(SOURCE, 'assets/pdf/fixture.pdf'), "%PDF-1.4\n% Private fixture only.\n")
record = { 'id' => 'fixture-paper', 'title' => 'A <verified> paper & title', 'authors' => ['Fixture Author', 'Second Author'],
  'year' => 2026, 'venue' => 'Fixture Journal', 'doi' => '10.1234/fixture',
  'pdf' => '/assets/pdf/fixture.pdf', 'abstract' => '<script>unsafe()</script> plain abstract' }
File.write(File.join(SOURCE, '_data/publications.yml'), YAML.dump('publications' => [record]))
config = { 'source' => SOURCE, 'destination' => DEST, 'quiet' => true, 'plugins' => [],
  'url' => 'https://fixture.example', 'baseurl' => '/portfolio', 'default_lang' => 'en-us', 'languages' => ['en-us'] }
site = Jekyll::Site.new(Jekyll.configuration(config))
site.process
checks = []
def check(checks, name)
  yield
  checks << { 'check' => name, 'passed' => true }
rescue => error
  checks << { 'check' => name, 'passed' => false, 'error' => error.message }
end
def assert(value, message)
  raise message unless value
end
check(checks, 'validated data has a stable internal detail route') do
  assert(site.data.dig('research', 'publications', 0, 'detail_url') == '/research/fixture-paper/', 'detail URL missing')
end
check(checks, 'genuine static paper main is directly readable and source text is escaped') do
  file = File.join(DEST, 'research/fixture-paper/index.html')
  assert(File.file?(file), 'static paper page absent')
  doc = Nokogiri::HTML(File.read(file))
  assert(doc.at_css('main#main .paper-detail h1').text == record['title'], 'title changed or not escaped')
  assert(doc.css('.paper-detail script').empty?, 'untrusted abstract created script')
  assert(doc.at_css('.paper-abstract').text.include?('<script>unsafe()</script>'), 'abstract source text lost')
  assert(doc.at_css('.back-link')['href'] == '/portfolio/?view=papers', 'profile return lost baseurl')
  assert(doc.at_css('a[href="https://doi.org/10.1234/fixture"]'), 'genuine DOI action absent')
  assert(doc.at_css('a[href="/portfolio/assets/pdf/fixture.pdf"]'), 'PDF link absent')
  assert(doc.at_css('a[href="/portfolio/assets/bib/fixture-paper.bib"][download]'), 'BibTeX download absent')
  assert(doc.at_css('.research-citation pre code').text.include?('Fixture Author and Second Author'), 'selectable citation absent')
end
check(checks, 'repeated generation retains one paper page and one bibliography artifact') do
  Portfolio::ResearchGenerator.new.generate(site)
  assert(site.pages.count { |page| page.is_a?(Portfolio::PublicationPage) } == 1, 'duplicate generated page')
  assert(site.static_files.count { |file| file.is_a?(Portfolio::BibliographyFile) } == 1, 'duplicate generated bibliography')
end
check(checks, 'reserved real source routes are never overwritten') do
  conflicting = Jekyll::PageWithoutAFile.new(site, SOURCE, 'research/fixture-paper', 'index.html')
  conflicting.data['permalink'] = '/research/fixture-paper/'
  site.pages << conflicting
  begin
    Portfolio::ResearchGenerator.new.generate(site)
    raise 'route collision was accepted'
  rescue Jekyll::Errors::FatalException => error
    assert(error.message.include?('already exists'), 'wrong collision error')
  ensure
    site.pages.delete(conflicting)
  end
end
check(checks, 'empty or removed author data emits no fake pages or bibliography') do
  site.data['publications'] = { 'publications' => [] }
  Portfolio::ResearchGenerator.new.generate(site)
  assert(site.pages.none? { |page| page.is_a?(Portfolio::PublicationPage) }, 'empty data left paper pages')
  assert(site.static_files.none? { |file| file.is_a?(Portfolio::BibliographyFile) }, 'empty data left citations')
end
report = { 'passed' => checks.all? { |item| item['passed'] }, 'checks' => checks }
File.write(File.join(WORK, 'report.json'), JSON.pretty_generate(report))
puts JSON.pretty_generate(report)
exit(report['passed'] ? 0 : 1)
