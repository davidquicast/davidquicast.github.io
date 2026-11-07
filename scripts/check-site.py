#!/usr/bin/env python3
"""Audit generated static output, including semantic and publishing regressions."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote
from collections import Counter
import argparse
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

REQUIRED = ("index.html", "projects/index.html", "blog/index.html", "404.html",
            "resume/index.html", "feed.xml", "sitemap.xml")
PRIVATE = (".local", ".git", ".github", ".codex", ".aws", ".env", ".mcp.json",
           "docs", "tools", "tests", "node_modules", "assets/js/src", "drafts")
BUILD_FILES = ("Dockerfile", "docker-compose.yml", "docker.md", "requirements.txt",
               "package.json", "package-lock.json", "Gemfile", "Gemfile.lock")
TEMPLATE_OUTPUTS = ("assets/html/relativity.html", "assets/plotly/demo.html",
                    "assets/jupyter/blog.ipynb", "assets/jupyter/blog.ipynb.html",
                    "assets/json/resume.json", "assets/json/resume_en-us.json",
                    "assets/json/resume_pt-br.json", "assets/json/resume_en-us_sample.json",
                    "assets/pdf/pt-br/example_pdf.pdf")
ATOM = {"a": "http://www.w3.org/2005/Atom"}

class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.links, self.images = [], []
        self.ids, self.h1 = Counter(), 0
        self.lang, self.title, self.canonical = "", "", ""
        self.metas, self.in_title = {}, False
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids[attrs["id"]] += 1
        if tag == "html":
            self.lang = attrs.get("lang", "")
        if tag == "h1":
            self.h1 += 1
        if tag == "title":
            self.in_title = True
        if tag == "meta":
            self.metas[attrs.get("name", attrs.get("property", ""))] = attrs.get("content", "")
        if tag == "link" and "canonical" in attrs.get("rel", "").split():
            self.canonical = attrs.get("href", "")
        if tag == "img":
            self.images.append(attrs)
        for key in ("href", "src") + (("data",) if tag == "object" else ()):
            if attrs.get(key):
                self.links.append(attrs[key])
        if attrs.get("srcset"):
            self.links.extend(item.strip().split()[0] for item in attrs["srcset"].split(",") if item.strip())

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data

def source_manifest(source):
    helper = Path(__file__).with_name("content-manifest.rb")
    result = subprocess.run(["ruby", str(helper), str(source)],
                            text=True, capture_output=True, check=True)
    return json.loads(result.stdout)

def post_route(post, template):
    route = post.get("permalink") or template
    replacements = {**post, "title": post["slug"], "output_ext": ".html"}
    return re.sub(r":([a-z_]+)", lambda m: str(replacements.get(m[1], m[0])), route)

def audit(root, source):
    root, source = Path(root).resolve(), Path(source).resolve()
    manifest = source_manifest(source)
    site_url = manifest["url"].rstrip("/") + manifest["baseurl"].rstrip("/") + "/"
    host = urlsplit(site_url).netloc
    prefix = manifest["baseurl"].rstrip("/")
    errors, documents = [], {}
    pages = sorted(root.rglob("*.html"))
    checked = 0

    def issue(page, url, message):
        errors.append({"page": page, "url": url, "issue": message})

    def document(path):
        if path not in documents:
            documents[path] = Document(path.read_text(errors="replace"))
        return documents[path]

    def local_destination(parsed):
        path = unquote(parsed.path)
        if prefix and (path == prefix or path.startswith(prefix + "/")):
            path = path[len(prefix):]
        target = (root / path.lstrip("/")).resolve()
        if not target.is_relative_to(root):
            return None
        return target / "index.html" if target.is_dir() else target

    for path in pages:
        relative = "/" + path.relative_to(root).as_posix()
        base = relative[:-10] if relative.endswith("index.html") else relative
        doc = document(path)
        for identifier, count in doc.ids.items():
            if count > 1:
                issue(relative, "#" + identifier, "duplicate HTML id")
        # Embedded asset documents are not indexable portfolio pages.
        if not relative.startswith("/assets/"):
            if doc.lang.lower() not in ("en", "en-us"):
                issue(relative, doc.lang, "missing or unexpected page language")
            if doc.h1 != 1:
                issue(relative, "", "page must have one h1")
            if not doc.title.strip() or doc.title.strip().lower() == "blank":
                issue(relative, "", "empty or placeholder page title")
            expected = urljoin(site_url, base.lstrip("/"))
            if doc.canonical != expected:
                issue(relative, doc.canonical, "canonical URL differs from generated route")
            if not doc.metas.get("description", "").strip():
                issue(relative, "", "missing page description")
            if "noindex" in doc.metas.get("robots", "") and "draft-notice" in path.read_text():
                issue(relative, "", "unpublished draft rendered in production")
            for image in doc.images:
                if "alt" not in image:
                    issue(relative, image.get("src", ""), "image lacks alt attribute")
                if not all(str(image.get(key, "")).isdigit() and int(image[key]) > 0
                           for key in ("width", "height")):
                    issue(relative, image.get("src", ""), "image lacks positive reserved dimensions")

        for link in set(doc.links):
            parsed = urlsplit(urljoin(urljoin(site_url, base.lstrip("/")), link))
            if parsed.scheme not in ("http", "https") or parsed.netloc != host:
                continue
            checked += 1
            target = local_destination(parsed)
            if target is None or not target.is_file():
                issue(relative, link, "missing local destination")
            elif parsed.fragment and target.suffix == ".html":
                if unquote(parsed.fragment) not in document(target).ids:
                    issue(relative, link, "missing fragment")

    feed = sitemap = None
    for name in REQUIRED:
        if not (root / name).is_file():
            issue("", name, "required route missing")
    for name in PRIVATE + BUILD_FILES + TEMPLATE_OUTPUTS:
        if (root / name).exists():
            issue("", name, "private, build-only or template content shipped")
    for path in (root / "news").glob("announcement_*.md"):
        issue("", str(path.relative_to(root)), "template news shipped")

    for name in ("feed.xml", "sitemap.xml"):
        if (root / name).is_file():
            try:
                tree = ET.parse(root / name)
                if name == "feed.xml":
                    feed = tree
                    title = tree.findtext("a:title", default="", namespaces=ATOM).strip()
                    if not title or title.lower() == "blank":
                        issue("", name, "feed title is empty or placeholder")
                    entries = tree.findall("a:entry", ATOM)
                    for entry in entries:
                        author = entry.findtext("a:author/a:name", default="", namespaces=ATOM).strip()
                        if not author:
                            issue("", name, "feed entry lacks author name")
                else:
                    sitemap = tree
            except ET.ParseError as error:
                issue("", name, "invalid XML: " + str(error))

    draft_routes = []
    xml_urls = set()
    for tree in (feed, sitemap):
        if tree is not None:
            for element in tree.iter():
                for value in [element.text or "", element.attrib.get("href", "")]:
                    if value.strip().startswith(("http://", "https://")):
                        xml_urls.add(urlsplit(value.strip()).path.rstrip("/"))

    for post in manifest["posts"]:
        if post["published"]:
            continue
        route = post_route(post, manifest["permalink"])
        parsed = urlsplit(urljoin(site_url, route.lstrip("/")))
        draft_routes.append(parsed.path)
        target = local_destination(parsed)
        if target and target.is_file():
            issue("", parsed.path, "unpublished draft shipped")
        if parsed.path.rstrip("/") in xml_urls:
            issue("", parsed.path, "unpublished draft indexed in feed or sitemap")

    return {"site": str(root), "htmlPages": len(pages),
            "localReferencesChecked": checked, "unpublishedDraftsChecked": len(draft_routes),
            "errors": errors}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", default="_site")
    parser.add_argument("--source", default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument("--report", default=".local/redesign/evidence/static-site-check.json")
    args = parser.parse_args()
    if not Path(args.site).is_dir():
        parser.error("Build directory does not exist")
    try:
        result = audit(args.site, args.source)
    except (subprocess.CalledProcessError, ValueError, OSError) as error:
        print("Static audit could not run: " + str(error), file=sys.stderr)
        return 2
    output = Path(args.report)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    return 1 if result["errors"] else 0

if __name__ == "__main__":
    sys.exit(main())
