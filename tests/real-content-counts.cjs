const { execFileSync } = require("node:child_process");
module.exports = JSON.parse(
  execFileSync(
    "ruby",
    [
      "-ryaml",
      "-rjson",
      "-rdate",
      "-e",
      `
read = ->(p) { YAML.safe_load(File.read(p).split(/^---\\s*$\\n?/, 3)[1], permitted_classes: [Date, Time], aliases: true) }
projects = Dir.glob('_projects/en-us/*.md').count { |p| read.call(p)['published'] != false }
writing = Dir.glob('_posts/en-us/*.md').count { |p| read.call(p)['published'] != false }
data = YAML.safe_load(File.read('_data/publications.yml')) || {}
authored = data.fetch('publications', []).length
cited = data.fetch('citations', []).length
covers = YAML.safe_load(File.read('_data/research_covers.yml')) || {}
research_ids = (data.fetch('publications', []) + data.fetch('citations', [])).map { |paper| paper['id'] }
talks_data = YAML.safe_load(File.read('_data/talks.yml')) || {}
talks = (talks_data['talks'] || []).count { |t| t['published'] != false }
puts JSON.generate({projects:projects,writing:writing,authored:authored,cited:cited,research:authored+cited,talks:talks,researchCovers:(covers.keys & research_ids),all:projects+writing+authored+cited+talks})
`,
    ],
    { encoding: "utf8" }
  )
);
