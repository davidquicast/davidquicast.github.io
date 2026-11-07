# Development and verification image. The deployed output remains a static Jekyll site.
FROM node:24.22.1-bookworm-slim AS node
FROM ruby:3.4.11-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    JEKYLL_ENV=development \
    EXECJS_RUNTIME=Node \
    CHROME_PATH=/usr/bin/chromium \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

COPY --from=node /usr/local/ /usr/local/
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential chromium curl git imagemagick inotify-tools \
    libffi-dev libxml2-dev libxslt1-dev pkg-config poppler-utils procps python3 python3-pip \
    tini zlib1g-dev && \
    pip3 install --no-cache-dir --break-system-packages nbconvert && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /srv/jekyll
COPY Gemfile Gemfile.lock ./
RUN bundle install --jobs 4
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY bin/entry_point.sh /usr/local/bin/portfolio-dev
ARG PORTFOLIO_UID=1000
ARG PORTFOLIO_GID=1000
RUN chmod +x /usr/local/bin/portfolio-dev && \
    groupadd --gid "${PORTFOLIO_GID}" portfolio && \
    useradd --uid "${PORTFOLIO_UID}" --gid "${PORTFOLIO_GID}" --create-home portfolio && \
    mkdir -p /home/portfolio/.npm && \
    cp -a /root/.npm/. /home/portfolio/.npm/ && \
    chown -R portfolio:portfolio /srv/jekyll /usr/local/bundle /home/portfolio
ENV HOME=/home/portfolio
USER portfolio
# Docker copies this app-owned directory into a fresh persistent skills volume.
RUN mkdir -p /home/portfolio/.codex/skills
EXPOSE 8080 35729
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/usr/local/bin/portfolio-dev"]
