# 6. Web-интерфейс: страницы, формы, JS, графики, адаптивность

## Страницы (`public/`)

| Страница | Назначение | JS-модули |
|---|---|---|
| `index.html` | Главная: описание решения + живой блок «Что уже произошло на сайте» (KPI из API) | `api.js`, `tracker.js`, `app.js` |
| `catalog.html` | Демонстрационная витрина с **web-формой фильтра** (кнопки на JS) | `api.js`, `tracker.js`, `app.js` |
| `contact.html` | **Web-форма обратной связи** с валидацией и асинхронной отправкой + таблица сообщений | `api.js`, `tracker.js`, `app.js` |
| `about.html` | Описание методики: какие показатели считаются и где выполнено задание | `api.js`, `tracker.js`, `app.js` |
| `dashboard.html` | Дашборд статистики: форма отчёта, KPI, 4 графика, таблицы | `api.js`, `tracker.js`, `charts.js`, `dashboard.js` |

Сервер также понимает «короткие» адреса: `/` → `index.html`, `/dashboard` → `dashboard.html`.

## Формы и кнопки (требование «JS обрабатывает нажатия на кнопки web-формы»)

### Форма фильтра каталога (`catalog.html` + `app.js`)

| Элемент | Тип | Обработка |
|---|---|---|
| `#category` | `<select>` | `change` → мгновенный пересчёт списка |
| `#maxPrice` | `<input type="number">` | `change` → фильтр по цене |
| `#search` | `<input type="search">` | `change` → поиск по названию |
| `#inStock` | `<input type="checkbox">` | `change` → только в наличии |
| «Применить фильтр» | `<button type="submit">` | `submit` + `event.preventDefault()` → фильтрация **без перезагрузки страницы** |
| «Сбросить» | `<button type="button">` | `form.reset()` + перерисовка |
| «Показать ещё» | `<button type="button">` | порционный вывод (по 6 карточек), кнопка отключается при исчерпании |

```js
form.addEventListener('submit', function (event) {
  event.preventDefault();     // кнопка формы обработана JS, страница не перезагружается
  applyFilters();
});
```

### Форма обратной связи (`contact.html` + `app.js`)

| Элемент | Проверка на клиенте | Проверка на сервере |
|---|---|---|
| `#name` | `required minlength=2` | длина ≥ 2 |
| `#email` | `type=email` | регулярное выражение e-mail |
| `#topic` | `<select>` | значение из списка |
| `#message` | `required minlength=5` | длина ≥ 5 |
| `#trackConsent` | чекбокс согласия | не участвует, но включает/выключает трекер |
| «Отправить» | `submit` + `preventDefault` → `await Api.postFeedback(...)` | `POST /api/feedback`, ответ `201` или `422` со списком ошибок |
| «Очистить» | очищает блок сообщений | — |

Ошибки сервера выводятся списком в `#formMessages`, успех — зелёной плашкой с номером сообщения,
после чего таблица «Отправленные сообщения» перезагружается запросом `GET /api/feedback`.

### Форма отчёта (`dashboard.html` + `dashboard.js`)

| Элемент | Действие |
|---|---|
| `#range` (24 ч / 7 дней / 30 дней / всё время) | `change` → перезапрос `/api/stats` и перерисовка графиков |
| `#page` (список страниц загружается с сервера) | `change` → фильтр по странице |
| `#limit` | сколько сессий выводить в таблице |
| `#autoRefresh` | включает/выключает автообновление каждые 5 с |
| «Применить» | `submit` + `preventDefault` → пересчёт отчёта |
| «Обновить» | однократный перезапрос |
| «Демо-данные» | `POST /api/seed` → пересчёт + обновление списка страниц |
| «Экспорт CSV» | переход на `GET /api/export.csv?type=sessions&…` (скачивание файла) |
| «Сбросить» | `confirm()` → `POST /api/reset` |

Все кнопки дополнительно помечены `data-track="…"` и сами попадают в статистику как события `action`.

## Асинхронные вызовы в JS (требование задания)

