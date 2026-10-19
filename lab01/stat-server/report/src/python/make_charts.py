#!/usr/bin/env python3
"""
Графики для отчёта по лабораторной работе №1 (вариант 7).

Источник данных: реальный файл статистики сервера data/stats.json
(тот же файл, который читает server/analytics.js при запросе /api/stats).

Запуск из корня лабораторной работы:
    npm run seed                       # наполнить data/stats.json демо-данными
    python3 report/src/python/make_charts.py

Результат: report/images/chart-*.png
"""

import json
import math
import os
from collections import defaultdict
from datetime import datetime

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator

HERE = os.path.dirname(os.path.abspath(__file__))
LAB_ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
DATA_FILE = os.environ.get("DATA_FILE", os.path.join(LAB_ROOT, "data", "stats.json"))
OUT_DIR = os.environ.get("CHARTS_OUT", os.path.join(LAB_ROOT, "report", "images"))
DAYS = int(os.environ.get("CHARTS_DAYS", "7"))

plt.rcParams["font.family"] = "DejaVu Sans"
plt.rcParams["figure.dpi"] = 120
plt.rcParams["savefig.bbox"] = "tight"

COLOR_VIEWS = "#1f6feb"
COLOR_VISITORS = "#2f9e44"
COLOR_ACTIONS = "#e8590c"
COLOR_OPEN = "#f08c00"
PALETTE = ["#1f6feb", "#2f9e44", "#e8590c", "#9c36b5", "#0c8599", "#e03131"]


def load_state():
    with open(DATA_FILE, encoding="utf-8") as fh:
        return json.load(fh)


def fmt(ts_ms):
    return datetime.fromtimestamp(ts_ms / 1000)


def save(fig, name):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name)
    fig.savefig(path)
    plt.close(fig)
    print("создан", path)


# --------------------------------------------------------------------------
# 1. Просмотры, посетители и действия по суткам (аналог графика «по времени»)
# --------------------------------------------------------------------------
def chart_timeline(state):
    now = max((e["ts"] for e in state["events"]), default=0)
    start = now - DAYS * 86400000
    per_day = defaultdict(lambda: {"views": 0, "visitors": set(), "actions": 0})

    for ev in state["events"]:
        if ev["ts"] < start:
            continue
        day = fmt(ev["ts"]).strftime("%d.%m")
        if ev["type"] == "pageview":
            per_day[day]["views"] += 1
            per_day[day]["visitors"].add(ev["visitorId"])
        elif ev["type"] == "action":
            per_day[day]["actions"] += 1

    days = sorted(per_day)
    views = [per_day[d]["views"] for d in days]
    visitors = [len(per_day[d]["visitors"]) for d in days]
    actions = [per_day[d]["actions"] for d in days]

    fig, ax = plt.subplots(figsize=(9, 4.2))
    ax.plot(days, views, marker="o", color=COLOR_VIEWS, label="просмотры страниц")
    ax.fill_between(days, views, color=COLOR_VIEWS, alpha=0.12)
    ax.plot(days, visitors, marker="s", color=COLOR_VISITORS, label="уникальные посетители")
    ax.bar(days, actions, width=0.35, color=COLOR_ACTIONS, alpha=0.55, label="нажатия кнопок")
    ax.set_title(f"Активность посетителей за {DAYS} дней (по данным data/stats.json)")
    ax.set_xlabel("дата")
    ax.set_ylabel("событий за сутки")
    ax.legend(loc="upper left", frameon=False)
    ax.grid(True, axis="y", alpha=0.25)
    ax.xaxis.set_major_locator(MaxNLocator(integer=True))
    fig.autofmt_xdate()
    save(fig, "chart-timeline.png")


