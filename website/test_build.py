"""Tests for build.py. Run: python3 -m unittest website/test_build.py"""
import json, os, re, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build

SRC = '''<!doctype html>
<html lang="en">
<head>
<title>T</title>
<meta name="description" content="D">
<link rel="canonical" href="https://mcctl.mirolab.dev/">
<meta property="og:url" content="https://mcctl.mirolab.dev/">
<meta property="og:title" content="Minecraft Server Manager">
<meta property="og:description" content="OD">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400&family=Noto+Sans+KR:wght@400;500&family=Noto+Sans+JP:wght@400&display=swap">
<script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":"FAQPage"},{"@type":"SoftwareApplication"}]}</script>
</head>
<body>
<p><span class="en">E<b>1</b></span><span class="ko">K<span>x</span></span><span class="ja">J<br>j</span></p>
<!-- c --> &amp; &#169;
<div class="en ko">both<div>n</div></div><span class="x ko en">y</span>
<img class="ko" src="a.png"><svg class="ja"><use href="#a"/></svg><br class="ko"/>
<a href="/" data-set-lang="en" aria-current="page">en</a><a href="/ko/" data-set-lang="ko">ko</a><a href="/ja/" data-set-lang="ja">ja</a>
</body>
</html>
'''

class T(unittest.TestCase):
    def page(self, lang):
        return build.render(SRC, lang)

    def test_strip(self):
        en, ko, ja = (self.page(l) for l in ("en", "ko", "ja"))
        self.assertIn('<span class="en">E<b>1</b></span>', en)
        self.assertNotIn("K<span", en)
        self.assertNotIn("J<br>", en)
        self.assertIn('<span class="ko">K<span>x</span></span>', ko)
        self.assertNotIn("E<b>", ko)
        self.assertEqual(ja.count('<img'), 0)
        self.assertNotIn('<svg class="ja"', en)
        self.assertIn('<svg class="ja"><use href="#a"/></svg>', ja)
        self.assertNotIn('<br class="ko"/>', en)
        self.assertIn("both", en); self.assertIn("both", ko); self.assertNotIn("both", ja)
        self.assertNotIn(">y<", ja)
        for p in (en, ko, ja):
            self.assertIn("<!-- c --> &amp; &#169;", p)

    def test_identity_for_unmatched(self):
        # no lang-class elements removed => only head substitutions differ
        plain = "<!doctype html>\n<html lang=\"en\"><head></head><body><br/><p>x &amp; y</p></body></html>"
        self.assertEqual(build.strip_langs(plain, "ko"), plain)

    def test_head(self):
        ko = self.page("ko")
        self.assertIn('<html lang="ko">', ko)
        self.assertIn("<title>%s</title>" % build.META["ko"]["title"], ko)
        self.assertIn('href="https://mcctl.mirolab.dev/ko/"', ko)
        self.assertIn('<meta property="og:url" content="https://mcctl.mirolab.dev/ko/">', ko)
        self.assertIn('content="%s"' % build.META["ko"]["description"], ko)
        self.assertIn('data-set-lang="ko" aria-current="page"', ko)
        self.assertNotIn('data-set-lang="en" aria-current="page"', ko)
        en = self.page("en")
        self.assertIn("<title>T</title>", en)
        self.assertIn('data-set-lang="en" aria-current="page"', en)

    def test_hreflang(self):
        for l in ("en", "ko", "ja"):
            p = self.page(l)
            for h, u in (("en", ""), ("ko", "ko/"), ("ja", "ja/"), ("x-default", "")):
                self.assertIn('<link rel="alternate" hreflang="%s" href="https://mcctl.mirolab.dev/%s">' % (h, u), p)

    def test_fonts(self):
        self.assertNotIn("Noto+Sans", self.page("en"))
        self.assertIn("Noto+Sans+KR", self.page("ko")); self.assertNotIn("Noto+Sans+JP", self.page("ko"))
        self.assertIn("Noto+Sans+JP", self.page("ja")); self.assertNotIn("Noto+Sans+KR", self.page("ja"))
        self.assertIn("family=Inter:wght@400&display=swap", self.page("en"))

    def test_jsonld(self):
        def types(p):
            m = re.search(r'<script type="application/ld\+json">(.*?)</script>', p, re.S)
            return [n["@type"] for n in json.loads(m.group(1))["@graph"]]
        self.assertIn("FAQPage", types(self.page("en")))
        for l in ("ko", "ja"):
            self.assertEqual(types(self.page(l)), ["WebSite", "SoftwareApplication"])

class RealSite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = tempfile.mkdtemp()
        build.build(cls.out)

    def read(self, rel):
        with open(os.path.join(self.out, rel), encoding="utf-8") as f:
            return f.read()

    def test_pages(self):
        for lang, rel in (("en", "index.html"), ("ko", "ko/index.html"), ("ja", "ja/index.html")):
            p = self.read(rel)
            others = {"en", "ko", "ja"} - {lang}
            for m in re.finditer(r'class="([^"]*)"', p):
                c = set(m.group(1).split())
                self.assertFalse(c & others and lang not in c, m.group(0))
            self.assertIn('<html lang="%s">' % lang, p)
            for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', p, re.S):
                json.loads(m.group(1))
            self.assertEqual(p.count('hreflang="x-default"'), 1)
            self.assertNotRegex(p, r'(?:src|href)="assets/|url\("assets/')
            for a in re.findall(r'(?:src|href)="(/assets/[^"?#]+)"|url\("(/assets/[^"]+)"\)', p):
                f = a[0] or a[1]
                self.assertTrue(os.path.exists(os.path.join(self.out, f.lstrip("/"))), f)

    def test_copy_excludes(self):
        for n in ("build.py", "wrangler.jsonc", "test_build.py", "_site"):
            self.assertFalse(os.path.exists(os.path.join(self.out, n)), n)
        self.assertTrue(os.path.exists(os.path.join(self.out, ".assetsignore")))

if __name__ == "__main__":
    unittest.main()
