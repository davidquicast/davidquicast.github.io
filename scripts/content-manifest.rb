#!/usr/bin/env ruby
# Read trusted Jekyll source metadata safely; no site generation or network access.
require "yaml"
require "json"
require "date"

root = File.expand_path(ARGV.fetch(0))
config_path = File.join(root, "_config.yml")
load_yaml = ->(value) { YAML.safe_load(value, permitted_classes: [Date, Time], aliases: true) || {} }
config = File.exist?(config_path) ? load_yaml.call(File.read(config_path)) : {}
posts = Dir.glob(File.join(root, "_posts", "en-us", "*.md")).map do |path|
  text = File.read(path)
  match = text.match(/\A---\s*\n(.*?)\n---(?:\s*\n|\z)/m)
  next unless match
  data = load_yaml.call(match[1])
  stem = File.basename(path, ".md")
  date = Date.parse((data["date"] || stem[0, 10]).to_s)
  {
    "source" => path.delete_prefix(root + "/"),
    "published" => data["published"] != false,
    "title" => data["title"].to_s,
    "slug" => (data["slug"] || stem[11..]).to_s,
    "permalink" => data["permalink"],
    "year" => date.strftime("%Y"),
    "short_year" => date.strftime("%y"),
    "month" => date.strftime("%m"),
    "day" => date.strftime("%d"),
    "categories" => Array(data["categories"]).join("/")
  }
end.compact
puts JSON.generate({
  "url" => config["url"] || "https://davidquicast.github.io",
  "baseurl" => config["baseurl"].to_s,
  "permalink" => config["permalink"] || "/blog/:year/:title/",
  "title" => config["title"].to_s,
  "posts" => posts
})