# --------------------------------------------------------------------------
# 2. Популярные страницы
# --------------------------------------------------------------------------
def chart_top_pages(state):
    views = defaultdict(int)
    visitors = defaultdict(set)
    for ev in state["events"]:
        if ev["type"] != "pageview":
            continue
        views[ev["page"]] += 1
        visitors[ev["page"]].add(ev["visitorId"])

    pages = sorted(views, key=lambda p: views[p], reverse=True)[:8]
    values = [views[p] for p in pages]
    uniq = [len(visitors[p]) for p in pages]
    labels = list(reversed(pages))

    fig, ax = plt.subplots(figsize=(9, 4.2))
    y = range(len(labels))
    ax.barh(list(y), list(reversed(values)), color=COLOR_VIEWS, label="просмотры")
    ax.barh([i + 0.35 for i in y], list(reversed(uniq)), height=0.45,
            color=COLOR_VISITORS, alpha=0.85, label="уникальных посетителей")
    ax.set_yticks(list(y))
    ax.set_yticklabels(labels)
    ax.set_title("Популярные страницы сайта")
    ax.set_xlabel("просмотров")
    ax.legend(loc="lower right", frameon=False)
    ax.grid(True, axis="x", alpha=0.25)
    for i, v in enumerate(reversed(values)):
        ax.text(v + 0.15, i, str(v), va="center", fontsize=9, color="#333")
    save(fig, "chart-top-pages.png")


# --------------------------------------------------------------------------
# 3. Устройства посетителей (кольцевая диаграмма)
# --------------------------------------------------------------------------
def chart_devices(state):
    counts = defaultdict(int)
    for session in state["sessions"].values():
        counts[session.get("device", "unknown")] += 1

    order = ["desktop", "mobile", "tablet", "aurora", "bot"]
    names = [d for d in order if counts.get(d)]
    values = [counts[d] for d in names]
    readable = {"desktop": "ПК (desktop)", "mobile": "смартфон", "tablet": "планшет",
                "aurora": "ОС Аврора", "bot": "роботы"}.copy()
    labels = [readable.get(n, n) for n in names]

    fig, ax = plt.subplots(figsize=(6.4, 4.4))
    wedges, _, auto = ax.pie(
        values, labels=None, autopct=lambda p: f"{p:.0f}%",
        startangle=90, counterclock=False, pctdistance=0.78,
        colors=PALETTE[: len(values)],
        wedgeprops={"width": 0.42, "edgecolor": "white", "linewidth": 1.5},
        textprops={"fontsize": 9},
    )
    total = sum(values)
    ax.text(0, 0.08, str(total), ha="center", va="center", fontsize=20, weight="bold")
    ax.text(0, -0.18, "сессий", ha="center", va="center", fontsize=10, color="#555")
    ax.legend(wedges, [f"{l} — {v}" for l, v in zip(labels, values)],
              loc="center left", bbox_to_anchor=(0.98, 0.5), frameon=False, fontsize=9)
    ax.set_title("Устройства посетителей (по User-Agent)")
    save(fig, "chart-devices.png")


# --------------------------------------------------------------------------
# 4. Длительность сессий
# --------------------------------------------------------------------------
def chart_session_duration(state):
    durations = [s["durationSec"] for s in state["sessions"].values()]
    if not durations:
        return
    durations_sorted = sorted(durations, reverse=True)[:25]
    labels = [str(i + 1) for i in range(len(durations_sorted))]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4.2),
                                   gridspec_kw={"width_ratios": [1.4, 1]})
    ax1.bar(labels, durations_sorted, color=COLOR_VIEWS, label="длительность сессии")
    ax1.set_title("Длительность сессий (25 самых длинных)")
    ax1.set_xlabel("номер сессии (от длинной к короткой)")
    ax1.set_ylabel("секунд")
    ax1.grid(True, axis="y", alpha=0.25)

    bins = [0, 30, 60, 120, 300, 600, 1200, 3600]
    hist, _ = np_histogram(durations, bins)
    ax2.bar(range(len(hist)), hist, color=COLOR_VISITORS)
    ax2.set_xticks(range(len(hist)))
    ax2.set_xticklabels([f"{bins[i]}–{bins[i + 1]}" for i in range(len(hist))],
                        rotation=30, ha="right", fontsize=8)
    ax2.set_title("Распределение сессий по длительности, сек")
    ax2.set_ylabel("число сессий")
    ax2.grid(True, axis="y", alpha=0.25)
    for i, v in enumerate(hist):
        if v:
            ax2.text(i, v + 0.15, str(v), ha="center", fontsize=9)

    avg = sum(durations) / len(durations)
    fig.suptitle(f"Средняя длительность сессии: {avg:.0f} с   "
                 f"максимум: {max(durations)} с   всего сессий: {len(durations)}",
                 fontsize=11, y=1.02)
    save(fig, "chart-session-duration.png")


