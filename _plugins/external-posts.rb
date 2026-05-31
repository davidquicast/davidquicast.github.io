require 'feedjira'
require 'httparty'
require 'jekyll'
require 'nokogiri'
require 'date'
require 'time'

module ExternalPosts
  class ExternalPostsGenerator < Jekyll::Generator
    safe true
    priority :high

    def generate(site)
      if site.config['external_sources'] != nil
        site.config['external_sources'].each do |src|
          puts "Fetching external posts from #{src['name']}:"
          if src['rss_url']
            fetch_from_rss(site, src)
          elsif src['posts']
            fetch_from_urls(site, src)
          end
        end
      end
    end

    def fetch_from_rss(site, src)
      xml = HTTParty.get(src['rss_url']).body
      return if xml.nil?
      feed = Feedjira.parse(xml)
      process_entries(site, src, feed.entries)
    rescue => e
      puts "...skipping #{src['name']} RSS (#{e.class}: #{e.message})"
    end

    def process_entries(site, src, entries)
      entries.each do |e|
        puts "...fetching #{e.url}"
        create_document(site, src['name'], e.url, {
          title: e.title,
          content: e.content,
          summary: e.summary,
          published: e.published
        })
      end
    end

    def create_document(site, source_name, url, content)
      return if external_post_exists?(site, url)

      # check if title is composed only of whitespace or foreign characters
      title = content[:title].to_s
      if title.gsub(/[^\w]/, '').strip.empty?
        # use the source name and last url segment as fallback
        slug = "#{source_name.downcase.strip.gsub(' ', '-').gsub(/[^\w-]/, '')}-#{url.split('/').last}"
      else
        # parse title from the post or use the source name and last url segment as fallback
        slug = title.downcase.strip.gsub(' ', '-').gsub(/[^\w-]/, '')
        slug = "#{source_name.downcase.strip.gsub(' ', '-').gsub(/[^\w-]/, '')}-#{url.split('/').last}" if slug.empty?
      end

      language = site.config['default_lang'] || site.config.dig('languages', 0)
      posts_dir = language ? "_posts/#{language}" : "_posts"
      path = site.in_source_dir("#{posts_dir}/#{slug}.md")
      doc = Jekyll::Document.new(
        path, { :site => site, :collection => site.collections['posts'] }
      )
      doc.data['external_source'] = source_name
      doc.data['layout'] = 'post'
      doc.data['title'] = title
      doc.data['feed_content'] = content[:content].to_s
      doc.data['description'] = content[:summary].to_s
      doc.data['date'] = content[:published]
      doc.data['redirect'] = url
      doc.data['blog_image_basename'] = image_basename(source_name, url, content[:published])
      doc.data['image'] = "assets/img/blog/#{doc.data['blog_image_basename']}_1.png"
      site.collections['posts'].docs << doc
    end

    def external_post_exists?(site, url)
      site.collections['posts'].docs.any? do |doc|
        doc.data['redirect'].to_s == url || doc.url.to_s == url
      end
    end

    def image_basename(source_name, url, published)
      source_slug = source_name.downcase.strip.gsub(' ', '-').gsub(/[^\w-]/, '')
      post_slug = url.split('/').last.downcase.strip.gsub(' ', '-').gsub(/[^\w-]/, '')
      date_prefix = begin
        Time.parse(published.to_s).strftime('%Y-%m-%d')
      rescue
        'external'
      end
      "#{date_prefix}-external-#{source_slug}-#{post_slug}"
    end

    def fetch_from_urls(site, src)
      src['posts'].each do |post|
        puts "...fetching #{post['url']}"
        content = begin
          fetch_content_from_url(post['url'])
        rescue => e
          puts "...using configured metadata for #{post['url']} (#{e.class}: #{e.message})"
          fallback_content(post)
        end
        content[:title] = post['title'] if post['title']
        content[:summary] = post['description'] if post['description']
        content[:content] = content[:summary] if content[:content].to_s.strip.empty?
        content[:published] = parse_published_date(post['published_date'])
        create_document(site, src['name'], post['url'], content)
      end
    rescue => e
      puts "...skipping #{src['name']} posts (#{e.class}: #{e.message})"
    end

    def fallback_content(post)
      slug_title = post['url'].split('/').last.to_s.tr('-', ' ')
      {
        title: post['title'] || slug_title,
        content: post['description'] || '',
        summary: post['description'] || ''
      }
    end

    def parse_published_date(published_date)
      case published_date
      when String
        Time.parse(published_date).utc
      when Date
        published_date.to_time.utc
      else
        raise "Invalid date format for #{published_date}"
      end
    end

    def fetch_content_from_url(url)
      html = HTTParty.get(url).body
      parsed_html = Nokogiri::HTML(html)

      title = parsed_html.at('head title')&.text.strip || ''
      description = parsed_html.at('head meta[name="description"]')&.attr('content') || ''
      body_content = parsed_html.at('body')&.inner_html || ''

      {
        title: title,
        content: body_content,
        summary: description
        # Note: The published date is now added in the fetch_from_urls method.
      }
    end

  end
end
