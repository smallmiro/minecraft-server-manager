#!/usr/bin/env python3
"""Build per-language landing pages (en, ko, ja) from index.html into _site/.

Usage: python3 website/build.py   (stdlib only)
"""
import html
import json
import os
import re
import shutil
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = "https://mcctl.mirolab.dev/"
LANGS = ("en", "ko", "ja")
PATHS = {"en": "", "ko": "ko/", "ja": "ja/"}
IGNORE = (".wrangler", "_site", "build.py", "test_build.py", "wrangler.jsonc", "__pycache__", "node_modules")

# en: values already in index.html (None = leave untouched)
META = {
    "en": {},
    "ko": {
        "title": "Minecraft Server Manager — 포트 하나로 여러 자바 서버 운영",
        "description": "직접 호스팅하는 모든 마인크래프트 자바 서버를 포트 하나로 운영하세요. 플레이어가 접속하면 서버가 켜지고, 아무도 없으면 꺼집니다. CLI와 웹 콘솔을 제공합니다.",
        "og_description": "Docker로 띄우고, 플레이어가 오면 깨웁니다.",
    },
    "ja": {
        "title": "Minecraft Server Manager — ひとつのポートで複数の Java サーバーを運用",
        "description": "ホストしているすべての Minecraft Java サーバーをひとつのポートで。プレイヤーが接続するとサーバーが起動し、誰もいなくなると停止します。CLI と Web コンソール付き。",
        "og_description": "Docker で動かし、プレイヤーが来たら起こす。",
    },
}

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class _Stripper(HTMLParser):
    """Re-emits the input verbatim, dropping elements that belong only to other languages."""

    def __init__(self, lang):
        super().__init__(convert_charrefs=False)
        self.lang, self.out, self.skip = lang, [], []  # skip: stack of open tag names

    def _drop(self, attrs):
        if self.lang is None:
            return False
        classes = set((dict(attrs).get("class") or "").split())
        return bool(classes & (set(LANGS) - {self.lang})) and self.lang not in classes

    def _emit(self, s):
        if not self.skip:
            self.out.append(s)

    def handle_starttag(self, tag, attrs):
        if self.skip:
            if tag not in VOID:
                self.skip.append(tag)
        elif self._drop(attrs):
            if tag not in VOID:
                self.skip.append(tag)
        else:
            self.out.append(self.get_starttag_text())

    def handle_startendtag(self, tag, attrs):
        if not self.skip and not self._drop(attrs):
            self.out.append(self.get_starttag_text())

    def handle_endtag(self, tag):
        if self.skip:
            if tag in self.skip:
                while self.skip.pop() != tag:
                    pass
        else:
            self.out.append("</%s>" % tag)

    def handle_data(self, d): self._emit(d)
    def handle_entityref(self, n): self._emit("&%s;" % n)
    def handle_charref(self, n): self._emit("&#%s;" % n)
    def handle_comment(self, d): self._emit("<!--%s-->" % d)
    def handle_decl(self, d): self._emit("<!%s>" % d)
    def handle_pi(self, d): self._emit("<?%s>" % d)
    def unknown_decl(self, d): self._emit("<![%s]>" % d)


def strip_langs(text, lang):
    p = _Stripper(lang)
    p.feed(text)
    p.close()
    return "".join(p.out)


def _sub1(pattern, repl, text, flags=0):
    new, n = re.subn(pattern, lambda m: repl, text, count=1, flags=flags)
    assert n == 1, "pattern not found: " + pattern
    return new


def _meta(text, attr, name, value):
    return re.sub(r'(<meta %s="%s" content=")[^"]*(")' % (attr, re.escape(name)),
                  lambda m: m.group(1) + html.escape(value) + m.group(2), text, count=1)


def render(src, lang):
    t = strip_langs(src, lang)
    m = META[lang]
    t = _sub1(r'<html lang="[^"]*">', '<html lang="%s">' % lang, t)
    if "title" in m:
        t = _sub1(r"<title>.*?</title>", "<title>%s</title>" % html.escape(m["title"]), t, re.S)
    if "description" in m:
        t = _meta(t, "name", "description", m["description"])
    if "og_description" in m:
        t = _meta(t, "property", "og:description", m["og_description"])
    if "title" in m:
        t = _meta(t, "property", "og:title", "Minecraft Server Manager")
    url = BASE + PATHS[lang]
    t = _sub1(r'<meta property="og:url" content="[^"]*">', '<meta property="og:url" content="%s">' % url, t)
    alts = "".join('\n<link rel="alternate" hreflang="%s" href="%s">' % (h, BASE + PATHS.get(h, ""))
                   for h in LANGS + ("x-default",))
    t = _sub1(r'<link rel="canonical" href="[^"]*">', '<link rel="canonical" href="%s">%s' % (url, alts), t)
    # fonts: keep only the Noto Sans family this language needs
    for fam in ("KR", "JP"):
        if lang != {"KR": "ko", "JP": "ja"}[fam]:
            t = re.sub(r"&family=Noto\+Sans\+%s[^&\"]*" % fam, "", t)
    # language switcher: mark the current page
    t = re.sub(r'(<a [^>]*data-set-lang="\w+")( aria-current="page")?',
               lambda mm: mm.group(1) + (' aria-current="page"' if mm.group(1).endswith('"%s"' % lang) else ""), t)
    if lang != "en":
        t = re.sub(r'(<script type="application/ld\+json">)(.*?)(</script>)',
                   lambda mm: mm.group(1) + _drop_faq(mm.group(2)) + mm.group(3), t, flags=re.S)
    return t


def _drop_faq(raw):
    data = json.loads(raw)
    data["@graph"] = [n for n in data["@graph"] if n.get("@type") != "FAQPage"]
    return "\n" + json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def build(out=None):
    out = out or os.path.join(HERE, "_site")
    shutil.rmtree(out, ignore_errors=True)
    shutil.copytree(HERE, out, ignore=shutil.ignore_patterns(*IGNORE))
    with open(os.path.join(HERE, "index.html"), encoding="utf-8") as f:
        src = f.read()
    for lang in LANGS:
        d = os.path.join(out, PATHS[lang])
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "index.html"), "w", encoding="utf-8", newline="") as f:
            f.write(render(src, lang))
    return out


if __name__ == "__main__":
    print("built", build())
