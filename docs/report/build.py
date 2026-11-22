#!/usr/bin/env python3
"""Собирает docs/report/process.md в report.html в стиле Орбиты. PDF — render.mjs (Playwright)."""
import html
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "process.md")
OUT = os.path.join(HERE, "report.html")
FONTS = "../../web/node_modules/@fontsource/onest/files"

DEMO_URL = os.environ.get("DEMO_URL", "https://111-88-81-132.sslip.io")  # адрес прототипа после деплоя
REPO_URL = "https://github.com/timurgondin/orbita-mgimo-ai-challenge"

# Скриншоты: номер метки → [(файл в img/, подпись)]. Нет файла — рисуется заглушка.
SHOTS = {
    "2": [("02-today-v1.png", "v1 · 15:21"), ("02-today-v2.png", "v2 · 15:36"),
          ("02-today-v3.png", "v3 · 15:49 · «китайская магнитола»"), ("02-today-v4.png", "v4 · 16:02 · эталон")],
    "4": [("04.png", "")],
    "B": [("B-1.png", ""), ("B-2.png", "")],
    "6": [("06-2.png", ""), ("06-3.png", ""), ("06-4.png", ""), ("06-1.png", ""), ("06-5.png", "")],
    "7": [("07.png", "Центр уведомлений")],
    "8": [("08.png", "Студенческий с живым QR")],
    "9": [("09.png", "Страница курса")],
    "10": [("10.png", "ИИ-помощник")],
    "11": [("11.png", "Библиотека: постамат")],
    "C": [("C-before.png", "21.11 · до"), ("01-phone.png", "сейчас")],
    "12": [("12-1.png", ""), ("12-2.png", ""), ("12-3.png", ""), ("12-4.png", "")],
    "13": [("13.png", "Шторка задания")],
    "14": [("14.png", "Random Coffee")],
    "15": [("15.png", "Кабинет преподавателя: проверка работы")],
    "16": [("16-1.png", "Аудитории"), ("16-2.png", "Красная кнопка")],
    "17": [("17.png", "Еда с КБЖУ")],
    "18": [("18-1.png", ""), ("18-2.png", ""), ("18-3.png", "")],
    "19": [("19.png", "")],
}


def is_phone(f: str) -> bool:
    import struct
    with open(os.path.join(HERE, "img", f), "rb") as fh:
        w, h = struct.unpack(">II", fh.read(24)[16:24])
    return h / w > 1.6


def inline(t: str) -> str:
    t = html.escape(t, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r'<a href="\2">\1</a>', t)
    return t


def figures(block: list[str]) -> str:
    """Блок меток [СКРИН …] подряд → одна группа: скриншоты компьютера сеткой, телефона — рядом."""
    files, caps, out = [], [], []
    for line in block:
        m = re.match(r"\*\*\[(СКРИН|СХЕМА)\s*([0-9A-Za-zА-Яа-я]*)\]\*\*\s*(.*)", line)
        if not m:
            continue
        kind, num, cap = m.groups()
        if kind == "СХЕМА":
            out.append(SCHEME)
            continue
        have = [(f, c) for f, c in SHOTS.get(num, []) if os.path.exists(os.path.join(HERE, "img", f))]
        if not have:
            out.append(f'<div class="ph"><span>{kind} {num}</span><p>{inline(cap)}</p></div>')
            continue
        files += have
        caps.append(inline(cap))
    if files:
        def fig(f, c):
            fc = f"<figcaption>{html.escape(c)}</figcaption>" if c else ""
            return f'<figure><img src="img/{f}" alt="">{fc}</figure>'
        desk = [x for x in files if not is_phone(x[0])]
        phones = [x for x in files if is_phone(x[0])]
        if desk:
            if len(desk) % 2 == 1:
                out.append(f'<div class="shots one">{fig(*desk[0])}</div>')
                desk = desk[1:]
            if desk:
                out.append('<div class="shots grid2">' + "".join(fig(*d) for d in desk) + "</div>")
        if phones:
            cols = 3 if len(phones) in (3, 5, 6) else min(len(phones), 4)
            out.append(f'<div class="shots phones c{cols}">' + "".join(fig(*p) for p in phones) + "</div>")
        out.append(f'<p class="cap">{" ".join(c for c in caps if c)}</p>')
    return "\n".join(out)


