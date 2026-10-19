# 2. Архитектура и поток данных

## Общая схема

```
        Браузер (ПК / телефон Аврора)                     Node.js сервер
 ┌───────────────────────────────────────────┐   ┌──────────────────────────────────────┐
 │  index.html  catalog.html  about.html     │   │  server/server.js                    │
 │  contact.html  dashboard.html             │   │   ├─ маршрутизация /api/* и статики  │
 │                                           │   │   ├─ раздача html/css/js (public/)   │
 │  <script src="/js/tracker.js">            │   │   └─ обработка ошибок, лимит тела    │
 │     │                                     │   │                                      │
 │     ├─ pageview  ─────────────────────────┼──▶│ POST /api/events                     │
 │     ├─ action (клик по data-track) ───────┼──▶│   └─ storage.addEvent()              │
 │     ├─ heartbeat (каждые 30 с) ───────────┼──▶│      ├─ visitors / sessions / events │
 │     └─ session_end (sendBeacon/fetch) ────┼──▶│      └─ scheduleSave() → data/       │
 │                                           │   │                        stats.json    │
 │  <script src="/js/dashboard.js">          │   │                                      │
 │     └─ Api.getStats() ────────────────────┼──▶│ GET /api/stats  → analytics.js       │
 │        Api.getPages() ────────────────────┼──▶│ GET /api/pages                       │
 │        Api.postSeed()/postReset() ────────┼──▶│ POST /api/seed, /api/reset           │
 │        экспорт CSV (кнопка) ──────────────┼──▶│ GET  /api/export.csv                 │
 │                                           │   │                                      │
 │  <script src="/js/charts.js">             │   │  server/analytics.js — сводные       │
 │     └─ рисует графики на <canvas>         │   │  показатели, ряды для графиков       │
 └───────────────────────────────────────────┘   └──────────────────────────────────────┘
```

## Модули сервера

| Файл | Назначение |
|---|---|
| `server/server.js` | HTTP-сервер: маршрутизация, статика, все эндпоинты API, CSV-экспорт, корректное завершение с сохранением данных |
| `server/storage.js` | Класс `Storage`: загрузка/сохранение `data/stats.json`, добавление событий, открытие/закрытие сессий, очистка, лимиты |
| `server/analytics.js` | `computeStats(state, {range, page, limit})` — KPI, временной ряд, топ страниц, устройства, источники, последние сессии |
| `server/seed.js` | Генератор демонстрационных посетителей (детерминированный ГПСЧ, разные User-Agent, включая Аврора) |
| `server/seed-cli.js` | CLI-обёртка: `npm run seed`, `npm run reset` |
| `server/config.js` | Настройки из переменных окружения + список IPv4-адресов машины |

## Модули клиента

| Файл | Назначение |
|---|---|
| `public/js/tracker.js` | Идентификаторы посетителя/сессии, отправка `pageview`, `action`, `heartbeat`, `session_end`, очередь неотправленных событий |
| `public/js/api.js` | `Api.*` — обёртка над `fetch` (async/await, таймаут через `AbortController`, разбор ошибок) |
| `public/js/charts.js` | `Charts.drawLine / drawBars / drawColumns / drawDonut` на 2D-canvas с учётом `devicePixelRatio` |
| `public/js/dashboard.js` | Форма отчёта, кнопки, автообновление, отрисовка KPI/графиков/таблиц |
| `public/js/app.js` | Меню, живые счётчики главной, фильтр каталога, web-форма обратной связи |

## Жизненный цикл одного визита

1. **Открытие страницы.** Браузер загружает HTML, затем `tracker.js`.
   `visitorId` берётся из `localStorage` (если нет — генерируется UUID), `sessionId` — из `sessionStorage`.
   Отправляется `POST /api/events` с `type: "pageview"`.
2. **Сервер** (`storage.addEvent`):
   - создаёт/обновляет запись посетителя;
   - создаёт сессию, если её нет или с прошлой активности прошло больше `SESSION_TIMEOUT_SEC`;
   - увеличивает `pageViews` сессии и счётчик просмотров, добавляет запись в `events`;
   - ставит отложенную запись на диск (`scheduleSave`, 400 мс).
3. **Клики по кнопкам.** Любой элемент с атрибутом `data-track="..."` порождает событие
   `type: "action"` с подписью (`catalog:filter`, `contact:submit`, `dashboard:seed` …).
4. **Пока страница открыта.** Каждые 30 с (только если вкладка видима) отправляется `heartbeat` —
   он сдвигает `session.lastEvent`, поэтому длительность сессии соответствует реальному времени на сайте.
5. **Закрытие вкладки/страницы.** `pagehide` / `visibilitychange` → `session_end`
   (сначала `navigator.sendBeacon`, при неудаче `fetch` с `keepalive: true`).
   Сервер закрывает сессию и фиксирует `durationSec`.
6. **Дашборд.** `dashboard.js` асинхронно запрашивает `/api/stats`, `/api/pages`,
   пересчитывает KPI и перерисовывает canvas-графики; каждые 5 с повторяет запрос,
   если включено автообновление и вкладка видима.

## Как данные попадают на диск

- События накапливаются в памяти и пишутся пачкой не чаще, чем раз в `SAVE_DEBOUNCE_MS` (400 мс).
- Файл заменяется атомарно: запись в `stats.json.<pid>.tmp`, затем `fs.rename`.
  Обрыв процесса не оставляет «полфайла».
- При `SIGINT`/`SIGTERM` сервер делает принудительный `flush()` перед выходом.
- Лимиты `MAX_EVENTS` (20000), `MAX_SESSIONS` (5000), `MAX_FEEDBACK` (500) не дают файлу бесконечно расти;
  отброшенные события учитываются в `counters.trimmedEvents`.

## Точки расширения

- Заменить JSON-файл на SQLite/PostgreSQL — интерфейс `Storage` (load/save/addEvent/endSession/reset) остаётся тем же.
- Добавить аутентификацию дашборда (сейчас он доступен всем в локальной сети).
- Считать сервер автореферралов: `GET /api/events` принимает `referrer`, поэтому можно строить воронку.
