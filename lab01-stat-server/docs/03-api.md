# 3. API сервера

Все методы доступны на том же адресе, что и сайт: `http://<host>:3000`.
Запросы к API — обычные HTTP, тело ответов — JSON в кодировке UTF-8.

## Сводка методов

| Метод | Путь | Назначение | Кто вызывает |
|---|---|---|---|
| `GET` | `/api/health` | Проверка сервера, версия, таймауты, путь к файлу данных | тесты, диагностика |
| `POST` | `/api/events` | Приём события статистики (`pageview`, `action`, `heartbeat`, `session_end`) | `tracker.js` |
| `POST` | `/api/session-end` | Явно закрыть сессию и зафиксировать длительность | `tracker.js` (закрытие вкладки) |
| `GET` | `/api/stats` | Сводка показателей + данные для графиков | `dashboard.js`, `app.js` |
| `GET` | `/api/pages` | Список страниц, которые когда-либо просматривали | `dashboard.js` (фильтр) |
| `GET` | `/api/sessions` | Последние сессии (таблица) | `dashboard.js` |
| `POST` | `/api/feedback` | Обработка web-формы обратной связи | `app.js` |
| `GET` | `/api/feedback` | Список полученных сообщений | `app.js` |
| `GET` | `/api/export.csv` | Экспорт отчёта в CSV (`type=sessions\|pages\|timeline`) | кнопка «Экспорт CSV» |
| `POST` | `/api/seed` | Наполнить статистику демонстрационными данными | кнопка «Демо-данные» |
| `POST` | `/api/reset` | Полная очистка статистики | кнопка «Сбросить» |

---

## GET /api/health

```bash
curl http://localhost:3000/api/health
```

```json
{
  "ok": true,
  "service": "lab01-stat-server",
  "version": "1.0.0",
  "startedAt": "2026-10-10T14:22:53.020Z",
  "uptimeSec": 2,
  "dataFile": "/…/lab01-stat-server/data/stats.json",
  "sessionTimeoutSec": 1800,
  "heartbeatSec": 30
}
```

## POST /api/events

Тело запроса (все поля необязательные, кроме смысла «что произошло»):

| Поле | Тип | Описание |
|---|---|---|
| `type` | string | `pageview` (по умолчанию), `action`, `heartbeat`, `session_end` |
| `visitorId` | string | Идентификатор посетителя из `localStorage`; если пуст — сервер сгенерирует UUID |
| `sessionId` | string | Идентификатор сессии из `sessionStorage` |
| `page` | string | Путь страницы (`/catalog.html`); query/хост отбрасываются |
| `referrer` | string | `document.referrer` |
| `origin` | string | `location.origin` — адрес текущей страницы; нужен, чтобы отличить переходы внутри сайта от внешних |
| `ua` | string | `navigator.userAgent` — по нему определяется устройство |
| `label` | string | Подпись действия для `action` (например, `catalog:filter`) |
| `ts` | number | Миллисекунды на стороне клиента (не может быть больше времени сервера) |
| `lang`, `screen`, `tz` | string | Язык, разрешение экрана, часовой пояс |

```bash
curl -X POST http://localhost:3000/api/events \
  -H 'Content-Type: application/json' \
  -d '{"type":"pageview","visitorId":"doc-visitor","sessionId":"doc-session",
       "page":"/index.html","ua":"Mozilla/5.0 (Linux; U; Android 8.1.0; ru-ru; Jolla X) Aurora Browser/2.0.0.21"}'
```

```json
{
  "ok": true,
  "eventId": "6732b723-99e7-44eb-b828-e54d6f65c56e",
  "sessionId": "doc-session",
  "counters": { "events": 177, "pageViews": 114, "actions": 28, "heartbeats": 0,
                "sessionEnds": 35, "feedback": 0, "trimmedEvents": 0 }
}
```

Ответ: `201 Created`. Ошибки: `400` (битый JSON), `413` (тело больше `MAX_BODY_BYTES`).

## POST /api/session-end

```bash
curl -X POST http://localhost:3000/api/session-end \
  -H 'Content-Type: application/json' \
  -d '{"sessionId":"doc-session","visitorId":"doc-visitor"}'
```

```json
{ "ok": true, "session": { "id": "doc-session", "closed": true, "durationSec": 42, "pageViews": 1 } }
```

`404`, если такой сессии нет.

## GET /api/stats

Параметры:

| Параметр | Значения | По умолчанию |
|---|---|---|
| `range` | `24h`, `7d`, `30d`, `all` | `24h` |
| `page` | путь страницы (фильтр по странице) | без фильтра |
| `limit` | 1…50 — сколько сессий вернуть в `recentSessions` | 15 |

```bash
curl "http://localhost:3000/api/stats?range=24h"
```

Фрагмент ответа:

