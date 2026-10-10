# 5. Клиентский сбор статистики (`public/js/tracker.js`)

`tracker.js` подключён на **всех** страницах сайта:

```html
<script src="/js/api.js"></script>
<script src="/js/tracker.js"></script>
<script src="/js/app.js"></script>
```

## Идентификаторы

| Ключ | Где хранится | Зачем |
|---|---|---|
| `weblab.visitorId` | `localStorage` | постоянный идентификатор посетителя → счёт «уникальных посетителей» |
| `weblab.sessionId` | `sessionStorage` | идентификатор визита → сессии и их длительность |
| `weblab.consent` | `localStorage` | разрешение на сбор статистики (чекбокс на форме обратной связи) |

Если хранилище недоступно (приватный режим), код не падает: идентификаторы генерируются на лету
(`crypto.randomUUID()` с запасным вариантом на `getRandomValues`/`Math.random`).

## Типы событий

| Событие | Когда отправляется | Что даёт серверу |
|---|---|---|
| `pageview` | при загрузке страницы (`DOMContentLoaded`) | просмотры страниц, входная страница сессии |
| `action` | клик по элементу с `data-track="…"` | число нажатий кнопок, подписи действий |
| `heartbeat` | каждые 30 с, только если вкладка видима | продлевает сессию → корректная длительность |
| `session_end` | `pagehide` / `beforeunload` / `visibilitychange → hidden` | фиксирует `end` и `durationSec` |

## Асинхронность (требование задания)

```js
async function sendEvent(type, extra) {
  const payload = basePayload();
  payload.type = type;
  try {
    const result = await postJson(EVENT_URL, payload, false);
    flushQueue();                       // повторная отправка того, что не ушло
    return result;
  } catch (err) {
    if (queue.length < MAX_QUEUE) queue.push(payload);   // очередь на повтор
    return null;
  }
}
```

- `async/await` — все отправки.
- `fetch` с `keepalive: true` для финального `session_end`.
- `navigator.sendBeacon` — основной способ сообщить о закрытии вкладки (надёжнее, чем `fetch`
  при выгрузке страницы); при его недоступности используется `fetch` с `keepalive`.
- Очередь неотправленных событий (`Promise`-цепочка в `flushQueue`) — если сеть/сервер
  на секунду недоступны, событие не теряется, а будет отправлено при следующем успехе.
- `console.warn` вместо падения: ошибка сети не ломает интерфейс сайта.

## Отслеживание кнопок

Ловушка кликов на уровне документа (третий аргумент `true` — фаза захвата):

```js
document.addEventListener('click', (event) => {
  let target = event.target;
  while (target && target !== document) {
    if (target.getAttribute && target.getAttribute('data-track')) {
      sendEvent('action', { label: target.getAttribute('data-track') });
      break;
    }
    target = target.parentNode;
  }
}, true);
```

Достаточно добавить атрибут элементу, чтобы его нажатие попало в статистику:

```html
<button class="btn" type="submit" data-track="catalog:filter">Применить фильтр</button>
<a class="btn" href="/dashboard.html" data-track="open:dashboard">Открыть статистику</a>
```

Используемые метки: `index:refresh`, `index:demo-action`, `open:dashboard`, `open:contact`,
`catalog:filter`, `catalog:reset`, `catalog:more`, `contact:submit`, `contact:clear`,
`dashboard:apply`, `dashboard:reload`, `dashboard:seed`, `dashboard:export`, `dashboard:reset`.

## Согласие на сбор данных

На странице «Обратная связь» есть чекбокс «разрешить собирать статистику моего визита».
Он вызывает `MAITracker.setConsent(false)` — после этого клиент перестаёт отправлять события
(значения уже собранных визитов при этом не удаляются).

## Публичный API трекера

```js
MAITracker.visitorId;              // текущий идентификатор посетителя
MAITracker.sessionId;              // текущая сессия
MAITracker.action('my:label');     // отправить произвольное действие
MAITracker.sendEvent('pageview');  // отправить произвольное событие
MAITracker.setConsent(true|false);
MAITracker.hasConsent();
MAITracker.endSession();
MAITracker.queued();               // сколько событий ждут повторной отправки
```

## Совместимость с браузером телефона (Аврора)

- Не используется новый синтаксис: нет optional chaining (`?.`), нет `??`, нет классовых полей.
  Применяются `var`, обычные функции, `async/await`, `Promise`, `Object.keys`.
- `crypto.randomUUID()` вызывается только если он существует (в старых WebKit его нет) —
  есть резервная реализация UUID.
- `sendBeacon` и `keepalive` применяются «по возможности», а не как единственная опция.
- Нет внешних библиотек и CDN: страница работает даже без доступа в интернет.
