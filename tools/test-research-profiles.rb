#!/usr/bin/env ruby
# Schema and rendered-link boundaries for the author's real research accounts.
require 'jekyll'
require 'json'
require 'yaml'
require 'tmpdir'
require 'fileutils'
require 'nokogiri'
require_relative '../_plugins/profile-links'
require_relative '../_plugins/portfolio-localization'

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
root = File.expand_path('..', __dir__)
socials = YAML.safe_load(File.read(File.join(root, '_data/socials.yml')))
links = Portfolio::ProfileLinks.build(socials, source: root, feed: true)
research = links.select { |link| link['group'] == 'research' }
verify(checks, 'Actual academic accounts preserve supplied destinations and public identity') do
  targets = {
    'orcid_id' => ['https://orcid.org/0009-0004-6602-2218', '0009-0004-6602-2218'],
    'scholar_userid' => ['https://scholar.google.com/citations?user=G8ea1KMAAAAJ', 'David Quispe-Castillo'],
    'openreview_id' => ['https://openreview.net/profile?id=~David_Quispe-Castillo1', 'David Quispe-Castillo']
  }
  assert(research.map { |link| link['id'] }.sort == targets.keys.sort, 'an academic account was missing or invented')
  research.each do |link|
    assert([link['url'], link['display']] == targets[link['id']], "wrong research target/identity #{link['id']}")
    assert(link['aria_label'].start_with?(link['label'] + ': '), 'platform identity missing from accessible name')
  end
  assert(links.length == 9, 'profile registry contains a metadata entry or misses an existing connection')
  assert(links.last['id'] == 'rss', 'RSS is not the final profile destination')
  assert(links[0...-1].last(3) == research, 'academic identities lost their canonical order')
end
verify(checks, 'OpenReview identifiers reject URLs, query injection, whitespace and executable input') do
  ['https://openreview.net/profile?id=~Someone1', '~Someone1&redirect=evil', '~Person1#fragment', '../../private',
   '~Name With Spaces1', '<script>1', '~MissingSuffix', '', nil, false].each do |value|
    result = Portfolio::ProfileLinks.build({ 'openreview_id' => value }, source: root)
    assert(result.empty?, "invalid public identifier rendered: #{value.inspect}")
  end
end
verify(checks, 'Metadata names cannot add links, active markup or control characters') do
  names = { 'scholar_userid' => '<script>bad</script>', 'openreview_id' => "Bad\nName" }
  result = Portfolio::ProfileLinks.build({ 'scholar_userid' => 'PublicId', 'openreview_id' => '~Real_Name1',
    'profile_display_names' => names }, source: root)
  assert(result.length == 2, 'display metadata became a phantom destination')
  assert(result.first['display'] == 'PublicId', 'invalid display metadata replaced safe fallback')
  assert(result.last['display'] == 'Real Name', 'OpenReview fallback lost its public owner name')