| Место | Что асинхронного |
|---|---|
| `public/js/api.js` | `async function request()` + `fetch` + `AbortController` (таймаут 10 с), разбор ошибок по `response.ok` |
| `public/js/tracker.js` | `async/await`, `sendBeacon`, `keepalive`, очередь повторной отправки на `Promise` |
| `public/js/dashboard.js` | `await Api.getStats(...)`, `await Api.postSeed()`, `await Api.postReset()`, `setInterval` автообновления, `setTimeout` на debounce перерисовки при `resize` |
| `public/js/app.js` | `await Api.getStats({range:'all'})` для живых счётчиков, `await Api.postFeedback(...)` при отправке формы, `await loadFeedback()` |

Пример (главная страница):

```js
async function refresh() {
  try {
    const stats = await Api.getStats({ range: 'all' });
    document.querySelector('[data-stat="pageViews"]').textContent = stats.lifetime.pageViews;
  } catch (err) {
    note.textContent = 'Ошибка загрузки статистики: ' + err.message;
  }
}
```

## Графики (`public/js/charts.js`)

Все графики рисуются стандартным 2D-`canvas`, без библиотек. Учитывается `devicePixelRatio`,
поэтому линии чёткие на retina-экранах и на телефоне; при изменении размера окна графики
перерисовываются (debounce 200 мс).

| График | Тип | Данные |
|---|---|---|
| «Просмотры по времени» | линейный график, 2 серии + заливка | `stats.timeline`: `views`, `visitors` по корзинам (час/6 часов/день) |
| «Популярные страницы» | горизонтальные столбцы | `stats.topPages`: просмотры и число посетителей страницы |
| «Устройства посетителей» | кольцевая диаграмма с легендой | `stats.devices`: desktop / mobile / tablet / aurora |
| «Длительность последних сессий» | вертикальные столбцы | `stats.recentSessions`: `durationSec` (открытые сессии — оранжевым) |

Если данных нет, на canvas выводится надпись «Нет данных за выбранный период» — пустой экран не выглядит сломанным.

## Адаптивная вёрстка (`@media`)

### `public/css/style.css`

| Брейкпоинт | Что меняется |
|---|---|
| `max-width: 992px` | KPI и карточки каталога — в 2 колонки, форма — в 2 колонки, уменьшены отступы |
| `max-width: 768px` | меню сворачивается в кнопку «Меню» (`.nav-toggle`, `.nav.is-open`), все сетки в 1 колонку, кнопки форм на всю ширину, таблицы скроллятся горизонтально |
| `max-width: 480px` | крупнее шрифт кнопок и полей ввода (16 px отключает авто-увеличение в мобильных браузерах), KPI в одну колонку |
| `prefers-color-scheme: dark` | тёмная палитра через CSS-переменные |

### `public/css/dashboard.css`

| Брейкпоинт | Что меняется |
|---|---|
| `max-width: 992px` | графики из 2 колонок в 1, высота canvas 240 px |
| `max-width: 768px` | высота canvas 220 px, статусная строка в столбик |
| `max-width: 480px` | высота canvas 200 px, компактные KPI |
| `print` | скрыты шапка/подвал/кнопки, убраны тени — чтобы отчёт можно было распечатать |

Механизм адаптивности: CSS-переменные палитры + `display: grid` с `minmax(0, 1fr)` +
`flex-wrap` + горизонтально скроллящиеся таблицы (`.table-wrap { overflow-x: auto }`).

## Как проверить адаптивность руками

1. Открыть `http://localhost:3000/dashboard.html` на ПК — 2 колонки графиков, 6 KPI в ряд.
2. Сузить окно до ~900 px — графики в одну колонку, KPI по 2 в ряд.
3. Сузить до ~700 px — появляется кнопка «Меню», кнопки формы на всю ширину.
4. Открыть в эмуляции телефона (DevTools → device toolbar) или на реальном телефоне —
   всё в одну колонку, таблицы скроллятся, шрифт форм 16 px.