SCHEME = """<div class="scheme">
  <div class="node me"><b>Я</b><span>продакт и арт-директор: задачи, решения, ревью на телефоне</span></div>
  <div class="arrow"></div>
  <div class="node"><b>Документы для агентов</b><span>CLAUDE.md · vision · ui-guide · security · память</span></div>
  <div class="arrow"></div>
  <div class="row">
    <div class="node lead"><b>Opus 5.5 — тимлид</b><span>по треду bb на фичу, параллельно</span></div>
    <div class="node"><b>Субагенты</b><span>Sonnet, Haiku — объёмная работа</span></div>
    <div class="node"><b>Fable 5.2</b><span>ИИ-жюри</span></div>
  </div>
  <div class="arrow"></div>
  <div class="row">
    <div class="node"><b>Макет → ревью</b><span>18 HTML-макетов</span></div>
    <div class="node"><b>Автопроверки</b><span>620 проверок Playwright</span></div>
    <div class="node"><b>Коммит → push</b><span>GitHub Actions → прод</span></div>
  </div>
  <div class="loop">ошибка → правило в документах → следующий агент её не повторит</div>
</div>"""


def table(rows: list[str], stats: bool) -> str:
    cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in rows]
    head, body = cells[0], [r for r in cells[2:]]
    if stats:
        items = "".join(f'<div class="stat"><b>{inline(v)}</b><span>{inline(k)}</span></div>' for k, v in body)
        return f'<div class="stats">{items}</div>'
    th = "".join(f"<th>{inline(c)}</th>" for c in head)
    tb = "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body)
    return f"<table><thead><tr>{th}</tr></thead><tbody>{tb}</tbody></table>"


TOC: list[tuple[str, str, str, int]] = []  # (id, номер, название, уровень)


def body_html(md: str) -> str:
    lines = md.split("\n")
    out, i, section = [], 0, ""
    while i < len(lines):
        ln = lines[i]
        if not ln.strip() or ln.strip() == "---":
            i += 1
            continue
        if ln.startswith("## "):
            title = ln[3:].strip()
            m = re.match(r"(\d+)\.\s*(.*)", title)
            num, name = (m.group(1).zfill(2), m.group(2)) if m else ("", title)
            section = name
            kicker = f'<span class="num">{num}</span>' if num else ""
            major = name.startswith(("Как была устроена", "Этапы", "Работа с ошибками", "Безопасность"))
            sid = f"s{len(TOC)}"
            TOC.append((sid, num, name, 2))
            out.append(f'<section class="sec{" major" if major else ""}"><h2 id="{sid}">{kicker}{inline(name)}</h2>')
            out.append("</section>")  # закрываем сразу: секция — только маркер разрыва страницы
            i += 1
            continue
        if ln.startswith("### "):
            t = ln[4:].strip()
            m = re.match(r"(Этап \d+)\.\s*(.*?)\s*\(([^)]+)\)$", t)
            if m:
                sid = f"s{len(TOC)}"
                TOC.append((sid, m.group(1), m.group(2), 3))
                out.append(f'<h3 id="{sid}"><span class="stage">{m.group(1)}</span>{inline(m.group(2))}<span class="date">{m.group(3)}</span></h3>')
            else:
                out.append(f"<h3>{inline(t)}</h3>")
            i += 1
            continue
        if ln.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append(lines[i])
                i += 1
            stats = section == "Коротко" and rows[0].replace("|", "").strip() == ""
            out.append(table(rows, stats))
            continue
        if ln.startswith(">"):
            block = []
            while i < len(lines) and lines[i].startswith(">"):
                block.append(lines[i][1:].strip())
                i += 1
            if block[0].startswith("**[СКРИН") or block[0].startswith("**[СХЕМА"):
                out.append(figures([b for b in block if b]))
            else:
                text = " ".join(block)
                cls = "prompt" if text.startswith("«") else "note"
                label = '<span class="who">Промпт</span>' if cls == "prompt" else ""
                out.append(f'<blockquote class="{cls}">{label}<p>{inline(text)}</p></blockquote>')
            continue
        if re.match(r"^(- |\d+\. )", ln):
            ordered = bool(re.match(r"^\d+\. ", ln))
            items = []
            while i < len(lines) and re.match(r"^(- |\d+\. |  +\S)", lines[i]):
                cur = lines[i]
                if re.match(r"^(- |\d+\. )", cur):
                    items.append(re.sub(r"^(- |\d+\. )", "", cur))
                else:
                    items[-1] += " " + cur.strip()
                i += 1
            tag = "ol" if ordered else "ul"
            out.append(f"<{tag}>" + "".join(f"<li>{inline(x)}</li>" for x in items) + f"</{tag}>")
            continue
        para = [ln]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r"^(#|\||>|- |\d+\. |---)", lines[i]):
            para.append(lines[i])
            i += 1
        out.append(f"<p>{inline(' '.join(para))}</p>")
    return "\n".join(out)