def np_histogram(values, bins):
    counts = [0] * (len(bins) - 1)
    for v in values:
        for i in range(len(bins) - 1):
            if bins[i] <= v < bins[i + 1]:
                counts[i] += 1
                break
        else:
            counts[-1] += 1
    return counts, bins


# --------------------------------------------------------------------------
# 5. Источники переходов
# --------------------------------------------------------------------------
def chart_sources(state):
    self_hosts = {"localhost", "127.0.0.1"}
    direct = 0
    internal = 0
    external = defaultdict(int)
    for session in state["sessions"].values():
        ref = session.get("referrer") or ""
        host = None
        if ref:
            try:
                host = ref.split("//")[1].split("/")[0].split(":")[0]
            except IndexError:
                host = None
        if not host:
            direct += 1
        elif session.get("referrerInternal") or host in self_hosts:
            internal += 1
        else:
            external[host] += 1

    labels = ["прямые заходы", "внутри сайта"] + sorted(external, key=lambda h: -external[h])
    values = [direct, internal] + [external[h] for h in labels[2:]]
    colors = ["#868e96", "#1f6feb"] + PALETTE[2:2 + len(labels) - 2]

    fig, ax = plt.subplots(figsize=(8.6, 3.8))
    bars = ax.bar(labels, values, color=colors)
    ax.set_title("Откуда приходили посетители (по referrer первой страницы сессии)")
    ax.set_ylabel("сессий")
    ax.grid(True, axis="y", alpha=0.25)
    for bar, value in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, value + 0.15, str(value),
                ha="center", fontsize=9)
    plt.setp(ax.get_xticklabels(), rotation=20, ha="right", fontsize=9)
    save(fig, "chart-sources.png")


# --------------------------------------------------------------------------
# 6. Сводка показателей (для раздела «результат»)
# --------------------------------------------------------------------------
def chart_kpi(state):
    sessions = list(state["sessions"].values())
    durations = [s["durationSec"] for s in sessions]
    visitors = state["visitors"]
    bounce = sum(1 for s in sessions if s["pageViews"] <= 1) / max(len(sessions), 1) * 100
    depth = state["counters"]["pageViews"] / max(len(sessions), 1)

    tiles = [
        ("Просмотры страниц", state["counters"]["pageViews"]),
        ("Уникальные посетители", len(visitors)),
        ("Сессии", len(sessions)),
        ("Средняя длительность", f"{(sum(durations) / max(len(durations), 1)):.0f} с"),
        ("Глубина просмотра", f"{depth:.2f}"),
        ("Показатель отказов", f"{bounce:.1f} %"),
    ]

    fig, axes = plt.subplots(1, 6, figsize=(11, 2.2))
    for ax, (title, value) in zip(axes, tiles):
        ax.axis("off")
        ax.text(0.5, 0.62, str(value), ha="center", va="center",
                fontsize=20, weight="bold", color=COLOR_VIEWS)
        ax.text(0.5, 0.22, title, ha="center", va="center", fontsize=9, color="#444")
        ax.add_patch(plt.Rectangle((0.02, 0.02), 0.96, 0.96, transform=ax.transAxes,
                                   facecolor="#f4f7fb", edgecolor="#d8e2ef", linewidth=1))
    fig.suptitle("Итоговые показатели, посчитанные сервером", fontsize=12, y=1.06)
    save(fig, "chart-kpi.png")


if __name__ == "__main__":
    state = load_state()
    chart_timeline(state)
    chart_top_pages(state)
    chart_devices(state)
    chart_session_duration(state)
    chart_sources(state)
    chart_kpi(state)
