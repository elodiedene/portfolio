#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Outil local de création de projets pour le portfolio.

Lance un petit serveur (uniquement la bibliothèque standard Python) qui
affiche un formulaire dans le navigateur. À la validation, l'outil :
  1. crée un nouveau fichier projetN.html à partir du gabarit,
  2. ajoute la card correspondante dans index.html,
  3. met à jour la navigation « précédent / suivant » entre projets,
  4. enregistre les images téléversées dans le dossier images/.

Usage :  python3 tools/nouveau-projet.py
"""

import base64
import json
import os
import re
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                     # racine du portfolio
IMAGES_DIR = os.path.join(ROOT, "images")
INDEX_FILE = os.path.join(ROOT, "index.html")
BUILDER_FILE = os.path.join(HERE, "builder.html")
PORT = 4321
CURRENT_YEAR = datetime.now().year


# ────────────────────────────────────────────────────────────
#  Petites aides
# ────────────────────────────────────────────────────────────

def escape_html(s):
    if s is None:
        s = ""
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def fmt(s):
    """Met en forme : **gras**, *italique*. Le reste est échappé."""
    s = escape_html(s).strip()
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\*(.+?)\*", r"<em>\1</em>", s)
    return s


def plain_text(s):
    """Texte brut sans balises ni &nbsp; (pour la navigation)."""
    if s is None:
        s = ""
    s = str(s).replace("**", "").replace("*", "").replace("&nbsp;", " ")
    s = re.sub(r"<[^>]+>", "", s)
    return s.strip()


def next_project_number():
    mx = 0
    for f in os.listdir(ROOT):
        m = re.match(r"^projet(\d+)\.html$", f)
        if m:
            mx = max(mx, int(m.group(1)))
    return mx + 1


def last_project_number():
    mx = 0
    for f in os.listdir(ROOT):
        m = re.match(r"^projet(\d+)\.html$", f)
        if m:
            mx = max(mx, int(m.group(1)))
    return mx


def get_shared_style():
    """<style> le plus complet parmi les pages projet existantes."""
    best = ""
    for f in os.listdir(ROOT):
        if not re.match(r"^projet\d+\.html$", f):
            continue
        with open(os.path.join(ROOT, f), encoding="utf-8") as fh:
            html = fh.read()
        m = re.search(r"<style>([\s\S]*?)</style>", html)
        if m and len(m.group(1)) > len(best):
            best = m.group(1)
    return best


def get_project_title(num):
    try:
        with open(os.path.join(ROOT, "projet%d.html" % num), encoding="utf-8") as fh:
            html = fh.read()
        m = re.search(r"<h1>([\s\S]*?)</h1>", html)
        return plain_text(m.group(1)) if m else "Projet %d" % num
    except OSError:
        return "Projet %d" % num


# ────────────────────────────────────────────────────────────
#  Images
# ────────────────────────────────────────────────────────────

class ImageSaver:
    def __init__(self, project_num):
        self.num = project_num
        self.counter = 0

    def save(self, img):
        if not img:
            return ""
        if isinstance(img, str):
            return img.strip()
        if not img.get("__img") or not img.get("data"):
            return ""
        self.counter += 1
        ext = re.sub(r"[^a-z0-9]", "", str(img.get("ext", "png")).lower()) or "png"
        name = "p%d-%d.%s" % (self.num, self.counter, ext)
        with open(os.path.join(IMAGES_DIR, name), "wb") as fh:
            fh.write(base64.b64decode(img["data"]))
        return "images/%s" % name


# ────────────────────────────────────────────────────────────
#  Rendu des blocs
# ────────────────────────────────────────────────────────────

def render_paragraphs(text):
    lines = [l.strip() for l in str(text or "").split("\n") if l.strip()]
    return "\n".join("            <p>%s</p>" % fmt(l) for l in lines)


def render_sub_desc(text):
    if not text or not str(text).strip():
        return ""
    return '            <p class="subsection-desc">%s</p>\n' % fmt(text)


def lines_of(text):
    return [l.strip() for l in str(text or "").split("\n") if l.strip()]


def render_block(block, saver):
    t = block.get("type")

    if t == "text":
        return render_paragraphs(block.get("text"))

    if t == "subheading":
        out = "            <h3>%s</h3>\n" % fmt(block.get("heading"))
        out += render_sub_desc(block.get("desc"))
        return out.rstrip("\n")

    if t == "objectives":
        items = []
        for it in block.get("items", []):
            if it.get("number") or it.get("text"):
                items.append(
                    '                <div class="objective-item">\n'
                    '                    <span class="objective-number">%s</span>\n'
                    '                    <p class="objective-text">%s</p>\n'
                    '                </div>' % (fmt(it.get("number")), fmt(it.get("text")))
                )
        return ('%s            <div class="objectives-grid">\n%s\n            </div>'
                % (render_sub_desc(block.get("desc")), "\n".join(items)))

    if t in ("insights", "hmw"):
        dot = "pill-dot--key" if t == "hmw" else "pill-dot--insight"
        list_cls = "pills-list pills-list--hmw" if t == "hmw" else "pills-list"
        pills = "\n".join(
            '                <span class="pill"><span class="pill-dot %s"></span>%s</span>'
            % (dot, fmt(l)) for l in lines_of(block.get("items"))
        )
        return ('%s            <div class="%s">\n%s\n            </div>'
                % (render_sub_desc(block.get("desc")), list_cls, pills))

    if t == "statement":
        return '            <span class="pill-statement">%s</span>' % fmt(block.get("text"))

    if t == "image":
        src = saver.save(block.get("image"))
        if not src:
            return ""
        return '            <img src="%s" alt="%s">' % (escape_html(src), escape_html(block.get("alt")))

    if t == "twocol":
        cols = []
        for c in block.get("columns", []):
            src = saver.save(c.get("image"))
            img = ('                    <a href="%s" target="_blank" rel="noopener">'
                   '<img src="%s" alt="%s"></a>'
                   % (escape_html(src), escape_html(src), escape_html(c.get("label")))) if src else ""
            caption = ('\n                    <p>%s</p>' % fmt(c.get("caption"))) if c.get("caption") else ""
            cols.append(
                '                <div>\n'
                '                    <p class="col-label">%s</p>\n%s%s\n'
                '                </div>' % (fmt(c.get("label")), img, caption)
            )
        return ('%s            <div class="two-col-grid">\n%s\n            </div>'
                % (render_sub_desc(block.get("desc")), "\n".join(cols)))

    if t == "decisions":
        blocks = [d for d in block.get("items", [])
                  if d.get("avant") or d.get("probleme") or d.get("decision") or d.get("impact")]

        def rows(d):
            r = []
            if d.get("avant"):
                r.append('                    <div class="decision-row">\n'
                         '                        <span class="decision-row-label decision-row-label--avant">Avant</span>\n'
                         '                        <span class="decision-row-text">%s</span>\n'
                         '                    </div>' % fmt(d["avant"]))
            if d.get("probleme"):
                r.append('                    <div class="decision-row">\n'
                         '                        <span class="decision-row-label">Problème</span>\n'
                         '                        <span class="decision-row-text">%s</span>\n'
                         '                    </div>' % fmt(d["probleme"]))
            if d.get("decision"):
                r.append('                    <div class="decision-row">\n'
                         '                        <span class="decision-row-label">Décision</span>\n'
                         '                        <span class="decision-row-text">%s</span>\n'
                         '                    </div>' % fmt(d["decision"]))
            if d.get("impact"):
                r.append('                    <div class="decision-row">\n'
                         '                        <span class="decision-row-label">Impact attendu</span>\n'
                         '                        <span class="decision-row-text">%s</span>\n'
                         '                    </div>' % fmt(d["impact"]))
            return "\n".join(r)

        inner = '\n                <div class="decision-divider"></div>\n'.join(
            '                <div class="decision-block">\n%s\n                </div>' % rows(d)
            for d in blocks
        )
        return ('%s            <div class="decisions-list">\n%s\n            </div>'
                % (render_sub_desc(block.get("desc")), inner))

    if t == "moscow":
        def card(level, label, cls):
            items = "\n".join('                        <li>%s</li>' % fmt(l)
                              for l in lines_of(block.get(level)))
            if not items:
                return ""
            return ('                <div class="priority-card priority-card--%s">\n'
                    '                    <span class="priority-badge">%s</span>\n'
                    '                    <ul class="priority-card-list">\n%s\n'
                    '                    </ul>\n'
                    '                </div>' % (cls, label, items))
        cards = "\n".join(filter(None, [
            card("must", "Must have", "must"),
            card("should", "Should have", "should"),
            card("nice", "Nice to have", "nice"),
            card("wont", "Won't do", "wont"),
        ]))
        return ('%s            <div class="features-priority-alt">\n%s\n            </div>'
                % (render_sub_desc(block.get("desc")), cards))

    if t == "gallery":
        items = []
        for it in block.get("items", []):
            src = saver.save(it.get("image"))
            if not src:
                continue
            caption = ('\n                    <p class="image-caption">%s</p>' % fmt(it.get("caption"))) \
                if it.get("caption") else ""
            items.append(
                '                <div class="design-grid-item">\n'
                '                    <a href="%s" target="_blank" rel="noopener">'
                '<img src="%s" alt="%s"></a>%s\n'
                '                </div>' % (escape_html(src), escape_html(src),
                                           escape_html(it.get("alt")), caption)
            )
        return ('%s            <div class="design-grid">\n%s\n            </div>'
                % (render_sub_desc(block.get("desc")), "\n".join(items)))

    return ""


def render_section(section, saver):
    parts = []
    for b in section.get("blocks", []):
        rendered = render_block(b, saver)
        if rendered and rendered.strip():
            parts.append(rendered)
    blocks = "\n\n".join(parts)
    return ('        <div class="case-section">\n'
            '            <h2>%s</h2>\n\n%s\n'
            '        </div>' % (fmt(section.get("title")), blocks))


# ────────────────────────────────────────────────────────────
#  Gabarit de la page projet
# ────────────────────────────────────────────────────────────

def build_project_page(data, num):
    saver = ImageSaver(num)
    style = get_shared_style()

    header_tags = "\n".join('            <span class="tag">%s</span>' % escape_html(tg)
                            for tg in data.get("headerTags", []))
    sections = "\n\n".join(render_section(s, saver) for s in data.get("sections", []))

    prev_num = num - 1
    has_prev = os.path.exists(os.path.join(ROOT, "projet%d.html" % prev_num))
    if has_prev:
        project_nav = (
            '        <!-- Navigation projets -->\n'
            '        <div class="project-nav">\n'
            '            <a class="project-nav-prev" href="projet%d.html">\n'
            '                <span class="project-nav-dir">← Projet précédent</span>\n'
            '                <span class="project-nav-title">%s</span>\n'
            '            </a>\n'
            '        </div>\n\n' % (prev_num, escape_html(get_project_title(prev_num)))
        )
    else:
        project_nav = ""

    page_title = plain_text(data.get("title"))

    return """<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>%(page_title)s — Elodie Dené</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap" rel="stylesheet">
    <style>%(style)s</style>
