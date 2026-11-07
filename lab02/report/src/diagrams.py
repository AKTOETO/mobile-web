#!/usr/bin/env python3
"""Схемы отчёта ЛР №2: архитектура и жизненный цикл offline-операции.

Запуск:
    python3 src/diagrams.py --out images
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

SKILL = Path.home() / ".agents/skills/gost-docx-report/scripts/diagrams"
sys.path.insert(0, str(SKILL))
from svgkit import Drawing  # noqa: E402

FONTS = {"title": 24, "pkg": 18, "box": 20, "sub": 18, "label": 18, "state": 20, "note": 18}
OUT = Path(__file__).resolve().parent.parent / "images"


def build_architecture() -> Drawing:
    d = Drawing(1000, 700, "Архитектура: клиенты и Node.js сервер", fonts=FONTS)

    d.package(16, 56, 440, 600, "Клиенты", fill="#F2F7FF")
    d.package(600, 56, 384, 600, "Node.js сервер (без зависимостей)", fill="#FFF6E8")

    d.box(36, 100, 400, 96, ["Браузер (ПК / Аврора)",
                             "index.html · app.js · docs.html",
                             "fetch/XHR · автодемо ?auto=1"], name="browser")
    d.box(36, 250, 400, 120, ["Нативное приложение Qt/C++",
                              "QML (Sailfish Silica)",
                              "InventoryClient · ItemModel",
                              "SQLite-кэш · QSettings"], fill="#EAF6EA", name="app")
    d.box(36, 460, 400, 100, ["Локальное состояние",
                              "items + pending (SQLite)",
                              "token + cookies (QSettings)"], fill="#F5EDFF", name="local")

    d.box(620, 100, 344, 96, ["server.js · /api/v1",
                              "CRUD · статика · кэш-заголовки",
                              "коды 200/201/204/4xx/5xx"], name="routes")
    d.box(620, 240, 344, 78, ["auth.js", "scrypt · JWT HS256 · роли",
                              "Bearer или cookie token"], name="auth")
    d.box(620, 360, 344, 78, ["validation.js · store.js",
                              "поля варианта №7 · версии",
                              "атомарная запись JSON"], name="store")
    d.cylinder(620, 490, 344, 140, ["data/inventory.json",
                                    "certs/server.crt + ca.crt",
                                    "data/jwt.secret"], name="data")

    d.arrow([(436, 148), (620, 148)], name="browser-https", bidir=True)
    d.arrow([(436, 310), (620, 278)], name="app-rest", bidir=True)
    d.arrow([(236, 370), (236, 460)], name="cache", bidir=True)
    d.arrow([(700, 196), (700, 240)], name="routes-auth")
    d.arrow([(860, 318), (860, 360)], name="auth-store")
    d.arrow([(780, 438), (780, 490)], name="store-data")

    d.label(528, 124, ["HTTPS :8443", "статика + /api/v1"])
    d.label(532, 252, ["REST/JSON", "Bearer / cookie"])
    d.label(350, 420, ["кэш и настройки", "между сессиями"])
    d.label(390, 660, ["очередь pending → синхронизация"])
    return d


def build_offline_lifecycle() -> Drawing:
    d = Drawing(1000, 640, "Жизненный цикл offline-операции", fonts=FONTS)

    d.state(30, 80, 250, 110, "Онлайн", ["GET / POST / PATCH", "ответ 2xx"])
    d.state(390, 80, 250, 110, "Офлайн", ["ошибка сети или", "simulateOffline"])
    d.state(720, 80, 250, 110, "Очередь", ["pending", "CREATE · UPDATE", "DELETE"])
    d.state(720, 330, 250, 110, "Синхронизация", ["syncAll", "по одной операции"])
    d.state(390, 330, 250, 110, "Замена id", ["local-* → серверный", "remapItemId"])
    d.state(30, 330, 250, 110, "Готово", ["список с сервера", "pending = 0"])

    d.arrow([(280, 135), (390, 135)], name="online-offline")
    d.arrow([(640, 135), (720, 135)], name="offline-queue")
    d.arrow([(845, 190), (845, 330)], name="queue-sync")
    d.arrow([(720, 385), (640, 385)], name="sync-remap")
    d.arrow([(390, 385), (280, 385)], name="remap-done")
    d.arrow([(155, 330), (155, 190)], name="done-online")

    d.note(390, 490, 580, 110, "Обработка ошибок",
           ["4xx — операция не выполнена, ошибка показана",
            "5xx / таймаут — операция остаётся в pending",
            "после сети очередь уходит на сервер по порядку"])

    d.label(335, 68, ["сеть недоступна"])
    d.label(680, 68, ["мутация"])
    d.label(700, 270, ["сеть восстановлена"])
    d.label(680, 318, ["CREATE вернул id"])
    d.label(335, 318, ["refresh / список"])
    d.label(260, 260, ["следующий запрос"])
    return d


def save(d: Drawing, stem: str) -> None:
    problems = d.check()
    if problems:
        print(f"!! {stem}: layout не сошёлся:")
        for p in problems:
            print("   -", p)
        raise SystemExit(1)
    OUT.mkdir(parents=True, exist_ok=True)
    svg = OUT / f"{stem}.svg"
    svg.write_text(d.svg(), encoding="utf-8")
    print(f"SVG: {svg} ({d.w}x{d.h})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()
    OUT = Path(args.out).resolve()
    save(build_architecture(), "architecture")
    save(build_offline_lifecycle(), "offline-lifecycle")
