# frozen_string_literal: true

require 'uri'

module Portfolio
  module ProfileLinks
    # These identifiers are public profile references, never API credentials.
    PREFIXES = {
      'acm_id' => ['ACM', 'https://dl.acm.org/profile/'],
      'discord_id' => ['Discord', 'https://discord.com/users/'],
      'facebook_id' => ['Facebook', 'https://facebook.com/'],
      'flickr_id' => ['Flickr', 'https://www.flickr.com/'],
      'github_username' => ['GitHub', 'https://github.com/'],
      'gitlab_username' => ['GitLab', 'https://gitlab.com/'],
      'ieee_id' => ['IEEE', 'https://ieeexplore.ieee.org/author/'],
      'inspirehep_id' => ['INSPIRE', 'https://inspirehep.net/authors/'],
      'instagram_id' => ['Instagram', 'https://instagram.com/'],
      'kaggle_id' => ['Kaggle', 'https://www.kaggle.com/'],
      'keybase_username' => ['Keybase', 'https://keybase.io/'],
      'lastfm_id' => ['Last.fm', 'https://www.last.fm/user/'],
      'lattes_id' => ['Lattes', 'https://lattes.cnpq.br/'],
      'leetcode_id' => ['LeetCode', 'https://leetcode.com/u/'],
      'linkedin_username' => ['LinkedIn', 'https://www.linkedin.com/in/'],
      'medium_username' => ['Medium', 'https://medium.com/@'],
      'orcid_id' => ['ORCID', 'https://orcid.org/'],
      'openreview_id' => ['OpenReview', 'https://openreview.net/profile?id='],
      'osf_id' => ['OSF', 'https://osf.io/'],
      'pinterest_id' => ['Pinterest', 'https://www.pinterest.com/'],
      'publons_id' => ['Publons', 'https://publons.com/a/'],
      'quora_username' => ['Quora', 'https://www.quora.com/profile/'],
      'research_gate_profile' => ['ResearchGate', 'https://www.researchgate.net/profile/'],
      'scholar_userid' => ['Google Scholar', 'https://scholar.google.com/citations?user='],
      'scopus_id' => ['Scopus', 'https://www.scopus.com/authid/detail.uri?authorId='],
      'semanticscholar_id' => ['Semantic Scholar', 'https://www.semanticscholar.org/author/'],
      'spotify_id' => ['Spotify', 'https://open.spotify.com/user/'],
      'stackoverflow_id' => ['Stack Overflow', 'https://stackoverflow.com/users/'],
      'strava_userid' => ['Strava', 'https://www.strava.com/athletes/'],
      'telegram_username' => ['Telegram', 'https://t.me/'],
      'unsplash_id' => ['Unsplash', 'https://unsplash.com/@'],
      'whatsapp_number' => ['WhatsApp', 'https://wa.me/'],
      'wikidata_id' => ['Wikidata', 'https://www.wikidata.org/wiki/'],
      'wikipedia_id' => ['Wikipedia', 'https://wikipedia.org/wiki/User:'],
      'x_username' => ['X', 'https://x.com/'],
      'youtube_id' => ['YouTube', 'https://youtube.com/@'],
      'zotero_username' => ['Zotero', 'https://www.zotero.org/'],
      'huggingface_id' => ['Hugging Face', 'https://huggingface.co/']
    }.freeze
    DIRECT = {
      'blogger_url' => 'Blogger', 'bluesky_url' => 'Bluesky',
      'dblp_url' => 'DBLP', 'work_url' => 'Website'
    }.freeze
    # Exact, locally vendored brand marks; unsupported custom sites keep their own label.
    ICONS = {
      'email' => 'email',
      'acm_id' => 'acm',
      'discord_id' => 'discord',
      'facebook_id' => 'facebook',
      'flickr_id' => 'flickr',
      'github_username' => 'github',
      'gitlab_username' => 'gitlab',
      'ieee_id' => 'ieee',
      'inspirehep_id' => 'inspire',
      'instagram_id' => 'instagram',
      'kaggle_id' => 'kaggle',
      'keybase_username' => 'keybase',
      'lastfm_id' => 'lastdotfm',
      'leetcode_id' => 'leetcode',
      'linkedin_username' => 'linkedin',
      'medium_username' => 'medium',
      'orcid_id' => 'orcid',
      'openreview_id' => 'openreview',
      'osf_id' => 'osf',
      'pinterest_id' => 'pinterest',
      'publons_id' => 'publons',
      'quora_username' => 'quora',
      'research_gate_profile' => 'researchgate',
      'scholar_userid' => 'googlescholar',
      'scopus_id' => 'scopus',
      'semanticscholar_id' => 'semanticscholar',
      'spotify_id' => 'spotify',
      'stackoverflow_id' => 'stackoverflow',
      'strava_userid' => 'strava',
      'telegram_username' => 'telegram',
      'unsplash_id' => 'unsplash',
      'whatsapp_number' => 'whatsapp',
      'wikidata_id' => 'wikidata',
      'wikipedia_id' => 'wikipedia',
      'x_username' => 'x',
      'youtube_id' => 'youtube',
      'zotero_username' => 'zotero',
      'huggingface_id' => 'huggingface',
      'blogger_url' => 'blogger',
      'bluesky_url' => 'bluesky',
      'dblp_url' => 'dblp',
      'mastodon_username' => 'mastodon',
      'wechat_qr' => 'wechat',
      'rss' => 'rss',
    }.freeze
    USERNAME_KEYS = %w[github_username gitlab_username linkedin_username x_username huggingface_id
      instagram_id kaggle_id keybase_username lastfm_id leetcode_id medium_username pinterest_id
      quora_username research_gate_profile telegram_username unsplash_id wikipedia_id youtube_id
      zotero_username].freeze
    RESEARCH_KEYS = %w[orcid_id scholar_userid openreview_id].freeze
    module_function

    def safe_url(value)
      uri = URI.parse(value.to_s)
      return nil unless %w[http https].include?(uri.scheme) && uri.host && !uri.userinfo
      value.to_s
    rescue URI::InvalidURIError
      nil
    end

    def safe_logo(value, source:, baseurl: '')
      return nil unless value.is_a?(String) && !value.strip.empty?
      image = value.strip
      if image.start_with?('https://')
        return safe_url(image)
      end
      return nil if image.include?('://') || image.start_with?('//') || image.include?('..')
      path = image.start_with?('/') ? image : '/assets/img/' + image
      return nil unless path.start_with?('/assets/')
      return nil unless %w[.svg .png .jpg .jpeg .webp .avif .gif].include?(File.extname(path).downcase)
      root = File.realpath(source)
      file = File.expand_path(path.delete_prefix('/'), root)
      return nil unless File.file?(file) && File.realpath(file).start_with?(root + File::SEPARATOR)
      baseurl + path
    rescue Errno::ENOENT, Errno::EACCES
      nil
    end

    def icon_for(id, url)
      return ICONS[id] if ICONS.key?(id)
      host = URI.parse(url.to_s).host.to_s.downcase.sub(/\Awww\./, '')
      return 'huggingface' if host == 'huggingface.co'
      return 'github' if host == 'github.com'
      return 'linkedin' if host == 'linkedin.com'
      return 'x' if %w[x.com twitter.com].include?(host)
      return 'openreview' if host == 'openreview.net'
      return 'orcid' if host == 'orcid.org'
      return 'googlescholar' if host == 'scholar.google.com'
      nil
    rescue URI::InvalidURIError
      nil
    end

    def format_handle(value)
      return nil unless value.is_a?(String) && value.strip.match?(/\A@?[\p{L}\p{N}_.+~@-]+\z/u)
      '@' + value.strip.sub(/\A@+/, '')
    end

    def profile_handle(url)
      uri = URI.parse(url.to_s)
      host = uri.host.to_s.downcase.sub(/\Awww\./, '')
      parts = uri.path.split('/').reject(&:empty?).map { |part| URI::DEFAULT_PARSER.unescape(part) }
      if %w[github.com huggingface.co x.com twitter.com].include?(host) && parts.length == 1
        return nil if %w[spaces datasets models organizations docs blog settings login join explore search home intent].include?(parts.first)
        return format_handle(parts.first)
      end
      return format_handle(parts.last) if host == 'linkedin.com' && parts.length == 2 && parts.first == 'in'
      return format_handle(parts.last) if host == 'bsky.app' && parts.length == 2 && parts.first == 'profile'
      nil
    rescue URI::InvalidURIError
      nil
    end

    def display_for(id, value, url, label)
      return value.to_s if id == 'email'
      return value.to_s.sub(/\A~/, '').sub(/\d+\z/, '').tr('_', ' ') if id == 'openreview_id'
      return format_handle(value.to_s) || value.to_s if USERNAME_KEYS.include?(id)
      if id == 'mastodon_username'
        uri = URI.parse(url)
        account = uri.path.split('/').reject(&:empty?).last.to_s
        return account + '@' + uri.host if account.start_with?('@')
      end
      return profile_handle(url) || label if DIRECT.key?(id)
      return value.to_s if PREFIXES.key?(id)
      label
    rescue URI::InvalidURIError
      label
    end

    def build(socials, source:, baseurl: '', feed: false)
      return [] unless socials.is_a?(Hash)
      result = []
      socials.each do |key, value|
        next if value.nil? || value == false || value.to_s.strip.empty?
        label = url = nil
        if key == 'email'
          next unless value.is_a?(String) && value.match?(/\A[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+\z/)
          label, url = 'Email', 'mailto:' + URI.encode_www_form_component(value).gsub('+', '%20').gsub('%40', '@')
        elsif PREFIXES.key?(key)
          next unless value.is_a?(String) || value.is_a?(Numeric)
          next if key == 'openreview_id' && !value.to_s.match?(/\A~[\p{L}\p{N}_.-]+[0-9]+\z/u)
          label, prefix = PREFIXES[key]
          url = prefix + URI.encode_www_form_component(value.to_s.strip).gsub('+', '%20')
          url = url.gsub('%7E', '~') if key == 'openreview_id'
        elsif DIRECT.key?(key)
          label, url = DIRECT[key], safe_url(value)
        elsif key == 'mastodon_username'
          label, url = 'Mastodon', safe_url(value.to_s.start_with?('https://') ? value : 'https://' + value)
        elsif key == 'wechat_qr'
          path = File.join(source, 'assets/img', value.to_s)
          if !value.to_s.include?('..') && File.file?(path)
            label, url = 'WeChat QR code', baseurl + '/assets/img/' + value
          end
        elsif key == 'custom_social'
          Array(value.is_a?(Hash) ? [value] : value).each_with_index do |custom, index|
            next unless custom.is_a?(Hash)
            custom_url = safe_url(custom['url'])
            custom_label = custom['label'].to_s.strip
            custom_label = custom['title'].to_s.strip if custom_label.empty?
            next unless custom_url && !custom_label.empty?
            display = format_handle(custom['handle'] || custom['username']) || profile_handle(custom_url) || custom_label
            result << { 'id' => 'custom-' + index.to_s, 'label' => custom_label, 'display' => display,
              'url' => custom_url, 'external' => true, 'logo' => safe_logo(custom['logo'], source: source, baseurl: baseurl) }
          end
        end
        next unless label && url
        result << { 'id' => key, 'label' => label, 'url' => url, 'external' => url.start_with?('http') }
      end
      if feed || socials['rss_icon'] == true
        result << { 'id' => 'rss', 'label' => 'RSS', 'url' => baseurl + '/feed.xml', 'external' => false }
      end
      result.each do |profile|
        profile['group'] = RESEARCH_KEYS.include?(profile['id']) ? 'research' : 'general'
        profile['icon'] = icon_for(profile['id'], profile['url'])
        profile['display'] ||= display_for(profile['id'], socials[profile['id']], profile['url'], profile['label'])
        names = socials['profile_display_names']
        if RESEARCH_KEYS.include?(profile['id']) && names.is_a?(Hash)
          name = names[profile['id']]
          profile['display'] = name.strip if name.is_a?(String) && !name.strip.empty? && name.length <= 120 && !name.match?(/[<>\x00-\x1f]/)
        end
        profile['aria_label'] = profile['display'] == profile['label'] ? profile['label'] : profile['label'] + ': ' + profile['display']
      end
      result.partition { |profile| profile['group'] != 'research' }.flatten(1)
    end
  end

  class ProfileLinksGenerator < Jekyll::Generator
    safe true
    priority :normal
    def generate(site)
      site.data['profile_links'] = ProfileLinks.build(site.data['socials'], source: site.source,
        baseurl: site.config['baseurl'].to_s, feed: site.config['rss_icon'] == true)
    end
  end
end