MARK = """<svg viewBox="0 0 32 32" width="{s}" height="{s}" aria-hidden="true"><defs><mask id="m{s}"><rect width="32" height="32" fill="#fff"/><circle cx="22.4" cy="9.6" r="4.6" fill="#000"/></mask></defs><circle cx="16" cy="16" r="9" fill="none" stroke="#ededef" stroke-width="2.4" mask="url(#m{s})"/><circle cx="22.4" cy="9.6" r="2.6" fill="#8b8eff"/></svg>"""


def cover() -> str:
    demo = f'<a href="{DEMO_URL}">{html.escape(DEMO_URL.replace("https://", ""))}</a>' if DEMO_URL else "<i>ссылка после деплоя</i>"
    hero_html = (
        '<div class="hero"><img class="hd" src="img/01-desktop.png" alt=""><img class="hp" src="img/01-phone.png" alt=""></div>'
        if os.path.exists(os.path.join(HERE, "img/01-desktop.png"))
        else '<div class="ph hero-ph"><span>СКРИН 1</span><p>«Сегодня» на телефоне и компьютере</p></div>'
    )
    return f"""
<section class="cover">
  <div class="dots"></div>
  <div class="brand">{MARK.format(s=34)}<span>Орбита</span></div>
  <p class="kick">Единый цифровой кабинет Университета Будущего · MGIMO×AI Challenge</p>
  <h1>9 дней.<br>22 агента.<br><em>Ни одной строки кода, написанной руками.</em></h1>
  <p class="lead">Как я построил систему из ИИ-агентов, которая за девять дней сделала кабинет студента — от дизайн-системы до продакшна с автодеплоем.</p>
  {hero_html}
  <div class="foot">
  <div class="meta">
    <div><span>Прототип</span>{demo}</div>
    <div><span>Код</span><a href="{REPO_URL}">github.com/timurgondin/orbita-mgimo-ai-challenge</a></div>
    <div><span>Аккаунты · пароль <code>orbita-demo</code></span><code>a.vorontsova</code> <code>m.orlov</code> <code>n.lanskaya</code> <code>e.petrova</code></div>
  </div>
  <a class="qr" href="{DEMO_URL}"><img src="img/qr-demo.svg" alt=""><span>Открыть с телефона</span></a>
  </div>
</section>"""