</head>
<body>

    <!-- Navigation -->
    <nav>
        <a href="index.html" class="nav-logo"><img src="images/Logo.svg" alt="Logo Elodie Dené" class="nav-logo-img">Elodie Dené</a>
        <ul class="nav-links">
            <li>
                <span class="nav-available">
                    <span class="nav-available-dot"></span>
                    Disponible
                </span>
            </li>
            <li><a href="about.html">À propos</a></li>
        </ul>
    </nav>

    <!-- Header -->
    <header class="case-header">
        <a href="index.html" class="back-link">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7H2M2 7L7 2M2 7L7 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Retour
        </a>
        <div class="case-tags">
%(header_tags)s
        </div>
        <h1>%(title)s</h1>
        <div class="case-meta">
            <div class="meta-item">
                <span class="meta-label">Entreprise</span>
                <p>%(company)s</p>
            </div>
            <div class="meta-item">
                <span class="meta-label">Rôle</span>
                <p>%(role)s</p>
            </div>
            <div class="meta-item">
                <span class="meta-label">Année</span>
                <p>%(year)s</p>
            </div>
        </div>
    </header>

    <!-- Content -->
    <article class="case-content">

%(sections)s

%(project_nav)s    </article>

    <!-- Back to top -->
    <a href="#" class="back-to-top" id="backToTop" aria-label="Remonter en haut">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 11L8 5L13 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </a>
    <script>
        const btn = document.getElementById('backToTop');
        window.addEventListener('scroll', () => {
            btn.classList.toggle('visible', window.scrollY > 300);
        });
    </script>

    <!-- Footer -->
    <footer>
        <p>© %(cur_year)s Elodie Dené</p>
    </footer>