```json
{
  "generatedAt": 1791642175003,
  "range": { "key": "24h", "label": "последние 24 часа", "from": 1791555775003,
             "to": 1791642175003, "bucketMs": 3600000, "pageFilter": "" },
  "totals": {
    "pageViews": 31, "uniqueVisitors": 8, "sessions": 24, "openSessions": 15,
    "newVisitors": 5, "returningVisitors": 4, "actions": 8,
    "avgSessionDurationSec": 64, "maxSessionDurationSec": 554,
    "avgPagesPerSession": 1.29, "bounceRate": 83.3, "activeNow": 2
  },
  "lifetime": { "pageViews": 113, "uniqueVisitors": 24, "sessions": 35,
                "avgSessionDurationSec": 299, "avgPagesPerSession": 3.23,
                "newVisitors": 17, "returningVisitors": 7, "actions": 28,
                "feedback": 0, "firstEvent": 1791094680000, "lastEvent": 1791642231530 },
  "devices": { "desktop": 21, "aurora": 3, "tablet": 5, "mobile": 6 },
  "sources": { "direct": 7, "internal": 17, "external": [ { "host": "google.com", "count": 2 } ] },
  "timeline": [ { "t": 1791555775003, "label": "17:00", "views": 0, "visitors": 0 },
                { "t": 1791559375003, "label": "18:00", "views": 7, "visitors": 2 } ],
  "topPages": [ { "page": "/index.html", "views": 10, "visitors": 6 } ],
  "recentSessions": [ { "id": "demo-s-demo-004-1", "visitorId": "demo-004", "device": "desktop",
                        "start": 1791641000000, "end": 1791641500000, "durationSec": 500,
                        "pageViews": 5, "actions": 1, "entryPage": "/index.html",
                        "exitPage": "/catalog.html", "open": false } ],
  "counters": { "events": 176, "pageViews": 113, "actions": 28, "heartbeats": 0,
                "sessionEnds": 35, "feedback": 0, "trimmedEvents": 0 }
}
```

## GET /api/pages и GET /api/sessions

```bash
curl http://localhost:3000/api/pages
# {"pages":[{"page":"/index.html","views":33},{"page":"/catalog.html","views":24}, …]}

curl "http://localhost:3000/api/sessions?limit=5"
# {"sessions":[{"id":"…","visitorId":"…","device":"aurora","start":…,"durationSec":126,"pageViews":3,…}]}
```

## POST /api/feedback (web-форма)

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H 'Content-Type: application/json' \
  -d '{"name":"Иван","email":"ivan@mai.ru","topic":"question","message":"Вопрос по лабораторной работе"}'
# {"ok":true,"id":"8a1f1d6d-…","createdAt":"2026-10-10T14:24:11.103Z"}
```

Ошибка валидации (`422`):

```bash
curl -X POST http://localhost:3000/api/feedback -H 'Content-Type: application/json' \
  -d '{"name":"A","email":"x","message":"hi"}'
# {"ok":false,"errors":["Укажите имя (минимум 2 символа).","Некорректный e-mail.","Сообщение слишком короткое (минимум 5 символов)."]}
```

Правила валидации на сервере: имя ≥ 2 символов, e-mail по регулярному выражению, сообщение ≥ 5 символов.
Те же правила продублированы на клиенте, чтобы не отправлять заведомо плохую форму.

## GET /api/export.csv

```bash
curl "http://localhost:3000/api/export.csv?type=sessions&range=7d"
```

```
id;visitorId;device;start;end;durationSec;pageViews;actions;entryPage;exitPage
demo-s-demo-004-1;demo-004;desktop;1791641000000;1791641500000;500;5;1;/index.html;/catalog.html
```

`type`: `sessions` (по умолчанию), `pages`, `timeline`. Разделитель — `;`, добавлен BOM, чтобы Excel
корректно открыл кириллицу. Заголовок ответа содержит `Content-Disposition: attachment; filename="stats-…csv"`.

## POST /api/seed и POST /api/reset

```bash
curl -X POST http://localhost:3000/api/seed -H 'Content-Type: application/json' \
  -d '{"visitors":24,"days":7,"seed":42}'
# {"ok":true,"events":113,"visitors":24,"days":7}

curl -X POST http://localhost:3000/api/reset -H 'Content-Type: application/json' \
  -d '{"confirm":true}'
# {"ok":true,"message":"Статистика очищена"}
```

`reset` без `{"confirm": true}` вернёт `400` — защита от случайного сброса.

## Коды ошибок

| Код | Когда |
|---|---|
| `200/201` | успех |
| `400` | некорректный JSON в теле, отсутствует подтверждение сброса |
| `404` | неизвестный API-метод, несуществующая страница/сессия |
| `405` | не GET/POST для статики |
| `413` | тело запроса больше `MAX_BODY_BYTES` (по умолчанию 64 КБ) |
| `422` | форма прошла transport, но не прошла валидацию |
| `500` | внутренняя ошибка (текст ошибки возвращается в JSON) |

## Безопасность (в объёме учебной работы)

- Статика отдаётся только из `public/`, путь нормализуется, выход за пределы папки запрещён (`403/404`).
- Тело POST ограничено по размеру, строки урезаются до разумной длины, `visitorId/sessionId`
  проверяются регулярным выражением `^[A-Za-z0-9_.:#-]{1,64}$`.
- SQL-инъекций нет, так как нет SQL; XSS в таблицах дашборда ограничивается тем, что сервер
  сохраняет только путь страницы и короткие строки (HTML-разметка не генерируется из них осмысленно).
- Дашборд доступен всем в локальной сети — это осознанно для демонстрации (см. `docs/09-faq.md`).
