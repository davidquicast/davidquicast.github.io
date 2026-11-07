"""Mutation tests for publishing guards: successful checks must be able to fail."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "check-site.py"
spec = importlib.util.spec_from_file_location("check_site", SCRIPT)
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)
SITE_URL = "https://davidquicast.github.io"

class StaticSiteAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / "source"
        self.site = Path(self.temp.name) / "site"
        self.source.mkdir()
        self.site.mkdir()
        (self.source / "_config.yml").write_text(
            "url: " + SITE_URL + "\ntitle: David Quispe\npermalink: /blog/:year/:title/\n")
        for name in checker.REQUIRED:
            path = self.site / name
            path.parent.mkdir(parents=True, exist_ok=True)
            if path.suffix == ".html":
                route = "/" + name.removesuffix("index.html")
                path.write_text(self.page(route))
        (self.site / "feed.xml").write_text(
            '<feed xmlns="http://www.w3.org/2005/Atom"><title>David Quispe</title>'
            '<entry><title>Example</title><author><name>David Quispe</name></author></entry></feed>')
        (self.site / "sitemap.xml").write_text(
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            '<url><loc>' + SITE_URL + '/</loc></url></urlset>')

    def page(self, route, body=""):
        return ('<!doctype html><html lang="en"><head><title>Test page</title>'
                '<meta name="description" content="A meaningful page.">'
                '<link rel="canonical" href="' + SITE_URL + route + '">'
                '</head><body><h1>Test page</h1>' + body + '</body></html>')

    def errors(self):
        return checker.audit(self.site, self.source)["errors"]

    def assertIssue(self, text):
        self.assertTrue(any(text in item["issue"] for item in self.errors()), self.errors())

    def test_clean_site_is_accepted(self):
        self.assertEqual(self.errors(), [])

    def test_missing_local_reference_is_rejected(self):
        (self.site / "index.html").write_text(self.page("/", '<a href="/missing/">Missing</a>'))
        self.assertIssue("missing local destination")

    def test_duplicate_ids_and_missing_fragments_are_rejected(self):
        (self.site / "index.html").write_text(self.page(
            "/", '<p id="same"></p><p id="same"></p><a href="#missing">Jump</a>'))
        self.assertIssue("duplicate HTML id")
        self.assertIssue("missing fragment")

    def test_blank_feed_and_missing_author_are_rejected(self):
        (self.site / "feed.xml").write_text(
            '<feed xmlns="http://www.w3.org/2005/Atom"><title>blank</title><entry/></feed>')
        self.assertIssue("feed title")
        self.assertIssue("author name")

    def test_template_news_and_build_files_are_rejected(self):
        path = self.site / "news" / "announcement_2.md"
        path.mkdir(parents=True)
        (self.site / "docker.md").write_text("Build instructions")
        self.assertIssue("template news")
        self.assertIssue("build-only")

    def test_custom_permalink_and_date_draft_is_rejected(self):
        folder = self.source / "_posts" / "en-us"
        folder.mkdir(parents=True)
        (folder / "2026-01-01-draft.md").write_text(
            '---\ntitle: Draft\npublished: false\ndate: 2027-03-02\n'
            'slug: custom-slug\npermalink: /notes/:year/:title/\n---\nDraft')
        path = self.site / "notes" / "2027" / "custom-slug"
        path.mkdir(parents=True)
        (path / "index.html").write_text(self.page("/notes/2027/custom-slug/"))
        self.assertIssue("unpublished draft shipped")

    def test_draft_only_in_sitemap_is_rejected(self):
        folder = self.source / "_posts" / "en-us"
        folder.mkdir(parents=True)
        (folder / "2026-01-01-draft.md").write_text(
            '---\ntitle: Draft\npublished: false\n---\nDraft')
        (self.site / "sitemap.xml").write_text(
            '<urlset><url><loc>' + SITE_URL + '/blog/2026/draft/</loc></url></urlset>')
        self.assertIssue("unpublished draft indexed")

    def test_images_need_alt_and_reserved_dimensions(self):
        (self.site / "image.webp").write_bytes(b"fixture")
        (self.site / "index.html").write_text(self.page("/", '<img src="/image.webp">'))
        self.assertIssue("alt attribute")
        self.assertIssue("reserved dimensions")

    def test_bad_canonical_and_private_tree_are_rejected(self):
        (self.site / "index.html").write_text(self.page("/wrong/"))
        (self.site / ".local").mkdir()
        self.assertIssue("canonical URL")
        self.assertIssue("private, build-only")

if __name__ == "__main__":
    unittest.main()