</body>
</html>
""" % {
        "page_title": escape_html(page_title),
        "style": style,
        "header_tags": header_tags,
        "title": fmt(data.get("title")),
        "company": fmt(data.get("company")),
        "role": fmt(data.get("role")),
        "year": fmt(data.get("year")),
        "sections": sections,
        "project_nav": project_nav,
        "cur_year": CURRENT_YEAR,
    }


# ────────────────────────────────────────────────────────────
#  Card dans index.html
# ────────────────────────────────────────────────────────────

def build_card(data, num):
    saver = ImageSaver(num + 1000)  # noms distincts pour l'image de card
    card_img = saver.save(data.get("cardImage"))
    tags = "\n".join('                            <span class="showcase-tag">%s</span>' % escape_html(tg)
                     for tg in data.get("cardTags", []))
    if card_img:
        top_style = ("background-color: var(--bg-soft); background-image: url('%s'); "
                     "background-size: cover; background-position: center; "
                     "border-bottom: 1px solid var(--border);" % escape_html(card_img))
    else:
        top_style = "background-color: var(--bg-soft); border-bottom: 1px solid var(--border);"

    return ('                <!-- ░ Carte projet %(num)d ░ -->\n'
            '                <a href="projet%(num)d.html" class="bento-card showcase-card">\n'
            '                    <div class="showcase-top" style="%(top)s">\n'
            '                    </div>\n'
            '                    <div class="showcase-bottom">\n'
            '                        <div class="showcase-tags">\n%(tags)s\n'
            '                        </div>\n'
            '                        <h3 class="showcase-title">%(title)s</h3>\n'
            '                        <p class="showcase-desc">%(desc)s</p>\n'
            '                        <div class="showcase-footer">\n'
            '                            <span class="showcase-meta">%(year)s</span>\n'
            '                            <span class="showcase-btn">\n'
            '                                Voir le projet\n'
            '                                <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 12L12 2M12 2H5M12 2V9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>\n'
            '                            </span>\n'
            '                        </div>\n'
            '                    </div>\n'
            '                </a>' % {
                "num": num, "top": top_style, "tags": tags,
                "title": fmt(data.get("cardTitle")), "desc": fmt(data.get("cardDesc")),
                "year": fmt(data.get("year")),
            })


def insert_card(card_html, position):
    with open(INDEX_FILE, encoding="utf-8") as fh:
        html = fh.read()
    if position == "debut" and "<!-- CARDS:START -->" in html:
        html = html.replace("<!-- CARDS:START -->", "<!-- CARDS:START -->\n%s" % card_html)
    elif "<!-- CARDS:END -->" in html:
        html = html.replace("<!-- CARDS:END -->", "%s\n                <!-- CARDS:END -->" % card_html)
    else:
        raise RuntimeError("Marqueurs CARDS introuvables dans index.html")
    with open(INDEX_FILE, "w", encoding="utf-8") as fh:
        fh.write(html)


# ────────────────────────────────────────────────────────────
#  Lien « suivant » du projet précédent
# ────────────────────────────────────────────────────────────

def update_previous_nav(prev_num, new_num, new_title):
    path = os.path.join(ROOT, "projet%d.html" % prev_num)
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as fh:
        html = fh.read()

    next_anchor = ('            <a class="project-nav-next" href="projet%d.html">\n'
                   '                <span class="project-nav-dir">Projet suivant →</span>\n'
                   '                <span class="project-nav-title">%s</span>\n'
                   '            </a>' % (new_num, escape_html(new_title)))

    nav_re = re.compile(r'(<div class="project-nav">)([\s\S]*?)(</div>)')
    m = nav_re.search(html)
    if not m:
        return
    inner = m.group(2)
    if "project-nav-next" in inner:
        inner = re.sub(r'<a class="project-nav-next"[\s\S]*?</a>', next_anchor.strip(), inner)
    else:
        inner = inner.rstrip() + "\n" + next_anchor + "\n        "
    html = html[:m.start()] + m.group(1) + inner + m.group(3) + html[m.end():]
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(html)


# ────────────────────────────────────────────────────────────
#  Création complète
# ────────────────────────────────────────────────────────────

def create_project(data):
    num = next_project_number()
    prev_num = num - 1

    page = build_project_page(data, num)
    with open(os.path.join(ROOT, "projet%d.html" % num), "w", encoding="utf-8") as fh:
        fh.write(page)

    card = build_card(data, num)
    insert_card(card, data.get("cardPosition") or "debut")

    update_previous_nav(prev_num, num, plain_text(data.get("title")))

    return {"num": num, "file": "projet%d.html" % num}


# ────────────────────────────────────────────────────────────
#  Serveur HTTP
# ────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # silencieux

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            with open(BUILDER_FILE, "rb") as fh:
                body = fh.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path == "/api/info":
            self._json(200, {
                "nextNumber": next_project_number(),
                "lastNumber": last_project_number(),
                "lastTitle": get_project_title(last_project_number()),
                "year": CURRENT_YEAR,
            })
            return
        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Introuvable")

    def do_POST(self):
        if self.path == "/api/create":
            try:
                length = int(self.headers.get("Content-Length", 0))
                data = json.loads(self.rfile.read(length).decode("utf-8"))
                result = create_project(data)
                self._json(200, dict(ok=True, **result))
            except Exception as e:  # noqa
                import traceback
                traceback.print_exc()
                self._json(500, {"ok": False, "error": str(e)})
            return
        self.send_response(404)
        self.end_headers()


def main():
    url = "http://localhost:%d" % PORT
    print("\n  🎨  Outil de création de projets — portfolio Elodie Dené")
    print("  ➜  Ouvre :  %s\n" % url)
    print("  (Ctrl+C pour arrêter le serveur)\n")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    ThreadingHTTPServer(("localhost", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
