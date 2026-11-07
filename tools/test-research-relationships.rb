#!/usr/bin/env ruby
# Offline contracts for ownership, source provenance and canonical citation exports.
require 'jekyll'
require 'json'
require 'yaml'
require 'tmpdir'
require 'fileutils'
require 'bibtex'
require_relative '../_plugins/research-data'

ROOT = File.expand_path('..', __dir__)
checks = []
def check(checks, name)
  yield
  checks << { 'name' => name, 'passed' => true }
rescue => error
  checks << { 'name' => name, 'passed' => false, 'error' => error.message }
end
def assert(value, message)
  raise message unless value
end
def rejects
  begin
    yield
  rescue ArgumentError
    return true
  end
  raise 'invalid publication data was accepted'
end
source_data = YAML.safe_load(File.read(File.join(ROOT, '_data/publications.yml')))
entries = Portfolio::ResearchData.prepare(source_data, source: ROOT)
by_id = entries.to_h { |entry| [entry['id'], entry] }
Dir.mktmpdir('portfolio-research-contracts-') do |source|
  base = { 'id' => 'fixture-paper', 'title' => 'A {safe} paper', 'authors' => ['First Author', 'Second Author'], 'year' => 2026 }
  normalize = ->(record) { Portfolio::ResearchData.normalize(record, source: source) }
  check(checks, 'actual source separates two coauthored papers from two cited-work records') do
    assert(entries.length == 4, 'the four supplied works were not preserved')
    assert(source_data['publications'].map { |entry| entry['id'] }.sort == %w[culturalriddles include-2-0], 'coauthor source changed')
    assert(source_data['citations'].map { |entry| entry['id'] }.sort == %w[rigochat-2 somos600m], 'cited source changed')
    assert(entries.count { |entry| entry['relationship'] == 'coauthor' } == 2, 'authored count includes cited work')
    assert(entries.count { |entry| entry['relationship'] == 'cited_work' } == 2, 'cited count incorrect')
  end
  check(checks, 'INCLUDE exports the actual conference and full verified 41-author list') do
    paper = by_id.fetch('include-2-0')
    assert(paper['authors_count'] == 41 && paper['authors'].include?('David Quispe-Castillo'), 'published author list changed')
    assert(paper['authors'][14] == 'David Quispe-Castillo', 'canonical author order changed')
    assert(paper['authors'].include?('Marvin M. Agüero-Torales'), 'canonical middle initial lost')
    assert(paper['authorship_status'] == 'verified' && paper['selected'], 'verified authored status lost')
    bib = BibTeX.parse(paper['bibtex']).entries.fetch('include-2-0')
    assert(bib.type.to_s == 'inproceedings', 'conference incorrectly exported as journal article')
    assert(bib[:booktitle].to_s.include?('2026 Conference on Empirical Methods'), 'conference title missing')
    assert(bib[:pages].to_s == '30643--30666', 'real page range lost')
    assert(bib[:publisher].to_s == 'Association for Computational Linguistics', 'publisher missing')
    assert(!paper['bibtex'].include?('journal ='), 'conference invented journal')
  end
  check(checks, 'CulturalRiddles retains 164 published authors and explicit pending owner confirmation') do
    paper = by_id.fetch('culturalriddles')
    assert(paper['relationship'] == 'coauthor' && paper['authorship_status'] == 'pending_update', 'pending coauthorship not represented')
    assert(paper['authors_count'] == 164 && paper['authors'].length == 164, 'published author list truncated')
    assert(paper['authors'].none? { |name| name.include?('Quispe') }, 'owner inserted into published author list')
    assert(!paper['bibtex'].include?('Quispe'), 'canonical citation fabricated updated author list')
    assert(paper['relationship_note'].include?('confirmed by David Quispe-Castillo') && paper['relationship_note'].include?('awaiting an update'), 'source-update status hidden')
    assert(paper['evidence'].any? { |item| item['url'] == paper['dataset'] + '#contributors' }, 'official dataset credit source missing')
    assert(paper['summary'].length.between?(30, 180) && paper['abstract'].empty?, 'paraphrase mislabeled as original abstract')
  end
  check(checks, 'source previews are bounded while every canonical author remains available') do
    entries.each do |paper|
      expected = paper['authors'].first(3).join(', ') + (paper['authors_count'] > 3 ? ', et al.' : '')
      assert(paper['authors_preview'] == expected, 'preview alters first canonical authors')
      assert(paper['authors_count'] == paper['authors'].length, 'author count fabricated')
    end
  end
  check(checks, 'cited dataset records contain primary evidence and never claim coauthorship') do
    somos = by_id.fetch('somos600m')
    rigo = by_id.fetch('rigochat-2')
    assert(somos['authors'] == ['María Grandury'], 'Somos paper authors changed')
    assert(rigo['authors_count'] == 13 && rigo['authors'].none? { |name| name.include?('Quispe') }, 'Rigo paper authors changed')
    assert(somos['mentions'].map { |item| item['title'] } == %w[KUNTUR WikiHowES], 'Somos cited artifacts missing')
    assert(rigo['mentions'].map { |item| item['title'] } == ['WikiHowES'], 'Rigo cited artifact missing')
    [somos, rigo].each do |paper|
      assert(paper['relationship'] == 'cited_work' && !paper['selected'], 'cited work became selected authored paper')
      assert(!paper['evidence'].empty? && paper['mentions'].all? { |item| item['evidence_url'].start_with?('https://arxiv.org/html/') }, 'primary citation evidence missing')
    end
  end
  check(checks, 'publication dates preserve honest month/day precision without fabricated days') do
    assert(by_id['include-2-0'].values_at('published_at', 'date_precision', 'month') == ['2026-10', 'month', 'oct'], 'conference month became a fictional day')
    assert(by_id['culturalriddles'].values_at('published_at', 'date_precision') == ['2026-10-21', 'day'], 'revision date replaced original submission')
    assert(by_id['somos600m']['published_at'] == '2024-07-01' && by_id['rigochat-2']['published_at'] == '2025-03-11', 'actual source dates changed')
    assert(normalize.call(base).values_at('published_at', 'date_precision') == ['', 'year'], 'legacy record invented a date')
  end
  check(checks, 'legacy records retain safe article/coauthor defaults') do
    paper = normalize.call(base)
    assert(paper.values_at('relationship', 'authorship_status', 'type') == %w[coauthor verified article], 'legacy fixture defaults changed')
    assert(paper['evidence'].empty? && paper['mentions'].empty? && paper['summary'].empty?, 'legacy fixtures gained invented evidence')
    assert(paper['bibtex'].include?('First Author and Second Author') && paper['bibtex'].include?('\{safe\}'), 'canonical names or safe BibTeX delimiters lost')
  end
  check(checks, 'all supported BibTeX types retain appropriate bibliographic fields') do
    %w[article inproceedings book misc].each do |kind|
      paper = normalize.call(base.merge('type' => kind, 'venue' => 'Source venue', 'booktitle' => 'Source proceedings', 'publisher' => 'Real Publisher', 'pages' => '12--20'))
      bib = BibTeX.parse(paper['bibtex']).entries.fetch('fixture-paper')
      assert(bib.type.to_s == kind, 'citation kind changed')
      assert(paper['bibtex'].include?('publisher = {Real Publisher}'), 'publisher dropped')
      assert(paper['bibtex'].include?('pages = {12--20}'), 'pages dropped')
      assert(kind != 'inproceedings' || paper['bibtex'].include?('booktitle = {Source proceedings}'), 'booktitle missing')
      assert(kind != 'article' || paper['bibtex'].include?('journal = {Source venue}'), 'article venue missing')
      assert(kind != 'misc' || paper['bibtex'].include?('howpublished = {Source venue}'), 'misc source missing')
    end
  end
  check(checks, 'arXiv citations include canonical archive/eprint metadata') do
    %w[culturalriddles somos600m rigochat-2].each do |id|
      paper = by_id.fetch(id)
      assert(paper['bibtex'].include?("eprint = {#{paper['eprint']}}"), 'eprint absent')
      assert(paper['bibtex'].include?('archivePrefix = {arXiv}') && paper['bibtex'].include?('primaryClass = {cs.CL}'), 'archive or class lost')
      assert(paper['bibtex'].include?(paper['doi']), 'source DOI lost')
    end
  end
  check(checks, 'rich metadata validates type, month, pages and archive identifiers') do
    rejects { normalize.call(base.merge('type' => 'website')) }
    rejects { normalize.call(base.merge('pages' => { 'from' => 1 })) }
    rejects { normalize.call(base.merge('pages' => '12<script>')) }
    rejects { normalize.call(base.merge('publisher' => ['bad'])) }
    rejects { normalize.call(base.merge('archiveprefix' => 'ar Xiv')) }
    rejects { normalize.call(base.merge('archiveprefix' => 'arXiv', 'eprint' => 'bad/id')) }
    rejects { normalize.call(base.merge('eprint' => '2610.29968')) }
    rejects { normalize.call(base.merge('primaryclass' => 'cs.CL<script>')) }
    [0, 13, false, 'yesterday'].each { |value| rejects { normalize.call(base.merge('month' => value)) } }
    assert(normalize.call(base.merge('month' => 10))['month'] == 'oct', 'integer month rejected')
    assert(normalize.call(base.merge('month' => 'Oct'))['month'] == 'oct', 'canonical month abbreviation rejected')
  end
  check(checks, 'invalid, imprecise and contradictory dates fail closed') do
    ['2026', '2026-13', '2026-02-29', '2026-10-32', '2026/10/21', '2025-10-21'].each do |date|
      rejects { normalize.call(base.merge('published_at' => date)) }
    end
    rejects { normalize.call(base.merge('published_at' => '2026-10', 'month' => 'nov')) }
    rejects { normalize.call(base.merge('published_at' => 2026)) }
    assert(normalize.call(base.merge('year' => 2024, 'published_at' => '2024-02-29'))['date_precision'] == 'day', 'real leap day rejected')
  end
  check(checks, 'relationship/status combinations cannot silently promote cited work') do
    rejects { normalize.call(base.merge('relationship' => 'author-ish')) }
    rejects { normalize.call(base.merge('authorship_status' => 'unverified')) }
    rejects { normalize.call(base.merge('authorship_status' => 'pending_update')) }
    rejects { normalize.call(base.merge('relationship' => 'cited_work', 'authorship_status' => 'pending_update', 'relationship_note' => 'Note')) }
    rejects { normalize.call(base.merge('relationship' => 'cited_work', 'selected' => true)) }
    rejects { normalize.call(base.merge('selected' => 'true')) }
    assert(normalize.call(base.merge('relationship' => 'cited_work'))['selected'] == false, 'cited default became featured')
  end
  check(checks, 'source collection boundaries and duplicate IDs are validated together') do
    rejects { Portfolio::ResearchData.prepare({ 'publications' => {}, 'citations' => [] }, source: source) }
    rejects { Portfolio::ResearchData.prepare({ 'publications' => [], 'citations' => {} }, source: source) }
    rejects { Portfolio::ResearchData.prepare({ 'publications' => [base], 'citations' => [base] }, source: source) }
    rejects { Portfolio::ResearchData.prepare({ 'citations' => [base.merge('relationship' => 'coauthor')] }, source: source) }
    rejects { Portfolio::ResearchData.prepare({ 'publications' => [base.merge('relationship' => 'cited_work')] }, source: source) }
    assert(Portfolio::ResearchData.prepare({ 'citations' => [base] }, source: source).first['relationship'] == 'cited_work', 'citation collection default wrong')
  end
  check(checks, 'every direct and nested link rejects executable schemes, credentials and protocol-relative URLs') do
    %w[javascript:alert(1) data:text/html,test //evil.example/paper https://user:secret@example.org/paper].each do |url|
      Portfolio::ResearchData::LINK_FIELDS.each { |field| rejects { normalize.call(base.merge(field => url)) } }
      rejects { normalize.call(base.merge('evidence' => [{ 'label' => 'Source', 'url' => url }])) }
      rejects { normalize.call(base.merge('mentions' => [{ 'title' => 'Artifact', 'url' => url, 'evidence_url' => 'https://example.org/evidence' }])) }
      rejects { normalize.call(base.merge('mentions' => [{ 'title' => 'Artifact', 'url' => 'https://example.org/artifact', 'evidence_url' => url }])) }
    end
  end
  check(checks, 'local resources reject encoded traversal and escaping symlinks while preserving real fragments') do
    FileUtils.mkdir_p(File.join(source, 'assets'))
    File.write(File.join(source, 'assets/fixture.pdf'), '%PDF fixture')
    assert(normalize.call(base.merge('pdf' => '/assets/fixture.pdf#page=2'))['pdf'].end_with?('#page=2'), 'valid local PDF fragment lost')
    rejects { normalize.call(base.merge('pdf' => '/assets/%2e%2e/private.pdf')) }
    Dir.mktmpdir('portfolio-research-outside-') do |outside|
      File.write(File.join(outside, 'private.pdf'), 'private')
      File.symlink(File.join(outside, 'private.pdf'), File.join(source, 'assets/escape.pdf'))
      rejects { normalize.call(base.merge('pdf' => '/assets/escape.pdf')) }
    end
  end
  check(checks, 'evidence and mentions require structured plain text and valid source links') do
    [false, 'bad', {}].each { |value| rejects { normalize.call(base.merge('evidence' => value)) }; rejects { normalize.call(base.merge('mentions' => value)) } }
    rejects { normalize.call(base.merge('evidence' => ['bad'])) }
    rejects { normalize.call(base.merge('evidence' => [{ 'label' => '', 'url' => 'https://example.org' }])) }
    rejects { normalize.call(base.merge('mentions' => [{ 'title' => 'Artifact', 'url' => 'https://example.org' }])) }
    rejects { normalize.call(base.merge('mentions' => [{ 'title' => 'Artifact', 'url' => 'https://example.org', 'evidence_url' => 'https://example.org/source', 'note' => {} }])) }
    rejects { normalize.call(base.merge('summary' => "unsafe\u0000text")) }
  end
  check(checks, 'raw text survives normalization for mandatory escaping at the template boundary') do
    title = 'A <script>literal</script> title'
    paper = normalize.call(base.merge('title' => title, 'summary' => '<b>plain text</b>', 'relationship_note' => '<img src=x>'))
    assert(paper['title'] == title && paper['summary'] == '<b>plain text</b>' && paper['relationship_note'] == '<img src=x>', 'text was converted to trusted HTML or dropped')
  end
  check(checks, 'BibTeX text escaping prevents record injection and escapes literal title markers') do
    paper = normalize.call(base.merge('title' => "A } injected { title #value & data %test\\path"))
    bib = BibTeX.parse(paper['bibtex'])
    assert(bib.entries.keys == ['fixture-paper'], 'untrusted text injected a bibliography record')
    assert(paper['bibtex'].include?('\#value') && paper['bibtex'].include?('\& data') && paper['bibtex'].include?('\%test'), 'TeX title markers not escaped')
  end
  check(checks, 'generator partitions ownership while emitting real details and BibTeX for all four works') do
    site = Jekyll::Site.new(Jekyll.configuration('source' => source, 'destination' => File.join(source, 'out'), 'quiet' => true, 'plugins' => [], 'default_lang' => 'en-us'))
    site.data['publications'] = source_data
    generator = Portfolio::ResearchGenerator.new
    generator.generate(site)
    assert(site.data['research']['publications'].length == 2 && site.data['research']['citations'].length == 2 && site.data['research']['entries'].length == 4, 'generator failed ownership partition')
    assert(site.pages.grep(Portfolio::PublicationPage).length == 4 && site.static_files.grep(Portfolio::BibliographyFile).length == 4, 'not every work has genuine destinations')
    site.pages.grep(Portfolio::PublicationPage).each do |page|
      assert(page.data['description'] == page.data['paper']['summary'], 'page description ignores plain overview')
      assert(page.url == page.data['paper']['detail_url'], 'generated detail URL changed')
    end
    site.static_files.grep(Portfolio::BibliographyFile).each do |file|
      file.write(site.dest)
      entry = by_id.fetch(File.basename(file.name, '.bib'))
      assert(File.read(File.join(site.dest, file.url)) == entry['bibtex'], 'generated bibliography bytes changed')
    end
    generator.generate(site)
    assert(site.pages.grep(Portfolio::PublicationPage).length == 4 && site.static_files.grep(Portfolio::BibliographyFile).length == 4, 'repeated generation duplicated outputs')
    site.data['publications'] = { 'publications' => [], 'citations' => [] }
    generator.generate(site)
    assert(site.pages.grep(Portfolio::PublicationPage).empty? && site.static_files.grep(Portfolio::BibliographyFile).empty?, 'removed works retained generated records')
  end
  check(checks, 'cited-work detail collisions are rejected as strictly as authored routes') do
    FileUtils.mkdir_p(File.join(source, 'research/somos600m'))
    File.write(File.join(source, 'research/somos600m/index.html'), 'owner source route')
    site = Jekyll::Site.new(Jekyll.configuration('source' => source, 'destination' => File.join(source, 'out'), 'quiet' => true, 'plugins' => [], 'default_lang' => 'en-us'))
    site.data['publications'] = source_data
    begin
      Portfolio::ResearchGenerator.new.generate(site)
      raise 'real cited-work route was overwritten'
    rescue Jekyll::Errors::FatalException => error
      assert(error.message.include?('already exists'), 'wrong route collision failure')
    end
  end
  check(checks, 'active Scholar bibliography preserves all four published citation author lists') do
    source = File.read(File.join(ROOT, '_bibliography/papers.bib')).sub(/\A---\s*\n---\s*\n/, '')
    bib = BibTeX.parse(source)
    assert(bib.entries.keys.sort == by_id.keys.sort, 'active bibliography differs from maintained works')
    assert(bib.entries['include-2-0'].type.to_s == 'inproceedings', 'active conference bibliography type wrong')
    assert(bib.entries['culturalriddles'].author.length == 164 && !bib.entries['culturalriddles'].author.to_s.include?('Quispe'), 'active bibliography invented pending authorship')
    assert(bib.entries['somos600m'].author.length == 1 && bib.entries['rigochat-2'].author.length == 13, 'active bibliography changed cited-paper authors')
  end
end
puts JSON.pretty_generate({ 'passed' => checks.all? { |item| item['passed'] }, 'checks' => checks })
exit(checks.all? { |item| item['passed'] } ? 0 : 1)
