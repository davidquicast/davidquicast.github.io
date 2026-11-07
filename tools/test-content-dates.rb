#!/usr/bin/env ruby
require 'jekyll'
require 'json'
require 'yaml'
require_relative '../_plugins/portfolio-localization'
require_relative '../_plugins/content-dates'
D = Portfolio::ContentDates
checks = []
def check(checks, name)
 yield
 checks << { name: name, passed: true }
rescue => error
 checks << { name: name, passed: false, error: error.message }
end
def assert(value, message)
 raise message unless value
end
def reject
 begin
  yield
 rescue ArgumentError
  return true
 end
 raise 'invalid date accepted'
end
check(checks, 'precision is preserved for years months days and zoned timestamps') do
 {'2026'=>'year','2026-10'=>'month','2026-10-21'=>'day','2026-10-21T16:20:30Z'=>'day'}.each do |value, precision|
  assert(D.point(value)['value'] == value && D.point(value)['precision'] == precision, 'precision changed')
 end
 assert(D.point('2026-10-21T23:30:00-05:00')['display']=='2026-10-21','authored local publication day shifted')
end
check(checks, 'invalid dates and injected date objects fail closed') do
 %w[2026-02-30 2026-13 0000 garbage].each { |value| reject { D.point(value) } }
 reject { D.point({'value'=>'<script>unsafe</script>'}) }
 reject { D.point('2026-02-30T12:00:00Z') }
end
site = Struct.new(:config,:data).new({'default_lang'=>'en-us'}, {})
render = ->(value) { Liquid::Template.parse('{{ value | precise_date }}').render!({'value'=>value},registers:{site:site}) }
check(checks, 'visible labels never turn month precision into a fabricated day') do
 assert(render.call('2026-10')=='October 2026','month was displayed with a day')
 assert(render.call('2026-10-21')=='October 21, 2026','full verified day missing')
 assert(render.call(2024)=='2024','authored year changed')
end
snapshot = JSON.parse(File.read(File.expand_path('../_data/project_activity.json',__dir__)))['projects']
check(checks, 'actual19projects24resources5contributions are retained') do
 ids=Dir.glob(File.expand_path('../_projects/en-us/*.md',__dir__)).filter_map do |file|
  data=YAML.safe_load(File.read(file).split(/^---\s*$\n?/,3)[1],permitted_classes:[Date,Time],aliases:true)
  data['page_id'] unless data['published']==false
 end
 assert(snapshot.keys.sort==ids.sort,'configured published projects missing from snapshot')
 assert(snapshot.values.all?{|v| D.resources(v).size==v['resources'].size},'verified source record dropped')
 assert(snapshot.values.flat_map{|v| Array(v['contributions'])}.all?{|c|c['author']=='davidquicast'},'another users contribution entered actual snapshot')
end
check(checks, 'repository creation does not become project origin') do
 result=D.project({'year'=>2023},snapshot.fetch('davidquicast_portfolio_site'),owner:'davidquicast')
 assert(result['primary']['value']=='2023','repository origin invented a project date')
 assert(result['resources'].first['created']['value'].start_with?('2024-12-15'),'real repository creation lost')
end
check(checks, 'verified contribution dates correct an inaccurate fallback year') do
 result=D.project({'year'=>2024,'category'=>'collaborations'},snapshot.fetch('collab_synthetic_data_generator'),owner:'davidquicast')
 assert(result['primary']['display']=='2025-02-20','own merged contribution date missing')
 assert(result['activity']['display']=='2025-02-20','upstream changes misrepresented owner activity')
end
check(checks, 'multiple own contributions preserve first and latest linked dates') do
 result=D.project({'year'=>2024,'category'=>'collaborations'},snapshot.fetch('collab_smol_course'),owner:'davidquicast')
 assert(result['primary']['display']=='2024-12-09','first linked contribution date changed')
 assert(result['updated']['display']=='2024-12-16','latest linked contribution date changed')
end
check(checks, 'other users and unmerged PRs cannot become owner activity') do
 data=Marshal.load(Marshal.dump(snapshot.fetch('collab_synthetic_data_generator')))
 data['contributions'].first['author']='another-user'
 result=D.project({'year'=>2024,'category'=>'collaborations'},data,owner:'davidquicast')
 assert(result['primary']['value']=='2024' && result['updated'].nil?,'unverified own activity was claimed')
end
check(checks, 'failed checks do not use refresh attempts as activity dates') do
 data=Marshal.load(Marshal.dump(snapshot.fetch('collab_synthetic_data_generator')))
 expected=data['resources'].first['updated_at']
 data['resources'].first.merge!('status'=>'unavailable','last_attempted_at'=>'2026-11-05T12:00:00Z')
 resource=D.resources(data).first
 assert(resource['updated']['value']==expected,'attempt overwrote actual source activity')
end
check(checks, 'paper first publication and source revision remain independent') do
 t=D.paper({'published_at'=>'2026-10-21','last_revised_at'=>'2026-10-27'})
 assert(t['primary']['value']=='2026-10-21' && t['activity']['value']=='2026-10-27','revision replaced publication date')
 reject { D.paper({'published_at'=>'2026-10-21','last_revised_at'=>'2026-10-20'}) }
end
check(checks, 'legacy paper fixtures retain year fallback and articles retain authored updates') do
 assert(D.paper({'year'=>2026,'published_at'=>''})['primary']['value']=='2026','empty normalized date removed fallback')
 t=D.article({'date'=>'2025-01-07','last_updated'=>'2026-10-29'})
 assert(t['primary']['value']=='2025-01-07' && t['activity']['value']=='2026-10-29','editorial update overwrote publication')
end
check(checks, 'unsafe resource and contribution links are never rendered') do
 assert(D.resources({'resources'=>[{'kind'=>'github','url'=>'javascript:alert(1)'}]}).empty?,'unsafe snapshot became a link')
 assert(D.public_link('https://user:password@github.com/owner/repo').empty?,'credentials accepted')
end
puts JSON.pretty_generate({passed:checks.all?{|c|c[:passed]},checks:checks})
exit(checks.all?{|c|c[:passed]} ? 0 : 1)
