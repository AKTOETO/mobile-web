# 10. WebSocket-канал `/ws` и мобильное приложение

Кроме HTTP-API сервер предоставляет **WebSocket**-канал `/ws`. Через него мобильное
приложение под управлением Аврора ОС получает «живую» статистику (без периодических
`fetch`-запросов) и может само присылать события.

Канал обслуживается встроенной реализацией RFC 6455
([`server/websocket.js`](../server/websocket.js) + [`server/realtime.js`](../server/realtime.js)) —
внешних npm-зависимостей по-прежнему нет.

## Подключение

```
ws://<ip-сервера>:3000/ws
```

Клиент (приложение) подключается, сервер сразу присылает приветствие и снимок статистики.

## Сообщения клиент → сервер

| `type` | Поля | Что делает |
|---|---|---|
| `subscribe` | `range` (`24h`/`7d`/`30d`/`all`), `page`, `limit` | Запоминает фильтр клиента и присылает снимок `stats` |
| `stats` / `refresh` | — | Прислать снимок статистики с текущим фильтром |
| `pages` | — | Прислать список страниц (`pages`) |
| `track` | `event` (объект как в `POST /api/events`) | Записать событие и разослать обновление |
| `ping` | `t` (любое) | Проверка связи, ответ `pong` |

Пример:

```json
{ "type": "subscribe", "range": "24h" }
{ "type": "track", "event": { "type": "pageview", "page": "/aurora", "ua": "AuroraOS" } }
```

## Сообщения сервер → клиент

| `type` | Поля | Когда приходит |
|---|---|---|
| `hello` | `service`, `version`, `protocol`, `serverTime`, `heartbeatSec` | Сразу после подключения |
| `stats` | `data` — тот же объект, что отдаёт `GET /api/stats` | После подключения, `subscribe`, изменений (с задержкой ≤ 0.5 с) |
| `update` | `reason`, `counters`, `serverTime` | При любом изменении данных (лёгкое уведомление) |
| `event` | `reason`, `event`, `counters` | Новое событие (для «ленты в реальном времени») |
| `pages` | `data` — как `GET /api/pages` | В ответ на `pages` |
| `tracked` | `eventId`, `sessionId`, `counters` | Подтверждение записи события из `track` |
| `pong` | `serverTime`, `echo` | Ответ на `ping` |
| `error` | `error` | Некорректное сообщение |

### Пример обмена

```
< {"type":"hello","service":"lab01-stat-server","version":"1.0.0","protocol":"aurora-stat/1", …}
< {"type":"stats","data":{ "totals":{…}, "timeline":[…], "devices":{…}, "topPages":[…] }}
> {"type":"subscribe","range":"all"}
< {"type":"stats","data":{ "range":{"key":"all"}, "totals":{…}, …}}
> {"type":"track","event":{"type":"pageview","page":"/aurora"}}
< {"type":"tracked","eventId":"…","sessionId":"…","counters":{…}}
< {"type":"update","reason":"track","counters":{…}}
```

## Контроль соединения

- Сервер раз в `HEARTBEAT_SEC` секунд (по умолчанию 30) отправляет кадр `ping`;
  клиент отвечает `pong` автоматически (это делает библиотека Qt WebSockets).
- Сообщения ограничены по размеру (1 МиБ), неверные кадры закрывают соединение
  кодом `1002`.

## Тест канала

```bash
cd lab01/stat-server
node test/ws-test.js     # 9 проверок: рукопожатие, hello, снимок, track, update, ping/pong
```

Клиент для теста написан вручную на модуле `net` (маскирование кадров, рукопожатие),
чтобы тест не требовал npm-зависимостей.

## Мобильное приложение (Аврора ОС)

Приложение на Qt/QML находится в соседней папке [`../../aurora-app`](../../aurora-app).
Оно подключается именно к этому каналу `/ws`, показывает KPI, грaфики (временной ряд,
устройства, топ страницы) и позволяет отправить тестовое событие.
