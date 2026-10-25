#!/usr/bin/env python3
"""Схемы отчёта по лабораторным работам №1 и №2 (вариант 7).

Схемы рисуются координатами через svgkit из скилла gost-docx-report: ортогональные
отрезки, каждая стрелка в своей полосе, подписи в свободных коридорах.
Drawing.check() обязан молчать — иначе схема не записывается.

Масштаб: канвас 1000 px, шрифты 18–24 px -> на бумаге (полоса 16,1 см) 8,2–11 pt.
Раньше схемы шли из PlantUML (канвас 1400–1900 px при шрифтах 11–14 px), и в печати
получалось 3,5–4,5 pt — подписи нельзя было прочитать.

    python3 lab01/report/src/diagrams.py [--out lab01/report/images]
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SKILL_DIAGRAMS = Path("/home/bogdan/.agents/skills/gost-docx-report/scripts/diagrams")
sys.path.insert(0, str(SKILL_DIAGRAMS))
from svgkit import Drawing  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = (HERE.parent / "images")

FONTS = {"title": 24, "pkg": 18, "box": 20, "sub": 18, "label": 18, "state": 20, "note": 18}


# ============================================================ 1. архитектура работ
def build_architecture() -> Drawing:
    d = Drawing(1000, 640, "Архитектура: web-клиент, приложение Аврора и Node.js сервер",
                fonts=FONTS)

    d.package(16, 56, 430, 544, "Клиенты", fill="#F2F7FF")
    d.package(560, 56, 424, 544, "Node.js сервер (без npm-зависимостей)", fill="#FFF6E8")

    # клиенты ---------------------------------------------------------------
    d.box(36, 100, 185, 70, ["Браузер ПК", "1440×1000"], name="browser-pc")
    d.box(241, 100, 185, 70, ["Браузер Аврора", "390×844"], name="browser-aurora")
    d.box(36, 190, 390, 90, ["Сайт и панель статистики", "index · catalog · about · contact",
                             "dashboard.html"], name="site")
    d.box(36, 300, 390, 80, ["tracker.js · api.js", "pageview · action · heartbeat",
                             "fetch · sendBeacon"], name="tracker")
    d.box(36, 400, 390, 100, ["Приложение Аврора (Qt/QML)", "ru.mai.aurorastat",
                              "StatClient · QWebSocket", "LineChart · DeviceDonut"],
          fill="#EFE7FF", name="aurora-app")
    d.box(36, 520, 390, 70, ["localStorage · QSettings", "visitorId · sessionId"],
          name="storage-client")

    # сервер ---------------------------------------------------------------
    d.box(580, 100, 180, 80, ["server.js", "маршруты /api/*", "статика · CSV"], name="srv")
    d.box(784, 100, 180, 80, ["websocket.js", "realtime.js", "канал /ws"], name="ws")
    d.box(580, 210, 180, 70, ["analytics.js", "KPI и ряды"], name="anal")
    d.box(784, 210, 180, 80, ["storage.js", "addEvent", "endSession"], name="stor")
    d.cylinder(580, 320, 384, 110, ["data/stats.json", "посетители · сессии",
                                    "события · отзывы", "debounce 400 мс"],
               name="db")
    d.box(580, 460, 384, 70, ["seed.js", "демонстрационные данные"], name="seed")

    # стрелки клиента ------------------------------------------------------
    d.arrow([(128, 170), (128, 190)], name="pc→site")
    d.arrow([(333, 170), (333, 190)], name="aurora-browser→site")
    d.arrow([(231, 280), (231, 300)], name="site→tracker")
    d.arrow([(231, 500), (231, 520)], name="app→settings")

    # стрелки сервера ------------------------------------------------------
    d.arrow([(620, 180), (620, 210)], name="srv→anal")
    d.arrow([(824, 180), (824, 210)], name="ws→stor")
    d.arrow([(620, 280), (620, 320)], name="anal→db")
    d.arrow([(824, 280), (824, 320)], name="stor→db")
    d.arrow([(700, 460), (700, 430)], name="seed→db")

    # клиенты ↔ сервер: три горизонтальные полосы --------------------------
    d.arrow([(446, 220), (560, 220)], name="http-static", bidir=True)
    d.arrow([(446, 340), (560, 340)], name="http-events", bidir=True)
    d.arrow([(446, 440), (560, 440)], name="ws-channel", bidir=True)

    # подписи в коридоре между пакетами ------------------------------------
    d.label(503, 186, ["HTTP · статика"], name="lbl-http")
    d.label(503, 306, ["POST /api/events"], name="lbl-events")
    d.label(503, 406, ["WebSocket /ws"], name="lbl-ws")
    return d


# ================================================================ 2. модель данных
def build_data_model() -> Drawing:
    d = Drawing(1000, 470, "Модель данных статистики", fonts=FONTS)

    d.box(30, 70, 290, 110, ["Посетитель (visitor)", "id · firstSeen · lastSeen",
                             "visits · ua · device", "screen · lang · tz"], name="visitor")
    d.box(360, 70, 290, 110, ["Сессия (session)", "id · visitorId · start",
                              "lastEvent · end · closed", "durationSec · pageViews"], name="session")
    d.box(690, 70, 280, 110, ["Событие (event)", "id · ts · type", "page · label · referrer",
                              "visitorId · sessionId"], name="event")
    d.box(360, 250, 290, 90, ["Отзыв (feedback)", "ts · name · email",
                              "message · page"], name="feedback")
    d.note(30, 250, 290, 90, "Типы событий",
           ["pageview · action", "heartbeat · session_end"])
    d.note(690, 250, 280, 90, "Идентификаторы",
           ["visitorId в localStorage", "sessionId в sessionStorage"])

    d.arrow([(320, 125), (360, 125)], name="visitor→session")
    d.arrow([(650, 125), (690, 125)], name="session→event")
    d.arrow([(505, 180), (505, 250)], name="session→feedback")

    d.label(340, 108, ["1:N"], name="lbl-1n")
    d.label(670, 108, ["1:N"], name="lbl-2n")
    d.label(560, 214, ["форма сайта"], name="lbl-form")
    return d


# ============================================== 3. путь события от браузера к графику
def build_tracking_flow() -> Drawing:
    d = Drawing(1000, 340, "Как событие проходит от браузера до графика", fonts=FONTS)

    d.box(30, 70, 210, 90, ["Страница сайта", "загрузка, клик, хит"], name="page")
    d.box(260, 70, 210, 90, ["tracker.js", "basePayload()", "очередь событий"], name="tracker")
    d.box(490, 70, 220, 90, ["api.js", "fetch · AbortController", "sendBeacon"], name="api")
    d.box(730, 70, 240, 90, ["POST /api/events", "валидация тела", "ответ 201 + сводка"],
          name="endpoint")

    d.box(730, 210, 240, 90, ["storage.js", "insertEvent по ts", "сессия и посетитель"],
          name="storage")
    d.box(490, 210, 220, 90, ["analytics.js", "KPI · таймлайн", "топ страниц"], name="anal")
    d.box(260, 210, 210, 90, ["GET /api/stats", "Promise.all", "автообновление 5 с"],
          name="stats")
    d.box(30, 210, 210, 90, ["Дашборд", "4 canvas-графика", "таблицы KPI"], name="dash")

    d.arrow([(240, 115), (260, 115)], name="page→tracker")
    d.arrow([(470, 115), (490, 115)], name="tracker→api")
    d.arrow([(710, 115), (730, 115)], name="api→endpoint")
    d.arrow([(850, 160), (850, 210)], name="endpoint→storage")
    d.arrow([(730, 255), (710, 255)], name="storage→anal")
    d.arrow([(490, 255), (470, 255)], name="anal→stats")
    d.arrow([(260, 255), (240, 255)], name="stats→dash")
    return d


# ==================================================== 4. жизненный цикл сессии
def build_session_lifecycle() -> Drawing:
    d = Drawing(1000, 700, "Жизненный цикл сессии посетителя", fonts=FONTS)

    d.state(30, 90, 240, 100, "Новый посетитель", ["visitorId", "первый pageview"])
    d.state(390, 90, 240, 100, "Сессия открыта", ["pageview", "sessionId"])
    d.state(720, 90, 240, 100, "Активная сессия", ["action", "heartbeat"])
    d.state(720, 400, 240, 100, "Закрытая сессия", ["durationSec", "end_reason"])
    d.state(390, 400, 240, 100, "Новая сессия", ["pageview", "sessionId"])

    d.note(30, 400, 320, 100, "Правила закрытия",
           ["session_end при уходе", "таймаут 1800 с без событий"])

    d.arrow([(270, 140), (390, 140)], name="new→session")
    d.arrow([(630, 140), (720, 140)], name="session→active")
    d.arrow([(840, 190), (840, 400)], name="timeout")
    d.arrow([(840, 500), (840, 560), (510, 560), (510, 500)], name="closed→new")
    d.arrow([(390, 500), (390, 620), (975, 620), (975, 140), (960, 140)], name="new→active")
    d.arrow([(390, 190), (390, 400)], name="active→new")

    d.label(330, 118, ["первый визит"], name="lbl-first")
    d.label(675, 118, ["pageview"], name="lbl-open")
    d.label(720, 280, ["нет событий 30 мин"], name="lbl-timeout")
    d.label(320, 280, ["session_end"], name="lbl-end")
    d.label(665, 538, ["hit на любой странице"], name="lbl-hit")
    d.label(680, 648, ["обычный переход"], name="lbl-normal")
    return d


# ==================================== 5. обмен сообщениями по WebSocket-каналу
def build_ws_flow() -> Drawing:
    d = Drawing(1000, 560, "Обмен сообщениями приложения Аврора с сервером (канал /ws)",
                fonts=FONTS)

    d.package(16, 56, 430, 470, "Приложение ru.mai.aurorastat", fill="#EFE7FF")
    d.package(560, 56, 424, 470, "Сервер: websocket.js + realtime.js", fill="#FFF6E8")

    d.box(36, 100, 390, 80, ["StatClient (C++)", "QWebSocket · QJsonDocument",
                             "QSettings serverUrl"], name="client")
    d.box(36, 210, 195, 80, ["connectToServer", "subscribe range"], name="connect")
    d.box(246, 210, 180, 80, ["trackPageView()", "trackAction()"], name="track")
    d.box(36, 320, 390, 80, ["QML-страницы", "MainPage · DashboardPage",
                             "SessionsPage · SettingsPage"], name="qml")
    d.box(36, 430, 390, 60, ["Автопереподключение", "экспоненциальная задержка ≤ 30 с"],
          name="reconnect")

    d.box(580, 100, 384, 80, ["handshake 101", "hello: service, protocol",
                              "heartbeatSec = 30"], name="hello")
    d.box(580, 210, 180, 80, ["stats", "тот же объект,", "что GET /api/stats"], name="stats")
    d.box(774, 210, 190, 80, ["update", "счётчики", "при изменении"], name="update")
    d.box(580, 320, 185, 80, ["tracked", "eventId", "sessionId"], name="tracked")
    d.box(784, 320, 185, 80, ["ping → pong", "кадр ping", "каждые 30 с"], name="ping")
    d.box(580, 430, 384, 60, ["error", "некорректное сообщение или тип"], name="error")

    # клиент -> сервер -----------------------------------------------------
    d.arrow([(446, 140), (560, 140)], name="ws-open")
    d.arrow([(446, 250), (560, 250)], name="client-subscribe")
    d.arrow([(446, 360), (560, 360)], name="client-track")
    # сервер -> клиент -----------------------------------------------------
    d.arrow([(560, 190), (446, 190)], name="server-stats")
    d.arrow([(560, 300), (446, 300)], name="server-update")
    d.arrow([(560, 400), (446, 400)], name="server-tracked")

    d.label(503, 122, ["subscribe"], name="lbl-sub")
    d.label(503, 172, ["hello + stats"], name="lbl-hello")
    d.label(503, 232, ["track"], name="lbl-track")
    d.label(503, 282, ["update"], name="lbl-update")
    d.label(503, 342, ["ping / pong"], name="lbl-ping")
    d.label(503, 382, ["tracked"], name="lbl-tracked")
    return d


# =============================================== 6. внутреннее устройство приложения
def build_aurora_app() -> Drawing:
    d = Drawing(1000, 560, "Устройство приложения под ОС Аврора (Qt 5 / QML, Sailfish Silica)",
                fonts=FONTS)

    d.box(30, 70, 290, 100, ["main.cpp", "Aurora::Application", "contextProperty StatClient"],
          name="main")
    d.box(360, 70, 290, 100, ["statclient.cpp / .h", "QWebSocket · QTimer", "QSettings serverUrl",
                              "13 Q_PROPERTY для QML"], name="client")
    d.box(690, 70, 280, 100, ["QWebSocket", "Qt WebSockets", "текстовые JSON-кадры"],
          name="qws")

    d.box(30, 210, 210, 90, ["MainPage.qml", "статус соединения", "KPI, лента событий"],
          name="mainpage")
    d.box(260, 210, 220, 90, ["DashboardPage.qml", "24h · 7d · 30d · всё", "графики, источники"],
          name="dashpage")
    d.box(500, 210, 210, 90, ["SessionsPage.qml", "таблица сессий", "длительность"],
          name="sesspage")
    d.box(730, 210, 240, 90, ["SettingsPage.qml", "адрес сервера", "тестовое событие"],
          name="setpage")

    d.box(30, 340, 290, 90, ["LineChart.qml", "Canvas: просмотры", "и посетители по времени"],
          fill="#EAF6EA", name="line")
    d.box(360, 340, 290, 90, ["DeviceDonut.qml", "Canvas: кольцевая", "диаграмма устройств"],
          fill="#EAF6EA", name="donut")
    d.box(690, 340, 280, 90, ["BarList.qml", "столбцы популярных", "страниц"],
          fill="#EAF6EA", name="bar")

    d.box(30, 460, 440, 70, ["CoverPage.qml", "карточка приложения (cover)"], name="cover")
    d.box(500, 460, 470, 70,
          ["rpm / ru.mai.aurorastat.spec", "BuildRequires: Qt5WebSockets, auroraapp"],
          name="spec")

    d.arrow([(320, 120), (360, 120)], name="main→client")
    d.arrow([(650, 120), (690, 120)], name="client→qws")
    d.arrow([(135, 170), (135, 210)], name="client→mainpage")
    d.arrow([(370, 170), (370, 210)], name="client→dashpage")
    d.arrow([(605, 170), (605, 210)], name="client→sesspage")
    d.arrow([(850, 170), (850, 210)], name="client→setpage")
    d.arrow([(135, 300), (135, 340)], name="mainpage→line")
    d.arrow([(370, 300), (370, 340)], name="dashpage→donut")
    d.arrow([(605, 300), (605, 340)], name="sesspage→bar")

    d.label(250, 192, ["QML видит StatClient"], name="lbl-qml")
    return d


# ============================================================================= сборка
def to_png(svg: Path) -> None:
    """SVG -> PNG в 2× разрешении (rsvg-convert / cairosvg / ImageMagick / LibreOffice)."""
    png = svg.with_suffix(".png")
    if shutil.which("rsvg-convert"):
        subprocess.run(["rsvg-convert", "-z", "2", "-o", str(png), str(svg)], check=True)
        print(f"  PNG: {png} (rsvg-convert)")
        return
    try:
        import cairosvg  # noqa: WPS433
        cairosvg.svg2png(url=str(svg), write_to=str(png), scale=2)
        print(f"  PNG: {png} (cairosvg)")
        return
    except ImportError:
        pass
    for cmd in (["inkscape", str(svg), "--export-type=png", f"--export-filename={png}"],
                ["convert", str(svg), str(png)], ["magick", str(svg), str(png)]):
        if shutil.which(cmd[0]):
            subprocess.run(cmd, check=True)
            print(f"  PNG: {png} ({cmd[0]})")
            return
    # LibreOffice: растер по declared size, поэтому подаём копию с удвоенными width/height
    if shutil.which("soffice") or shutil.which("libreoffice"):
        soffice = shutil.which("soffice") or "libreoffice"
        with tempfile.TemporaryDirectory(prefix="svg2x-") as td:
            tmp = Path(td)
            text = svg.read_text(encoding="utf-8")
            w = int(re.search(r'width="(\d+)"', text).group(1))
            h = int(re.search(r'height="(\d+)"', text).group(1))
            scaled = tmp / f"{svg.stem}.svg"
            scaled.write_text(text.replace(f'width="{w}" height="{h}"',
                                           f'width="{2 * w}" height="{2 * h}"', 1),
                              encoding="utf-8")
            subprocess.run([soffice, "--headless",
                            f"-env:UserInstallation=file://{tmp / 'lo'}",
                            "--convert-to", "png", "--outdir", str(tmp), str(scaled)],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            made = tmp / f"{svg.stem}.png"
            if made.exists():
                shutil.copy2(made, png)
                print(f"  PNG: {png} (LibreOffice, 2×)")
                return
    print("  ! ни один растеризатор не найден — остался только SVG")


def save(d: Drawing, stem: str) -> None:
    problems = d.check()
    if problems:
        print(f"  !! {stem}: layout не сошёлся, схема не записана:")
        for p in problems:
            print("     -", p)
        raise SystemExit(1)
    OUT.mkdir(parents=True, exist_ok=True)
    svg = OUT / f"{stem}.svg"
    svg.write_text(d.svg(), encoding="utf-8")
    print(f"  SVG: {svg.name}  ({d.w}×{d.h})")
    to_png(svg)


BUILDERS = [
    (build_architecture, "architecture"),
    (build_data_model, "data-model"),
    (build_tracking_flow, "tracking-flow"),
    (build_session_lifecycle, "session-lifecycle"),
    (build_ws_flow, "ws-flow"),
    (build_aurora_app, "aurora-app"),
]

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Рисует схемы отчёта (SVG + PNG).")
    ap.add_argument("--out", help="каталог для SVG/PNG")
    args = ap.parse_args()
    if args.out:
        OUT = Path(args.out).resolve()
    for builder, stem in BUILDERS:
        save(builder(), stem)
    print(f"готово: {len(BUILDERS)} схем в {OUT}")