end
verify(checks, 'Compact and full link rendering retain distinct semantic research groups and exact local brands') do
  Dir.mktmpdir('research-profile-render-') do |source|
    FileUtils.mkdir_p(File.join(source, '_includes'))
    %w[profile-links.liquid profile-link.liquid brand-icon.liquid].each do |file|
      FileUtils.cp(File.join(root, '_includes', file), File.join(source, '_includes', file))
    end
    site = Jekyll::Site.new(Jekyll.configuration('source' => source, 'destination' => File.join(source, 'output'),
      'default_lang' => 'en-us', 'languages' => ['en-us'], 'quiet' => true, 'plugins' => []))
    site.data['profile_links'] = links
    [true, false].each do |compact|
      page = Jekyll::PageWithoutAFile.new(site, source, '', 'profiles.html')
      page.content = "{% include profile-links.liquid compact=#{compact} %}"
      page.data = {}
      html = Nokogiri::HTML(Jekyll::Renderer.new(site, page).run)
      assert(html.css('nav').length == 1, 'profile navigation landmark duplicated')
      general = html.at_css('[data-profile-primary]')
      academic = html.at_css('[role=group].profile-research-links')
      assert(general.css('.profile-social-link').length == 5 && academic.css('.profile-social-link').length == 3,
        'real groups lost links or duplicated accounts')
      assert(html.css('.profile-social-link').last['data-profile-id'] == 'rss', 'RSS was not rendered last')
      assert(html.at_css('details summary') && html.css('[data-profile-extra] .profile-social-link').length == 4, 'native overflow disclosure does not preserve all links')
      assert(academic['aria-label'] == 'Research profiles', 'research navigation lacks an accessible name')
      html.css('.profile-social-link').zip(links).each do |node, record|
        assert(node['href'] == record['url'] && node['aria-label'] == record['aria_label'], 'safe target/name changed in markup')
        assert(node.at_css('.profile-link-label').text.strip == record['display'], 'public account identity was lost')
      end
      assert(academic.at_css('[data-brand="orcid"][width="20"][height="20"][aria-hidden="true"]'), 'ORCID decorative brand missing')
      assert(academic.at_css('[data-brand="googlescholar"][width="20"][height="20"][aria-hidden="true"]'), 'Scholar decorative brand missing')
      mark = academic.at_css('img[data-brand="openreview"]')
      assert(mark && mark['src'] == '/assets/icons/openreview.png' && mark['alt'] == '' && mark['aria-hidden'] == 'true',
        'OpenReview mark is missing, remote or inaccessible')
      assert(html.css('script').empty?, 'research link markup introduced a script')
    end
  end
end
verify(checks, 'Connection overflow starts above six links and preserves complete data order') do
  [0, 1, 6, 7, 25].each do |count|
    data = (0...count).map do |i|
      { 'id' => "test-#{i}", 'label' => "Profile #{i}", 'display' => "@account#{i}",
        'aria_label' => "Profile #{i}: @account#{i}", 'group' => 'general', 'url' => "https://example.org/#{i}" }
    end
    Dir.mktmpdir('profile-overflow-render-') do |source|
      FileUtils.mkdir_p(File.join(source, '_includes'))
      %w[profile-links.liquid profile-link.liquid brand-icon.liquid].each do |file|
        FileUtils.cp(File.join(root, '_includes', file), File.join(source, '_includes', file))
      end
      site = Jekyll::Site.new(Jekyll.configuration('source' => source, 'destination' => File.join(source, 'output'),
        'default_lang' => 'en-us', 'languages' => ['en-us'], 'quiet' => true, 'plugins' => []))
      site.data['profile_links'] = data
      page = Jekyll::PageWithoutAFile.new(site, source, '', 'profiles.html')
      page.content = "{% include profile-links.liquid compact=true %}"
      page.data = {}
      html = Nokogiri::HTML(Jekyll::Renderer.new(site, page).run)
      assert(html.css('.profile-social-link').length == count, "links lost at count #{count}")
      assert(html.css('[data-profile-primary] a').length == (count > 6 ? 5 : count), "wrong initial count #{count}")
      assert(html.css('details').length == (count > 6 ? 1 : 0), "wrong disclosure threshold #{count}")
      assert(html.css('.profile-social-link').map { |link| link['href'] } == data.map { |link| link['url'] }, 'profile order changed')
    end
  end
end
verify(checks, 'Official OpenReview asset has pinned provenance and retained license') do
  icon = File.binread(File.join(root, 'assets/icons/openreview.png'))
  assert(icon.start_with?("\x89PNG\r\n\x1a\n".b), 'official asset is not a PNG')
  assert(icon.bytesize == 6646, 'official mark bytes unexpectedly changed')
  assert(File.read(File.join(root, 'assets/icons/openreview-LICENSE.txt')).include?('GNU AFFERO GENERAL PUBLIC LICENSE'), 'upstream icon license omitted')
  assert(File.read(File.join(root, 'assets/brand-icons-NOTICE.txt')).include?('9d824a8d050ce975e2c3acb6b17ed65fa8633312'), 'pinned OpenReview source omitted')
end
puts JSON.pretty_generate('checks' => checks)
exit(checks.all? { |check| check['passed'] } ? 0 : 1)
