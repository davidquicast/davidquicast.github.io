#!/usr/bin/env ruby
# Minimal isolated render fixtures for optional site chrome; never published.
require 'jekyll'
require 'fileutils'
require 'json'
require 'nokogiri'
ROOT = File.expand_path('..', __dir__)
require File.join(ROOT, '_plugins/portfolio-localization')
require File.join(ROOT, '_plugins/optional-features')
WORK = File.join(ROOT, '.local/redesign/readcv-implementation/independent-audit/chrome-fixture')
FileUtils.rm_rf(WORK)
FileUtils.mkdir_p(WORK)
checks = []
cases = [
  { 'name' => 'default', 'back_to_top' => true, 'rss_icon' => true, 'enable_progressbar' => true },
  { 'name' => 'enabled', 'back_to_top' => false, 'rss_icon' => false, 'last_updated' => true, 'footer_fixed' => true,
    'impressum_path' => '/legal/', 'enable_progressbar' => true,
    'newsletter' => { 'enabled' => true, 'endpoint' => 'fixture-test-only' } },
  { 'name' => 'disabled', 'back_to_top' => false, 'rss_icon' => false, 'enable_progressbar' => false,
    'impressum_path' => 'javascript:alert(1)', 'newsletter' => { 'enabled' => true, 'endpoint' => 'https://untrusted.example/form' } }
]
cases.each do |options|
  name = options.fetch('name')
  source = File.join(WORK, name, 'source')
  output = File.join(WORK, name, 'site')
  %w[_includes/scripts _plugins _layouts _data/en-us].each { |dir| FileUtils.mkdir_p(File.join(source, dir)) }
  %w[footer.liquid site-engagement.liquid site-progress.liquid scripts/newsletter.liquid].each do |file|
    FileUtils.cp(File.join(ROOT, '_includes', file), File.join(source, '_includes', file))
  end
  FileUtils.cp(File.join(ROOT, '_data/en-us/ui.yml'), File.join(source, '_data/en-us/ui.yml'))
  File.write(File.join(source, '_layouts/default.liquid'), '<main id="main">{{ content }}</main>{% include footer.liquid %}{% include site-progress.liquid %}')
  File.write(File.join(source, '_layouts/post.liquid'), "---\nlayout: default\n---\n<article class=\"editorial-post\"><div class=\"article-content\">{{ content }}</div></article>")
  File.write(File.join(source, 'index.html'), "---\nlayout: default\n---\n<h1>Fixture home</h1>")
  File.write(File.join(source, 'article.html'), "---\nlayout: post\n---\n<h1>Fixture article</h1>")
  config = { 'source' => source, 'destination' => output, 'quiet' => true, 'baseurl' => '/fixture', 'url' => 'https://fixture.example',
    'author' => { 'name' => 'Fixture Author' }, 'default_lang' => 'en-us', 'languages' => ['en-us'], 'plugins' => [], 'newsletter' => { 'enabled' => false } }.merge(options)
  Jekyll::Site.new(Jekyll.configuration(config)).process
  home = Nokogiri::HTML(File.read(File.join(output, 'index.html')))
  article = Nokogiri::HTML(File.read(File.join(output, 'article.html')))
  def verify(checks, name, condition)
    checks << { 'check' => name, 'passed' => !!condition }
  end
  verify(checks, "#{name}: author preserved", home.at_css('.footer-credit').text.include?('Fixture Author'))
  verify(checks, "#{name}: back-to-top flag", !home.at_css('.site-footer a[href="#main"]').nil? == (options['back_to_top'] == true))
  verify(checks, "#{name}: RSS flag", !home.at_css('.site-footer a[href="/fixture/feed.xml"]').nil? == (options['rss_icon'] == true))
  verify(checks, "#{name}: fixed footer flag", !home.at_css('.site-footer-fixed').nil? == (options['footer_fixed'] == true))
  verify(checks, "#{name}: updated flag", !home.at_css('.footer-updated time[datetime]').nil? == (options['last_updated'] == true))
  verify(checks, "#{name}: article-only progress", home.css('div[data-reading-progress]').empty? && (!article.at_css('div[data-reading-progress][hidden]').nil? == (options['enable_progressbar'] == true)))
  verify(checks, "#{name}: optional chrome runtime", !home.at_css('script[src="/fixture/assets/js/site-chrome.js"]').nil? == (options['footer_fixed'] == true))
  verify(checks, "#{name}: valid newsletter only", !home.at_css('form[data-newsletter]').nil? == (name == 'enabled'))
  verify(checks, "#{name}: no empty engagement", home.css('.site-engagement').length == home.css('form[data-newsletter]').length)
  verify(checks, "#{name}: safe internal impressum", !home.at_css('.site-footer a[href="/fixture/legal/"]').nil? == (name == 'enabled'))
  verify(checks, "#{name}: executable impressum omitted", home.css('a[href^="javascript:"]').empty?)
  if name == 'enabled'
    verify(checks, 'newsletter remains outside fixed footer', home.css('.site-footer .newsletter-form').empty? && home.at_css('.site-engagement + .site-footer'))
    verify(checks, 'newsletter has valid real-provider shape', home.at_css('form[data-newsletter]')['action'] == 'https://app.loops.so/api/newsletter-form/fixture-test-only')
  end
end
report = { 'passed' => checks.all? { |check| check['passed'] }, 'checks' => checks }
File.write(File.join(WORK, 'report.json'), JSON.pretty_generate(report))
puts JSON.pretty_generate(report)
exit(report['passed'] ? 0 : 1)