CSS = f"""
@font-face {{ font-family: Onest; font-weight: 400; src: url({FONTS}/onest-cyrillic-400-normal.woff2) format('woff2'); unicode-range: U+0400-04FF; }}
@font-face {{ font-family: Onest; font-weight: 500; src: url({FONTS}/onest-cyrillic-500-normal.woff2) format('woff2'); unicode-range: U+0400-04FF; }}
@font-face {{ font-family: Onest; font-weight: 600; src: url({FONTS}/onest-cyrillic-600-normal.woff2) format('woff2'); unicode-range: U+0400-04FF; }}
@font-face {{ font-family: Onest; font-weight: 400; src: url({FONTS}/onest-latin-400-normal.woff2) format('woff2'); }}
@font-face {{ font-family: Onest; font-weight: 500; src: url({FONTS}/onest-latin-500-normal.woff2) format('woff2'); }}
@font-face {{ font-family: Onest; font-weight: 600; src: url({FONTS}/onest-latin-600-normal.woff2) format('woff2'); }}
:root {{
  --bg:#131315; --s1:#1b1b1e; --s2:#212124; --s3:#2a2a2e; --line:rgba(255,255,255,.08);
  --text:#ededef; --text-2:#a3a3ab; --text-3:#7e7e87; --accent:#8b8eff; --urgent:#f2a35e; --green:#5bd891;
}}
@page {{ size: A4; margin: 16mm 17mm 16mm; background: var(--bg); }}
@page :first {{ margin: 0; }}
* {{ box-sizing: border-box; }}
html {{ background: var(--bg); -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
body {{ margin: 0; font-family: Onest, system-ui, sans-serif; color: var(--text-2); font-size: 10.4pt; line-height: 1.6; font-variant-numeric: tabular-nums; }}
a {{ color: var(--accent); text-decoration: none; }}
b {{ color: var(--text); font-weight: 600; }}
code {{ font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: .86em; color: var(--text); background: var(--s2); border-radius: 5px; padding: .05em .35em; }}
p {{ margin: 0 0 3.2mm; }}

.cover {{ position: relative; height: 297mm; padding: 20mm 18mm 16mm; display: flex; flex-direction: column; overflow: hidden; break-after: page; }}
.dots {{ position: absolute; inset: 0 0 auto auto; width: 130mm; height: 90mm; background-image: radial-gradient(circle, rgba(139,142,255,.55) 1.1px, transparent 1.3px); background-size: 4.2mm 4.2mm; -webkit-mask-image: radial-gradient(ellipse at 85% 10%, #000 10%, transparent 70%); mask-image: radial-gradient(ellipse at 85% 10%, #000 10%, transparent 70%); }}
.brand {{ display: flex; align-items: center; gap: 3mm; color: var(--text); font-size: 15pt; font-weight: 600; letter-spacing: -.02em; }}
.kick {{ margin-top: 14mm; color: var(--text-3); font-size: 10pt; }}
.cover h1 {{ margin: 3mm 0 0; color: var(--text); font-size: 38pt; line-height: 1.05; font-weight: 500; letter-spacing: -.035em; }}
.cover h1 em {{ font-style: normal; color: var(--accent); }}
.lead {{ margin-top: 6mm; max-width: 150mm; font-size: 12.5pt; line-height: 1.5; color: var(--text-2); }}
.hero {{ position: relative; margin-top: auto; margin-right: 20mm; margin-bottom: 2mm; }}
.hero .hd {{ display: block; width: 100%; border-radius: 3mm; border: 1px solid var(--line); }}
.hero .hp {{ position: absolute; right: -20mm; bottom: -1mm; width: 38mm; border-radius: 5mm; border: 1px solid rgba(255,255,255,.14); box-shadow: 0 6mm 14mm rgba(0,0,0,.6); }}
.shots.phones {{ grid-template-columns: repeat(4, 1fr); gap: 4mm; padding: 0 6mm; }}
.shots.phones.c3 {{ grid-template-columns: repeat(3, 1fr); padding: 0 14mm; }}
.shots.phones.c2 {{ grid-template-columns: repeat(2, 1fr); padding: 0 34mm; }}
.shots.phones.c1 {{ grid-template-columns: 1fr; padding: 0 66mm; }}
.shots.phones img {{ border-radius: 4mm; }}
.scheme {{ margin: 2mm 0 7mm; padding: 6mm; border-radius: 4mm; background: var(--s1); display: flex; flex-direction: column; align-items: stretch; gap: 0; break-inside: avoid; }}
.scheme .row {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }}
.scheme .node {{ background: var(--s2); border-radius: 3mm; padding: 3mm 3.5mm; }}
.scheme .node b {{ display: block; font-size: 10pt; }}
.scheme .node span {{ display: block; font-size: 8.4pt; color: var(--text-3); line-height: 1.35; margin-top: .6mm; }}
.scheme .me {{ background: var(--accent); }} .scheme .me b {{ color: #131315; }} .scheme .me span {{ color: rgba(19,19,21,.72); }}
.scheme .lead {{ outline: 1.2px solid var(--accent); }}
.scheme .arrow {{ height: 6mm; width: 1.2px; background: var(--text-3); margin: 0 auto; position: relative; }}
.scheme .arrow::after {{ content: ""; position: absolute; bottom: -1px; left: -2.4px; border: 3px solid transparent; border-top: 4px solid var(--text-3); }}
.scheme .loop {{ margin-top: 4mm; text-align: center; color: var(--accent); font-size: 9pt; font-weight: 500; }}
.hero-ph {{ margin-top: auto; height: 95mm; }}
.foot {{ margin-top: 8mm; display: flex; gap: 8mm; align-items: flex-end; }}
.foot .meta {{ flex: 1; }}
.qr {{ display: flex; flex-direction: column; align-items: center; gap: 1.5mm; color: var(--text-3); font-size: 7.8pt; }}
.qr img {{ width: 27mm; height: 27mm; border-radius: 2.5mm; display: block; }}
.meta {{ display: grid; grid-template-columns: 1fr 1.4fr; gap: 3mm 8mm; font-size: 9.4pt; color: var(--text); }}
.meta div:last-child {{ grid-column: 1 / -1; }}
.meta span {{ display: block; color: var(--text-3); font-size: 8.6pt; margin-bottom: .6mm; }}

.sec {{ margin-top: 12mm; break-before: auto; }}
.sec.major {{ break-before: page; margin-top: 0; }}
h2 {{ break-after: avoid; margin: 0 0 6mm; color: var(--text); font-size: 24pt; line-height: 1.12; font-weight: 500; letter-spacing: -.03em; }}
h2 .num {{ display: block; margin-bottom: 2.5mm; color: var(--accent); font-size: 10pt; font-weight: 600; letter-spacing: .02em; }}
h3 {{ margin: 8mm 0 3mm; color: var(--text); font-size: 13.5pt; line-height: 1.3; font-weight: 600; letter-spacing: -.015em; break-after: avoid; }}
h3 .stage {{ display: block; color: var(--text-3); font-size: 8.8pt; font-weight: 500; margin-bottom: .8mm; }}
h3 .date {{ margin-left: 2.5mm; padding: .3mm 2.2mm; border-radius: 99px; background: var(--s2); color: var(--text-2); font-size: 8.6pt; font-weight: 500; vertical-align: 2px; }}
ul, ol {{ margin: 0 0 3.5mm; padding-left: 5mm; }}
li {{ margin: 0 0 1.3mm; }}
li::marker {{ color: var(--text-3); }}

table {{ width: 100%; border-collapse: collapse; margin: 2mm 0 5mm; font-size: 9.2pt; line-height: 1.45; break-inside: auto; }}
th {{ text-align: left; color: var(--text-3); font-weight: 500; font-size: 8.4pt; padding: 0 3mm 2mm 0; border-bottom: 1px solid var(--line); }}
td {{ padding: 2.4mm 3mm 2.4mm 0; border-bottom: 1px solid var(--line); vertical-align: top; }}
td:first-child {{ color: var(--text); }}
tr {{ break-inside: avoid; }}

.stats {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 2.5mm; margin: 3mm 0 6mm; }}
.stat {{ background: var(--s1); border-radius: 3.5mm; padding: 4mm 4mm 3.5mm; }}
.stat b {{ display: block; font-size: 17pt; font-weight: 500; letter-spacing: -.02em; line-height: 1.1; }}
.stat span {{ display: block; margin-top: 1.5mm; font-size: 8.4pt; line-height: 1.35; color: var(--text-3); }}

blockquote {{ margin: 0 0 3.5mm; break-inside: avoid; }}
.prompt {{ position: relative; margin-left: 0; margin-right: 14mm; padding: 3mm 4.2mm 3.2mm; background: var(--s2); border-radius: 4mm 4mm 4mm 1.2mm; color: var(--text); font-size: 9.8pt; line-height: 1.5; }}
.prompt .who {{ display: block; color: var(--accent); font-size: 8pt; font-weight: 600; margin-bottom: .8mm; }}
.prompt p {{ margin: 0; }}
.note {{ padding: 3mm 4mm; border-radius: 3mm; background: var(--s1); color: var(--text-2); font-size: 9.4pt; }}
.note p {{ margin: 0; }}

.ph {{ margin: 2mm 0 5mm; min-height: 42mm; border: 1.2px dashed rgba(139,142,255,.45); border-radius: 4mm; padding: 5mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; break-inside: avoid; }}
.ph span {{ color: var(--accent); font-weight: 600; font-size: 10pt; }}
.ph p {{ margin: 1.5mm 0 0; max-width: 140mm; color: var(--text-3); font-size: 8.8pt; }}
.shots {{ display: grid; gap: 3mm; margin: 2mm 0 1.5mm; break-inside: avoid; }}
.shots.grid2 {{ grid-template-columns: 1fr 1fr; }}
.shots figure {{ margin: 0; }}
.shots img {{ display: block; width: 100%; border-radius: 2.5mm; border: 1px solid var(--line); }}
.shots figcaption {{ margin-top: 1.2mm; color: var(--text-3); font-size: 8pt; }}
.toc {{ break-after: page; }}
.toc a {{ display: flex; gap: 4mm; align-items: baseline; color: var(--text); border-bottom: 1px solid var(--line); }}
.toc .t2 {{ padding: 3.2mm 0; font-size: 12.5pt; font-weight: 500; letter-spacing: -.01em; }}
.toc .t2 span {{ width: 9mm; color: var(--accent); font-size: 9.5pt; font-weight: 600; }}
.toc .t3 {{ padding: 1.6mm 0 1.6mm 13mm; font-size: 9.6pt; color: var(--text-2); border-bottom: 0; }}
.toc .t3 span {{ width: 15mm; color: var(--text-3); font-size: 8.6pt; }}
.cap {{ color: var(--text-3); font-size: 8.6pt; margin-bottom: 5mm; }}
"""


def toc_html() -> str:
    rows = []
    for sid, num, name, lvl in TOC:
        if lvl == 2:
            rows.append(f'<a class="t2" href="#{sid}"><span>{num}</span>{inline(name)}</a>')
        else:
            rows.append(f'<a class="t3" href="#{sid}"><span>{html.escape(num)}</span>{inline(name)}</a>')
    return f'<section class="toc"><h2>Содержание</h2>{"".join(rows)}</section>'


def build() -> None:
    md = open(SRC, encoding="utf-8").read()
    start = md.index("## ")  # всё до первого раздела — данные обложки, они в cover()
    body = body_html(md[start:])
    doc = f"""<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Орбита — как мы её создавали</title>
<style>{CSS}</style></head><body>{cover()}{toc_html()}{body}</body></html>"""
    open(OUT, "w", encoding="utf-8").write(doc)
    print("ok", OUT)


if __name__ == "__main__":
    build()
