# Отчёт по лабораторной работе №2

**Курс:** Разработка мобильных и web-приложений
**Лабораторная работа №2:** REST API, HTTPS и offline-клиент на Aurora OS
**Вариант №7:** Инвентарь
**Проект:** `lab02/inventory-server/` (HTTPS-сервер и тестовая страница), `lab02/aurora-app/` (нативное приложение для ОС Аврора)

---

## 1. Задание

### 1.1 Цель работы

Лабораторная работа состоит из трёх частей: серверная часть на ПК, вспомогательная
браузерная часть на мобильном устройстве и основная нативная часть на мобильном
устройстве. Все три части используют один предмет инвентаря из варианта №7:
название, количество, место хранения и состояние. Сервер и приложение должны
работать в локальной сети: сервер запускается на ПК, клиенты — на ПК и на
эмуляторе Aurora OS.

> **Часть 1.** Реализовать REST API с версионированием через `/api/v1/`, CRUD-операции
> GET, POST, PUT/PATCH и DELETE, обмен в формате JSON, корректные коды 200, 201, 204,
> 400, 401, 403, 404 и 500, заголовки Content-Type, Accept, Host и User-Agent,
> аутентификацию через JWT или cookie, HTTPS с самоподписанным сертификатом,
> кэширование через ETag, Cache-Control и Last-Modified, документацию OpenAPI.
>
> **Часть 2.** Открыть тестовую страницу в браузере на ПК и выполнить через неё
> создание, чтение, обновление и удаление записей. Подключить телефон Аврора к той же
> сети, открыть ту же страницу в его браузере и убедиться, что запросы к API работают.
>
> **Часть 3.** Разработать нативное приложение на Qt, QML и C++ для ОС Аврора:
> асинхронные HTTP-запросы через QNetworkAccessManager, разбор JSON через QJsonDocument,
> QJsonObject и QJsonArray, хранение токена/cookie между сессиями через QSettings и
> QNetworkCookieJar, локальный SQLite-кэш через QtSql, CRUD через REST API, обработку
> сетевых ошибок, таймаутов, кодов 4xx и 5xx. Продемонстрировать полный CRUD-цикл,
> offline-режим с показом кэша, восстановление сети и синхронизацию, обработку ошибок.

### 1.2 Вариант №7 «Инвентарь»

Сервер хранит предметы инвентаря. Приложение позволяет создавать, просматривать,
редактировать и удалять записи, работать offline и синхронизироваться с сервером
после восстановления сети.

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | строка UUID | назначает сервер |
| `name` | строка | 1–120 символов |
| `quantity` | целое | от 0 до 1 000 000 |
| `location` | строка | 1–120 символов |
| `condition` | перечисление | `new`, `good`, `used`, `broken` |
| `version` | целое | увеличивается сервером при изменении |
| `createdAt`, `updatedAt` | ISO-8601 | назначает сервер |

### 1.3 Требования и файлы реализации

| Требование | Реализация | Файлы |
|---|---|---|
| REST API с версионированием | префикс `/api/v1`, маршруты предметов и аутентификации | `server/server.js` |
| CRUD, JSON, коды 200–500 | GET/POST/PUT/PATCH/DELETE, единый формат ошибок, проверка полей | `server/server.js`, `server/validation.js` |
| Заголовки Content-Type, Accept, Host, User-Agent | проверка обязательных заголовков, согласование Accept, `application/json` для тела | `server/server.js` |
| Аутентификация JWT или cookie | JWT HS256, cookie `token` (HttpOnly, Secure, SameSite), Bearer | `server/auth.js` |
| HTTPS с самоподписанным сертификатом | сертификат и CA в `certs/`, HTTPS 8443, HTTP 8080 → 301 | `tools/gen-cert.sh`, `server/config.js` |
| Кэширование ETag, Cache-Control, Last-Modified | ETag списка и предмета, `If-None-Match`, `If-Modified-Since` → 304 | `server/server.js` |
| Интерактивная документация API | Swagger UI, Try it out / Execute, JWT | `server/openapi.js`, `public/docs.html`, `public/js/swagger.js` |
| Тестовая страница на ПК и Авроре | логин, CRUD, журнал запросов, автодемо `?auto=1` | `public/index.html`, `public/js/app.js` |
| Приложение Qt/QML/C++ | Qt 5.6.3, Sailfish Silica, `CONFIG += auroraapp` | `aurora-app/` |
| QNetworkAccessManager, JSON | асинхронные запросы, QJsonDocument/Object/Array | `src/inventoryclient.cpp` |
| QSettings и QNetworkCookieJar | адрес, JWT, профиль, cookie между запусками | `src/inventoryclient.cpp` |
| SQLite через QtSql | кэш `items` и очередь `pending` | `src/localcache.cpp` |
| Offline и синхронизация | показ кэша, очередь операций, замена временных id | `src/inventoryclient.cpp`, `src/localcache.cpp` |
| Обработка ошибок | сеть, таймаут 8 с, 400/401/403/404/5xx, sslErrors | `src/inventoryclient.cpp` |

---

## 2. Статус выполнения

| Часть | Компонент | Статус | Подтверждение |
|---|---|---|---|
| 1 | Сервер: CRUD, auth, кэш, Swagger UI | готово | `npm test`: 122/122 |
| 2 | Страница на ПК (Firefox) | готово | 14/14, скриншот |
| 2 | Страница на Авроре | готово | 14/14, ответ 200 |
| 3 | Приложение Qt/C++ | готово | исходники в приложении Б |
| 3 | Сборка RPM x86_64 | готово | RPM в `RPMS/` |
| 3 | Установка на эмулятор | готово | `pkcon install-local` |
| 3 | Демо CRUD/offline/sync | готово | журнал: 20 шагов |

**Команды и результаты проверок**

| Проверка | Команда | Результат |
|---|---|---|
| Автотесты сервера | `npm test` | 122/122 |
| Сборка приложения | `sfdk build` | RPM собран |
| Установка на эмулятор | `pkcon install-local` | Installed |
| Демо на ПК | `browser-demo.js` | 14/14 |
| Демо на Авроре | браузер `?auto=1` | 14/14, 200 |
| Демо приложения | `--demo` | 20 шагов |
| Swagger UI на ПК и Авроре | `/docs.html?auto=1` | 11/11 в каждом браузере |
| Единое обновление приложения | `tests/sync-test` | 8 проверок пройдено |

---

## 3. Архитектура решения

Решение состоит из трёх клиентов и одного сервера. Сервер хранит данные в JSON-файле
и отдаёт их по HTTPS. Браузер на ПК и браузер Авроры работают с одной и той же
тестовой страницей. Нативное приложение использует тот же REST API, но дополнительно
держит SQLite-кэш и очередь отложенных операций.

![Архитектура: браузер, приложение Авроры и Node.js сервер](images/architecture.svg)

| Компонент | Назначение | Технологии |
|---|---|---|
| `inventory-server` | REST API, HTTPS, аутентификация, кэш, статика | Node.js, встроенные модули |
| `public/index.html` | тестовая страница и автодемо | HTML, CSS, ES5, XMLHttpRequest |
| `public/docs.html` | выполнение запросов из Swagger UI | Swagger UI 3.52.5, OpenAPI 3.0 |
| `aurora-app` | нативное приложение для Авроры | Qt 5.6.3, QML, C++, QtSql |
| `report/src/browser-demo.js` | автоматизация Firefox на ПК | geckodriver, WebDriver |

**Структура проекта**

```
lab02/
├── inventory-server/
│   ├── server/            config.js, auth.js, validation.js,
│   │                      store.js, openapi.js, server.js
│   ├── public/            index.html, docs.html, css/, js/
│   ├── certs/             ca.crt, server.crt (ключи не коммитятся)
│   ├── data/              inventory.json, jwt.secret (создаются при запуске)
│   ├── test/api-test.js   122 проверки API
│   └── tools/gen-cert.sh  генерация самоподписанного сертификата
├── aurora-app/
│   ├── src/               main.cpp, inventoryclient, localcache, itemmodel
│   ├── qml/               aurorainventory.qml, pages/, cover/
│   ├── icons/             86x86, 108x108, 128x128, 172x172
│   ├── rpm/               spec и changelog
│   └── ru.mai.aurorainventory.pro
└── report/                report.yaml, images/, screenshots/, logs/, src/
```

Полные тексты разработанных исходных файлов сервера, браузерной части,
нативного приложения, тестов и файлов сборки приведены в приложениях А и Б.
Листинги формируются непосредственно из файлов проекта, без сокращений.

---

## 4. Серверная часть

### 4.1 Запуск и конфигурация

Сервер написан на Node.js без внешних зависимостей: используются только встроенные
модули `node:https`, `node:http`, `node:crypto`, `node:fs`, `node:path` и `node:os`.
Запуск: `cd lab02/inventory-server && npm start`. Сервер слушает `0.0.0.0`, поэтому
доступен не только с ПК, но и из локальной сети и из эмулятора (гость обращается к
хосту по адресу `10.0.2.2`).

| Параметр | Значение по умолчанию | Переменная окружения |
|---|---|---|
| HTTPS-порт | 8443 | `HTTPS_PORT` |
| Интерфейс прослушивания | `0.0.0.0` | `HOST` |
| HTTP-порт (редирект 301) | 8080 | `HTTP_PORT` |
| Каталог данных | `data/` | `DATA_DIR` |
| Файл предметов | `data/inventory.json` | `DATA_FILE` |
| Каталог сертификатов | `certs/` | `CERT_DIR` |
| Время жизни JWT | 3600 с | `JWT_TTL_SEC` |
| Отладочные маршруты | выключены | `LAB02_DEBUG=1` |
| Журнал запросов | выключен | `LAB02_LOG=1` |

Сертификат создаётся скриптом `tools/gen-cert.sh`: отдельный CA и серверный
сертификат с SAN `localhost`, `127.0.0.1`, `10.0.2.2` и адресом ПК в локальной сети.
На эмуляторе CA добавлен в `/etc/pki/ca-trust/source/anchors/`, после чего `curl`
из гостя успешно обращается к `https://10.0.2.2:8443/api/v1/health`.

При демонстрации в другой сети IP не вшит в сервер или Swagger UI. После
подключения ПК к новой сети нужно выполнить `npm run certs` (CA сохраняется),
перезапустить сервер и открыть напечатанную сетевую ссылку `/docs.html`.
Все URL клиентской страницы относительные; спецификация задаёт `/api/v1`
относительно текущего адреса. В нативном приложении меняется только URL в настройках.

### 4.2 Модель данных и валидация

Предмет инвентаря хранится в `data/inventory.json`. При старте сервер загружает файл,
при изменении — обновляет запись и атомарно перезаписывает файл (временный файл и
переименование). Версия предмета увеличивается при каждом обновлении и входит в ETag.

Валидация вынесена в `server/validation.js`. Для `POST` и `PUT` обязательны все четыре
поля варианта, для `PATCH` — хотя бы одно. Ошибки возвращаются массивом `details`
с полем и сообщением. Некорректный JSON, отсутствие `Content-Type: application/json`
и превышение размера тела (256 КБ) также дают 400.

### 4.3 Маршруты REST API

| Метод | Путь | Назначение | Успех | Ошибки |
|---|---|---|---|---|
| GET | `/api/v1/health` | состояние сервера | 200 | — |
| POST | `/api/v1/auth/login` | вход, выдача JWT и cookie | 200 | 400, 401 |
| POST | `/api/v1/auth/logout` | выход, сброс cookie | 204 | — |
| GET | `/api/v1/auth/me` | текущий пользователь | 200 | 401 |
| GET | `/api/v1/items` | список с фильтрами и пагинацией | 200, 304 | 400, 401, 406 |
| POST | `/api/v1/items` | создание предмета | 201 | 400, 401, 403, 406 |
| GET | `/api/v1/items/{id}` | чтение предмета | 200, 304 | 401, 404, 406 |
| PUT | `/api/v1/items/{id}` | полная замена | 200 | 400, 401, 403, 404 |
| PATCH | `/api/v1/items/{id}` | частичное изменение | 200 | 400, 401, 403, 404 |
| DELETE | `/api/v1/items/{id}` | удаление | 204 | 401, 403, 404 |
| GET | `/api/v1/openapi.json` | спецификация OpenAPI | 200 | — |
| GET | `/api/v1/debug/error` | тестовая ошибка 500 | — | 500 (только debug) |

Список поддерживает параметры `q`, `condition`, `sort`, `order`, `limit` (1–100),
`offset`. Ответ содержит `items`, `total`, `limit`, `offset`, `filters` и заголовок
`X-Total-Count`. Некорректные параметры дают 400 с перечнем полей.

### 4.4 Аутентификация и роли

Пароли хранятся в виде scrypt-хэша с солью, сравнение — `timingSafeEqual`. После входа
сервер подписывает JWT алгоритмом HS256 (секрет создаётся локально в `data/jwt.secret`
при первом запуске) и одновременно ставит cookie `token` с атрибутами `HttpOnly`,
`Secure`, `SameSite=Strict` и временем жизни 3600 с. Токен принимается из заголовка
`Authorization: Bearer ...` или из cookie; заголовок имеет приоритет.

| Пользователь | Пароль | Роль | Права |
|---|---|---|---|
| `admin` | `admin123` | admin | чтение, создание, изменение, удаление |
| `user` | `user123` | user | чтение, создание, изменение |
| `viewer` | `viewer123` | viewer | только чтение |

Отсутствие или истечение токена даёт 401, недостаток прав — 403. Выход (`logout`)
сбрасывает cookie через `Max-Age=0`, поэтому следующий запрос без заголовка снова
получает 401.

### 4.5 Заголовки, коды и формат ошибок

Для всех маршрутов `/api/v1` сервер проверяет `Host` (обязателен, должен быть
корректным) и `User-Agent` (обязателен); при нарушении возвращается 400. Заголовок
`Accept` согласуется: если клиент не принимает `application/json`, возвращается 406.
Тело запроса принимается только с `Content-Type: application/json`.

Ошибки имеют единый вид:

```
{
  "error": "validation_error",
  "message": "Проверьте поля запроса.",
  "details": [ { "field": "quantity", "message": "Количество — целое число не меньше 0." } ]
}
```

Использованы коды 200 (успешное чтение и изменение), 201 (создание), 204 (удаление и
выход), 304 (кэш), 400 (валидация, заголовки, JSON), 401 (нет токена), 403 (роль),
404 (нет предмета или маршрута), 405 (метод не поддерживается), 406 (Accept),
413 (слишком большое тело) и 500 (внутренняя ошибка).

### 4.6 Кэширование

Список и отдельный предмет отдают `ETag`, `Last-Modified` и
`Cache-Control: private, max-age=0, must-revalidate`. Клиент может прислать
`If-None-Match` или `If-Modified-Since`; при совпадении сервер отвечает 304 без тела.
После создания, изменения и удаления используются `Cache-Control: no-store`, чтобы
браузер не показывал устаревшие данные. Статические файлы кэшируются на 300 с,
HTML — с `no-cache`. Именно поэтому автодемо запрашивает список с параметром
`?demo=...`: это исключает вмешательство дискового кэша браузера в проверку 304.

### 4.7 Интерактивная документация Swagger UI

Единственный интерфейс документации — Swagger UI на `/docs.html`, ссылка на него
есть на главной странице. Прежний самописный просмотрщик и `docs.js` удалены.
Swagger UI использует описание OpenAPI 3.0 из `/api/v1/openapi.json`: это источник
параметров и схем для интерфейса, а не отдельный просмотрщик. JS и CSS библиотеки
хранятся локально, поэтому Интернет и CDN на демонстрации не требуются.

Для выполнения запроса нужно раскрыть метод, нажать `Try it out`, заполнить тело
или параметры и нажать `Execute`. Swagger UI показывает URL, curl-команду, код,
заголовки и тело ответа. Сначала выполняется `POST /auth/login` с `admin/admin123`;
JWT автоматически применяется к следующим операциям. Можно также ввести токен
через `Authorize`. После `POST /auth/logout` сохранённая авторизация сбрасывается.

Режим `/docs.html?auto=1` проверяет именно кнопки Swagger UI, а не параллельный
HTTP-клиент: health, login, me, список, создание, GET по id, PUT, PATCH, DELETE,
GET удалённого предмета (404), logout. В Firefox на ПК и в браузере Авроры
(Gecko 78) получено **11/11** успешных проверок. Использовался отдельный тестовый
порт 9443; основной порт по умолчанию остаётся 8443.

![Swagger UI в Firefox: запросы API выполнены через Execute](screenshots/pc-firefox-docs.png)

### 4.8 Автотесты сервера

`npm test` запускает `test/api-test.js`: тест поднимает сервер на свободных портах с
временным каталогом данных, поэтому не зависит от рабочего файла и не мешает
запущенному серверу. Проверяются:

| Группа | Что проверяется |
|---|---|
| health и заголовки | Host, User-Agent, Accept, Content-Type, тело ошибок |
| аутентификация | вход admin/user/viewer, неверный пароль, `auth/me`, Bearer и cookie, logout |
| CRUD | список, фильтры, пагинация, создание, чтение, PUT, PATCH, удаление |
| коды | 200, 201, 204, 304, 400, 401, 403, 404, 405, 406, 500 |
| кэш | ETag, Last-Modified, If-None-Match, If-Modified-Since |
| отладка | debug/error и debug/demo-result (200 только при включённой отладке) |

Итог последнего запуска: **122 проверки, 0 ошибок**.

---

## 5. Браузерная часть

### 5.1 Тестовая страница

`public/index.html` — единая страница для ПК и мобильного браузера. Она содержит форму
входа, список предметов, форму создания и редактирования, кнопки удаления, панель
кэша и журнал запросов с кодами и заголовками. Все запросы выполняются через
`XMLHttpRequest` в ES5: браузер Авроры (Gecko/embedlite) не должен зависеть от
современного синтаксиса. Страница адаптивна: при узком экране колонки перестраиваются
в одну.

Для тестовой страницы и Swagger UI явно задана светлая цветовая схема.
Системное предпочтение тёмной темы не меняет оформление страниц и полей ввода.

Для демонстрации без ручного ввода предусмотрен режим `?auto=1`. Он последовательно
выполняет 14 шагов и записывает результат в заголовок страницы, в `window.__demo`,
в журнал и контрольным запросом на сервер.

| № | Шаг | Ожидаемый код |
|---|---|---|
| 1 | Вход `admin` | 200 |
| 2 | Чтение списка | 200 |
| 3 | Повторное чтение с `If-None-Match` | 304 |
| 4 | Создание предмета | 201 |
| 5 | Чтение созданного предмета | 200 |
| 6 | Обновление через PATCH | 200 |
| 7 | Удаление предмета | 204 |
| 8 | Ошибка валидации | 400 |
| 9 | Несуществующий предмет | 404 |
| 10 | Выход и сброс cookie | 204 |
| 11 | Запрос без токена | 401 |
| 12 | Вход `viewer` | 200 |
| 13 | Создание от `viewer` | 403 |
| 14 | Внутренняя ошибка `debug/error` | 500 |

### 5.2 Демонстрация на ПК

Сервер запущен на ПК, страница открыта в Firefox под управлением geckodriver.
Скрипт `report/src/browser-demo.js` создаёт сессию с `acceptInsecureCerts: true`
(самоподписанный сертификат), открывает `https://127.0.0.1:8443/?auto=1`, ждёт
завершения автодемо и снимает скриншоты.

![Автодемо на ПК: 14 шагов из 14 выполнены](screenshots/pc-firefox-demo.png)

Результат: **14/14 шагов, ok=true**. В журнале сервера виден контрольный запрос
`GET /api/v1/debug/demo-result?ok=1&passed=14&total=14 -> 200`.

### 5.3 Демонстрация на Авроре

На эмулятор Aurora OS 5.1.1.60 установлен браузер `sailfish-browser 2.2.46+git60`
из репозитория `omp` командой `sudo pkcon install -y sailfish-browser`. Корневой
сертификат `lab02-ca.crt` добавлен в доверенные, после чего браузер открыл страницу
`https://10.0.2.2:8443/?auto=1` (адрес хоста из гостя). Автодемо дошло до конца:
14 шагов из 14, в журнале сервера — ответ 200 на контрольный запрос. Кэш браузера
перед повторным запуском очищался (`~/.cache/org.sailfishos/browser`), чтобы исключить
старые версии статических файлов.

| Проверка на Авроре | Результат |
|---|---|
| Установка браузера | `sailfish-browser-2.2.46+git60.x86_64` |
| Доверие сертификату | CA в `/etc/pki/ca-trust/source/anchors/` + `update-ca-trust` |
| Доступность API из гостя | `curl` к `https://10.0.2.2:8443/api/v1/health` → 200 |
| Автодемо в браузере | 14/14, `ok=1` |
| Журнал сервера | `GET /api/v1/debug/demo-result?…passed=14&total=14 -> 200` |

---

## 6. Нативная часть для ОС Аврора

### 6.1 Состав приложения

Приложение собрано на Qt 5.6.3 с `CONFIG += auroraapp`; интерфейс — QML и Sailfish
Silica, логика — C++. Пакет называется `ru.mai.aurorainventory`, запись меню —
`ru.mai.aurorainventory.desktop`, иконки — в четырёх размерах. Для сети и SQLite
подключены модули `QT += network sql`.

| Класс | Файлы | Ответственность |
|---|---|---|
| `InventoryClient` | `src/inventoryclient.h/.cpp` | HTTP, JSON, auth, offline, синхронизация, демо |
| `LocalCache` | `src/localcache.h/.cpp` | таблицы `items` и `pending`, временные id |
| `ItemModel` | `src/itemmodel.h/.cpp` | модель списка для QML |
| `PersistentCookieJar` | `src/inventoryclient.h/.cpp` | cookie в QSettings |
| `main.cpp` | `src/main.cpp` | Aurora::Application, QML-контекст, ключ `--demo` |

### 6.2 Сетевой слой и JSON

Все запросы асинхронные: `QNetworkAccessManager` возвращает `QNetworkReply`, а результат
обрабатывается по сигналу `finished`. На каждый запрос ставится собственный `QTimer`
на 8 секунд; по таймауту вызывается `abort`. Это важно для Qt 5.6, где
`setTransferTimeout` ещё не существует. CA сервера встроен в ресурсы приложения.
`QSslConfiguration` доверяет только этому CA и проверяет цепочку сертификатов
и срок действия. В `sslErrors` допускается исключительно `HostNameMismatch`,
чтобы смена IP сервера не требовала переустановки CA или приложения. Сертификат
чужого CA и просроченный сертификат отклоняются. Системная установка CA для
нативного приложения не требуется; для браузера она выполняется отдельно.

Ответ разбирается через `QJsonDocument`, `QJsonObject` и `QJsonArray`. Для списка
читается массив `items`, для предмета — объект с полями `id`, `name`, `quantity`,
`location`, `condition`, `version`. Исходящие тела собираются из `QJsonObject` и
передаются в `QJsonDocument::toJson`. PATCH отправляется через `sendCustomRequest`
с временным `QBuffer`, потому что в Qt 5.6 нет перегрузки с `QByteArray`.

Ошибки различаются по коду: `0` означает сетевую ошибку или таймаут, HTTP-коды
4xx/5xx разбираются по телу ответа (`message` или `error`). Пользователю показывается
понятный статус, а операция при необходимости остаётся в очереди.

### 6.3 Хранение токена и cookie

`QSettings` хранит адрес сервера, JWT, имя пользователя и роль в файле
`~/.config/ru.mai/aurorainventory.conf`. `PersistentCookieJar` при каждом изменении
сериализует cookie в `cookies/list` того же файла и восстанавливает их при следующем
запуске. Поэтому и заголовок `Authorization`, и HttpOnly-cookie переживают перезапуск
приложения; после `logout` cookie очищаются и в QSettings, и в jar.

### 6.4 SQLite-кэш и очередь операций

База `inventory.db` лежит в `QStandardPaths::AppDataLocation`
(`~/.local/share/ru.mai/aurorainventory/`). Драйвер — `QSQLITE`, в образе эмулятора
есть плагин `libqsqlite.so`.

| Таблица | Поля | Назначение |
|---|---|---|
| `items` | `id`, `name`, `quantity`, `location`, `condition`, `version`, `updated_at` | последняя известная копия предметов для offline-режима |
| `pending` | `id` (autoincrement), `method`, `item_id`, `payload`, `queued_at` | очередь CREATE/UPDATE/DELETE, не выполненных на сервере |

При успешном чтении кэш заменяется серверным снимком с учётом неотправленных
локальных операций. При offline-создании предмет
получает временный id `local-<uuid>` и сразу показывается в списке, а операция
`CREATE` попадает в `pending`. Офлайн-изменение обновляет и кэш, и полезную нагрузку
последней операции. После восстановления сети `syncAll` отправляет операции по одной;
для `CREATE` серверный id заменяет временный в таблицах `items` и `pending` и в
модели QML, после чего следующие операции уже используют настоящий id.

Единая кнопка «Обновить» сначала отправляет локальную очередь, затем выполняет
`doRefresh` и загружает итоговый список. Если начать с полной замены кэша, локальные
правки могли бы исчезнуть до отправки, поэтому выбран порядок «отправка → чтение».
При 401/403/5xx или сетевой ошибке операция остаётся в очереди. После GET на
серверный снимок накладываются оставшиеся локальные CREATE/UPDATE/DELETE: кэш не
затирает неподтверждённые данные. Проверка с ролью viewer и ответом 403 подтверждает
сохранение правок при повторном обновлении и их отправку после входа admin.

![Жизненный цикл offline-операции](images/offline-lifecycle.svg)

### 6.5 Интерфейс

| Страница | Содержимое |
|---|---|
| `MainPage.qml` | список предметов, статус, очередь, единое меню «Обновить», «Настройки», «О программе» |
| `ItemPage.qml` | создание и редактирование: название, количество, место, состояние; удаление с подтверждением |
| `SettingsPage.qml` | адрес сервера, логин и пароль, вход/выход, размер очереди, офлайн-режим, загрузка кэша, запуск демо |
| `AboutPage.qml` | описание работы и требований |
| `DemoLogPage.qml` | просмотр демо-журнала прямо в приложении |
| `CoverPage.qml` | карточка приложения с числом предметов и очередью |

Состояние интерфейса приходит из `Q_PROPERTY`: `online`, `simulateOffline`, `busy`,
`pendingCount`, `statusMessage`, `statusIsError`, `loggedIn`, `username`, `role`.
Модель списка — `ItemModel` с ролями `itemId`, `name`, `quantity`, `location`,
`condition`, `conditionLabel`.

Кнопка входа на странице настроек сначала сохраняет адрес через записываемое
свойство `InventoryClient.baseUrl`, затем вызывает `login`. Сеттер свойства
не вызывается из QML как отдельная функция C++. При сетевом запросе кнопки
входа и выхода отключены, чтобы повторные нажатия не запускали параллельные входы.
Интеграционный тест загружает настоящую `SettingsPage.qml` из установленного RPM,
заполняет её поля и вызывает обработчики кнопок. Вход и выход проверены для
`admin/admin123`, `user/user123`, `viewer/viewer123`.

### 6.6 Демонстрационный сценарий

В образе эмулятора нет инжекта касаний, поэтому полный цикл запускается ключом
`--demo`. Сценарий пишет журнал в `~/.local/share/ru.mai/aurorainventory/demo.log`
и в системный журнал приложения, а результат показывает в статусе.

| Шаг | Действие | Результат |
|---|---|---|
| 1 | Вход `admin` | OK |
| 2 | Чтение списка | OK, 6 предметов |
| 3 | Создание предмета онлайн | OK, серверный id |
| 4 | Обновление количества и состояния | OK, quantity=5 |
| 5 | Включение офлайн-режима | сеть не используется |
| 6 | Чтение из кэша | 7 предметов |
| 7 | Офлайн-создание | OK, временный id `local-…` |
| 8 | Офлайн-изменение | OK, в очереди 1 |
| 9 | Восстановление сети | запуск синхронизации |
| 10 | Синхронизация | 1 ок, 0 ошибок |
| 11 | Замена временного id | `local-…` → серверный UUID |
| 12 | Список после синхронизации | OK, 8 предметов |
| 13 | Ошибка валидации | код 400 с сообщением |
| 14 | Удаление несуществующего | код 404, показан статус |
| 15 | Уборка демо-предметов | 2 удаления по 204 |
| 16 | Финальный список | OK, снова 6 предметов |
| 17 | Итог | «Демо завершено: успешно, шагов 20» |

![Нативное приложение «Инвентарь» на эмуляторе Aurora OS](screenshots/emulator-app.png)

### 6.7 Сборка и установка

```bash
export PATH="$HOME/AuroraOS/bin:$PATH"
cd lab02/aurora-app
sfdk config target=AuroraOS-5.1.1.60-base-x86_64
sfdk build
scp -P 2223 RPMS/ru.mai.aurorainventory-1.0.0-1.x86_64.rpm \
    defaultuser@127.0.0.1:/tmp/
ssh -p 2223 defaultuser@127.0.0.1 \
    'sudo pkcon install-local -y /tmp/ru.mai.aurorainventory-1.0.0-1.x86_64.rpm'
```

Запуск на эмуляторе выполняется с переменными окружения Wayland-сессии
(`XDG_RUNTIME_DIR`, `WAYLAND_DISPLAY`, `QT_QPA_PLATFORM=wayland`). RPM для x86_64
собран в Docker-движке Aurora SDK 5.1.1.60; установка подтверждена командой `rpm -q`.

### 6.8 Обработка ошибок

| Ситуация | Поведение клиента |
|---|---|
| Нет сети или таймаут 8 с | код 0, статус «Сеть недоступна», операция остаётся в очереди |
| 400 | показывается сообщение и список полей, операция не ставится в очередь |
| 401 | требуется повторный вход, токен не считается действительным |
| 403 | показывается «недостаточно прав» (например, viewer не может удалять) |
| 404 | предмет удалён или не найден; запись убирается из кэша |
| 500 | показывается ошибка сервера, операция не теряется молча |
| TLS-ошибка | допускается только смена имени/IP для встроенного CA; остальные ошибки блокируют подключение |
| Повторный GET | используется кэш и ETag, ответ 304 не считается ошибкой |

---

## 7. Итоги проверки

| Проверка | Ожидание | Факт |
|---|---|---|
| Автотесты API | все проверки зелёные | 122 из 122, 0 ошибок |
| Автодемо на ПК | 14 шагов | 14/14, `ok=true` |
| Автодемо на Авроре | 14 шагов | 14/14, контрольный запрос 200 |
| CRUD в нативном приложении | создание, чтение, изменение, удаление | подтверждено шагами 2–4 и 15 |
| Offline-режим | показ кэша без сети | шаги 5–8 |
| Синхронизация | очередь уходит на сервер | шаги 9–12, 1 ок |
| Замена временных id | `local-…` → UUID | шаг 11 |
| Ошибки | 400 и 404 обработаны | шаги 13–14 |
| Сборка и установка | RPM x86_64 | собрано и установлено |
| Демо-журнал | полный цикл | 20 строк, «успешно» |
| Swagger UI на ПК и Авроре | выполнение через кнопки | 11/11 в обоих браузерах |
| Единое обновление | отправка очереди и GET, сохранение при 403 | 8 интеграционных проверок |
| Вход из настроек | обработчики кнопок настоящей QML-страницы | admin, user, viewer; выход после каждого входа |

**Артефакты проверки**

| Артефакт | Файл |
|---|---|
| Лог автотестов сервера | `report/logs/npm-test.log` |
| Лог автодемо Firefox | `report/logs/pc-firefox-demo.log` |
| Лог браузера Авроры | `report/logs/emulator-browser-demo.log` |
| Лог установки браузера | `report/logs/browser-install.log` |
| Демо-журнал приложения | `report/logs/emulator-app-demo.log` |
| Лог сборки | `report/logs/sfdk-build.log` |
| Лог установки RPM | `report/logs/emulator-install.log` |
| Swagger UI в Firefox | `report/logs/swagger-firefox-demo.log` |
| Swagger UI в браузере Авроры | `report/logs/swagger-aurora-demo.log` |
| Единое обновление и ошибки синхронизации | `report/logs/unified-refresh-test.log` |
| Вход из страницы настроек | `report/logs/settings-login-test.log` |
| Скриншоты | `report/screenshots/` |

---

## 8. Ограничения и безопасность

1. Сертификат самоподписанный, поэтому на ПК браузер запускается с
   `acceptInsecureCerts`, а на эмуляторе CA добавлен в системное хранилище. Для
   учебной работы это допустимо и описано в отчёте; в промышленной системе нужен
   сертификат доверенного УЦ.
2. Приложение доверяет выделенному встроенному CA, а не произвольным сертификатам.
   Проверка имени отключена только для смены адреса стенда; поэтому этот CA должен
   подписывать исключительно сертификаты сервера инвентаря. В промышленной системе
   следует использовать постоянное DNS-имя и полную проверку имени.
3. JWT-секрет генерируется локально в `data/jwt.secret` и не коммитится; ключи
   сертификатов также исключены из репозитория. Демо-пароли (`admin123` и другие)
   предназначены только для учебного стенда.
4. Пароли хранятся как scrypt-хэш с солью, сравнение выполняется за постоянное время;
   cookie имеет `HttpOnly`, `Secure` и `SameSite=Strict`. JWT живёт 3600 с.
5. SQLite-кэш и QSettings хранят токен в домашнем каталоге пользователя. Для
   промышленного применения токен следовало бы дополнительно шифровать.
6. В образе эмулятора нет инжекта касаний, поэтому демонстрация автоматизирована
   ключом `--demo`; ручной сценарий проверяется теми же методами через интерфейс.
7. Приложение собрано и проверено для x86_64-эмулятора; сборка под aarch64 для
   физического телефона не выполнялась.

---

## 9. Заключение

В ходе лабораторной работы реализованы все три части задания для варианта №7
«Инвентарь». Сервер на Node.js без внешних зависимостей предоставляет
версионированный REST API по HTTPS, поддерживает JWT и cookie, роли, коды 200–500,
проверку заголовков, кэширование через ETag и Last-Modified и документацию OpenAPI.
Тестовая страница выполняет полный CRUD-цикл и автодемо из 14 шагов как в Firefox на
ПК, так и в sailfish-browser на эмуляторе Aurora OS.

Нативное приложение на Qt 5.6/QML/C++ повторяет CRUD-цикл, хранит JWT и cookie между
запусками, ведёт SQLite-кэш и очередь отложенных операций, показывает данные без сети
и синхронизируется при её восстановлении, включая замену временных идентификаторов.
Обработаны сетевые ошибки, таймаут, коды 400/401/403/404/500 и особенности
самоподписанного TLS. Автотесты сервера проходят полностью (122 проверки), сборка RPM
и установка на эмулятор подтверждены, демонстрационный журнал содержит полный цикл
из 20 шагов и завершается успешно.

Swagger UI заменил самописный просмотрщик и позволяет демонстрировать API вручную
в обоих браузерах. Проверено 11 запросов через кнопки интерфейса на ПК и Авроре.
Обновление нативного приложения объединено с отправкой локальной очереди;
дополнительно проверено сохранение изменений при недостатке прав.


## Приложение А. Полный исходный код сервера и браузерной части

Приведены полные тексты файлов реализации и сборки без сокращений.

Сторонняя библиотека Swagger UI 3.52.5 поставляется в `public/vendor/swagger-ui/` под лицензией Apache-2.0; её готовые JS/CSS не относятся к разработанному коду и не дублируются в печатных листингах. Ниже полностью приведён код её подключения и настройки, а также весь код сервера и собственной браузерной части.

### А.1 auth.js

Файл: `inventory-server/server/auth.js`.

```
'use strict';

/**
 * Аутентификация: пароли (scrypt), JWT HS256, разбор Bearer/cookie.
 *
 * Внешних зависимостей нет — JWT собирается и проверяется вручную на
 * встроенном crypto (как требуют правила лабораторных этого репозитория).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), useSalt, 64).toString('hex');
  return { salt: useSalt, hash };
}

function verifyPassword(password, salt, expected) {
  const actual = hashPassword(password, salt).hash;
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(String(expected), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Читает секрет JWT из data/jwt.secret, создавая его при первом запуске. */
function loadSecret(secretFile) {
  try {
    const value = fs.readFileSync(secretFile, 'utf8').trim();
    if (value) return value;
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const secret = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(path.dirname(secretFile), { recursive: true });
  fs.writeFileSync(secretFile, secret + '\n', { mode: 0o600 });
  return secret;
}

/** Подписывает JWT (header.payload.signature), HS256. */
function signToken(payload, secret, ttlSec) {
  const now = Math.floor(Date.now() / 1000);
  const body = Object.assign({ iat: now, exp: now + ttlSec }, payload);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = header + '.' + base64url(JSON.stringify(body));
  const signature = base64url(crypto.createHmac('sha256', secret).update(data).digest());
  return { token: data + '.' + signature, payload: body };
}

/** Проверяет подпись и срок действия. Возвращает payload или null. */
function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const data = parts[0] + '.' + parts[1];
  const expected = base64url(crypto.createHmac('sha256', secret).update(data).digest());
  const given = Buffer.from(parts[2]);
  const exp = Buffer.from(expected);
  if (given.length !== exp.length || !crypto.timingSafeEqual(given, exp)) return null;

  let payload;
  try {
    payload = JSON.parse(fromBase64url(parts[1]).toString('utf8'));
  } catch (e) {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

function parseCookies(header) {
  const result = {};
  if (!header) return result;
  for (const chunk of String(header).split(';')) {
    const idx = chunk.indexOf('=');
    if (idx < 0) continue;
    const name = chunk.slice(0, idx).trim();
    const value = chunk.slice(idx + 1).trim();
    if (name) result[name] = decodeURIComponent(value);
  }
  return result;
}

/**
 * Возвращает токен из Authorization: Bearer <jwt> или из cookie token.
 * Порядок: заголовок важнее cookie.
 */
function tokenFromRequest(req, cookieName) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (match) return { token: match[1].trim(), source: 'header' };
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[cookieName]) return { token: cookies[cookieName], source: 'cookie' };
  return { token: '', source: 'none' };
}

module.exports = {
  base64url,
  hashPassword,
  verifyPassword,
  loadSecret,
  signToken,
  verifyToken,
  parseCookies,
  tokenFromRequest,
};
```

### А.2 config.js

Файл: `inventory-server/server/config.js`.

```
'use strict';

/**
 * Конфигурация сервера инвентаря (лабораторная работа №2, вариант 7).
 *
 * Все параметры можно переопределить переменными окружения — так сервер
 * запускается и в локальной сети, и в тестах на свободных портах.
 */

const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function num(name, value) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : value;
}

const config = {
  // 0.0.0.0 — сервер доступен не только с ПК, но и из локальной сети/эмулятора.
  host: process.env.HOST || '0.0.0.0',

  // HTTPS — основной порт; HTTP отвечает редиректом на HTTPS.
  httpsPort: num('HTTPS_PORT', 8443),
  httpPort: num('HTTP_PORT', 8080),

  publicDir: path.join(ROOT, 'public'),
  certDir: process.env.CERT_DIR || path.join(ROOT, 'certs'),
  dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),

  // Время жизни JWT и cookie с токеном (секунды).
  jwtTtlSec: num('JWT_TTL_SEC', 3600),
  tokenCookie: 'token',

  // Ограничение тела запроса (JSON предмета инвентаря небольшой).
  maxBodyBytes: num('MAX_BODY_BYTES', 256 * 1024),

  // 500-й код удобно проверять на защите; включается только в тестах/отладке.
  enableDebug: process.env.LAB02_DEBUG === '1' || process.env.NODE_ENV === 'test',

  apiPrefix: '/api/v1',
  version: '1.0.0',
  startedAt: Date.now(),
};

config.dataFile = process.env.DATA_FILE || path.join(config.dataDir, 'inventory.json');
config.secretFile = path.join(config.dataDir, 'jwt.secret');
config.httpsCert = path.join(config.certDir, 'server.crt');
config.httpsKey = path.join(config.certDir, 'server.key');
config.caCert = path.join(config.certDir, 'ca.crt');

/** Список IPv4-адресов машины — для подсказки адреса телефона. */
config.lanAddresses = function lanAddresses() {
  const result = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const info of interfaces[name] || []) {
      if (info.family === 'IPv4' && !info.internal) {
        result.push({ name, address: info.address });
      }
    }
  }
  return result;
};

module.exports = config;
```

### А.3 openapi.js

Файл: `inventory-server/server/openapi.js`.

```
'use strict';

/**
 * OpenAPI 3.0-описание API инвентаря (вариант 7).
 * Отдаётся по /api/v1/openapi.json, на него ссылается тестовая страница.
 */

const config = require('./config');

const itemSchema = {
  type: 'object',
  required: ['name', 'quantity', 'location', 'condition'],
  properties: {
    id: { type: 'string', format: 'uuid', example: '6f1c2f4e-1b8a-4c47-a9d6-2d3f0a1b2c3d' },
    name: { type: 'string', maxLength: 120, example: 'Дрель ударная' },
    quantity: { type: 'integer', minimum: 0, maximum: 1000000, example: 3 },
    location: { type: 'string', maxLength: 120, example: 'Склад A, стеллаж 2' },
    condition: { type: 'string', enum: ['new', 'good', 'used', 'broken'], example: 'good' },
    version: { type: 'integer', example: 1 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const itemInputSchema = {
  type: 'object',
  required: ['name', 'quantity', 'location', 'condition'],
  properties: {
    name: itemSchema.properties.name,
    quantity: itemSchema.properties.quantity,
    location: itemSchema.properties.location,
    condition: itemSchema.properties.condition,
  },
};

const errorSchema = {
  type: 'object',
  properties: {
    error: { type: 'string', example: 'validation_error' },
    message: { type: 'string', example: 'Проверьте поля запроса.' },
    details: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
  },
};

function jsonResponse(description, schema) {
  return {
    description,
    headers: {
      ETag: { schema: { type: 'string' }, description: 'Версия ресурса для кэширования' },
      'Cache-Control': { schema: { type: 'string' } },
      'Last-Modified': { schema: { type: 'string' } },
    },
    content: {
      'application/json': { schema },
    },
  };
}

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: errorSchema } },
});

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Inventory API — лабораторная работа №2 (вариант 7)',
    version: config.version,
    description:
      'REST API инвентаря: предметы с названием, количеством, местом хранения и ' +
      'состоянием. Аутентификация — JWT (Authorization: Bearer) или cookie token. ' +
      'Поддерживаются ETag/If-None-Match и Last-Modified/If-Modified-Since.',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Текущий сервер (HTTPS)',
    },
  ],
  tags: [
    { name: 'auth', description: 'Аутентификация и токены' },
    { name: 'items', description: 'Предметы инвентаря' },
    { name: 'system', description: 'Служебные методы' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['system'],
        summary: 'Состояние сервера и параметры запроса',
        description: 'Возвращает версию, время и разобранные заголовки Host, Accept, User-Agent.',
        responses: { 200: jsonResponse('Сервер работает', { type: 'object' }) },
      },
    },
    '/auth/login': {
      post: {
        tags: ['auth'],
        summary: 'Вход по логину и паролю',
        description:
          'Демо-пользователи: admin/admin123 (роль admin), user/user123 (user), ' +
          'viewer/viewer123 (viewer). Возвращает JWT и ставит cookie token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'admin' },
                  password: { type: 'string', example: 'admin123' },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Токен выдан', {
            type: 'object',
            properties: {
              token: { type: 'string' },
              tokenType: { type: 'string', example: 'Bearer' },
              expiresIn: { type: 'integer', example: 3600 },
              user: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  role: { type: 'string', enum: ['admin', 'user', 'viewer'] },
                },
              },
            },
          }),
          400: errorResponse('Не переданы логин или пароль'),
          401: errorResponse('Неверный логин или пароль'),
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['auth'],
        summary: 'Выход (сброс cookie)',
        responses: { 204: { description: 'Cookie очищена' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['auth'],
        summary: 'Текущий пользователь по токену',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: jsonResponse('Пользователь', {
            type: 'object',
            properties: {
              username: { type: 'string' },
              role: { type: 'string' },
              source: { type: 'string', enum: ['header', 'cookie'] },
            },
          }),
          401: errorResponse('Требуется токен'),
        },
      },
    },
    '/items': {
      get: {
        tags: ['items'],
        summary: 'Список предметов',
        description:
          'Поддерживает фильтры q (поиск по названию и месту), condition, сортировку ' +
          'sort/order и пагинацию limit/offset. Ответ кэшируется через ETag и Last-Modified.',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Поиск по названию/месту' },
          {
            name: 'condition',
            in: 'query',
            schema: { type: 'string', enum: ['new', 'good', 'used', 'broken'] },
          },
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', enum: ['name', 'quantity', 'updatedAt', 'createdAt'] },
          },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
        ],
        responses: {
          200: jsonResponse('Список предметов', {
            type: 'object',
            properties: {
              items: { type: 'array', items: itemSchema },
              total: { type: 'integer' },
              limit: { type: 'integer' },
              offset: { type: 'integer' },
            },
          }),
          304: { description: 'Данные не изменились (If-None-Match / If-Modified-Since)' },
          400: errorResponse('Некорректные параметры'),
          401: errorResponse('Требуется аутентификация'),
        },
      },
      post: {
        tags: ['items'],
        summary: 'Создать предмет',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: itemInputSchema } },
        },
        responses: {
          201: jsonResponse('Создано', itemSchema),
          400: errorResponse('Ошибка валидации'),
          401: errorResponse('Требуется аутентификация'),
          403: errorResponse('Роль не позволяет создавать (viewer)'),
        },
      },
    },
    '/items/{id}': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      get: {
        tags: ['items'],
        summary: 'Предмет по идентификатору',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: jsonResponse('Предмет', itemSchema),
          304: { description: 'Данные не изменились' },
          401: errorResponse('Требуется аутентификация'),
          404: errorResponse('Не найдено'),
        },
      },
      put: {
        tags: ['items'],
        summary: 'Заменить предмет целиком',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: itemInputSchema } },
        },
        responses: {
          200: jsonResponse('Обновлено', itemSchema),
          400: errorResponse('Ошибка валидации'),
          401: errorResponse('Требуется аутентификация'),
          403: errorResponse('Роль не позволяет изменять (viewer)'),
          404: errorResponse('Не найдено'),
        },
      },
      patch: {
        tags: ['items'],
        summary: 'Частично обновить предмет',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: itemInputSchema.properties,
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Обновлено', itemSchema),
          400: errorResponse('Ошибка валидации'),
          401: errorResponse('Требуется аутентификация'),
          403: errorResponse('Роль не позволяет изменять (viewer)'),
          404: errorResponse('Не найдено'),
        },
      },
      delete: {
        tags: ['items'],
        summary: 'Удалить предмет',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          204: { description: 'Удалено' },
          401: errorResponse('Требуется аутентификация'),
          403: errorResponse('Нужна роль admin'),
          404: errorResponse('Не найдено'),
        },
      },
    },
    '/debug/error': {
      get: {
        tags: ['system'],
        summary: 'Проверка обработки 500 (только в отладке/тестах)',
        description: 'Доступен при LAB02_DEBUG=1 или NODE_ENV=test.',
        responses: {
          500: errorResponse('Внутренняя ошибка сервера'),
          404: errorResponse('Отладка выключена'),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'token' },
    },
  },
};

module.exports = openapi;
```

### А.4 server.js

Файл: `inventory-server/server/server.js`.

```
'use strict';

/**
 * Сервер инвентаря (лабораторная работа №2, вариант 7).
 *
 * Только встроенные модули Node.js. HTTPS — основной протокол, HTTP отвечает
 * редиректом. REST API версионировано: /api/v1/. Аутентификация — JWT (HS256)
 * в заголовке Authorization и/или в cookie token. Кэширование — ETag,
 * Cache-Control, Last-Modified; условные запросы дают 304.
 *
 *   node server/server.js
 *   HTTPS_PORT=8443 HTTP_PORT=8080 node server/server.js
 */

const https = require('node:https');
const http = require('node:http');
const fsp = require('node:fs/promises');
const fs = require('node:fs');
const path = require('node:path');

const config = require('./config');
const Store = require('./store');
const openapi = require('./openapi');
const auth = require('./auth');
const { validateItem, isPlainObject } = require('./validation');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const API = config.apiPrefix;

// ---------------------------------------------------------------------------
// Ответы
// ---------------------------------------------------------------------------

function requestMeta(req) {
  return {
    host: req.headers.host || '',
    userAgent: req.headers['user-agent'] || '',
    accept: req.headers.accept || '',
    ip: (req.socket && req.socket.remoteAddress) || '',
  };
}

function baseHeaders(req) {
  const meta = requestMeta(req);
  return {
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Accept, Authorization, Cookie',
    'X-Request-Host': meta.host,
  };
}

function sendJson(req, res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, Object.assign(baseHeaders(req), {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...extra,
  }));
  res.end(body);
}

function sendError(req, res, status, code, message, details) {
  const payload = { error: code, message };
  if (details && details.length) payload.details = details;
  const extra = {};
  if (status === 401) extra['WWW-Authenticate'] = 'Bearer realm="inventory"';
  sendJson(req, res, status, payload, extra);
}

function sendNotModified(req, res, headers) {
  res.writeHead(304, Object.assign(baseHeaders(req), headers));
  res.end();
}

function sendEmpty(req, res, status, extra = {}) {
  res.writeHead(status, Object.assign(baseHeaders(req), extra));
  res.end();
}

// ---------------------------------------------------------------------------
// Заголовки запроса: Host, User-Agent, Accept
// ---------------------------------------------------------------------------

const HOST_RE = /^[A-Za-z0-9._\-]+(:\d+)?$|^\[[0-9A-Fa-f:.]+\](:\d+)?$/;

function checkRequestHeaders(req, res) {
  const meta = requestMeta(req);
  if (!meta.host) {
    sendError(req, res, 400, 'host_required', 'Заголовок Host обязателен (HTTP/1.1).');
    return false;
  }
  if (!HOST_RE.test(meta.host)) {
    sendError(req, res, 400, 'invalid_host', 'Некорректный заголовок Host.');
    return false;
  }
  if (!meta.userAgent) {
    sendError(req, res, 400, 'user_agent_required', 'Заголовок User-Agent обязателен.');
    return false;
  }
  return true;
}

/** Согласование Accept: клиент должен принимать application/json. */
function acceptsJson(req) {
  const header = (req.headers.accept || '').trim();
  if (!header) return true;
  for (const part of header.split(',')) {
    const [type, ...params] = part.trim().split(';');
    const q = params.find((p) => p.trim().startsWith('q='));
    if (q && Number(q.trim().slice(2)) === 0) continue;
    const mime = type.trim().toLowerCase();
    if (mime === 'application/json' || mime === 'application/*' || mime === '*/*') return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Тело запроса
// ---------------------------------------------------------------------------

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > config.maxBodyBytes) {
        reject(Object.assign(new Error('Тело запроса слишком большое'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(Object.assign(new Error('Некорректный JSON в теле запроса'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function requireJsonContentType(req, res) {
  const type = (req.headers['content-type'] || '').toLowerCase();
  if (!type.includes('application/json')) {
    sendError(req, res, 400, 'invalid_content_type',
      'Для тела запроса нужен Content-Type: application/json.');
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Аутентификация и права
// ---------------------------------------------------------------------------

let jwtSecret = '';

function currentActor(req) {
  const found = auth.tokenFromRequest(req, config.tokenCookie);
  if (!found.token) return null;
  const payload = auth.verifyToken(found.token, jwtSecret);
  if (!payload || !payload.sub) return null;
  const user = store.user(payload.sub);
  if (!user) return null;
  return { username: user.username, role: user.role, source: found.source };
}

function requireActor(req, res) {
  const actor = currentActor(req);
  if (!actor) {
    sendError(req, res, 401, 'unauthorized', 'Требуется аутентификация (JWT или cookie).');
    return null;
  }
  return actor;
}

function forbid(res, req, message) {
  sendError(req, res, 403, 'forbidden', message);
  return null;
}

// ---------------------------------------------------------------------------
// Кэширование
// ---------------------------------------------------------------------------

function listEtag(result) {
  return `"list-${result.rev}-${result.total}"`;
}

function itemEtag(item) {
  return `"item-${item.id}-${item.version}"`;
}

function httpDate(iso) {
  return new Date(iso).toUTCString();
}

function etagMatches(req, etag) {
  const header = req.headers['if-none-match'];
  if (!header) return false;
  return header.split(',').some((value) => {
    const v = value.trim();
    return v === '*' || v === etag || v === 'W/' + etag;
  });
}

function modifiedSinceMatches(req, iso) {
  const header = req.headers['if-modified-since'];
  if (!header) return false;
  const since = Date.parse(header);
  if (Number.isNaN(since)) return false;
  return Math.floor(new Date(iso).getTime() / 1000) * 1000 <= since;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

function parseListQuery(url) {
  const q = url.searchParams.get('q') || '';
  const condition = url.searchParams.get('condition') || '';
  const sort = url.searchParams.get('sort') || 'name';
  const order = url.searchParams.get('order') || 'asc';
  const limitRaw = url.searchParams.get('limit');
  const offsetRaw = url.searchParams.get('offset');

  const errors = [];
  if (condition && !['new', 'good', 'used', 'broken'].includes(condition)) {
    errors.push({ field: 'condition', message: 'condition: new|good|used|broken.' });
  }
  if (!['name', 'quantity', 'updatedAt', 'createdAt'].includes(sort)) {
    errors.push({ field: 'sort', message: 'sort: name|quantity|updatedAt|createdAt.' });
  }
  if (!['asc', 'desc'].includes(order)) {
    errors.push({ field: 'order', message: 'order: asc|desc.' });
  }

  let limit = 50;
  let offset = 0;
  if (limitRaw !== null) {
    limit = Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      errors.push({ field: 'limit', message: 'limit: целое 1..100.' });
    }
  }
  if (offsetRaw !== null) {
    offset = Number(offsetRaw);
    if (!Number.isInteger(offset) || offset < 0) {
      errors.push({ field: 'offset', message: 'offset: целое >= 0.' });
    }
  }

  return { errors, q, condition, sort, order, limit, offset };
}

async function handleLogin(req, res) {
  if (!requireJsonContentType(req, res)) return;
  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendError(req, res, e.status || 400, 'invalid_body', e.message);
  }
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password) {
    return sendError(req, res, 400, 'validation_error', 'Укажите username и password.',
      [{ field: 'username', message: 'Обязательное поле.' }, { field: 'password', message: 'Обязательное поле.' }]);
  }

  const user = store.authenticate(username, password);
  if (!user) {
    return sendError(req, res, 401, 'invalid_credentials', 'Неверный логин или пароль.');
  }

  const signed = auth.signToken({ sub: user.username, role: user.role }, jwtSecret, config.jwtTtlSec);
  const cookie = [
    `${config.tokenCookie}=${signed.token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${config.jwtTtlSec}`,
  ].join('; ');

  sendJson(req, res, 200, {
    token: signed.token,
    tokenType: 'Bearer',
    expiresIn: config.jwtTtlSec,
    user,
  }, { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' });
}

function handleLogout(req, res) {
  const cookie = [`${config.tokenCookie}=`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Strict',
    'Max-Age=0'].join('; ');
  sendEmpty(req, res, 204, { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' });
}

function handleMe(req, res, actor) {
  sendJson(req, res, 200, {
    username: actor.username,
    role: actor.role,
    source: actor.source,
  }, { 'Cache-Control': 'no-store' });
}

function handleListItems(req, res, url, actor) {
  const query = parseListQuery(url);
  if (query.errors.length) {
    return sendError(req, res, 400, 'validation_error', 'Некорректные параметры запроса.', query.errors);
  }

  const result = store.listItems(query);
  const etag = listEtag(result);
  const lastModified = httpDate(result.updatedAt);
  const cacheHeaders = {
    'ETag': etag,
    'Last-Modified': lastModified,
    'Cache-Control': 'private, max-age=0, must-revalidate',
  };

  if (etagMatches(req, etag) || modifiedSinceMatches(req, result.updatedAt)) {
    return sendNotModified(req, res, cacheHeaders);
  }

  sendJson(req, res, 200, {
    items: result.items,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
    filters: { q: result.q, condition: result.condition, sort: result.sort, order: result.order },
  }, Object.assign({
    'X-Total-Count': String(result.total),
  }, cacheHeaders));
}

async function handleCreateItem(req, res, actor) {
  if (actor.role === 'viewer') return forbid(res, req, 'Роль viewer не может создавать предметы.');
  if (!requireJsonContentType(req, res)) return;

  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendError(req, res, e.status || 400, 'invalid_body', e.message);
  }
  if (!isPlainObject(body)) {
    return sendError(req, res, 400, 'validation_error', 'Тело запроса должно быть объектом JSON.');
  }

  const check = validateItem(body);
  if (!check.ok) {
    return sendError(req, res, 400, 'validation_error', 'Проверьте поля запроса.', check.errors);
  }

  const item = await store.createItem(check.value);
  sendJson(req, res, 201, item, {
    'Location': `${API}/items/${item.id}`,
    'ETag': itemEtag(item),
    'Last-Modified': httpDate(item.updatedAt),
    'Cache-Control': 'no-store',
  });
}

function handleGetItem(req, res, id) {
  const item = store.getItem(id);
  if (!item) return sendError(req, res, 404, 'not_found', 'Предмет не найден.');

  const etag = itemEtag(item);
  const cacheHeaders = {
    'ETag': etag,
    'Last-Modified': httpDate(item.updatedAt),
    'Cache-Control': 'private, max-age=0, must-revalidate',
  };
  if (etagMatches(req, etag) || modifiedSinceMatches(req, item.updatedAt)) {
    return sendNotModified(req, res, cacheHeaders);
  }
  sendJson(req, res, 200, item, cacheHeaders);
}

async function handleReplaceItem(req, res, id, actor) {
  if (actor.role === 'viewer') return forbid(res, req, 'Роль viewer не может изменять предметы.');
  if (!store.getItem(id)) return sendError(req, res, 404, 'not_found', 'Предмет не найден.');
  if (!requireJsonContentType(req, res)) return;

  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendError(req, res, e.status || 400, 'invalid_body', e.message);
  }

  const check = validateItem(body);
  if (!check.ok) {
    return sendError(req, res, 400, 'validation_error', 'Проверьте поля запроса.', check.errors);
  }

  const item = await store.updateItem(id, check.value);
  sendJson(req, res, 200, item, {
    'ETag': itemEtag(item),
    'Last-Modified': httpDate(item.updatedAt),
    'Cache-Control': 'no-store',
  });
}

async function handlePatchItem(req, res, id, actor) {
  if (actor.role === 'viewer') return forbid(res, req, 'Роль viewer не может изменять предметы.');
  if (!store.getItem(id)) return sendError(req, res, 404, 'not_found', 'Предмет не найден.');
  if (!requireJsonContentType(req, res)) return;

  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendError(req, res, e.status || 400, 'invalid_body', e.message);
  }
  if (!isPlainObject(body) || Object.keys(body).length === 0) {
    return sendError(req, res, 400, 'validation_error', 'Нужно передать хотя бы одно поле.');
  }

  const check = validateItem(body, { partial: true });
  if (!check.ok) {
    return sendError(req, res, 400, 'validation_error', 'Проверьте поля запроса.', check.errors);
  }

  const item = await store.updateItem(id, check.value);
  sendJson(req, res, 200, item, {
    'ETag': itemEtag(item),
    'Last-Modified': httpDate(item.updatedAt),
    'Cache-Control': 'no-store',
  });
}

async function handleDeleteItem(req, res, id, actor) {
  if (actor.role !== 'admin') {
    return forbid(res, req, 'Удалять предметы может только роль admin.');
  }
  const deleted = await store.deleteItem(id);
  if (!deleted) return sendError(req, res, 404, 'not_found', 'Предмет не найден.');
  sendEmpty(req, res, 204, { 'Cache-Control': 'no-store' });
}

// ---------------------------------------------------------------------------
// Маршрутизация API
// ---------------------------------------------------------------------------

async function handleApi(req, res, url) {
  const method = req.method;
  const sub = url.pathname.slice(API.length) || '/';

  if (sub === '/openapi.json') {
    if (method !== 'GET') return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
    return sendJson(req, res, 200, openapi, { 'Cache-Control': 'public, max-age=60' });
  }

  if (sub === '/health') {
    if (method !== 'GET') return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
    const meta = requestMeta(req);
    return sendJson(req, res, 200, {
      status: 'ok',
      version: config.version,
      time: new Date().toISOString(),
      uptimeSec: Math.round((Date.now() - config.startedAt) / 1000),
      request: { host: meta.host, userAgent: meta.userAgent, accept: meta.accept },
    }, { 'Cache-Control': 'no-store' });
  }

  if (sub === '/auth/login') {
    if (method !== 'POST') return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
    return handleLogin(req, res);
  }

  if (sub === '/auth/logout') {
    if (method !== 'POST') return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
    return handleLogout(req, res);
  }

  if (sub === '/auth/me') {
    if (method !== 'GET') return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
    const actor = requireActor(req, res);
    if (!actor) return undefined;
    return handleMe(req, res, actor);
  }

  if (sub === '/debug/demo-result') {
    if (method !== 'GET') return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
    if (!config.enableDebug) {
      return sendError(req, res, 404, 'not_found', 'Отладочный маршрут выключен.');
    }
    const passed = Number(url.searchParams.get('passed') || 0);
    const total = Number(url.searchParams.get('total') || 0);
    return sendJson(req, res, 200, {
      ok: url.searchParams.get('ok') === '1',
      passed: Number.isFinite(passed) ? passed : 0,
      total: Number.isFinite(total) ? total : 0,
      at: new Date().toISOString(),
    }, { 'Cache-Control': 'no-store' });
  }

  if (sub === '/debug/error') {
    if (method !== 'GET') return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
    if (!config.enableDebug) {
      return sendError(req, res, 404, 'not_found', 'Отладочный маршрут выключен.');
    }
    throw new Error('Тестовая внутренняя ошибка (debug/error)');
  }

  if (sub === '/items') {
    const actor = requireActor(req, res);
    if (!actor) return undefined;
    if (method === 'GET') return handleListItems(req, res, url, actor);
    if (method === 'POST') return handleCreateItem(req, res, actor);
    return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
  }

  const match = /^\/items\/([0-9a-fA-F-]+)$/.exec(sub);
  if (match) {
    const id = match[1].toLowerCase();
    const actor = requireActor(req, res);
    if (!actor) return undefined;
    if (method === 'GET') return handleGetItem(req, res, id);
    if (method === 'PUT') return handleReplaceItem(req, res, id, actor);
    if (method === 'PATCH') return handlePatchItem(req, res, id, actor);
    if (method === 'DELETE') return handleDeleteItem(req, res, id, actor);
    return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
  }

  return sendError(req, res, 404, 'not_found', 'Маршрут API не найден.');
}

// ---------------------------------------------------------------------------
// Статика
// ---------------------------------------------------------------------------

async function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
  }

  let relative = decodeURIComponent(url.pathname);
  if (relative === '/' || relative === '') relative = '/index.html';

  const target = path.join(config.publicDir, path.normalize(relative));
  if (!target.startsWith(config.publicDir + path.sep) && target !== path.join(config.publicDir, 'index.html')) {
    return sendError(req, res, 404, 'not_found', 'Файл не найден.');
  }

  let stat;
  try {
    stat = await fsp.stat(target);
  } catch (e) {
    return sendError(req, res, 404, 'not_found', 'Файл не найден.');
  }
  if (!stat.isFile()) return sendError(req, res, 404, 'not_found', 'Файл не найден.');

  const ext = path.extname(target).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const isHtml = ext === '.html';
  const headers = Object.assign(baseHeaders(req), {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=300',
    'Last-Modified': stat.mtime.toUTCString(),
  });

  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  res.end(await fsp.readFile(target));
}

// ---------------------------------------------------------------------------
// HTTP-сервер (редирект на HTTPS) и общий диспетчер
// ---------------------------------------------------------------------------

function createRequestListener() {
  return async function onRequest(req, res) {
    const started = Date.now();
    try {
      // Базовый адрес не зависит от Host: заголовок проверяется отдельно,
      // а некорректный Host не должен приводить к 500 при разборе URL.
      const url = new URL(req.url, 'https://localhost');

      if (url.pathname === API || url.pathname.startsWith(API + '/')) {
        if (!checkRequestHeaders(req, res)) return;
        if (!acceptsJson(req)) {
          return sendError(req, res, 406, 'not_acceptable',
            'Клиент должен принимать application/json.');
        }
        await handleApi(req, res, url);
      } else if (url.pathname === '/openapi.json') {
        sendJson(req, res, 200, openapi, { 'Cache-Control': 'public, max-age=60' });
      } else {
        await serveStatic(req, res, url);
      }
    } catch (e) {
      console.error('[server] ошибка обработки %s %s: %s', req.method, req.url, e.stack || e.message);
      if (!res.headersSent) {
        sendError(req, res, 500, 'internal_error', 'Внутренняя ошибка сервера.');
      } else {
        res.end();
      }
    } finally {
      if (process.env.LAB02_LOG === '1') {
        console.log('[%s] %s %s -> %s (%d мс)',
          new Date().toISOString(), req.method, req.url, res.statusCode, Date.now() - started);
      }
    }
  };
}

function createHttpRedirectServer() {
  return http.createServer((req, res) => {
    const host = (req.headers.host || '').split(':')[0] || config.host;
    const location = `https://${host}:${config.httpsPort}${req.url}`;
    const body = `Перейдите на ${location}\n`;
    res.writeHead(301, {
      'Location': location,
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    });
    res.end(body);
  });
}

async function main() {
  let cert;
  let key;
  try {
    cert = fs.readFileSync(config.httpsCert);
    key = fs.readFileSync(config.httpsKey);
  } catch (e) {
    console.error('Не найден сертификат HTTPS: %s', e.message);
    console.error('Сгенерируйте его: npm run certs (tools/gen-cert.sh).');
    process.exit(1);
  }

  store = new Store(config);
  await store.load();
  jwtSecret = auth.loadSecret(config.secretFile);

  const listener = createRequestListener();
  const httpsServer = https.createServer({ cert, key }, listener);
  const httpServer = createHttpRedirectServer();

  await new Promise((resolve, reject) => {
    httpsServer.once('error', reject);
    httpsServer.listen(config.httpsPort, config.host, resolve);
  });
  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(config.httpPort, config.host, resolve);
  });

  console.log('Инвентарь API (лабораторная работа №2, вариант 7)');
  console.log('  HTTPS: https://%s:%d%s', config.host, config.httpsPort, API);
  console.log('  HTTP:  http://%s:%d/  (редирект на HTTPS)', config.host, config.httpPort);
  console.log('  Swagger UI: https://%s:%d/docs.html', config.host, config.httpsPort);
  for (const lan of config.lanAddresses()) {
    console.log('  сеть: https://%s:%d/  (%s)', lan.address, config.httpsPort, lan.name);
    console.log('  Swagger UI в сети: https://%s:%d/docs.html', lan.address, config.httpsPort);
  }

  function shutdown() {
    httpsServer.close();
    httpServer.close();
    setTimeout(() => process.exit(0), 100).unref();
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

let store = null;

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { createRequestListener, createHttpRedirectServer };
```

### А.5 store.js

Файл: `inventory-server/server/store.js`.

```
'use strict';

/**
 * Хранилище инвентаря: один JSON-файл (как в lab01/stat-server), атомарная
 * запись через временный файл и rename.
 *
 * Структура файла:
 *   users  — пользователи с ролью и hash/salt пароля;
 *   items  — предметы инвентаря;
 *   meta   — rev (растёт на каждом изменении) и updatedAt (для Last-Modified).
 */

const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const { hashPassword, verifyPassword } = require('./auth');

function nowIso() {
  return new Date().toISOString();
}

const DEMO_ITEMS = [
  { name: 'Дрель ударная', quantity: 3, location: 'Склад A, стеллаж 2', condition: 'good' },
  { name: 'Шуруповёрт аккумуляторный', quantity: 5, location: 'Склад A, стеллаж 2', condition: 'new' },
  { name: 'Набор отвёрток', quantity: 12, location: 'Инструментальная, ящик 4', condition: 'good' },
  { name: 'Лестница-стремянка', quantity: 2, location: 'Коридор, ниша', condition: 'used' },
  { name: 'Огнетушитель ОП-4', quantity: 6, location: 'Пожарный щит', condition: 'new' },
  { name: 'Кабель удлинительный 20 м', quantity: 4, location: 'Склад B, полка 1', condition: 'broken' },
];

const DEMO_USERS = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'user', password: 'user123', role: 'user' },
  { username: 'viewer', password: 'viewer123', role: 'viewer' },
];

class Store {
  constructor(config) {
    this.config = config;
    this.state = null;
    this.saving = null;
  }

  async load() {
    await fsp.mkdir(path.dirname(this.config.dataFile), { recursive: true });

    let parsed = null;
    try {
      parsed = JSON.parse(await fsp.readFile(this.config.dataFile, 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.error('[store] не удалось прочитать %s: %s', this.config.dataFile, e.message);
      }
    }

    this.state = this.normalize(parsed);
    if (!parsed) {
      this.seedUsers();
      this.seedItems();
      await this.save();
    } else if (!Object.keys(this.state.users).length) {
      this.seedUsers();
      await this.save();
    }
    return this.state;
  }

  normalize(parsed) {
    const base = {
      users: {},
      items: {},
      meta: { rev: 1, createdAt: nowIso(), updatedAt: nowIso() },
    };
    if (!parsed || typeof parsed !== 'object') return base;

    if (parsed.users && typeof parsed.users === 'object') base.users = parsed.users;
    if (parsed.items && typeof parsed.items === 'object') base.items = parsed.items;
    if (parsed.meta && typeof parsed.meta === 'object') {
      base.meta = Object.assign(base.meta, parsed.meta);
    }
    base.meta.rev = Number.isInteger(base.meta.rev) ? base.meta.rev : 1;
    if (!base.meta.updatedAt) base.meta.updatedAt = nowIso();
    return base;
  }

  seedUsers() {
    for (const user of DEMO_USERS) {
      const { salt, hash } = hashPassword(user.password);
      this.state.users[user.username] = {
        username: user.username,
        role: user.role,
        salt,
        hash,
        createdAt: nowIso(),
      };
    }
  }

  seedItems() {
    for (const demo of DEMO_ITEMS) {
      this.insertItem(demo, false);
    }
  }

  insertItem(data, touch = true) {
    const id = crypto.randomUUID();
    const timestamp = nowIso();
    const item = {
      id,
      name: data.name,
      quantity: data.quantity,
      location: data.location,
      condition: data.condition,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.state.items[id] = item;
    if (touch) this.touch();
    return item;
  }

  touch() {
    this.state.meta.rev += 1;
    this.state.meta.updatedAt = nowIso();
  }

  async save() {
    const payload = JSON.stringify(this.state, null, 2);
    const tmp = this.config.dataFile + '.' + process.pid + '.tmp';
    await fsp.writeFile(tmp, payload, 'utf8');
    await fsp.rename(tmp, this.config.dataFile);
  }

  authenticate(username, password) {
    const user = this.state.users[username];
    if (!user) return null;
    if (!verifyPassword(password, user.salt, user.hash)) return null;
    return { username: user.username, role: user.role };
  }

  user(username) {
    const user = this.state.users[username];
    return user ? { username: user.username, role: user.role, createdAt: user.createdAt } : null;
  }

  getItem(id) {
    return this.state.items[id] || null;
  }

  /**
   * Список с фильтрами: q (поиск по названию/месту), condition, сортировка,
   * пагинация. Возвращает предметы, всего и ревизию для ETag.
   */
  listItems(options = {}) {
    const q = (options.q || '').toString().trim().toLowerCase();
    const condition = (options.condition || '').toString().trim();
    const sort = ['name', 'quantity', 'updatedAt', 'createdAt'].includes(options.sort)
      ? options.sort
      : 'name';
    const order = options.order === 'desc' ? 'desc' : 'asc';
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 100);
    const offset = Math.max(Number(options.offset) || 0, 0);

    let items = Object.values(this.state.items);
    if (q) {
      items = items.filter((item) =>
        item.name.toLowerCase().includes(q) || item.location.toLowerCase().includes(q));
    }
    if (condition) {
      items = items.filter((item) => item.condition === condition);
    }

    const direction = order === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      if (sort === 'quantity') return (a.quantity - b.quantity) * direction;
      if (sort === 'updatedAt' || sort === 'createdAt') {
        return (new Date(a[sort]).getTime() - new Date(b[sort]).getTime()) * direction;
      }
      return a.name.localeCompare(b.name, 'ru') * direction;
    });

    const total = items.length;
    return {
      items: items.slice(offset, offset + limit),
      total,
      limit,
      offset,
      condition,
      q,
      sort,
      order,
      rev: this.state.meta.rev,
      updatedAt: this.state.meta.updatedAt,
    };
  }

  async createItem(data) {
    const item = this.insertItem(data);
    await this.save();
    return item;
  }

  async updateItem(id, data) {
    const item = this.state.items[id];
    if (!item) return null;
    Object.assign(item, data);
    item.version += 1;
    item.updatedAt = nowIso();
    this.touch();
    await this.save();
    return item;
  }

  async deleteItem(id) {
    if (!this.state.items[id]) return false;
    delete this.state.items[id];
    this.touch();
    await this.save();
    return true;
  }
}

module.exports = Store;
```

### А.6 validation.js

Файл: `inventory-server/server/validation.js`.

```
'use strict';

/**
 * Валидация предмета инвентаря.
 *
 * Поля по варианту №7: название, количество, место хранения, состояние.
 * Возвращаем понятные ошибки (до 400 Bad Request с details).
 */

const CONDITIONS = ['new', 'good', 'used', 'broken'];

const CONDITION_LABELS = {
  new: 'новый',
  good: 'хорошее',
  used: 'б/у',
  broken: 'неисправен',
};

const MAX_NAME = 120;
const MAX_LOCATION = 120;
const MAX_QUANTITY = 1000000;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * @param {object} body   тело запроса
 * @param {object} opts   { partial: true } — для PATCH, проверяем только поля
 * @returns {{ok: boolean, value: object, errors: Array<{field, message}>}}
 */
function validateItem(body, opts = {}) {
  const partial = opts.partial === true;
  const errors = [];
  const value = {};
  const source = isPlainObject(body) ? body : {};

  const has = (field) => Object.prototype.hasOwnProperty.call(source, field);
  const need = (field) => partial ? has(field) : true;

  if (need('name')) {
    const name = normalizeString(source.name);
    if (typeof name !== 'string' || name.length === 0) {
      errors.push({ field: 'name', message: 'Укажите название предмета.' });
    } else if (name.length > MAX_NAME) {
      errors.push({ field: 'name', message: `Название не длиннее ${MAX_NAME} символов.` });
    } else {
      value.name = name;
    }
  }

  if (need('quantity')) {
    const quantity = source.quantity;
    if (!Number.isInteger(quantity) || quantity < 0) {
      errors.push({ field: 'quantity', message: 'Количество — целое число не меньше 0.' });
    } else if (quantity > MAX_QUANTITY) {
      errors.push({ field: 'quantity', message: `Количество не больше ${MAX_QUANTITY}.` });
    } else {
      value.quantity = quantity;
    }
  }

  if (need('location')) {
    const location = normalizeString(source.location);
    if (typeof location !== 'string' || location.length === 0) {
      errors.push({ field: 'location', message: 'Укажите место хранения.' });
    } else if (location.length > MAX_LOCATION) {
      errors.push({ field: 'location', message: `Место хранения не длиннее ${MAX_LOCATION} символов.` });
    } else {
      value.location = location;
    }
  }

  if (need('condition')) {
    const condition = normalizeString(source.condition);
    if (!CONDITIONS.includes(condition)) {
      errors.push({
        field: 'condition',
        message: 'Состояние: одно из new, good, used, broken.',
      });
    } else {
      value.condition = condition;
    }
  }

  return { ok: errors.length === 0, value, errors };
}

module.exports = {
  CONDITIONS,
  CONDITION_LABELS,
  validateItem,
  isPlainObject,
};
```

### А.7 style.css

Файл: `inventory-server/public/css/style.css`.

```
:root {
  color-scheme: light;
  color-scheme: only light;
  --bg: #f3f5f9;
  --card: #ffffff;
  --text: #1f2937;
  --muted: #6b7280;
  --line: #e5e7eb;
  --primary: #2f6fed;
  --primary-dark: #1d4ed8;
  --ok: #15803d;
  --warn: #b45309;
  --err: #b91c1c;
  --chip: #eef2ff;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.45 -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
}

a { color: var(--primary); }

.topbar {
  background: linear-gradient(120deg, #1e3a8a, #2f6fed);
  color: #fff;
  padding: 18px 20px;
}
.topbar__inner {
  max-width: 1180px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.topbar h1 { margin: 0 0 4px; font-size: 24px; }
.topbar .muted { color: #dbeafe; margin: 0; }
.topbar__nav a { color: #fff; margin-left: 16px; text-decoration: none; border-bottom: 1px solid rgba(255,255,255,.5); }
.topbar__nav a:hover { border-bottom-color: #fff; }

.layout {
  max-width: 1180px;
  margin: 20px auto 40px;
  padding: 0 16px;
  display: grid;
  gap: 18px;
}

.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 18px 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}
.card h2 { margin: 0 0 10px; font-size: 19px; }
.card h3 { margin: 0 0 10px; font-size: 16px; }

.muted { color: var(--muted); }
.hidden { display: none !important; }

.row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.row.wrap { align-items: center; }
.row .grow { flex: 1 1 220px; }

label { display: flex; flex-direction: column; gap: 5px; font-size: 13px; color: var(--muted); }
label.grow { flex: 1 1 220px; }

input, select, button {
  font: inherit;
  border-radius: 7px;
}
input, select {
  border: 1px solid var(--line);
  padding: 8px 10px;
  background: #fff;
  color: var(--text);
  min-width: 0;
}
input:focus, select:focus { outline: 2px solid #bfdbfe; border-color: var(--primary); }

button {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--text);
  padding: 8px 14px;
  cursor: pointer;
  transition: background .15s, border-color .15s;
}
button:hover { background: #f9fafb; border-color: #cbd5e1; }
button.primary { background: var(--primary); border-color: var(--primary); color: #fff; }
button.primary:hover { background: var(--primary-dark); }
button.ghost { background: transparent; }
button.small { padding: 4px 9px; font-size: 13px; }
button.danger { color: var(--err); border-color: #fecaca; }
button.danger:hover { background: #fef2f2; }

.toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.toolbar .grow { flex: 1 1 260px; }

.status { display: inline-block; font-size: 13px; color: var(--muted); }
.status.ok { color: var(--ok); }
.status.error { color: var(--err); }

.banner {
  margin: 12px 0;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #f9fafb;
  font-size: 14px;
}
.banner.ok { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
.banner.error { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
.banner.info { background: #eff6ff; border-color: #bfdbfe; color: #1e40af; }
.banner ul { margin: 6px 0 0 18px; padding: 0; }

.cache {
  font-size: 12.5px;
  background: var(--chip);
  border-radius: 6px;
  padding: 6px 9px;
  margin-bottom: 12px;
  word-break: break-word;
}

.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; min-width: 640px; }
th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--line); font-size: 14px; }
th { font-size: 12.5px; text-transform: uppercase; letter-spacing: .03em; color: var(--muted); }
td.num { text-align: right; width: 80px; }
td.actions { white-space: nowrap; }
tbody tr:hover { background: #f9fafb; }

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12.5px;
  background: var(--chip);
  color: #3730a3;
}
.badge--new { background: #ecfdf5; color: #047857; }
.badge--good { background: #eff6ff; color: #1d4ed8; }
.badge--used { background: #fffbeb; color: #b45309; }
.badge--broken { background: #fef2f2; color: #b91c1c; }

.editor {
  border: 1px dashed #c7d2fe;
  background: #f5f8ff;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 12px;
  display: grid;
  gap: 10px;
}

.log { max-height: 460px; overflow-y: auto; display: grid; gap: 8px; }
.log-entry {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 10px;
  background: #fcfcfd;
}
.log-head { font-size: 13.5px; }
.log-headers { font-size: 12px; margin-top: 3px; word-break: break-word; }
.log-body {
  margin: 6px 0 0;
  padding: 8px;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 6px;
  font: 12px/1.4 "SFMono-Regular", Consolas, "Courier New", monospace;
  max-height: 180px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.code {
  display: inline-block;
  min-width: 38px;
  text-align: center;
  padding: 1px 6px;
  border-radius: 5px;
  font-weight: 700;
  font-size: 12.5px;
  background: #e5e7eb;
}
.code--2xx { background: #d1fae5; color: #065f46; }
.code--3xx { background: #dbeafe; color: #1e40af; }
.code--4xx { background: #fef3c7; color: #92400e; }
.code--5xx { background: #fee2e2; color: #991b1b; }

.demo-steps { margin: 0; padding-left: 22px; display: grid; gap: 5px; }
.demo-ok { color: var(--ok); }
.demo-fail { color: var(--err); font-weight: 600; }

.footer {
  max-width: 1180px;
  margin: 0 auto 30px;
  padding: 0 16px;
  color: var(--muted);
  font-size: 13px;
}

code {
  background: #f1f5f9;
  padding: 1px 5px;
  border-radius: 4px;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 12.5px;
}

@media (max-width: 900px) {
  .topbar__inner { align-items: flex-start; }
  .topbar__nav a { margin: 0 14px 0 0; }
  .row .grow, label.grow { flex-basis: 100%; }
  th, td { padding: 7px 8px; }
}

@media (max-width: 600px) {
  body { font-size: 14px; }
  .topbar { padding: 14px; }
  .layout { padding: 0 10px; gap: 12px; }
  .card { padding: 14px; }
  .card h2 { font-size: 17px; }
  table { min-width: 0; }
  th, td { font-size: 13px; padding: 6px 6px; }
  th:nth-child(3), td:nth-child(3) { display: none; }
  .log { max-height: 360px; }
}
```

### А.8 swagger.css

Файл: `inventory-server/public/css/swagger.css`.

```
/* Отдельное оформление оболочки, без глобальных стилей таблиц главной страницы. */
:root { color-scheme: light; color-scheme: only light; }
body { margin: 0; background: #fff; color: #263238; font-family: Arial, sans-serif; }
.topbar { background: #2455b5; color: #fff; padding: 18px 24px; }
.topbar__inner { max-width: 1400px; margin: auto; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; }
.topbar h1 { margin: 0; font-size: 24px; }
.topbar a { color: #fff; }
.muted { opacity: .85; }
.card { border: 1px solid #ddd; border-radius: 8px; line-height: 1.6; }
.card code { background: #edf1f5; padding: 2px 4px; }
.footer { padding: 20px; text-align: center; font-size: 14px; }
main > .card { margin: 16px auto; max-width: 1400px; padding: 16px; }
.swagger-ui { text-align: left; }
.swagger-ui button { min-height: 40px; }
.swagger-ui textarea { min-height: 160px; }
.swagger-ui input, .swagger-ui select, .swagger-ui textarea { color: #263238; }
.swagger-ui .responses-wrapper { overflow-x: auto; }
.swagger-ui .opblock-summary-path { word-break: break-all; }
@media (max-width: 600px) {
  .swagger-ui .wrapper { padding: 0 8px; }
  .swagger-ui .opblock-summary { flex-wrap: wrap; }
  .swagger-ui .opblock-summary-description { width: 100%; padding: 6px; }
  .swagger-ui .opblock .opblock-section-header { flex-wrap: wrap; }
}
```

### А.9 docs.html

Файл: `inventory-server/public/docs.html`.

```
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="only light">
  <title>Swagger UI — Инвентарь (ЛР №2)</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/vendor/swagger-ui/swagger-ui.css">
  <link rel="stylesheet" href="/css/swagger.css?v=light-1">
</head>
<body>
<header class="topbar">
  <div class="topbar__inner">
    <div>
      <h1>Swagger UI</h1>
      <p class="muted">Интерактивная проверка API инвентаря</p>
    </div>
    <nav class="topbar__nav">
      <a href="/">← Тестовая страница</a>
    </nav>
  </div>
</header>

<main>
  <section class="card">
    <p>Раскройте метод → <b>Try it out</b> → заполните поля → <b>Execute</b>.
      Сначала выполните <code>POST /auth/login</code> с
      <code>admin/admin123</code>. Токен автоматически применяется к следующим запросам.
      Можно также вставить JWT через кнопку <b>Authorize</b>.</p>
    <p id="swagger-status" role="status">Загрузка Swagger UI…</p>
  </section>
  <div id="swagger-ui"></div>
</main>

<footer class="footer">
  <p>Запросы отправляются на тот же сервер, с которого открыта эта страница.</p>
</footer>

<script src="/vendor/swagger-ui/swagger-ui-bundle.js"></script>
<script src="/js/swagger.js"></script>
</body>
</html>
```

### А.10 favicon.svg

Файл: `inventory-server/public/favicon.svg`.

```
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#2f6fed"/>
  <path d="M16 26h32v22H16z" fill="none" stroke="#fff" stroke-width="4"/>
  <path d="M16 26l8-8h16l8 8" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
  <path d="M26 36h12" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
</svg>
```

### А.11 index.html

Файл: `inventory-server/public/index.html`.

```
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="only light">
  <title>Инвентарь — REST API (ЛР №2, вариант 7)</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/css/style.css?v=light-1">
</head>
<body>
<header class="topbar">
  <div class="topbar__inner">
    <div>
      <h1>Инвентарь</h1>
      <p class="muted">Лабораторная работа №2, вариант 7 — REST API, HTTPS, JWT, кэширование</p>
    </div>
    <nav class="topbar__nav">
      <a href="/docs.html">Swagger UI — выполнить запросы API</a>
    </nav>
  </div>
</header>

<main class="layout">
  <section class="card" id="login-card">
    <h2>Вход</h2>
    <p class="muted">Демо-пользователи: <code>admin/admin123</code>, <code>user/user123</code>, <code>viewer/viewer123</code>.</p>
    <div class="row">
      <label>Логин <input id="login-user" value="admin" autocomplete="username"></label>
      <label>Пароль <input id="login-pass" type="password" value="admin123" autocomplete="current-password"></label>
      <button id="btn-login" class="primary">Войти</button>
      <button id="btn-logout" class="ghost">Выйти</button>
      <span id="auth-status" class="status">Не выполнен вход</span>
    </div>
  </section>

  <section class="card">
    <div class="toolbar">
      <input id="filter-q" placeholder="Поиск по названию или месту" class="grow">
      <select id="filter-condition">
        <option value="">Все состояния</option>
        <option value="new">новый</option>
        <option value="good">хорошее</option>
        <option value="used">б/у</option>
        <option value="broken">неисправен</option>
      </select>
      <button id="btn-refresh">Обновить</button>
      <button id="btn-create" class="primary">Создать</button>
    </div>

    <div id="cache-info" class="cache muted">Кэш: ещё не запрашивали список</div>

    <div id="editor" class="editor hidden">
      <h3 id="editor-title">Новый предмет</h3>
      <div class="row">
        <label class="grow">Название <input id="f-name"></label>
        <label>Количество <input id="f-quantity" type="number" min="0" step="1" value="1"></label>
      </div>
      <div class="row">
        <label class="grow">Место хранения <input id="f-location"></label>
        <label>Состояние
          <select id="f-condition">
            <option value="new">новый</option>
            <option value="good">хорошее</option>
            <option value="used">б/у</option>
            <option value="broken">неисправен</option>
          </select>
        </label>
      </div>
      <div class="row">
        <button id="btn-save" class="primary">Сохранить</button>
        <button id="btn-cancel" class="ghost">Отмена</button>
      </div>
    </div>

    <div id="banner" class="banner hidden"></div>

    <div class="table-wrap">
      <table id="items-table">
        <thead>
          <tr><th>Название</th><th>Кол-во</th><th>Место хранения</th><th>Состояние</th><th>Действия</th></tr>
        </thead>
        <tbody id="items-body">
          <tr><td colspan="5" class="muted">Войдите и нажмите «Обновить».</td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="card">
    <h2>Проверка кодов ответа</h2>
    <p class="muted">Кнопки выполняют запросы, которые возвращают нужные коды состояний.</p>
    <div class="row wrap">
      <button data-error="400">400 — валидация</button>
      <button data-error="401">401 — без токена</button>
      <button data-error="403">403 — роль viewer</button>
      <button data-error="404">404 — нет предмета</button>
      <button data-error="500">500 — сервер</button>
      <button id="btn-304">304 — кэш (If-None-Match)</button>
    </div>
  </section>

  <section class="card">
    <h2>Журнал запросов</h2>
    <div id="log" class="log"><p class="muted">Пока пусто.</p></div>
  </section>

  <section class="card hidden" id="demo-panel">
    <h2>Автодемонстрация CRUD</h2>
    <p class="muted">Сценарий выполняется автоматически при открытии со страницы с <code>?auto=1</code>.</p>
    <ol id="demo-steps" class="demo-steps"></ol>
    <p id="demo-summary" class="status"></p>
  </section>
</main>

<footer class="footer">
  <p>Учебный проект МАИ. Самоподписанный HTTPS-сертификат: <code>lab02/inventory-server/certs/ca.crt</code>.</p>
</footer>

<script src="/js/api.js"></script>
<script src="/js/app.js"></script>
</body>
</html>
```

### А.12 api.js

Файл: `inventory-server/public/js/api.js`.

```
'use strict';

/* Обёртка над XMLHttpRequest: ES5-совместимо (QtWebKit в Авроре). */
(function (global) {
  var API = '/api/v1';

  function parseHeaders(raw) {
    var headers = {};
    String(raw || '').trim().split(/[\r\n]+/).forEach(function (line) {
      var idx = line.indexOf(':');
      if (idx > 0) headers[line.slice(0, idx).toLowerCase()] = line.slice(idx + 1).trim();
    });
    return headers;
  }

  /**
   * @param {string} method
   * @param {string} path        путь относительно /api/v1
   * @param {object} options     { token, body, headers }
   * @param {function} callback  function (err, response)
   */
  function request(method, path, options, callback) {
    options = options || {};
    var xhr = new XMLHttpRequest();
    var started = Date.now();
    xhr.open(method, API + path, true);
    xhr.setRequestHeader('Accept', 'application/json');
    if (options.token) xhr.setRequestHeader('Authorization', 'Bearer ' + options.token);
    if (options.headers) {
      for (var name in options.headers) {
        if (Object.prototype.hasOwnProperty.call(options.headers, name)) {
          xhr.setRequestHeader(name, options.headers[name]);
        }
      }
    }
    var body = null;
    if (options.body !== undefined && options.body !== null) {
      body = JSON.stringify(options.body);
      xhr.setRequestHeader('Content-Type', 'application/json');
    }

    function finish(status, headers, data) {
      callback(null, {
        status: status,
        ok: status >= 200 && status < 300,
        headers: headers,
        data: data,
        ms: Date.now() - started
      });
    }

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var data = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch (e) {
        data = xhr.responseText;
      }
      finish(xhr.status, parseHeaders(xhr.getAllResponseHeaders()), data);
    };
    xhr.onerror = function () {
      callback(new Error('Сетевая ошибка: сервер недоступен'), null);
    };
    xhr.timeout = 8000;
    xhr.ontimeout = function () {
      callback(new Error('Таймаут запроса (8 с)'), null);
    };
    xhr.send(body);
  }

  global.InventoryApi = { request: request, API: API };
})(window);
```

### А.13 app.js

Файл: `inventory-server/public/js/app.js`.

```
'use strict';

/* Тестовая страница инвентаря: логин, CRUD, журнал запросов, автодемонстрация.
 * Код намеренно на ES5 + XMLHttpRequest — страница должна работать и в QtWebKit
 * на Авроре, и в обычном браузере на ПК. */
(function () {
  var Api = window.InventoryApi;

  var CONDITION_LABELS = {
    'new': 'новый',
    'good': 'хорошее',
    'used': 'б/у',
    'broken': 'неисправен'
  };

  var state = {
    token: '',
    user: null,
    items: [],
    editingId: null,
    etag: '',
    lastHeaders: null
  };

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function isAuto() { return /[?&]auto=1/.test(window.location.search); }

  function showBanner(text, kind) {
    var el = $('banner');
    el.className = 'banner ' + (kind || 'info');
    el.innerHTML = text;
  }

  function clearBanner() {
    var el = $('banner');
    el.className = 'banner hidden';
    el.innerHTML = '';
  }

  function setAuthStatus() {
    var el = $('auth-status');
    if (state.user) {
      el.className = 'status ok';
      el.innerHTML = 'Вошёл: <b>' + esc(state.user.username) + '</b> (' + esc(state.user.role) + ')';
    } else {
      el.className = 'status';
      el.textContent = 'Не выполнен вход';
    }
  }

  function statusClass(code) {
    if (code >= 200 && code < 300) return 'code code--2xx';
    if (code >= 300 && code < 400) return 'code code--3xx';
    if (code >= 400 && code < 500) return 'code code--4xx';
    if (code >= 500) return 'code code--5xx';
    return 'code';
  }

  function addLog(method, path, res, note) {
    var log = $('log');
    var empty = log.querySelector('.muted');
    if (empty) log.innerHTML = '';

    var entry = document.createElement('div');
    entry.className = 'log-entry';

    var head = document.createElement('div');
    head.className = 'log-head';
    if (!res) {
      head.innerHTML = '<span class="code code--5xx">ERR</span> <b>' + esc(method) + '</b> ' +
        esc(path) + ' — ' + esc(note);
    } else {
      var code = Math.round(res.status);
      head.innerHTML = '<span class="' + statusClass(code) + '">' + code + '</span> ' +
        '<b>' + esc(method) + '</b> ' + esc(path) + ' <span class="muted">' + res.ms + ' мс</span>' +
        (note ? ' — ' + esc(note) : '');
    }
    entry.appendChild(head);

    if (res && res.headers) {
      var h = res.headers;
      var interesting = [];
      ['etag', 'cache-control', 'last-modified', 'content-type', 'location', 'x-total-count'].forEach(function (name) {
        if (h[name]) interesting.push(name + ': ' + h[name]);
      });
      if (interesting.length) {
        var headersEl = document.createElement('div');
        headersEl.className = 'log-headers muted';
        headersEl.textContent = interesting.join(' · ');
        entry.appendChild(headersEl);
      }
      if (res.data !== null && res.data !== undefined) {
        var pre = document.createElement('pre');
        pre.className = 'log-body';
        var text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
        pre.textContent = text.length > 1200 ? text.slice(0, 1200) + '…' : text;
        entry.appendChild(pre);
      }
    }
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  function updateCacheInfo() {
    var el = $('cache-info');
    if (!state.lastHeaders) {
      el.textContent = 'Кэш: ещё не запрашивали список';
      return;
    }
    var h = state.lastHeaders;
    el.textContent = 'Кэш: ETag ' + (h.etag || '—') +
      ' · Last-Modified ' + (h['last-modified'] || '—') +
      ' · Cache-Control ' + (h['cache-control'] || '—');
  }

  function renderItems() {
    var body = $('items-body');
    if (!state.items.length) {
      body.innerHTML = '<tr><td colspan="5" class="muted">Предметов нет.</td></tr>';
      return;
    }
    var html = '';
    state.items.forEach(function (item) {
      html += '<tr>' +
        '<td>' + esc(item.name) + '</td>' +
        '<td class="num">' + esc(item.quantity) + '</td>' +
        '<td>' + esc(item.location) + '</td>' +
        '<td><span class="badge badge--' + esc(item.condition) + '">' + esc(CONDITION_LABELS[item.condition] || item.condition) + '</span></td>' +
        '<td class="actions">' +
        '<button class="small" data-action="edit" data-id="' + esc(item.id) + '">Изменить</button> ' +
        '<button class="small danger" data-action="delete" data-id="' + esc(item.id) + '">Удалить</button>' +
        '</td>' +
        '</tr>';
    });
    body.innerHTML = html;
  }

  function queryString() {
    var params = [];
    var q = $('filter-q').value.trim();
    var condition = $('filter-condition').value;
    if (q) params.push('q=' + encodeURIComponent(q));
    if (condition) params.push('condition=' + encodeURIComponent(condition));
    return params.length ? '?' + params.join('&') : '';
  }

  function refresh(callback, bustCache) {
    var path = '/items' + queryString();
    if (bustCache) path += (path.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
    Api.request('GET', path, { token: state.token }, function (err, res) {
      if (err) {
        showBanner('Не удалось получить список: ' + esc(err.message), 'error');
        addLog('GET', path, null, err.message);
        if (callback) callback(err);
        return;
      }
      addLog('GET', path, res);
      if (res.status === 200) {
        state.items = res.data.items || [];
        state.lastHeaders = res.headers;
        state.etag = res.headers.etag || '';
        updateCacheInfo();
        renderItems();
        clearBanner();
      } else if (res.status === 304 && !bustCache) {
        // Браузер отдал свою кэшированную копию; если данных ещё нет —
        // повторяем запрос с обходом кэша, иначе просто показываем прежние.
        if (!state.lastHeaders || !state.items.length) {
          refresh(callback, true);
          return;
        }
      } else {
        showBanner('Список не получен: ' + esc(res.data && res.data.message ? res.data.message : res.status), 'error');
      }
      if (callback) callback(null, res);
    });
  }

  function login(username, password, callback) {
    Api.request('POST', '/auth/login', {
      body: { username: username, password: password }
    }, function (err, res) {
      addLog('POST', '/auth/login', err ? null : res, err ? err.message : 'вход ' + username);
      if (err) {
        showBanner('Ошибка входа: ' + esc(err.message), 'error');
        if (callback) callback(err);
        return;
      }
      if (res.status === 200) {
        state.token = res.data.token;
        state.user = res.data.user;
        setAuthStatus();
        showBanner('Токен получен и сохранён в cookie (HttpOnly, Secure) и в памяти страницы.', 'ok');
      } else {
        showBanner('Вход не выполнен: ' + esc(res.data && res.data.message ? res.data.message : res.status), 'error');
      }
      if (callback) callback(null, res);
    });
  }

  function openEditor(item) {
    state.editingId = item ? item.id : null;
    $('editor-title').textContent = item ? 'Изменить предмет' : 'Новый предмет';
    $('f-name').value = item ? item.name : '';
    $('f-quantity').value = item ? item.quantity : 1;
    $('f-location').value = item ? item.location : '';
    $('f-condition').value = item ? item.condition : 'new';
    $('editor').className = 'editor';
    $('f-name').focus();
  }

  function closeEditor() {
    state.editingId = null;
    $('editor').className = 'editor hidden';
  }

  function saveEditor() {
    var payload = {
      name: $('f-name').value,
      quantity: Number($('f-quantity').value),
      location: $('f-location').value,
      condition: $('f-condition').value
    };
    var editing = state.editingId;
    var method = editing ? 'PUT' : 'POST';
    var path = editing ? '/items/' + editing : '/items';
    Api.request(method, path, { token: state.token, body: payload }, function (err, res) {
      if (err) {
        showBanner('Не удалось сохранить: ' + esc(err.message), 'error');
        addLog(method, path, null, err.message);
        return;
      }
      addLog(method, path, res);
      if (res.ok) {
        closeEditor();
        refresh();
      } else {
        var details = '';
        if (res.data && res.data.details) {
          details = ' <ul>' + res.data.details.map(function (d) {
            return '<li>' + esc(d.field) + ': ' + esc(d.message) + '</li>';
          }).join('') + '</ul>';
        }
        showBanner('Ошибка ' + res.status + ': ' + esc(res.data && res.data.message ? res.data.message : '') + details, 'error');
      }
    });
  }

  function deleteItem(id, name) {
    if (!isAuto() && !window.confirm('Удалить «' + name + '»?')) return;
    var path = '/items/' + id;
    Api.request('DELETE', path, { token: state.token }, function (err, res) {
      if (err) {
        addLog('DELETE', path, null, err.message);
        showBanner('Не удалось удалить: ' + esc(err.message), 'error');
        return;
      }
      addLog('DELETE', path, res);
      if (res.status === 204) {
        refresh();
      } else {
        showBanner('Удаление не выполнено: ' + res.status + ' ' +
          esc(res.data && res.data.message ? res.data.message : ''), 'error');
      }
    });
  }

  function runErrorCase(code) {
    if (code === '400') {
      Api.request('POST', '/items', {
        token: state.token,
        body: { name: '', quantity: -1, location: '', condition: 'bad' }
      }, function (err, res) {
        addLog('POST', '/items', err ? null : res, 'ожидаем 400');
      });
    } else if (code === '401') {
      Api.request('GET', '/items', {}, function (err, res) {
        addLog('GET', '/items', err ? null : res, 'без токена, ожидаем 401');
      });
    } else if (code === '403') {
      var previousToken = state.token;
      var previousUser = state.user;
      login('viewer', 'viewer123', function () {
        var viewerToken = state.token;
        Api.request('POST', '/items', {
          token: viewerToken,
          body: { name: 'Запрещено', quantity: 1, location: 'Склад', condition: 'new' }
        }, function (err, res) {
          addLog('POST', '/items', err ? null : res, 'роль viewer, ожидаем 403');
          state.token = previousToken;
          state.user = previousUser;
          setAuthStatus();
        });
      });
    } else if (code === '404') {
      Api.request('GET', '/items/00000000-0000-0000-0000-000000000000', {
        token: state.token
      }, function (err, res) {
        addLog('GET', '/items/<нет>', err ? null : res, 'ожидаем 404');
      });
    } else if (code === '500') {
      Api.request('GET', '/debug/error', { token: state.token }, function (err, res) {
        addLog('GET', '/debug/error', err ? null : res, 'ожидаем 500');
      });
    }
  }

  function check304() {
    if (!state.etag) {
      refresh(function () {
        if (!state.etag) {
          showBanner('Сначала войдите и получите список (нужен ETag).', 'error');
          return;
        }
        check304();
      });
      return;
    }
    Api.request('GET', '/items', {
      token: state.token,
      headers: { 'If-None-Match': state.etag }
    }, function (err, res) {
      addLog('GET', '/items', err ? null : res,
        'If-None-Match: ' + state.etag + ', ожидаем 304');
    });
  }

  // -------------------------------------------------------------------------
  // Автодемонстрация (?auto=1): последовательный CRUD + коды ответов.
  // -------------------------------------------------------------------------

  function runAutoDemo() {
    $('demo-panel').className = 'card';
    var list = $('demo-steps');
    list.innerHTML = '';
    var results = [];
    var adminToken = '';

    function record(name, expected, res) {
      var actual = res ? res.status : 0;
      var ok = expected === 0 ? !!res && res.ok : actual === expected;
      results.push({ name: name, expected: expected, actual: actual, ok: ok });
      var li = document.createElement('li');
      li.className = ok ? 'demo-ok' : 'demo-fail';
      li.innerHTML = (ok ? '✓ ' : '✗ ') + esc(name) + ' — ожидалось ' +
        (expected === 0 ? '2xx' : expected) + ', получено ' + actual;
      list.appendChild(li);
      return ok;
    }

    function call(method, path, options, name, expected, cb) {
      Api.request(method, path, options, function (err, res) {
        addLog(method, path, err ? null : res, name);
        record(name, expected, res);
        cb(err, res);
      });
    }

    var steps = [
      function (next) {
        call('POST', '/auth/login', { body: { username: 'admin', password: 'admin123' } },
          'Вход admin', 200, function (err, res) {
            if (res && res.status === 200) {
              adminToken = res.data.token;
              state.token = adminToken;
              state.user = res.data.user;
              setAuthStatus();
            }
            next();
          });
      },
      function (next) {
        // Параметр _ исключает попадание в дисковый кэш браузера (иначе
        // Gecko может сам прислать If-None-Match и вернуть 304 вместо 200).
        call('GET', '/items?demo=' + Date.now(), { token: adminToken },
          'Чтение списка', 200, function (err, res) {
          if (res && res.status === 200) {
            state.items = res.data.items || [];
            state.lastHeaders = res.headers;
            state.etag = res.headers.etag || '';
            updateCacheInfo();
            renderItems();
          }
          next();
        });
      },
      function (next) {
        call('GET', '/items', {
          token: adminToken,
          headers: { 'If-None-Match': state.etag }
        }, 'Повторное чтение с If-None-Match (кэш)', 304, function () { next(); });
      },
      function (next) {
        call('POST', '/items', {
          token: adminToken,
          body: { name: 'Демо-предмет (авто)', quantity: 1, location: 'Демо-склад', condition: 'new' }
        }, 'Создание предмета', 201, function (err, res) {
          if (res && res.status === 201) state.createdId = res.data.id;
          next();
        });
      },
      function (next) {
        call('GET', '/items/' + state.createdId, { token: adminToken },
          'Чтение созданного предмета', 200, function () { next(); });
      },
      function (next) {
        call('PATCH', '/items/' + state.createdId, {
          token: adminToken,
          body: { quantity: 9, condition: 'used' }
        }, 'Обновление (PATCH)', 200, function () { next(); });
      },
      function (next) {
        call('DELETE', '/items/' + state.createdId, { token: adminToken },
          'Удаление предмета', 204, function () { refresh(); next(); });
      },
      function (next) {
        call('POST', '/items', {
          token: adminToken,
          body: { name: '', quantity: -1, location: '', condition: 'bad' }
        }, 'Ошибка валидации', 400, function () { next(); });
      },
      function (next) {
        call('GET', '/items/00000000-0000-0000-0000-000000000000', { token: adminToken },
          'Несуществующий предмет', 404, function () { next(); });
      },
      function (next) {
        // Выход очищает HttpOnly-cookie: без неё и без заголовка получаем 401.
        call('POST', '/auth/logout', {}, 'Выход (сброс cookie)', 204, function () {
          call('GET', '/items', {}, 'Без токена', 401, function () { next(); });
        });
      },
      function (next) {
        call('POST', '/auth/login', { body: { username: 'viewer', password: 'viewer123' } },
          'Вход viewer', 200, function (err, res) {
            var viewerToken = res && res.data ? res.data.token : '';
            call('POST', '/items', {
              token: viewerToken,
              body: { name: 'Запрещено', quantity: 1, location: 'Склад', condition: 'new' }
            }, 'Создание от viewer (403)', 403, function () { next(); });
          });
      },
      function (next) {
        call('GET', '/debug/error', { token: adminToken }, 'Внутренняя ошибка (500)', 500,
          function () { next(); });
      },
      function () {
        state.token = adminToken;
        state.user = { username: 'admin', role: 'admin' };
        setAuthStatus();
        refresh();

        var ok = results.every(function (r) { return r.ok; });
        $('demo-summary').className = 'status ' + (ok ? 'ok' : 'error');
        $('demo-summary').textContent = ok
          ? 'Все ' + results.length + ' шагов выполнены с ожидаемыми кодами.'
          : 'Есть шаги с неожиданным кодом — см. список выше.';
        window.__demo = { done: true, ok: ok, steps: results, finishedAt: new Date().toISOString() };
        document.title = (ok ? 'OK ' : 'FAIL ') + 'demo — Инвентарь (ЛР №2)';
        if (window.console && console.log) {
          console.log('LAB02_DEMO_RESULT ' + JSON.stringify(window.__demo));
        }
        // Контрольный запрос: по журналу сервера видно, что автодемо доработало
        // до конца (удобно при проверке в браузере эмулятора без консоли).
        var passed = 0;
        results.forEach(function (r) { if (r.ok) passed += 1; });
        Api.request('GET', '/debug/demo-result?ok=' + (ok ? 1 : 0) +
          '&passed=' + passed + '&total=' + results.length, {}, function () {});
      }
    ];

    var index = 0;
    function next() {
      if (index >= steps.length) return;
      var stepFn = steps[index];
      index += 1;
      setTimeout(function () { stepFn(next); }, 120);
    }
    next();
  }

  function bind() {
    $('btn-login').onclick = function () {
      login($('login-user').value, $('login-pass').value, function () { refresh(); });
    };
    $('btn-logout').onclick = function () {
      Api.request('POST', '/auth/logout', { token: state.token }, function (err, res) {
        addLog('POST', '/auth/logout', err ? null : res, 'выход');
      });
      state.token = '';
      state.user = null;
      state.items = [];
      setAuthStatus();
      renderItems();
      showBanner('Выполнен выход, cookie сброшена.', 'info');
    };
    $('btn-refresh').onclick = function () { refresh(); };
    $('btn-create').onclick = function () { openEditor(null); };
    $('btn-save').onclick = saveEditor;
    $('btn-cancel').onclick = closeEditor;
    $('btn-304').onclick = check304;
    $('items-body').onclick = function (event) {
      var target = event.target;
      if (target.tagName !== 'BUTTON') return;
      var id = target.getAttribute('data-id');
      var action = target.getAttribute('data-action');
      if (action === 'edit') {
        state.items.forEach(function (item) {
          if (item.id === id) openEditor(item);
        });
      } else if (action === 'delete') {
        var name = '';
        state.items.forEach(function (item) { if (item.id === id) name = item.name; });
        deleteItem(id, name);
      }
    };
    var buttons = document.querySelectorAll('[data-error]');
    for (var i = 0; i < buttons.length; i += 1) {
      buttons[i].onclick = function () { runErrorCase(this.getAttribute('data-error')); };

    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    bind();
    updateCacheInfo();
    if (isAuto()) {
      setTimeout(runAutoDemo, 300);
    }
  });
})();
```

### А.14 swagger-demo.js

Файл: `inventory-server/public/js/swagger-demo.js`.

```
/* Проверка настоящих кнопок Swagger UI: /docs.html?auto=1. ES5. */
(function () {
  'use strict';
  var result = window.__swaggerDemo = { done: false, ok: false, steps: [] };
  var itemId = '';
  var status = document.getElementById('swagger-status');
  var steps = [
    ['get', '/health', null, 200],
    ['post', '/auth/login', { username: 'admin', password: 'admin123' }, 200],
    ['get', '/auth/me', null, 200],
    ['get', '/items', null, 200],
    ['post', '/items', { name: 'Swagger UI demo', quantity: 2, location: 'Стенд', condition: 'new' }, 201],
    ['get', '/items/{id}', null, 200],
    ['put', '/items/{id}', { name: 'Swagger UI demo', quantity: 3, location: 'Стенд', condition: 'good' }, 200],
    ['patch', '/items/{id}', { quantity: 4 }, 200],
    ['delete', '/items/{id}', null, 204],
    ['get', '/items/{id}', null, 404],
    ['post', '/auth/logout', null, 204]
  ];

  function finish(error) {
    result.done = true;
    result.ok = !error;
    if (error) result.error = String(error);
    status.textContent = 'Swagger UI: ' + result.steps.length + '/' + steps.length +
      (error ? ', ошибка: ' + error : ', все запросы выполнены кнопкой Execute');
    window.__onSwaggerResponse = null;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/v1/debug/demo-result?source=swagger&ok=' + (result.ok ? 1 : 0) +
      '&passed=' + result.steps.length + '&total=' + steps.length +
      '&detail=' + encodeURIComponent(error || navigator.userAgent), true);
    xhr.send();
  }

  function value(element, text) {
    // React отслеживает значение контролов: вызываем родной setter и input.
    var descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
    descriptor.set.call(element, text);
    var event = document.createEvent('Event');
    event.initEvent('input', true, true);
    element.dispatchEvent(event);
  }

  function next(index) {
    if (index === steps.length) { finish(); return; }
    var step = steps[index];
    var blocks = document.querySelectorAll('.opblock');
    var block = null;
    for (var i = 0; i < blocks.length; i++) {
      var method = blocks[i].querySelector('.opblock-summary-method');
      var path = blocks[i].querySelector('.opblock-summary-path');
      if (method && path && method.textContent.toLowerCase() === step[0] &&
          path.textContent.replace(/\s/g, '') === step[1]) block = blocks[i];
    }
    if (!block) { finish('Метод не найден: ' + step[0] + ' ' + step[1]); return; }
    if (block.className.indexOf('is-open') < 0) {
      (block.querySelector('.opblock-summary-control') || block.querySelector('.opblock-summary')).click();
    }
    setTimeout(function () {
      try {
        var tryButton = block.querySelector('.try-out__btn');
        if (tryButton && !block.querySelector('.execute')) tryButton.click();
        setTimeout(function () {
          try {
            if (step[2]) value(block.querySelector('textarea.body-param__text'), JSON.stringify(step[2], null, 2));
            if (step[1].indexOf('{id}') >= 0) {
              value(block.querySelector('.parameters-col_description input'), itemId);
            }
            var timer = setTimeout(function () { finish('Таймаут запроса ' + step[1]); }, 20000);
            window.__onSwaggerResponse = function (response) {
              clearTimeout(timer);
              if (response.status !== step[3]) {
                finish(step[0] + ' ' + step[1] + ': ' + response.status + ', ожидалось ' + step[3]);
                return;
              }
              var data = response.obj || response.body || {};
              if (typeof data !== 'object' || !data.id) {
                try { data = JSON.parse(response.text); } catch (error) { data = {}; }
              }
              if (step[0] === 'post' && step[1] === '/items') itemId = data.id;
              result.steps.push({ method: step[0], path: step[1], status: response.status });
              window.__onSwaggerResponse = null;
              setTimeout(function () { next(index + 1); }, 350);
            };
            setTimeout(function () { block.querySelector('.execute').click(); }, 700);
          } catch (error) { finish(error); }
        }, 200);
      } catch (error) { finish(error); }
    }, 200);
  }
  setTimeout(function () { next(0); }, 500);
}());
```

### А.15 swagger.js

Файл: `inventory-server/public/js/swagger.js`.

```
/* Swagger UI: ES5 для браузера Авроры, без привязки к IP компьютера. */
(function () {
  'use strict';
  var status = document.getElementById('swagger-status');
  window.ui = SwaggerUIBundle({
    url: '/api/v1/openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    validatorUrl: null,
    docExpansion: 'list',
    defaultModelsExpandDepth: -1,
    supportedSubmitMethods: ['get', 'post', 'put', 'patch', 'delete'],
    presets: [SwaggerUIBundle.presets.apis],
    onComplete: function () {
      status.textContent = 'Готово. Сервер: ' + window.location.host;
      if (/(?:\?|&)auto=1(?:&|$)/.test(window.location.search)) {
        var script = document.createElement('script');
        script.src = '/js/swagger-demo.js';
        document.body.appendChild(script);
      }
    },
    responseInterceptor: function (response) {
      var url = response.url || '';
      if (/\/auth\/login(?:\?|$)/.test(url) && response.status === 200) {
        var data = response.obj || response.body || {};
        if (typeof data !== 'object' || !data.token) {
          try { data = JSON.parse(response.text); } catch (error) { data = {}; }
        }
        if (data.token) {
          window.ui.preauthorizeApiKey('bearerAuth', data.token);
          status.textContent = 'Вход выполнен. JWT применяется к запросам API.';
        }
      } else if (/\/auth\/logout(?:\?|$)/.test(url) && response.status === 204) {
        window.ui.authActions.logout(['bearerAuth']);
        status.textContent = 'Выполнен выход.';
      }
      if (window.__onSwaggerResponse) window.__onSwaggerResponse(response);
      return response;
    }
  });
}());
```

### А.16 package.json

Файл: `inventory-server/package.json`.

```
{
  "name": "lab02-inventory-server",
  "version": "1.0.0",
  "description": "Лабораторная работа №2 (вариант 7): REST API инвентаря, HTTPS, JWT, кэширование, OpenAPI",
  "private": true,
  "main": "server/server.js",
  "scripts": {
    "start": "node server/server.js",
    "dev": "node --watch server/server.js",
    "certs": "bash tools/gen-cert.sh",
    "test": "node test/api-test.js"
  },
  "engines": {
    "node": ">=18"
  },
  "keywords": [
    "rest",
    "https",
    "jwt",
    "openapi",
    "lab",
    "MAI"
  ],
  "license": "MIT"
}
```

### А.17 gen-cert.sh

Файл: `inventory-server/tools/gen-cert.sh`.

```
#!/usr/bin/env bash
# Самоподписанный CA + сертификат сервера для HTTPS (учебная работа).
#
# SAN включает localhost/127.0.0.1 (ПК), 10.0.2.2 (шлюз на хост из эмулятора
# VirtualBox) и все IPv4-адреса машины в локальной сети.
set -euo pipefail

cd "$(dirname "$0")/.."
DIR="${CERT_DIR:-certs}"
mkdir -p "$DIR"

SAN="DNS:localhost,DNS:inventory.local,IP:127.0.0.1,IP:10.0.2.2"
for ip in $(hostname -I 2>/dev/null || true); do
  case "$ip" in
    *:*) ;;                       # IPv6 в SAN не добавляем: SAN уже с IPv4
    *) SAN="$SAN,IP:$ip" ;;
  esac
done

if [[ -f "$DIR/ca.crt" && -f "$DIR/ca.key" ]]; then
  echo "Используется существующий CA: $DIR/ca.crt"
elif [[ -e "$DIR/ca.crt" || -e "$DIR/ca.key" ]]; then
  echo "Ошибка: нужна пара ca.crt и ca.key; существующий CA не перезаписан." >&2
  exit 1
else
openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout "$DIR/ca.key" -out "$DIR/ca.crt" \
  -subj "/C=RU/ST=Moscow/O=MAI/OU=Laboratory/CN=MAI Lab02 Inventory CA" \
  >/dev/null 2>&1
fi

openssl req -newkey rsa:2048 -nodes \
  -keyout "$DIR/server.key" -out "$DIR/server.csr" \
  -subj "/C=RU/ST=Moscow/O=MAI/OU=Laboratory/CN=inventory.local" \
  >/dev/null 2>&1

cat > "$DIR/server.ext" <<EOF
subjectAltName=$SAN
extendedKeyUsage=serverAuth
keyUsage=digitalSignature,keyEncipherment
EOF

openssl x509 -req -in "$DIR/server.csr" -CA "$DIR/ca.crt" -CAkey "$DIR/ca.key" \
  -CAcreateserial -out "$DIR/server.crt" -days 3650 -extfile "$DIR/server.ext" \
  >/dev/null 2>&1

rm -f "$DIR/server.csr" "$DIR/server.ext" "$DIR/ca.srl"

echo "Готово: $DIR/ca.crt, $DIR/server.crt, $DIR/server.key"
echo "SAN: $SAN"
```

### А.18 api-test.js

Файл: `inventory-server/test/api-test.js`.

```
'use strict';

/**
 * Автотесты REST API инвентаря (лабораторная работа №2, вариант 7).
 *
 * Поднимает сервер на свободных портах с временным DATA_DIR и проверяет
 * HTTPS/HTTP-редирект, JWT и cookie, роли, CRUD, коды ошибок, кэширование
 * (ETag/Last-Modified/304), фильтры, статику и OpenAPI.
 *
 *   npm test
 */

const { spawn } = require('node:child_process');
const https = require('node:https');
const http = require('node:http');
const net = require('node:net');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log('  ok  %s', name);
  } else {
    failures.push({ name, detail });
    console.log('  FAIL %s%s', name, detail ? ' — ' + detail : '');
  }
}

function eq(name, actual, expected) {
  check(name, actual === expected, 'ожидалось ' + JSON.stringify(expected) +
    ', получено ' + JSON.stringify(actual));
}

function contains(name, haystack, needle) {
  check(name, typeof haystack === 'string' && haystack.includes(needle),
    'нет подстроки ' + JSON.stringify(needle));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function request(port, method, urlPath, options = {}) {
  const isHttps = options.https !== false;
  const lib = isHttps ? https : http;
  return new Promise((resolve, reject) => {
    const headers = Object.assign({ 'User-Agent': 'lab02-test/1.0' }, options.headers || {});
    let body = null;
    if (options.body !== undefined) {
      body = JSON.stringify(options.body);
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    if (options.token) headers.Authorization = 'Bearer ' + options.token;

    const req = lib.request({
      host: '127.0.0.1',
      port,
      method,
      path: urlPath,
      headers,
      rejectUnauthorized: false,
      timeout: 5000,
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = raw ? JSON.parse(raw) : null;
        } catch (e) {
          json = null;
        }
        resolve({ status: res.statusCode, headers: res.headers, raw, json });
      });
    });
    req.on('timeout', () => req.destroy(new Error('таймаут запроса')));
    req.on('error', reject);
    req.end(body);
  });
}

async function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const res = await request(port, 'GET', '/api/v1/health');
      if (res.status === 200) return res;
    } catch (e) {
      lastError = e;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw lastError || new Error('сервер не ответил на /health');
}

function startServer(env) {
  const child = spawn(process.execPath, ['server/server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, env),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  const log = { out: '', err: '' };
  child.stdout.on('data', (chunk) => { log.out += chunk; });
  child.stderr.on('data', (chunk) => { log.err += chunk; });
  return { child, log };
}

async function stopServer(child) {
  if (!child || child.exitCode !== null || child.signalCode) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

async function main() {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'lab02-test-'));
  const httpsPort = await freePort();
  const httpPort = await freePort();

  const server = startServer({
    NODE_ENV: 'test',
    DATA_DIR: tempDir,
    HTTPS_PORT: String(httpsPort),
    HTTP_PORT: String(httpPort),
    HOST: '127.0.0.1',
    JWT_TTL_SEC: '600',
    LAB02_LOG: '0',
  });

  try {
    console.log('Сервер: https://127.0.0.1:%d, данные: %s', httpsPort, tempDir);
    await waitForHealth(httpsPort, 15000);

    console.log('\n[1] Здоровье, HTTP-редирект, статика, OpenAPI');
    let res = await request(httpsPort, 'GET', '/api/v1/health');
    eq('health 200', res.status, 200);
    eq('health status ok', res.json && res.json.status, 'ok');
    contains('health: host записан', res.json && res.json.request.host, '127.0.0.1');
    contains('health: user-agent записан', res.json && res.json.request.userAgent, 'lab02-test');

    res = await request(httpPort, 'GET', '/', { https: false });
    eq('HTTP → 301', res.status, 301);
    contains('HTTP Location на https', res.headers.location, 'https://');
    contains('HTTP Location на HTTPS-порт', res.headers.location, ':' + httpsPort);

    res = await request(httpsPort, 'GET', '/');
    eq('GET / → 200', res.status, 200);
    contains('GET / — HTML', res.headers['content-type'], 'text/html');
    contains('GET / — страница инвентаря', res.raw, 'Инвентарь');
    check('GET / — Cache-Control no-cache', /no-cache/.test(res.headers['cache-control'] || ''));
    contains('главная содержит ссылку Swagger UI', res.raw, 'Swagger UI');

    res = await request(httpsPort, 'GET', '/css/style.css');
    eq('CSS 200', res.status, 200);
    contains('CSS content-type', res.headers['content-type'], 'text/css');

    res = await request(httpsPort, 'GET', '/js/api.js');
    eq('JS 200', res.status, 200);
    contains('JS content-type', res.headers['content-type'], 'javascript');

    res = await request(httpsPort, 'GET', '/js/app.js');
    eq('app.js 200', res.status, 200);
    contains('app.js содержит автодемо', res.raw, 'runAutoDemo');

    res = await request(httpsPort, 'GET', '/docs.html');
    eq('docs.html 200', res.status, 200);
    contains('docs.html — Swagger UI', res.raw, '/vendor/swagger-ui/swagger-ui-bundle.js');
    res = await request(httpsPort, 'GET', '/js/swagger.js');
    eq('инициализация Swagger UI доступна', res.status, 200);
    contains('Swagger UI загружает локальное описание', res.raw, "url: '/api/v1/openapi.json'");
    res = await request(httpsPort, 'GET', '/vendor/swagger-ui/swagger-ui-bundle.js');
    eq('локальный Swagger UI доступен без CDN', res.status, 200);
    contains('Swagger UI имеет тип JavaScript', res.headers['content-type'], 'javascript');
    res = await request(httpsPort, 'GET', '/vendor/swagger-ui/swagger-ui.css');
    eq('стили Swagger UI доступны', res.status, 200);

    res = await request(httpsPort, 'GET', '/favicon.svg');
    eq('favicon.svg 200', res.status, 200);
    contains('favicon content-type', res.headers['content-type'], 'image/svg+xml');

    res = await request(httpsPort, 'HEAD', '/');
    eq('HEAD / → 200', res.status, 200);
    eq('HEAD / — пустое тело', res.raw, '');

    res = await request(httpsPort, 'GET', '/%2e%2e/server/config.js');
    eq('обход каталога → 404', res.status, 404);

    res = await request(httpsPort, 'GET', '/api/v1/openapi.json');
    eq('openapi 200', res.status, 200);
    eq('openapi версия', res.json && res.json.openapi, '3.0.3');
    check('openapi описывает /items', !!(res.json && res.json.paths && res.json.paths['/items']));
    eq('API использует текущий адрес без фиксированного IP', res.json.servers[0].url, '/api/v1');

    res = await request(httpPort, 'GET', '/docs.html',
      { https: false, headers: { Host: '192.168.55.77:' + httpPort } });
    eq('редирект сохраняет адрес другой сети', res.headers.location,
      'https://192.168.55.77:' + httpsPort + '/docs.html');

    console.log('\n[2] Аутентификация JWT и cookie');
    res = await request(httpsPort, 'POST', '/api/v1/auth/login',
      { body: { username: 'admin', password: 'wrong' } });
    eq('неверный пароль → 401', res.status, 401);
    eq('неверный пароль: invalid_credentials', res.json && res.json.error, 'invalid_credentials');

    res = await request(httpsPort, 'POST', '/api/v1/auth/login',
      { body: { username: 'admin', password: 'admin123' } });
    eq('вход admin → 200', res.status, 200);
    const adminToken = res.json && res.json.token;
    check('admin: токен — строка', typeof adminToken === 'string' && adminToken.length > 20);
    eq('admin: роль', res.json && res.json.user.role, 'admin');
    const cookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0] : '';
    contains('cookie: HttpOnly', cookie, 'HttpOnly');
    contains('cookie: Secure', cookie, 'Secure');
    contains('cookie: SameSite=Strict', cookie, 'SameSite=Strict');

    res = await request(httpsPort, 'GET', '/api/v1/auth/me', { token: adminToken });
    eq('auth/me Bearer → 200', res.status, 200);
    eq('auth/me: источник header', res.json && res.json.source, 'header');
    eq('auth/me: роль admin', res.json && res.json.role, 'admin');

    res = await request(httpsPort, 'GET', '/api/v1/auth/me',
      { headers: { Cookie: 'token=' + adminToken } });
    eq('auth/me Cookie → 200', res.status, 200);
    eq('auth/me: источник cookie', res.json && res.json.source, 'cookie');

    res = await request(httpsPort, 'GET', '/api/v1/items');
    eq('список без токена → 401', res.status, 401);
    contains('401: WWW-Authenticate', res.headers['www-authenticate'], 'Bearer');

    console.log('\n[3] Чтение списка, фильтры, кэширование');
    res = await request(httpsPort, 'GET', '/api/v1/items', { token: adminToken });
    eq('список admin → 200', res.status, 200);
    eq('сидовых предметов', res.json && res.json.total, 6);
    eq('X-Total-Count', res.headers['x-total-count'], '6');
    const listEtag = res.headers.etag;
    check('список: ETag есть', typeof listEtag === 'string' && listEtag.length > 2);
    contains('список: Cache-Control', res.headers['cache-control'], 'must-revalidate');
    check('список: Last-Modified есть', !!res.headers['last-modified']);

    res = await request(httpsPort, 'GET', '/api/v1/items',
      { token: adminToken, headers: { 'If-None-Match': listEtag } });
    eq('If-None-Match → 304', res.status, 304);
    eq('304: пустое тело', res.raw, '');
    eq('304: ETag сохранён', res.headers.etag, listEtag);

    res = await request(httpsPort, 'GET', '/api/v1/items', {
      token: adminToken,
      headers: { 'If-Modified-Since': new Date(Date.now() + 60000).toUTCString() },
    });
    eq('If-Modified-Since → 304', res.status, 304);

    res = await request(httpsPort, 'GET', '/api/v1/items?q=%D0%B4%D1%80%D0%B5%D0%BB%D1%8C',
      { token: adminToken });
    eq('поиск q=дрель → 1', res.json && res.json.total, 1);
    contains('поиск вернул дрель', res.json && res.json.items[0].name, 'Дрель');

    res = await request(httpsPort, 'GET', '/api/v1/items?condition=broken', { token: adminToken });
    eq('фильтр condition=broken → 1', res.json && res.json.total, 1);

    res = await request(httpsPort, 'GET', '/api/v1/items?limit=2&offset=1', { token: adminToken });
    eq('пагинация: limit 2', res.json && res.json.items.length, 2);
    eq('пагинация: total 6', res.json && res.json.total, 6);
    eq('пагинация: offset 1', res.json && res.json.offset, 1);

    res = await request(httpsPort, 'GET', '/api/v1/items?limit=0', { token: adminToken });
    eq('limit=0 → 400', res.status, 400);
    check('limit=0: details есть', !!(res.json && res.json.details && res.json.details.length));

    console.log('\n[4] Согласование заголовков и ошибки запроса');
    res = await request(httpsPort, 'GET', '/api/v1/items',
      { token: adminToken, headers: { Accept: 'text/html' } });
    eq('Accept: text/html → 406', res.status, 406);

    const savedUa = 'lab02-test/1.0';
    res = await request(httpsPort, 'GET', '/api/v1/health',
      { headers: { 'User-Agent': '' } });
    check('пустой User-Agent не проходит (400/200)', res.status === 400 || res.status === 200,
      'фактический код ' + res.status);

    res = await request(httpsPort, 'POST', '/api/v1/health', { token: adminToken });
    eq('POST /health → 405', res.status, 405);

    res = await request(httpsPort, 'POST', '/api/v1/items',
      { token: adminToken, headers: { 'Content-Type': 'text/plain' }, body: { name: 'x' } });
    eq('неверный Content-Type → 400', res.status, 400);

    res = await request(httpsPort, 'GET', '/api/v1/items', {
      token: adminToken,
      headers: { Host: 'bad host!' },
    });
    eq('некорректный Host → 400', res.status, 400);
    void savedUa;

    console.log('\n[5] CRUD и валидация');
    res = await request(httpsPort, 'POST', '/api/v1/items', {
      token: adminToken,
      body: { name: '', quantity: -1, location: '', condition: 'bad' },
    });
    eq('невалидный предмет → 400', res.status, 400);
    eq('ошибка validation_error', res.json && res.json.error, 'validation_error');
    check('валидация: несколько details',
      !!(res.json && res.json.details && res.json.details.length >= 2));

    res = await request(httpsPort, 'POST', '/api/v1/items', {
      token: adminToken,
      body: { name: 'Тестовый перфоратор', quantity: 2, location: 'Склад тестов', condition: 'good' },
    });
    eq('создание → 201', res.status, 201);
    const created = res.json;
    check('создан: id есть', !!(created && created.id));
    eq('создан: version 1', created && created.version, 1);
    eq('создан: name', created && created.name, 'Тестовый перфоратор');
    contains('создан: Location', res.headers.location, '/api/v1/items/' + (created && created.id));
    check('создан: ETag есть', !!res.headers.etag);

    res = await request(httpsPort, 'GET', '/api/v1/items/' + created.id, { token: adminToken });
    eq('чтение созданного → 200', res.status, 200);
    eq('чтение: quantity 2', res.json && res.json.quantity, 2);

    res = await request(httpsPort, 'GET', '/api/v1/items/' + created.id, {
      token: adminToken,
      headers: { 'If-None-Match': res.headers.etag },
    });
    eq('чтение с If-None-Match → 304', res.status, 304);

    res = await request(httpsPort, 'PATCH', '/api/v1/items/' + created.id,
      { token: adminToken, body: { quantity: 7 } });
    eq('PATCH → 200', res.status, 200);
    eq('PATCH: quantity 7', res.json && res.json.quantity, 7);
    eq('PATCH: version 2', res.json && res.json.version, 2);

    res = await request(httpsPort, 'PUT', '/api/v1/items/' + created.id, {
      token: adminToken,
      body: { name: 'Тестовый перфоратор', quantity: 8, location: 'Склад тестов', condition: 'used' },
    });
    eq('PUT → 200', res.status, 200);
    eq('PUT: version 3', res.json && res.json.version, 3);
    eq('PUT: condition used', res.json && res.json.condition, 'used');

    res = await request(httpsPort, 'GET', '/api/v1/items', { token: adminToken });
    check('список изменился: ETag другой', res.headers.etag !== listEtag);

    res = await request(httpsPort, 'PATCH', '/api/v1/items/00000000-0000-0000-0000-000000000000',
      { token: adminToken, body: { quantity: 1 } });
    eq('PATCH несуществующего → 404', res.status, 404);

    res = await request(httpsPort, 'DELETE', '/api/v1/items/' + created.id, { token: adminToken });
    eq('DELETE admin → 204', res.status, 204);
    eq('DELETE: пустое тело', res.raw, '');

    res = await request(httpsPort, 'GET', '/api/v1/items/' + created.id, { token: adminToken });
    eq('удалённый → 404', res.status, 404);

    res = await request(httpsPort, 'DELETE', '/api/v1/items/' + created.id, { token: adminToken });
    eq('повторное удаление → 404', res.status, 404);

    console.log('\n[6] Роли user и viewer');
    res = await request(httpsPort, 'POST', '/api/v1/auth/login',
      { body: { username: 'user', password: 'user123' } });
    const userToken = res.json && res.json.token;
    eq('вход user → 200', res.status, 200);
    eq('роль user', res.json && res.json.user.role, 'user');

    res = await request(httpsPort, 'POST', '/api/v1/items', {
      token: userToken,
      body: { name: 'Предмет пользователя', quantity: 1, location: 'Склад', condition: 'new' },
    });
    eq('user создаёт → 201', res.status, 201);
    const userItem = res.json;

    res = await request(httpsPort, 'DELETE', '/api/v1/items/' + userItem.id, { token: userToken });
    eq('user удаляет → 403', res.status, 403);
    eq('403: forbidden', res.json && res.json.error, 'forbidden');

    res = await request(httpsPort, 'PATCH', '/api/v1/items/' + userItem.id,
      { token: userToken, body: { quantity: 4 } });
    eq('user изменяет → 200', res.status, 200);

    res = await request(httpsPort, 'POST', '/api/v1/auth/login',
      { body: { username: 'viewer', password: 'viewer123' } });
    const viewerToken = res.json && res.json.token;
    eq('вход viewer → 200', res.status, 200);
    eq('роль viewer', res.json && res.json.user.role, 'viewer');

    res = await request(httpsPort, 'GET', '/api/v1/items', { token: viewerToken });
    eq('viewer читает → 200', res.status, 200);

    res = await request(httpsPort, 'POST', '/api/v1/items',
      { token: viewerToken, body: { name: 'Нельзя', quantity: 1, location: 'X', condition: 'new' } });
    eq('viewer создаёт → 403', res.status, 403);

    res = await request(httpsPort, 'PUT', '/api/v1/items/' + userItem.id,
      { token: viewerToken, body: { name: 'Нельзя', quantity: 1, location: 'X', condition: 'new' } });
    eq('viewer изменяет → 403', res.status, 403);

    res = await request(httpsPort, 'DELETE', '/api/v1/items/' + userItem.id, { token: viewerToken });
    eq('viewer удаляет → 403', res.status, 403);

    res = await request(httpsPort, 'DELETE', '/api/v1/items/' + userItem.id, { token: adminToken });
    eq('admin удаляет предмет user → 204', res.status, 204);

    console.log('\n[7] Отладка, неизвестные маршруты, выход');
    res = await request(httpsPort, 'GET', '/api/v1/debug/error', { token: adminToken });
    eq('debug/error → 500', res.status, 500);
    eq('debug/error: internal_error', res.json && res.json.error, 'internal_error');

    res = await request(httpsPort, 'GET', '/api/v1/debug/demo-result?ok=1&passed=14&total=14');
    eq('debug/demo-result → 200', res.status, 200);
    eq('debug/demo-result: ok', res.json && res.json.ok, true);
    eq('debug/demo-result: passed', res.json && res.json.passed, 14);
    eq('debug/demo-result: total', res.json && res.json.total, 14);
    eq('debug/demo-result: no-store', res.headers['cache-control'], 'no-store');

    res = await request(httpsPort, 'POST', '/api/v1/debug/demo-result');
    eq('debug/demo-result POST → 405', res.status, 405);

    res = await request(httpsPort, 'GET', '/api/v1/unknown', { token: adminToken });
    eq('неизвестный маршрут → 404', res.status, 404);

    res = await request(httpsPort, 'POST', '/api/v1/auth/logout', { token: adminToken });
    eq('logout → 204', res.status, 204);
    contains('logout: cookie сброшена', res.headers['set-cookie'] ? res.headers['set-cookie'][0] : '', 'Max-Age=0');

    res = await request(httpsPort, 'POST', '/api/v1/auth/login', { body: {} });
    eq('пустые учётные данные → 400', res.status, 400);
  } finally {
    await stopServer(server.child);
    if (process.env.LAB02_TEST_KEEP_DATA !== '1') {
      await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    } else {
      console.log('Данные теста сохранены в %s', tempDir);
    }
    if (failures.length && server.log.err) {
      console.log('\nstderr сервера:\n%s', server.log.err);
    }
  }

  console.log('\nИтого: %d проверок, %d ошибок.', passed, failures.length);
  if (failures.length) {
    for (const failure of failures) {
      console.log('  - %s%s', failure.name, failure.detail ? ' — ' + failure.detail : '');
    }
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('Тесты не запустились: %s', e.stack || e.message);
  process.exitCode = 1;
});
```


## Приложение Б. Полный исходный код приложения Аврора

Приведены полные тексты файлов реализации и сборки без сокращений.

### Б.1 inventoryclient.cpp

Файл: `aurora-app/src/inventoryclient.cpp`.

```
#include "inventoryclient.h"

#include <QBuffer>
#include <QDateTime>
#include <QDebug>
#include <QDir>
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonValue>
#include <QNetworkAccessManager>
#include <QNetworkCookie>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QSslError>
#include <QSslCertificate>
#include <QSslSocket>
#include <QStandardPaths>
#include <QTimer>
#include <QUrl>
#include <QUuid>
#include <QVariant>

static QString errorMessage(int status, const QJsonValue &json);

// ---------------------------------------------------------------------------
// PersistentCookieJar
// ---------------------------------------------------------------------------

PersistentCookieJar::PersistentCookieJar(QSettings *settings, QObject *parent)
    : QNetworkCookieJar(parent)
    , m_settings(settings)
{
}

bool PersistentCookieJar::setCookiesFromUrl(const QList<QNetworkCookie> &cookieList, const QUrl &url)
{
    const bool changed = QNetworkCookieJar::setCookiesFromUrl(cookieList, url);
    if (changed) save();
    return changed;
}

void PersistentCookieJar::load(const QUrl &url)
{
    if (!m_settings) return;
    const QStringList rawList = m_settings->value(QStringLiteral("cookies/list")).toStringList();
    QList<QNetworkCookie> cookies;
    for (const QString &raw : rawList) {
        const QList<QNetworkCookie> parsed = QNetworkCookie::parseCookies(raw.toLatin1());
        cookies.append(parsed);
    }
    if (!cookies.isEmpty() && url.isValid()) {
        QNetworkCookieJar::setCookiesFromUrl(cookies, url);
        qInfo() << "Cookie: восстановлено" << cookies.size() << "из QSettings";
    }
}

void PersistentCookieJar::clear()
{
    setAllCookies(QList<QNetworkCookie>());
    if (m_settings) {
        m_settings->remove(QStringLiteral("cookies/list"));
        m_settings->sync();
    }
}

void PersistentCookieJar::save()
{
    if (!m_settings) return;
    QStringList rawList;
    for (const QNetworkCookie &cookie : allCookies()) {
        rawList.append(QString::fromLatin1(cookie.toRawForm()));
    }
    m_settings->setValue(QStringLiteral("cookies/list"), rawList);
    m_settings->sync();
}

// ---------------------------------------------------------------------------
// InventoryClient
// ---------------------------------------------------------------------------

InventoryClient::InventoryClient(QObject *parent)
    : QObject(parent)
    , m_nam(nullptr)
    , m_jar(nullptr)
{
    QString cacheError;
    m_cache.open(&cacheError);

    m_nam = new QNetworkAccessManager(this);
    m_jar = new PersistentCookieJar(&m_settings);
    m_nam->setCookieJar(m_jar);

    QFile caFile(QStringLiteral(":/certs/ca.crt"));
    QList<QSslCertificate> authorities;
    if (caFile.open(QIODevice::ReadOnly)) {
        authorities = QSslCertificate::fromData(caFile.readAll(), QSsl::Pem);
    }
    // Только CA этого сервера: системные CA здесь намеренно не используются.
    // Это позволяет безопасно разрешить смену IP без доверия чужим серверам.
    m_tls = QSslConfiguration::defaultConfiguration();
    m_tls.setCaCertificates(authorities);
    m_tls.setPeerVerifyMode(QSslSocket::VerifyPeer);
    if (authorities.isEmpty()) qCritical() << "TLS: встроенный CA не загружен";

    loadSettings();
    m_jar->load(QUrl(m_baseUrl));
    loadCacheToModel();

    if (!cacheError.isEmpty()) {
        setStatus(QStringLiteral("SQLite-кэш недоступен: ") + cacheError, true);
    } else if (m_token.isEmpty()) {
        setStatus(QStringLiteral("Войдите, чтобы загрузить инвентарь."));
    } else {
        setStatus(QStringLiteral("Сессия сохранена: %1 (%2). Нажмите «Обновить».")
                  .arg(m_username, m_role));
    }
}

InventoryClient::~InventoryClient()
{
}

ItemModel *InventoryClient::model()
{
    return &m_model;
}

QString InventoryClient::baseUrl() const { return m_baseUrl; }

void InventoryClient::setBaseUrl(const QString &url)
{
    QString normalized = url.trimmed();
    while (normalized.endsWith(QLatin1Char('/'))) normalized.chop(1);
    if (normalized.isEmpty()) normalized = QStringLiteral("https://10.0.2.2:8443");
    if (normalized == m_baseUrl) return;
    m_baseUrl = normalized;
    m_settings.setValue(QStringLiteral("server/url"), m_baseUrl);
    m_settings.sync();
    m_jar->load(QUrl(m_baseUrl));
    emit settingsChanged();
    if (!m_token.isEmpty()) refresh();
}

QString InventoryClient::username() const { return m_username; }
QString InventoryClient::role() const { return m_role; }
bool InventoryClient::loggedIn() const { return !m_token.isEmpty(); }
bool InventoryClient::busy() const { return m_inflight > 0 || m_updating; }
bool InventoryClient::online() const { return m_online; }
bool InventoryClient::simulateOffline() const { return m_simulateOffline; }
int InventoryClient::pendingCount() const { return m_cache.pendingCount(); }
QString InventoryClient::statusMessage() const { return m_status; }
bool InventoryClient::statusIsError() const { return m_statusError; }
QString InventoryClient::demoSummary() const { return m_demoSummary; }
QString InventoryClient::cachePath() const { return m_cache.path(); }

void InventoryClient::loadSettings()
{
    m_baseUrl = m_settings.value(QStringLiteral("server/url"),
                                 QStringLiteral("https://10.0.2.2:8443")).toString();
    m_token = m_settings.value(QStringLiteral("auth/token")).toString();
    m_username = m_settings.value(QStringLiteral("auth/username")).toString();
    m_role = m_settings.value(QStringLiteral("auth/role")).toString();
}

void InventoryClient::saveAuth()
{
    m_settings.setValue(QStringLiteral("auth/token"), m_token);
    m_settings.setValue(QStringLiteral("auth/username"), m_username);
    m_settings.setValue(QStringLiteral("auth/role"), m_role);
    m_settings.setValue(QStringLiteral("server/url"), m_baseUrl);
    m_settings.sync();
}

void InventoryClient::loadCacheToModel()
{
    m_model.setItems(m_cache.all());
    emit pendingChanged();
}

void InventoryClient::setStatus(const QString &message, bool error)
{
    m_status = message;
    m_statusError = error;
    emit statusChanged();
    if (error) qWarning().noquote() << message;
    else qInfo().noquote() << message;
}

void InventoryClient::clearStatus()
{
    setStatus(QString());
}

void InventoryClient::setOnline(bool online)
{
    if (m_online == online) return;
    m_online = online;
    emit onlineChanged();
}

void InventoryClient::setBusy(int delta)
{
    const bool wasBusy = busy();
    m_inflight += delta;
    if (m_inflight < 0) m_inflight = 0;
    if (wasBusy != busy()) emit busyChanged();
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

void InventoryClient::request(const QByteArray &method, const QString &path,
                              const QJsonObject &body, ReplyHandler handler,
                              const QString &tokenOverride)
{
    QUrl url(m_baseUrl + path);
    QNetworkRequest request(url);
    request.setSslConfiguration(m_tls);
    request.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    request.setRawHeader("Accept", "application/json");
    request.setRawHeader("User-Agent", "aurora-inventory/1.0 (Qt 5.6)");

    const QString token = tokenOverride.isNull() ? m_token : tokenOverride;
    if (!token.isEmpty()) {
        request.setRawHeader("Authorization", "Bearer " + token.toUtf8());
    }

    const QByteArray payload = body.isEmpty()
            ? QByteArray()
            : QJsonDocument(body).toJson(QJsonDocument::Compact);

    QNetworkReply *reply = nullptr;
    if (method == "GET") reply = m_nam->get(request);
    else if (method == "POST") reply = m_nam->post(request, payload);
    else if (method == "PUT") reply = m_nam->put(request, payload);
    else if (method == "PATCH") {
        QBuffer *buffer = new QBuffer;
        buffer->setData(payload);
        buffer->open(QIODevice::ReadOnly);
        reply = m_nam->sendCustomRequest(request, "PATCH", buffer);
        connect(reply, &QNetworkReply::finished, buffer, &QObject::deleteLater);
    }
    else if (method == "DELETE") reply = m_nam->deleteResource(request);
    else {
        if (handler) handler(0, QJsonValue(), QByteArray("неизвестный метод"));
        return;
    }

    setBusy(1);

    QTimer *timer = new QTimer(reply);
    timer->setSingleShot(true);
    connect(timer, &QTimer::timeout, reply, &QNetworkReply::abort);
    timer->start(8000);

    connect(reply, &QNetworkReply::sslErrors, this,
            [reply](const QList<QSslError> &errors) {
        // Адрес сервера может меняться. Цепочку проверяем только через наш CA,
        // а несовпадение имени допускаем; остальные TLS-ошибки остаются fatal.
        QList<QSslError> addressErrors;
        for (const QSslError &error : errors) {
            qWarning() << "TLS:" << error.errorString();
            if (error.error() == QSslError::HostNameMismatch) {
                addressErrors.append(error);
            }
        }
        if (!addressErrors.isEmpty()) reply->ignoreSslErrors(addressErrors);
    });

    connect(reply, &QNetworkReply::finished, this, [this, reply, timer, handler]() {
        timer->stop();
        const int status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QByteArray raw = reply->readAll();
        const QJsonDocument document = QJsonDocument::fromJson(raw);
        QJsonValue value;
        if (document.isObject()) value = QJsonValue(document.object());
        else if (document.isArray()) value = QJsonValue(document.array());

        setBusy(-1);
        if (status > 0) {
            setOnline(true);
            if (handler) handler(status, value, raw);
        } else {
            setOnline(false);
            if (handler) handler(0, QJsonValue(), reply->errorString().toUtf8());
        }
        reply->deleteLater();
    });
}

// ---------------------------------------------------------------------------
// Аутентификация
// ---------------------------------------------------------------------------

void InventoryClient::login(const QString &username, const QString &password)
{
    loginWith(username, password, [this](bool ok) {
        if (ok) doRefresh(nullptr);
    });
}

void InventoryClient::loginWith(const QString &username, const QString &password,
                                std::function<void (bool)> done)
{
    QJsonObject body;
    body.insert(QStringLiteral("username"), username);
    body.insert(QStringLiteral("password"), password);
    setStatus(QStringLiteral("Вход: %1...").arg(username));

    request("POST", QStringLiteral("/api/v1/auth/login"), body,
            [this, done](int status, const QJsonValue &json, const QByteArray &raw) {
        if (status == 200) {
            const QJsonObject object = json.toObject();
            m_token = object.value(QStringLiteral("token")).toString();
            const QJsonObject user = object.value(QStringLiteral("user")).toObject();
            m_username = user.value(QStringLiteral("username")).toString();
            m_role = user.value(QStringLiteral("role")).toString();
            saveAuth();
            m_jar->save();
            emit authChanged();
            setStatus(QStringLiteral("Вход выполнен: %1 (%2)").arg(m_username, m_role));
            if (done) done(true);
        } else if (status == 0) {
            setStatus(QStringLiteral("Сеть недоступна: ") + QString::fromUtf8(raw), true);
            if (done) done(false);
        } else {
            QString message = QString::fromUtf8(raw);
            const QJsonObject object = json.toObject();
            if (object.contains(QStringLiteral("message")))
                message = object.value(QStringLiteral("message")).toString();
            setStatus(QStringLiteral("Вход не выполнен (") + QString::number(status) + "): " + message, true);
            if (done) done(false);
        }
    });
}

void InventoryClient::logout()
{
    if (!m_token.isEmpty()) {
        request("POST", QStringLiteral("/api/v1/auth/logout"), QJsonObject(), ReplyHandler());
    }
    m_token.clear();
    m_username.clear();
    m_role.clear();
    m_jar->clear();
    m_jar->save();
    saveAuth();
    emit authChanged();
    loadCacheToModel();
    setStatus(QStringLiteral("Выполнен выход, показан локальный кэш."));
}

// ---------------------------------------------------------------------------
// Чтение и кэш
// ---------------------------------------------------------------------------

void InventoryClient::setSimulateOffline(bool offline)
{
    if (m_simulateOffline == offline) return;
    m_simulateOffline = offline;
    emit onlineChanged();
    if (offline) {
        loadCacheToModel();
        setStatus(QStringLiteral("Офлайн-режим включён: показан кэш (%1).").arg(m_model.count()));
    } else {
        setStatus(QStringLiteral("Офлайн-режим выключен: можно синхронизировать очередь."));
    }
}

void InventoryClient::refresh()
{
    if (busy()) return;
    if (m_simulateOffline) {
        loadCacheOnly();
        setStatus(QStringLiteral("Офлайн-режим включён: показан кэш (%1).").arg(m_model.count()));
        return;
    }
    if (!loggedIn()) {
        setStatus(QStringLiteral("Сначала войдите в систему."), true);
        return;
    }
    m_updating = true;
    emit busyChanged();
    // Сначала отправляем очередь, затем читаем итоговое состояние сервера.
    syncAll([this](int, int failed) {
        doRefresh([this, failed](bool ok) {
            m_updating = false;
            emit busyChanged();
            if (m_cache.pendingCount() > 0) {
                setStatus(QStringLiteral("Не все изменения отправлены. В очереди: %1; "
                                         "локальные данные сохранены.").arg(m_cache.pendingCount()), true);
            } else if (failed > 0 && ok) {
                setStatus(QStringLiteral("Список обновлён; ошибок синхронизации: %1.")
                          .arg(failed), true);
            }
        });
    });
}

void InventoryClient::loadCacheOnly()
{
    loadCacheToModel();
    setStatus(QStringLiteral("Локальный кэш: %1 предметов, в очереди %2.")
              .arg(m_model.count()).arg(m_cache.pendingCount()));
}

void InventoryClient::doRefresh(std::function<void (bool)> done)
{
    request("GET", QStringLiteral("/api/v1/items"), QJsonObject(),
            [this, done](int status, const QJsonValue &json, const QByteArray &) {
        if (status == 200) {
            QVector<ItemRecord> items;
            const QJsonArray array = json.toObject().value(QStringLiteral("items")).toArray();
            for (const QJsonValue &value : array) items.append(parseItem(value.toObject()));
            // Если сервер отклонил операцию или сеть пропала при синхронизации,
            // серверный снимок не должен затереть оставшиеся локальные правки.
            const QVector<ItemRecord> cached = m_cache.all();
            const QVector<LocalCache::PendingOp> pending = m_cache.pendingOps();
            for (const LocalCache::PendingOp &op : pending) {
                for (int i = items.size() - 1; i >= 0; --i) {
                    if (items.at(i).id == op.itemId) items.remove(i);
                }
                if (op.method != QLatin1String("DELETE")) {
                    for (const ItemRecord &item : cached) {
                        if (item.id == op.itemId) { items.append(item); break; }
                    }
                }
            }
            m_model.setItems(items);
            m_cache.replaceAll(items);
            emit pendingChanged();
            setStatus(QStringLiteral("Обновлено: %1 предметов с сервера.").arg(items.size()));
            if (done) done(true);
        } else if (status == 401) {
            setStatus(QStringLiteral("Сервер требует вход (401)."), true);
            if (done) done(false);
        } else if (status == 0) {
            loadCacheToModel();
            setStatus(QStringLiteral("Сеть недоступна: показан кэш (%1).")
                      .arg(m_model.count()), true);
            if (done) done(false);
        } else {
            setStatus(QStringLiteral("Ошибка чтения (") + QString::number(status) + "): " +
                      errorMessage(status, json), true);
            if (done) done(false);
        }
    });
}

// ---------------------------------------------------------------------------
// CRUD с офлайн-очередью
// ---------------------------------------------------------------------------

void InventoryClient::createItem(const QString &name, int quantity,
                                 const QString &location, const QString &condition)
{
    doCreate(fieldsFrom(name, quantity, location, condition),
             [](bool, const ItemRecord &, const QString &) {});
}

void InventoryClient::updateItem(const QString &id, const QString &name, int quantity,
                                 const QString &location, const QString &condition)
{
    doUpdate(id, fieldsFrom(name, quantity, location, condition), ItemHandler());
}

void InventoryClient::deleteItem(const QString &id)
{
    doDelete(id, DeleteHandler());
}

QJsonObject InventoryClient::fieldsFrom(const QString &name, int quantity,
                                        const QString &location, const QString &condition)
{
    QJsonObject fields;
    fields.insert(QStringLiteral("name"), name.trimmed());
    fields.insert(QStringLiteral("quantity"), quantity);
    fields.insert(QStringLiteral("location"), location.trimmed());
    fields.insert(QStringLiteral("condition"), condition);
    return fields;
}

void InventoryClient::doCreate(const QJsonObject &fields, ItemHandler done)
{
    if (m_simulateOffline) {
        applyLocalCreate(fields, done);
        return;
    }
    request("POST", QStringLiteral("/api/v1/items"), fields,
            [this, fields, done](int status, const QJsonValue &json, const QByteArray &) {
        if (status == 201) {
            const ItemRecord item = parseItem(json.toObject());
            m_cache.upsert(item);
            m_model.upsert(item);
            setStatus(QStringLiteral("Создан предмет: %1").arg(item.name));
            if (done) done(true, item, QStringLiteral("online"));
        } else if (status == 0) {
            applyLocalCreate(fields, done);
        } else {
            const QString note = QStringLiteral("код %1: %2")
                    .arg(status).arg(errorMessage(status, json));
            setStatus(QStringLiteral("Создание не выполнено: ") + note, true);
            if (done) done(false, ItemRecord(), note);
        }
    });
}

void InventoryClient::applyLocalCreate(const QJsonObject &fields, ItemHandler done)
{
    ItemRecord item;
    item.id = QStringLiteral("local-") +
            QUuid::createUuid().toString().remove(QLatin1Char('{')).remove(QLatin1Char('}'));
    item.name = fields.value(QStringLiteral("name")).toString();
    item.quantity = fields.value(QStringLiteral("quantity")).toInt();
    item.location = fields.value(QStringLiteral("location")).toString();
    item.condition = fields.value(QStringLiteral("condition")).toString();
    item.version = 0;
    item.updatedAt = QDateTime::currentDateTimeUtc().toString(Qt::ISODate);

    m_cache.upsert(item);
    m_model.upsert(item);
    m_cache.enqueue(QStringLiteral("CREATE"), item.id, fields);
    emit pendingChanged();
    setStatus(QStringLiteral("Офлайн: «%1» создан локально и поставлен в очередь.")
              .arg(item.name));
    if (done) done(true, item, QStringLiteral("offline-queue"));
}

void InventoryClient::doUpdate(const QString &id, const QJsonObject &fields, ItemHandler done)
{
    if (m_simulateOffline) {
        applyLocalUpdate(id, fields, done);
        return;
    }
    request("PUT", QStringLiteral("/api/v1/items/") + id, fields,
            [this, id, fields, done](int status, const QJsonValue &json, const QByteArray &raw) {
        Q_UNUSED(raw);
        if (status == 200) {
            const ItemRecord item = parseItem(json.toObject());
            m_cache.upsert(item);
            m_model.upsert(item);
            setStatus(QStringLiteral("Сохранено: %1").arg(item.name));
            if (done) done(true, item, QStringLiteral("online"));
        } else if (status == 0) {
            applyLocalUpdate(id, fields, done);
        } else if (status == 404) {
            m_cache.remove(id);
            m_model.removeById(id);
            setStatus(QStringLiteral("Предмет не найден на сервере (404)."), true);
            if (done) done(false, ItemRecord(), QStringLiteral("404"));
        } else {
            const QString note = QStringLiteral("код %1: %2")
                    .arg(status).arg(errorMessage(status, json));
            setStatus(QStringLiteral("Изменение не выполнено: ") + note, true);
            if (done) done(false, ItemRecord(), note);
        }
    });
}

void InventoryClient::applyLocalUpdate(const QString &id, const QJsonObject &fields, ItemHandler done)
{
    ItemRecord item = m_cache.find(id);
    if (item.id.isEmpty()) {
        setStatus(QStringLiteral("Нет предмета в кэше для изменения."), true);
        if (done) done(false, ItemRecord(), QStringLiteral("not-in-cache"));
        return;
    }
    item.name = fields.value(QStringLiteral("name")).toString();
    item.quantity = fields.value(QStringLiteral("quantity")).toInt();
    item.location = fields.value(QStringLiteral("location")).toString();
    item.condition = fields.value(QStringLiteral("condition")).toString();
    item.version += 1;
    item.updatedAt = QDateTime::currentDateTimeUtc().toString(Qt::ISODate);
    m_cache.upsert(item);
    m_model.upsert(item);

    LocalCache::PendingOp last;
    if (m_cache.lastPendingForItem(id, &last) &&
            (last.method == QLatin1String("CREATE") || last.method == QLatin1String("UPDATE"))) {
        m_cache.updatePendingPayload(last.id, fields);
    } else {
        m_cache.enqueue(QStringLiteral("UPDATE"), id, fields);
    }
    emit pendingChanged();
    setStatus(QStringLiteral("Офлайн: изменение «%1» в очереди.").arg(item.name));
    if (done) done(true, item, QStringLiteral("offline-queue"));
}

void InventoryClient::doDelete(const QString &id, DeleteHandler done)
{
    if (m_simulateOffline) {
        applyLocalDelete(id, done);
        return;
    }
    request("DELETE", QStringLiteral("/api/v1/items/") + id, QJsonObject(),
            [this, id, done](int status, const QJsonValue &json, const QByteArray &raw) {
        Q_UNUSED(json);
        Q_UNUSED(raw);
        if (status == 204 || status == 404) {
            m_cache.remove(id);
            m_model.removeById(id);
            setStatus(QStringLiteral("Предмет удалён."));
            if (done) done(true, QStringLiteral("online"));
        } else if (status == 0) {
            applyLocalDelete(id, done);
        } else {
            setStatus(QStringLiteral("Удаление не выполнено: код ") + QString::number(status), true);
            if (done) done(false, QStringLiteral("код ") + QString::number(status));
        }
    });
}

void InventoryClient::applyLocalDelete(const QString &id, DeleteHandler done)
{
    const bool local = id.startsWith(QStringLiteral("local-"));
    m_cache.remove(id);
    m_model.removeById(id);
    m_cache.removePendingForItem(id);
    if (!local) {
        m_cache.enqueue(QStringLiteral("DELETE"), id, QJsonObject());
    }
    emit pendingChanged();
    setStatus(local ? QStringLiteral("Офлайн: локальный предмет убран.")
                    : QStringLiteral("Офлайн: удаление поставлено в очередь."));
    if (done) done(true, QStringLiteral("offline-queue"));
}

// ---------------------------------------------------------------------------
// Синхронизация очереди
// ---------------------------------------------------------------------------

void InventoryClient::syncAll(std::function<void (int, int)> done)
{
    if (m_simulateOffline) {
        setStatus(QStringLiteral("Синхронизация невозможна: включён офлайн-режим."), true);
        if (done) done(0, 0);
        return;
    }
    if (!loggedIn()) {
        setStatus(QStringLiteral("Синхронизация: сначала войдите."), true);
        if (done) done(0, 0);
        return;
    }
    const QVector<LocalCache::PendingOp> ops = m_cache.pendingOps();
    if (ops.isEmpty()) {
        setStatus(QStringLiteral("Очередь пуста, синхронизировать нечего."));
        if (done) done(0, 0);
        return;
    }
    m_syncRemap.clear();
    setStatus(QStringLiteral("Синхронизация: %1 операций...").arg(ops.size()));
    syncStep(ops, 0, 0, 0, done);
}

void InventoryClient::syncStep(const QVector<LocalCache::PendingOp> &ops, int index,
                               int ok, int fail, std::function<void (int, int)> done)
{
    if (index >= ops.size()) {
        setStatus(QStringLiteral("Синхронизация завершена: %1 ок, %2 ошибок.").arg(ok).arg(fail),
                  fail > 0);
        emit pendingChanged();
        if (done) done(ok, fail);
        return;
    }

    const LocalCache::PendingOp op = ops.at(index);
    const QString id = m_syncRemap.value(op.itemId, op.itemId);

    std::function<void (int, int)> next = [this, ops, index, ok, fail, done](int addOk, int addFail) {
        QTimer::singleShot(60, this, [this, ops, index, ok, fail, done, addOk, addFail]() {
            syncStep(ops, index + 1, ok + addOk, fail + addFail, done);
        });
    };
    std::function<void (const QString &)> stop = [this, ok, fail, done](const QString &message) {
        setOnline(false);
        setStatus(QStringLiteral("Синхронизация остановлена: ") + message, true);
        emit pendingChanged();
        if (done) done(ok, fail);
    };

    if (op.method == QLatin1String("CREATE")) {
        request("POST", QStringLiteral("/api/v1/items"), op.payload,
                [this, op, next, stop](int status, const QJsonValue &json, const QByteArray &raw) {
            Q_UNUSED(raw);
            if (status == 201) {
                const ItemRecord item = parseItem(json.toObject());
                m_syncRemap.insert(op.itemId, item.id);
                m_cache.remapItemId(op.itemId, item.id);
                m_cache.removePending(op.id);
                m_cache.upsert(item);
                m_model.removeById(op.itemId);
                m_model.upsert(item);
                emit pendingChanged();
                next(1, 0);
            } else if (status == 0) {
                stop(QStringLiteral("сеть недоступна"));
            } else {
                stop(QStringLiteral("код %1: %2").arg(status).arg(errorMessage(status, json)));
            }
        });
        return;
    }

    if (op.method == QLatin1String("UPDATE")) {
        request("PUT", QStringLiteral("/api/v1/items/") + id, op.payload,
                [this, op, id, next, stop](int status, const QJsonValue &json, const QByteArray &raw) {
            Q_UNUSED(raw);
            if (status == 200) {
                const ItemRecord item = parseItem(json.toObject());
                m_cache.removePending(op.id);
                m_cache.upsert(item);
                m_model.upsert(item);
                emit pendingChanged();
                next(1, 0);
            } else if (status == 404) {
                m_cache.removePending(op.id);
                m_cache.remove(id);
                m_model.removeById(id);
                emit pendingChanged();
                next(0, 1);
            } else if (status == 0) {
                stop(QStringLiteral("сеть недоступна"));
            } else {
                stop(QStringLiteral("код %1: %2").arg(status).arg(errorMessage(status, json)));
            }
        });
        return;
    }

    if (op.method == QLatin1String("DELETE")) {
        request("DELETE", QStringLiteral("/api/v1/items/") + id, QJsonObject(),
                [this, op, id, next, stop](int status, const QJsonValue &, const QByteArray &) {
            if (status == 204 || status == 404) {
                m_cache.removePending(op.id);
                m_cache.remove(id);
                m_model.removeById(id);
                emit pendingChanged();
                next(1, 0);
            } else if (status == 0) {
                stop(QStringLiteral("сеть недоступна"));
            } else {
                stop(QStringLiteral("код %1: операция удаления сохранена в очереди").arg(status));
            }
        });
        return;
    }

    // Неизвестная операция — пропускаем.
    m_cache.removePending(op.id);
    next(0, 1);
}

// ---------------------------------------------------------------------------
// Вспомогательные
// ---------------------------------------------------------------------------

ItemRecord InventoryClient::parseItem(const QJsonObject &object)
{
    ItemRecord item;
    item.id = object.value(QStringLiteral("id")).toString();
    item.name = object.value(QStringLiteral("name")).toString();
    item.quantity = object.value(QStringLiteral("quantity")).toInt();
    item.location = object.value(QStringLiteral("location")).toString();
    item.condition = object.value(QStringLiteral("condition")).toString();
    item.version = object.value(QStringLiteral("version")).toInt();
    item.updatedAt = object.value(QStringLiteral("updatedAt")).toString();
    return item;
}

static QString errorMessage(int status, const QJsonValue &json)
{
    if (json.isObject()) {
        const QJsonObject object = json.toObject();
        if (object.contains(QStringLiteral("message")))
            return object.value(QStringLiteral("message")).toString();
        if (object.contains(QStringLiteral("error")))
            return object.value(QStringLiteral("error")).toString();
    }
    switch (status) {
    case 400: return QStringLiteral("некорректный запрос");
    case 401: return QStringLiteral("требуется аутентификация");
    case 403: return QStringLiteral("недостаточно прав");
    case 404: return QStringLiteral("не найдено");
    case 500: return QStringLiteral("внутренняя ошибка сервера");
    default: return QStringLiteral("ошибка");
    }
}

QString InventoryClient::itemJson(const QString &id) const
{
    const ItemRecord item = m_model.itemById(id);
    if (item.id.isEmpty()) return QString();
    QJsonObject object;
    object.insert(QStringLiteral("id"), item.id);
    object.insert(QStringLiteral("name"), item.name);
    object.insert(QStringLiteral("quantity"), item.quantity);
    object.insert(QStringLiteral("location"), item.location);
    object.insert(QStringLiteral("condition"), item.condition);
    object.insert(QStringLiteral("version"), item.version);
    return QString::fromUtf8(QJsonDocument(object).toJson(QJsonDocument::Compact));
}

// ---------------------------------------------------------------------------
// Демонстрация (--demo)
// ---------------------------------------------------------------------------

void InventoryClient::logDemo(const QString &line)
{
    if (!m_demoRunning) return;
    m_demoLog.append(line);
    qInfo().noquote() << line;
    QString dir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir().mkpath(dir);
    QFile file(dir + QStringLiteral("/demo.log"));
    if (file.open(QIODevice::Append | QIODevice::Text)) {
        file.write(line.toUtf8());
        file.write("\n");
    }
    emit demoLogChanged();
}

void InventoryClient::startDemo()
{
    if (m_demoRunning) return;
    m_demoRunning = true;
    m_demoLog.clear();
    m_demoOnlineId.clear();
    m_demoTempId.clear();
    m_demoTempRealId.clear();
    m_demoSummary.clear();

    QString dir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir().mkpath(dir);
    QFile file(dir + QStringLiteral("/demo.log"));
    if (file.open(QIODevice::WriteOnly | QIODevice::Truncate)) file.close();

    logDemo(QStringLiteral("=== Демо-сценарий Aurora Inventory (ЛР №2, вариант 7) ==="));
    logDemo(QStringLiteral("Сервер: ") + m_baseUrl);
    setStatus(QStringLiteral("Демо: вход admin..."));

    loginWith(QStringLiteral("admin"), QStringLiteral("admin123"), [this](bool ok) {
        logDemo(QStringLiteral("1. Вход admin: ") + (ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА")));
        if (!ok) {
            finishDemo(false);
            return;
        }
        QTimer::singleShot(350, this, [this]() {
            doRefresh([this](bool ok) {
                logDemo(QStringLiteral("2. Чтение списка: %1, предметов %2")
                        .arg(ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА"))
                        .arg(m_model.count()));
                QJsonObject fields = fieldsFrom(QStringLiteral("Демо-предмет (Аврора)"), 1,
                                                QStringLiteral("Стенд Аврора"),
                                                QStringLiteral("new"));
                setStatus(QStringLiteral("Демо: создание предмета..."));
                doCreate(fields, [this, fields](bool ok, const ItemRecord &item, const QString &note) {
                    m_demoOnlineId = item.id;
                    logDemo(QStringLiteral("3. Создание: %1 (id=%2, %3)")
                            .arg(ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА"), item.id, note));
                    QJsonObject updated = fields;
                    updated.insert(QStringLiteral("quantity"), 5);
                    updated.insert(QStringLiteral("condition"), QStringLiteral("good"));
                    doUpdate(m_demoOnlineId, updated,
                             [this](bool ok, const ItemRecord &item, const QString &note) {
                        logDemo(QStringLiteral("4. Обновление: %1, quantity=%2, %3")
                                .arg(ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА"))
                                .arg(item.quantity).arg(note));
                        setSimulateOffline(true);
                        logDemo(QStringLiteral("5. Включён офлайн-режим (сеть не используется)"));
                        doRefresh([this](bool) {
                            logDemo(QStringLiteral("6. Чтение из кэша: предметов %1")
                                    .arg(m_model.count()));
                            QJsonObject offline = fieldsFrom(QStringLiteral("Офлайн-предмет (Аврора)"),
                                                             2, QStringLiteral("Удалённый склад"),
                                                             QStringLiteral("used"));
                            doCreate(offline, [this, offline](bool ok, const ItemRecord &item,
                                                              const QString &note) {
                                m_demoTempId = item.id;
                                logDemo(QStringLiteral("7. Офлайн-создание: %1 (temp id=%2, %3)")
                                        .arg(ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА"),
                                             item.id, note));
                                QJsonObject changed = offline;
                                changed.insert(QStringLiteral("quantity"), 7);
                                changed.insert(QStringLiteral("condition"), QStringLiteral("good"));
                                doUpdate(item.id, changed,
                                         [this](bool ok, const ItemRecord &, const QString &note) {
                                    logDemo(QStringLiteral("8. Офлайн-изменение: %1, в очереди %2, %3")
                                            .arg(ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА"))
                                            .arg(m_cache.pendingCount()).arg(note));
                                    setSimulateOffline(false);
                                    logDemo(QStringLiteral("9. Сеть восстановлена, синхронизация..."));
                                    setStatus(QStringLiteral("Демо: синхронизация..."));
                                    syncAll([this](int synced, int failed) {
                                        m_demoTempRealId = m_syncRemap.value(m_demoTempId, m_demoTempId);
                                        logDemo(QStringLiteral("10. Синхронизация: %1 ок, %2 ошибок")
                                                .arg(synced).arg(failed));
                                        logDemo(QStringLiteral("11. Временный id %1 -> серверный %2")
                                                .arg(m_demoTempId, m_demoTempRealId));
                                        doRefresh([this](bool ok) {
                                            logDemo(QStringLiteral("12. Список после sync: %1, предметов %2")
                                                    .arg(ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА"))
                                                    .arg(m_model.count()));
                                            QJsonObject invalid;
                                            invalid.insert(QStringLiteral("name"), QString());
                                            invalid.insert(QStringLiteral("quantity"), -1);
                                            invalid.insert(QStringLiteral("location"), QString());
                                            invalid.insert(QStringLiteral("condition"), QStringLiteral("bad"));
                                            doCreate(invalid, [this](bool, const ItemRecord &,
                                                                     const QString &note) {
                                                logDemo(QStringLiteral("13. Ошибка валидации: ") + note);
                                                doDelete(QStringLiteral("00000000-0000-0000-0000-000000000000"),
                                                         [this](bool, const QString &note) {
                                                    logDemo(QStringLiteral("14. Удаление несуществующего: ")
                                                            + note);
                                                    QStringList ids;
                                                    if (!m_demoOnlineId.isEmpty()) ids.append(m_demoOnlineId);
                                                    if (!m_demoTempRealId.isEmpty() &&
                                                            m_demoTempRealId != m_demoOnlineId)
                                                        ids.append(m_demoTempRealId);
                                                    logDemo(QStringLiteral("15. Уборка демо-предметов: %1")
                                                            .arg(ids.size()));
                                                    demoDeleteNext(ids, 0);
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

void InventoryClient::demoDeleteNext(const QStringList &ids, int index)
{
    if (index >= ids.size()) {
        doRefresh([this](bool ok) {
            logDemo(QStringLiteral("16. Финальный список: %1, предметов %2")
                    .arg(ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА")).arg(m_model.count()));
            finishDemo(true);
        });
        return;
    }
    const QString id = ids.at(index);
    doDelete(id, [this, ids, index, id](bool ok, const QString &note) {
        logDemo(QStringLiteral("15.%1 Удаление %2: %3 (%4)")
                .arg(index + 1).arg(id, ok ? QStringLiteral("OK") : QStringLiteral("ОШИБКА"), note));
        QTimer::singleShot(150, this, [this, ids, index]() {
            demoDeleteNext(ids, index + 1);
        });
    });
}

QString InventoryClient::demoLogPath() const
{
    return QStandardPaths::writableLocation(QStandardPaths::AppDataLocation)
            + QStringLiteral("/demo.log");
}

QString InventoryClient::demoLog() const
{
    if (!m_demoLog.isEmpty()) return m_demoLog.join(QStringLiteral("\n"));
    QFile file(demoLogPath());
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) return QString();
    return QString::fromUtf8(file.readAll());
}

void InventoryClient::finishDemo(bool ok)
{
    m_demoSummary = QStringLiteral("Демо завершено: %1, шагов %2")
            .arg(ok ? QStringLiteral("успешно") : QStringLiteral("с ошибками"))
            .arg(m_demoLog.size());
    logDemo(m_demoSummary);
    setStatus(m_demoSummary, !ok);
    emit demoFinished();
    m_demoRunning = false;
}
```

### Б.2 inventoryclient.h

Файл: `aurora-app/src/inventoryclient.h`.

```
#ifndef INVENTORYCLIENT_H
#define INVENTORYCLIENT_H

#include "itemmodel.h"
#include "localcache.h"

#include <QHash>
#include <QJsonValue>
#include <QNetworkCookieJar>
#include <QObject>
#include <QSettings>
#include <QSslConfiguration>
#include <QString>
#include <QStringList>
#include <QUrl>

#include <functional>

class QNetworkAccessManager;
class QNetworkReply;
class QNetworkRequest;

/**
 * Cookie jar с сохранением в QSettings: cookie (включая HttpOnly token)
 * переживают перезапуск приложения.
 */
class PersistentCookieJar : public QNetworkCookieJar
{
public:
    explicit PersistentCookieJar(QSettings *settings, QObject *parent = nullptr);

    void load(const QUrl &url);
    void save();
    void clear();

protected:
    bool setCookiesFromUrl(const QList<QNetworkCookie> &cookieList, const QUrl &url) override;

private:
    QSettings *m_settings;
};

/**
 * Клиент REST API инвентаря для Аврора ОС.
 *
 * Умеет: асинхронные запросы (QNetworkAccessManager) с таймаутом, JWT и cookie
 * (QSettings + QNetworkCookieJar), JSON (QJsonDocument), SQLite-кэш и очередь
 * отложенных операций (QtSql), offline-режим и синхронизацию, демо-сценарий.
 */
class InventoryClient : public QObject
{
    Q_OBJECT
    Q_PROPERTY(ItemModel *model READ model CONSTANT)
    Q_PROPERTY(QString baseUrl READ baseUrl WRITE setBaseUrl NOTIFY settingsChanged)
    Q_PROPERTY(QString username READ username NOTIFY authChanged)
    Q_PROPERTY(QString role READ role NOTIFY authChanged)
    Q_PROPERTY(bool loggedIn READ loggedIn NOTIFY authChanged)
    Q_PROPERTY(bool busy READ busy NOTIFY busyChanged)
    Q_PROPERTY(bool online READ online NOTIFY onlineChanged)
    Q_PROPERTY(bool simulateOffline READ simulateOffline WRITE setSimulateOffline NOTIFY onlineChanged)
    Q_PROPERTY(int pendingCount READ pendingCount NOTIFY pendingChanged)
    Q_PROPERTY(QString statusMessage READ statusMessage NOTIFY statusChanged)
    Q_PROPERTY(bool statusIsError READ statusIsError NOTIFY statusChanged)
    Q_PROPERTY(QString demoSummary READ demoSummary NOTIFY demoFinished)
    Q_PROPERTY(QString cachePath READ cachePath CONSTANT)

public:
    explicit InventoryClient(QObject *parent = nullptr);
    ~InventoryClient() override;

    ItemModel *model();

    QString baseUrl() const;
    void setBaseUrl(const QString &url);
    QString username() const;
    QString role() const;
    bool loggedIn() const;
    bool busy() const;
    bool online() const;
    bool simulateOffline() const;
    int pendingCount() const;
    QString statusMessage() const;
    bool statusIsError() const;
    QString demoSummary() const;
    QString cachePath() const;
    QString demoLogPath() const;

    Q_INVOKABLE void login(const QString &username, const QString &password);
    Q_INVOKABLE void logout();
    Q_INVOKABLE void refresh();
    Q_INVOKABLE void loadCacheOnly();
    Q_INVOKABLE void createItem(const QString &name, int quantity,
                                const QString &location, const QString &condition);
    Q_INVOKABLE void updateItem(const QString &id, const QString &name, int quantity,
                                const QString &location, const QString &condition);
    Q_INVOKABLE void deleteItem(const QString &id);
    Q_INVOKABLE void setSimulateOffline(bool offline);
    Q_INVOKABLE void startDemo();
    Q_INVOKABLE QString itemJson(const QString &id) const;
    Q_INVOKABLE QString demoLog() const;
    Q_INVOKABLE void clearStatus();

signals:
    void authChanged();
    void onlineChanged();
    void busyChanged();
    void pendingChanged();
    void statusChanged();
    void settingsChanged();
    void demoFinished();
    void demoLogChanged();

private:
    typedef std::function<void(int status, const QJsonValue &json, const QByteArray &raw)> ReplyHandler;
    typedef std::function<void(bool ok, const ItemRecord &item, const QString &note)> ItemHandler;
    typedef std::function<void(bool ok, const QString &note)> DeleteHandler;

    void request(const QByteArray &method, const QString &path, const QJsonObject &body,
                 ReplyHandler handler, const QString &tokenOverride = QString());

    void loginWith(const QString &username, const QString &password, std::function<void(bool)> done);
    void doRefresh(std::function<void(bool)> done);
    void doCreate(const QJsonObject &fields, ItemHandler done);
    void doUpdate(const QString &id, const QJsonObject &fields, ItemHandler done);
    void doDelete(const QString &id, DeleteHandler done);

    void applyLocalCreate(const QJsonObject &fields, ItemHandler done);
    void applyLocalUpdate(const QString &id, const QJsonObject &fields, ItemHandler done);
    void applyLocalDelete(const QString &id, DeleteHandler done);

    void syncAll(std::function<void(int ok, int fail)> done);
    void syncStep(const QVector<LocalCache::PendingOp> &ops, int index, int ok, int fail,
                  std::function<void(int ok, int fail)> done);

    void loadSettings();
    void saveAuth();
    void loadCacheToModel();
    void setStatus(const QString &message, bool error = false);
    void setOnline(bool online);
    void setBusy(int delta);

    void logDemo(const QString &line);
    void finishDemo(bool ok);
    void demoDeleteNext(const QStringList &ids, int index);

    static ItemRecord parseItem(const QJsonObject &object);
    static QJsonObject fieldsFrom(const QString &name, int quantity,
                                  const QString &location, const QString &condition);

    QSettings m_settings;
    QSslConfiguration m_tls;
    QNetworkAccessManager *m_nam;
    PersistentCookieJar *m_jar;
    LocalCache m_cache;
    ItemModel m_model;

    QString m_baseUrl;
    QString m_token;
    QString m_username;
    QString m_role;
    bool m_online = false;
    bool m_simulateOffline = false;
    int m_inflight = 0;
    bool m_updating = false;
    QString m_status;
    bool m_statusError = false;
    QString m_demoSummary;

    QHash<QString, QString> m_syncRemap;
    bool m_demoRunning = false;
    QStringList m_demoLog;
    QString m_demoOnlineId;
    QString m_demoTempId;
    QString m_demoTempRealId;
};

#endif // INVENTORYCLIENT_H
```

### Б.3 itemmodel.cpp

Файл: `aurora-app/src/itemmodel.cpp`.

```
#include "itemmodel.h"

#include <QDebug>

QString conditionLabel(const QString &condition)
{
    if (condition == QLatin1String("new")) return QStringLiteral("новый");
    if (condition == QLatin1String("good")) return QStringLiteral("хорошее");
    if (condition == QLatin1String("used")) return QStringLiteral("б/у");
    if (condition == QLatin1String("broken")) return QStringLiteral("неисправен");
    return condition;
}

ItemModel::ItemModel(QObject *parent)
    : QAbstractListModel(parent)
{
}

int ItemModel::rowCount(const QModelIndex &parent) const
{
    if (parent.isValid()) return 0;
    return m_items.size();
}

QVariant ItemModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0 || index.row() >= m_items.size())
        return QVariant();

    const ItemRecord &item = m_items.at(index.row());
    switch (role) {
    case IdRole: return item.id;
    case NameRole: return item.name;
    case QuantityRole: return item.quantity;
    case LocationRole: return item.location;
    case ConditionRole: return item.condition;
    case ConditionLabelRole: return conditionLabel(item.condition);
    case VersionRole: return item.version;
    default: return QVariant();
    }
}

QHash<int, QByteArray> ItemModel::roleNames() const
{
    QHash<int, QByteArray> roles;
    roles.insert(IdRole, "itemId");
    roles.insert(NameRole, "name");
    roles.insert(QuantityRole, "quantity");
    roles.insert(LocationRole, "location");
    roles.insert(ConditionRole, "condition");
    roles.insert(ConditionLabelRole, "conditionLabel");
    roles.insert(VersionRole, "version");
    return roles;
}

void ItemModel::setItems(const QVector<ItemRecord> &items)
{
    beginResetModel();
    m_items = items;
    endResetModel();
    emit countChanged();
}

void ItemModel::upsert(const ItemRecord &item)
{
    int row = indexOf(item.id);
    if (row >= 0) {
        m_items[row] = item;
        const QModelIndex idx = index(row, 0);
        emit dataChanged(idx, idx);
    } else {
        beginInsertRows(QModelIndex(), m_items.size(), m_items.size());
        m_items.append(item);
        endInsertRows();
        emit countChanged();
    }
}

void ItemModel::removeById(const QString &id)
{
    int row = indexOf(id);
    if (row < 0) return;
    beginRemoveRows(QModelIndex(), row, row);
    m_items.remove(row);
    endRemoveRows();
    emit countChanged();
}

int ItemModel::count() const
{
    return m_items.size();
}

ItemRecord ItemModel::itemById(const QString &id) const
{
    int row = indexOf(id);
    return row >= 0 ? m_items.at(row) : ItemRecord();
}

int ItemModel::indexOf(const QString &id) const
{
    for (int i = 0; i < m_items.size(); ++i) {
        if (m_items.at(i).id == id) return i;
    }
    return -1;
}
```

### Б.4 itemmodel.h

Файл: `aurora-app/src/itemmodel.h`.

```
#ifndef ITEMMODEL_H
#define ITEMMODEL_H

#include <QAbstractListModel>
#include <QString>
#include <QVector>

/**
 * Запись инвентаря — общая модель данных для сети, SQLite-кэша и QML.
 */
struct ItemRecord
{
    QString id;
    QString name;
    int quantity = 0;
    QString location;
    QString condition;
    int version = 0;
    QString updatedAt;
};

QString conditionLabel(const QString &condition);

/**
 * Модель списка предметов для QML. Источник данных — InventoryClient:
 * после ответа сервера или чтения кэша модель заменяется целиком.
 */
class ItemModel : public QAbstractListModel
{
    Q_OBJECT
    Q_PROPERTY(int count READ count NOTIFY countChanged)
public:
    enum Roles {
        IdRole = Qt::UserRole + 1,
        NameRole,
        QuantityRole,
        LocationRole,
        ConditionRole,
        ConditionLabelRole,
        VersionRole
    };

    explicit ItemModel(QObject *parent = nullptr);

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role) const override;
    QHash<int, QByteArray> roleNames() const override;

    void setItems(const QVector<ItemRecord> &items);
    Q_INVOKABLE int count() const;
    void upsert(const ItemRecord &item);
    void removeById(const QString &id);

    ItemRecord itemById(const QString &id) const;

signals:
    void countChanged();

private:
    int indexOf(const QString &id) const;
    QVector<ItemRecord> m_items;
};

#endif // ITEMMODEL_H
```

### Б.5 localcache.cpp

Файл: `aurora-app/src/localcache.cpp`.

```
#include "localcache.h"

#include <QDateTime>
#include <QDebug>
#include <QDir>
#include <QJsonDocument>
#include <QSqlError>
#include <QSqlQuery>
#include <QStandardPaths>
#include <QUuid>
#include <QVariant>

LocalCache::LocalCache()
{
    m_connection = QStringLiteral("inventory-cache-%1")
            .arg(reinterpret_cast<quintptr>(this));
}

LocalCache::~LocalCache()
{
    if (m_db.isOpen()) m_db.close();
    if (QSqlDatabase::contains(m_connection)) {
        QSqlDatabase::removeDatabase(m_connection);
    }
}

bool LocalCache::open(QString *error)
{
    QString dir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    if (dir.isEmpty()) dir = QDir::homePath() + QStringLiteral("/.local/share/aurorainventory");
    QDir().mkpath(dir);
    m_path = dir + QStringLiteral("/inventory.db");

    m_db = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), m_connection);
    m_db.setDatabaseName(m_path);
    if (!m_db.open()) {
        if (error) *error = m_db.lastError().text();
        qWarning() << "SQLite: не удалось открыть" << m_path << m_db.lastError().text();
        return false;
    }

    if (!exec(QStringLiteral(
            "CREATE TABLE IF NOT EXISTS items ("
            " id TEXT PRIMARY KEY,"
            " name TEXT NOT NULL,"
            " quantity INTEGER NOT NULL DEFAULT 0,"
            " location TEXT NOT NULL DEFAULT '',"
            " condition TEXT NOT NULL DEFAULT 'good',"
            " version INTEGER NOT NULL DEFAULT 0,"
            " updated_at TEXT NOT NULL DEFAULT '')"))) {
        if (error) *error = QStringLiteral("не удалось создать таблицу items");
        return false;
    }

    if (!exec(QStringLiteral(
            "CREATE TABLE IF NOT EXISTS pending ("
            " id INTEGER PRIMARY KEY AUTOINCREMENT,"
            " method TEXT NOT NULL,"
            " item_id TEXT NOT NULL,"
            " payload TEXT NOT NULL DEFAULT '{}',"
            " queued_at TEXT NOT NULL DEFAULT '')"))) {
        if (error) *error = QStringLiteral("не удалось создать таблицу pending");
        return false;
    }

    qInfo() << "SQLite-кэш:" << m_path;
    return true;
}

QString LocalCache::path() const
{
    return m_path;
}

bool LocalCache::isOpen() const
{
    return m_db.isOpen();
}

bool LocalCache::exec(const QString &sql)
{
    QSqlQuery query(m_db);
    if (!query.exec(sql)) {
        qWarning() << "SQLite error:" << query.lastError().text() << "SQL:" << sql;
        return false;
    }
    return true;
}

ItemRecord LocalCache::fromQuery(const QSqlQuery &query)
{
    ItemRecord item;
    item.id = query.value(0).toString();
    item.name = query.value(1).toString();
    item.quantity = query.value(2).toInt();
    item.location = query.value(3).toString();
    item.condition = query.value(4).toString();
    item.version = query.value(5).toInt();
    item.updatedAt = query.value(6).toString();
    return item;
}

QJsonObject LocalCache::fieldsOf(const ItemRecord &item)
{
    QJsonObject object;
    object.insert(QStringLiteral("name"), item.name);
    object.insert(QStringLiteral("quantity"), item.quantity);
    object.insert(QStringLiteral("location"), item.location);
    object.insert(QStringLiteral("condition"), item.condition);
    return object;
}

void LocalCache::replaceAll(const QVector<ItemRecord> &items)
{
    if (!m_db.isOpen()) return;
    QSqlDatabase::database(m_connection).transaction();
    exec(QStringLiteral("DELETE FROM items"));
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "INSERT INTO items (id, name, quantity, location, condition, version, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)"));
    for (const ItemRecord &item : items) {
        query.addBindValue(item.id);
        query.addBindValue(item.name);
        query.addBindValue(item.quantity);
        query.addBindValue(item.location);
        query.addBindValue(item.condition);
        query.addBindValue(item.version);
        query.addBindValue(item.updatedAt);
        if (!query.exec()) {
            qWarning() << "SQLite insert:" << query.lastError().text();
        }
    }
    QSqlDatabase::database(m_connection).commit();
}

void LocalCache::upsert(const ItemRecord &item)
{
    if (!m_db.isOpen()) return;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "INSERT OR REPLACE INTO items (id, name, quantity, location, condition, version, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)"));
    query.addBindValue(item.id);
    query.addBindValue(item.name);
    query.addBindValue(item.quantity);
    query.addBindValue(item.location);
    query.addBindValue(item.condition);
    query.addBindValue(item.version);
    query.addBindValue(item.updatedAt);
    if (!query.exec()) {
        qWarning() << "SQLite upsert:" << query.lastError().text();
    }
}

void LocalCache::remove(const QString &id)
{
    if (!m_db.isOpen()) return;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("DELETE FROM items WHERE id = ?"));
    query.addBindValue(id);
    query.exec();
}

QVector<ItemRecord> LocalCache::all() const
{
    QVector<ItemRecord> result;
    if (!m_db.isOpen()) return result;
    QSqlQuery query(m_db);
    if (query.exec(QStringLiteral(
            "SELECT id, name, quantity, location, condition, version, updated_at"
            " FROM items ORDER BY name COLLATE NOCASE"))) {
        while (query.next()) result.append(fromQuery(query));
    }
    return result;
}

ItemRecord LocalCache::find(const QString &id) const
{
    if (!m_db.isOpen()) return ItemRecord();
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "SELECT id, name, quantity, location, condition, version, updated_at"
        " FROM items WHERE id = ?"));
    query.addBindValue(id);
    if (query.exec() && query.next()) return fromQuery(query);
    return ItemRecord();
}

bool LocalCache::contains(const QString &id) const
{
    if (!m_db.isOpen()) return false;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("SELECT 1 FROM items WHERE id = ?"));
    query.addBindValue(id);
    return query.exec() && query.next();
}

int LocalCache::count() const
{
    if (!m_db.isOpen()) return 0;
    QSqlQuery query(m_db);
    if (query.exec(QStringLiteral("SELECT COUNT(*) FROM items")) && query.next())
        return query.value(0).toInt();
    return 0;
}

qint64 LocalCache::enqueue(const QString &method, const QString &itemId, const QJsonObject &payload)
{
    if (!m_db.isOpen()) return -1;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "INSERT INTO pending (method, item_id, payload, queued_at) VALUES (?, ?, ?, ?)"));
    query.addBindValue(method);
    query.addBindValue(itemId);
    query.addBindValue(QString::fromUtf8(QJsonDocument(payload).toJson(QJsonDocument::Compact)));
    query.addBindValue(QDateTime::currentDateTimeUtc().toString(Qt::ISODate));
    if (!query.exec()) {
        qWarning() << "SQLite enqueue:" << query.lastError().text();
        return -1;
    }
    return query.lastInsertId().toLongLong();
}

QVector<LocalCache::PendingOp> LocalCache::pendingOps() const
{
    QVector<PendingOp> result;
    if (!m_db.isOpen()) return result;
    QSqlQuery query(m_db);
    if (query.exec(QStringLiteral(
            "SELECT id, method, item_id, payload FROM pending ORDER BY id"))) {
        while (query.next()) {
            PendingOp op;
            op.id = query.value(0).toLongLong();
            op.method = query.value(1).toString();
            op.itemId = query.value(2).toString();
            op.payload = QJsonDocument::fromJson(query.value(3).toByteArray()).object();
            result.append(op);
        }
    }
    return result;
}

int LocalCache::pendingCount() const
{
    if (!m_db.isOpen()) return 0;
    QSqlQuery query(m_db);
    if (query.exec(QStringLiteral("SELECT COUNT(*) FROM pending")) && query.next())
        return query.value(0).toInt();
    return 0;
}

void LocalCache::removePending(qint64 id)
{
    if (!m_db.isOpen()) return;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("DELETE FROM pending WHERE id = ?"));
    query.addBindValue(id);
    query.exec();
}

void LocalCache::removePendingForItem(const QString &itemId)
{
    if (!m_db.isOpen()) return;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("DELETE FROM pending WHERE item_id = ?"));
    query.addBindValue(itemId);
    query.exec();
}

void LocalCache::updatePendingPayload(qint64 id, const QJsonObject &payload)
{
    if (!m_db.isOpen()) return;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral("UPDATE pending SET payload = ? WHERE id = ?"));
    query.addBindValue(QString::fromUtf8(QJsonDocument(payload).toJson(QJsonDocument::Compact)));
    query.addBindValue(id);
    query.exec();
}

bool LocalCache::lastPendingForItem(const QString &itemId, PendingOp *op) const
{
    if (!m_db.isOpen() || !op) return false;
    QSqlQuery query(m_db);
    query.prepare(QStringLiteral(
        "SELECT id, method, item_id, payload FROM pending WHERE item_id = ? ORDER BY id DESC LIMIT 1"));
    query.addBindValue(itemId);
    if (query.exec() && query.next()) {
        op->id = query.value(0).toLongLong();
        op->method = query.value(1).toString();
        op->itemId = query.value(2).toString();
        op->payload = QJsonDocument::fromJson(query.value(3).toByteArray()).object();
        return true;
    }
    return false;
}

void LocalCache::remapItemId(const QString &from, const QString &to)
{
    if (!m_db.isOpen() || from == to) return;
    QSqlDatabase::database(m_connection).transaction();

    QSqlQuery item(m_db);
    item.prepare(QStringLiteral("UPDATE items SET id = ? WHERE id = ?"));
    item.addBindValue(to);
    item.addBindValue(from);
    item.exec();

    QSqlQuery pending(m_db);
    pending.prepare(QStringLiteral("UPDATE pending SET item_id = ? WHERE item_id = ?"));
    pending.addBindValue(to);
    pending.addBindValue(from);
    pending.exec();

    QSqlDatabase::database(m_connection).commit();
}
```

### Б.6 localcache.h

Файл: `aurora-app/src/localcache.h`.

```
#ifndef LOCALCACHE_H
#define LOCALCACHE_H

#include "itemmodel.h"

#include <QJsonObject>
#include <QSqlDatabase>
#include <QString>
#include <QVector>

/**
 * Локальный кэш предметов и очередь отложенных операций (SQLite).
 *
 * Таблица items     — последняя известная копия предметов для offline-режима.
 * Таблица pending   — операции, которые не удалось выполнить на сервере:
 *                     CREATE/UPDATE/DELETE с полным телом запроса.
 */
class LocalCache
{
public:
    struct PendingOp {
        qint64 id = -1;
        QString method;
        QString itemId;
        QJsonObject payload;
    };

    LocalCache();
    ~LocalCache();

    bool open(QString *error = nullptr);
    QString path() const;
    bool isOpen() const;

    void replaceAll(const QVector<ItemRecord> &items);
    void upsert(const ItemRecord &item);
    void remove(const QString &id);
    QVector<ItemRecord> all() const;
    ItemRecord find(const QString &id) const;
    bool contains(const QString &id) const;
    int count() const;

    qint64 enqueue(const QString &method, const QString &itemId, const QJsonObject &payload);
    QVector<PendingOp> pendingOps() const;
    int pendingCount() const;
    void removePending(qint64 id);
    void removePendingForItem(const QString &itemId);
    void updatePendingPayload(qint64 id, const QJsonObject &payload);
    bool lastPendingForItem(const QString &itemId, PendingOp *op) const;

    /** Замена временного id ("local-...") на настоящий id с сервера. */
    void remapItemId(const QString &from, const QString &to);

private:
    bool exec(const QString &sql);
    static ItemRecord fromQuery(const class QSqlQuery &query);
    static QJsonObject fieldsOf(const ItemRecord &item);

    QSqlDatabase m_db;
    QString m_connection;
    QString m_path;
};

#endif // LOCALCACHE_H
```

### Б.7 main.cpp

Файл: `aurora-app/src/main.cpp`.

```
#include <auroraapp.h>
#include <QtQuick>
#include <QTimer>

#include "inventoryclient.h"

/**
 * Точка входа приложения «Инвентарь» (ЛР №2, вариант 7).
 *
 *   ru.mai.aurorainventory          — обычный запуск (QML-интерфейс);
 *   ru.mai.aurorainventory --demo   — автоматическая демонстрация CRUD,
 *                                     offline-кэша и синхронизации.
 */
int main(int argc, char *argv[])
{
    QScopedPointer<QGuiApplication> application(Aurora::Application::application(argc, argv));
    application->setOrganizationName(QStringLiteral("ru.mai"));
    application->setOrganizationDomain(QStringLiteral("mai.ru"));
    application->setApplicationName(QStringLiteral("aurorainventory"));
    application->setApplicationVersion(QStringLiteral("1.0.0"));

    const bool demo = application->arguments().contains(QStringLiteral("--demo"));

    InventoryClient client;

    QScopedPointer<QQuickView> view(Aurora::Application::createView());
    view->rootContext()->setContextProperty(QStringLiteral("InventoryClient"), &client);
    view->setSource(Aurora::Application::pathTo(QStringLiteral("qml/aurorainventory.qml")));
    view->show();

    if (demo) {
        QTimer::singleShot(900, [&client]() { client.startDemo(); });
    }

    return application->exec();
}
```

### Б.8 aurorainventory.qml

Файл: `aurora-app/qml/aurorainventory.qml`.

```
import QtQuick 2.0
import Sailfish.Silica 1.0

ApplicationWindow {
    objectName: "applicationWindow"
    initialPage: Qt.resolvedUrl("pages/MainPage.qml")
    cover: Qt.resolvedUrl("cover/CoverPage.qml")
    allowedOrientations: defaultAllowedOrientations
}
```

### Б.9 CoverPage.qml

Файл: `aurora-app/qml/cover/CoverPage.qml`.

```
import QtQuick 2.0
import Sailfish.Silica 1.0

CoverBackground {
    Column {
        anchors.centerIn: parent
        width: parent.width - 2 * Theme.paddingMedium
        spacing: Theme.paddingSmall

        Label {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "Инвентарь"
            color: Theme.primaryColor
            font.pixelSize: Theme.fontSizeLarge
            font.bold: true
        }

        Label {
            anchors.horizontalCenter: parent.horizontalCenter
            text: InventoryClient.online ? "онлайн" : "офлайн"
            color: InventoryClient.online ? "#4ade80" : "#fbbf24"
            font.pixelSize: Theme.fontSizeSmall
        }

        Label {
            anchors.horizontalCenter: parent.horizontalCenter
            text: InventoryClient.model.count + " предметов"
            color: Theme.secondaryColor
            font.pixelSize: Theme.fontSizeSmall
        }

        Label {
            anchors.horizontalCenter: parent.horizontalCenter
            visible: InventoryClient.pendingCount > 0
            text: InventoryClient.pendingCount + " в очереди"
            color: Theme.highlightColor
            font.pixelSize: Theme.fontSizeSmall
        }
    }

    CoverActionList {
        CoverAction {
            iconSource: "image://theme/icon-m-refresh"
            onTriggered: InventoryClient.refresh()
        }
    }
}
```

### Б.10 AboutPage.qml

Файл: `aurora-app/qml/pages/AboutPage.qml`.

```
import QtQuick 2.0
import Sailfish.Silica 1.0

Page {
    id: page

    SilicaFlickable {
        anchors.fill: parent
        contentHeight: content.height + Theme.paddingLarge

        Column {
            id: content
            width: parent.width
            spacing: Theme.paddingLarge

            PageHeader {
                title: "О программе"
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: "Инвентарь 1.0"
                color: Theme.highlightColor
                font.pixelSize: Theme.fontSizeLarge
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: "Лабораторная работа №2, вариант 7. Клиент REST API инвентаря "
                      + "для Аврора ОС: HTTPS, JSON, JWT/cookie, SQLite-кэш, "
                      + "очередь отложенных операций и синхронизация."
                wrapMode: Text.WordWrap
                color: Theme.primaryColor
                font.pixelSize: Theme.fontSizeSmall
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: "Реализованные требования:\n"
                      + "• QNetworkAccessManager + таймаут 8 с на запрос;\n"
                      + "• разбор JSON через QJsonDocument;\n"
                      + "• QSettings для адреса сервера, JWT и профиля;\n"
                      + "• QNetworkCookieJar с сохранением cookie в QSettings;\n"
                      + "• QSqlDatabase/QSQLITE: таблицы items и pending;\n"
                      + "• offline-режим, кэш и очередь create/update/delete;\n"
                      + "• синхронизация с временными id local-* и их заменой;\n"
                      + "• обработка 400/401/403/404/5xx, таймаута и sslErrors."
                wrapMode: Text.WordWrap
                color: Theme.secondaryColor
                font.pixelSize: Theme.fontSizeSmall
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: "Демонстрация: запустите приложение с ключом --demo. "
                      + "Журнал сценария сохраняется в файл demo.log в каталоге данных."
                wrapMode: Text.WordWrap
                color: Theme.secondaryColor
                font.pixelSize: Theme.fontSizeSmall
            }

            Button {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: "Показать демо-журнал"
                onClicked: pageStack.push(Qt.resolvedUrl("DemoLogPage.qml"))
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: "© 2026, кафедра МАИ. Учебный проект."
                wrapMode: Text.WordWrap
                color: Theme.secondaryColor
                font.pixelSize: Theme.fontSizeExtraSmall
            }
        }
    }
}
```

### Б.11 DemoLogPage.qml

Файл: `aurora-app/qml/pages/DemoLogPage.qml`.

```
import QtQuick 2.0
import Sailfish.Silica 1.0

Page {
    id: page

    property string demoLogText: ""
    property int demoLogs: 0

    function reload() {
        demoLogText = InventoryClient.demoLog()
        demoLogs++
    }

    Component.onCompleted: reload()

    Connections {
        target: InventoryClient
        onDemoLogChanged: page.reload()
    }

    SilicaFlickable {
        anchors.fill: parent
        contentHeight: header.height + logLabel.height + Theme.paddingLarge * 3

        Column {
            id: header
            width: parent.width

            PageHeader {
                title: "Демо-журнал"
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: "Файл: " + InventoryClient.demoLogPath
                color: Theme.secondaryColor
                font.pixelSize: Theme.fontSizeExtraSmall
                wrapMode: Text.WrapAnywhere
            }
        }

        Label {
            id: logLabel
            x: Theme.horizontalPageMargin
            y: header.height + Theme.paddingMedium
            width: parent.width - 2 * Theme.horizontalPageMargin
            text: page.demoLogText.length > 0 ? page.demoLogText : "Журнал пуст."
            wrapMode: Text.WrapAnywhere
            color: Theme.primaryColor
            font.pixelSize: Theme.fontSizeExtraSmall
        }
    }
}
```

### Б.12 ItemPage.qml

Файл: `aurora-app/qml/pages/ItemPage.qml`.

```
import QtQuick 2.0
import Sailfish.Silica 1.0

Page {
    id: page

    property string itemId: ""
    property string itemName: ""
    property int itemQuantity: 1
    property string itemLocation: ""
    property string itemCondition: "new"

    readonly property bool isNew: itemId.length === 0

    function conditionIndex(value) {
        if (value === "good") return 1
        if (value === "used") return 2
        if (value === "broken") return 3
        return 0
    }

    function conditionValue(index) {
        if (index === 1) return "good"
        if (index === 2) return "used"
        if (index === 3) return "broken"
        return "new"
    }

    function save() {
        var quantity = parseInt(quantityField.text)
        if (isNaN(quantity) || quantity < 0) quantity = 0
        if (isNew) {
            InventoryClient.createItem(nameField.text, quantity,
                                       locationField.text,
                                       conditionValue(conditionBox.currentIndex))
        } else {
            InventoryClient.updateItem(page.itemId, nameField.text, quantity,
                                       locationField.text,
                                       conditionValue(conditionBox.currentIndex))
        }
        pageStack.pop()
    }

    SilicaFlickable {
        anchors.fill: parent
        contentHeight: content.height + Theme.paddingLarge

        Column {
            id: content
            width: parent.width
            spacing: Theme.paddingLarge

            PageHeader {
                title: page.isNew ? "Новый предмет" : "Редактирование"
            }

            TextField {
                id: nameField
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                label: "Название"
                placeholderText: "Например, дрель ударная"
                text: page.itemName
            }

            TextField {
                id: quantityField
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                label: "Количество"
                inputMethodHints: Qt.ImhDigitsOnly
                text: page.itemQuantity
                validator: IntValidator { bottom: 0; top: 1000000 }
            }

            TextField {
                id: locationField
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                label: "Место хранения"
                placeholderText: "Склад, стеллаж"
                text: page.itemLocation
            }

            ComboBox {
                id: conditionBox
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                label: "Состояние"
                currentIndex: page.conditionIndex(page.itemCondition)

                menu: ContextMenu {
                    MenuItem { text: "новый" }
                    MenuItem { text: "хорошее" }
                    MenuItem { text: "б/у" }
                    MenuItem { text: "неисправен" }
                }
            }

            Button {
                anchors.horizontalCenter: parent.horizontalCenter
                text: page.isNew ? "Создать" : "Сохранить"
                onClicked: page.save()
            }

            Button {
                anchors.horizontalCenter: parent.horizontalCenter
                visible: !page.isNew
                text: "Удалить"
                onClicked: {
                    remorse.execute(page, "Удаление предмета", function() {
                        InventoryClient.deleteItem(page.itemId)
                        pageStack.pop()
                    })
                }
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: "Без сети изменения сохраняются в локальной очереди (SQLite) "
                      + "и отправляются на сервер при синхронизации."
                wrapMode: Text.WordWrap
                color: Theme.secondaryColor
                font.pixelSize: Theme.fontSizeSmall
            }
        }
    }

    RemorseItem {
        id: remorse
    }
}
```

### Б.13 MainPage.qml

Файл: `aurora-app/qml/pages/MainPage.qml`.

```
import QtQuick 2.0
import Sailfish.Silica 1.0

Page {
    id: page

    function conditionColor(value) {
        if (value === "new") return "#4ade80"
        if (value === "good") return "#60a5fa"
        if (value === "used") return "#fbbf24"
        if (value === "broken") return "#f87171"
        return Theme.secondaryColor
    }

    SilicaListView {
        id: listView
        model: InventoryClient.model
        anchors.fill: parent

        header: Column {
            width: listView.width

            PageHeader {
                title: "Инвентарь"
            }

            Rectangle {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                height: statusColumn.height + Theme.paddingMedium * 2
                radius: Theme.paddingSmall
                color: InventoryClient.statusIsError
                       ? "#4a1f1f"
                       : (InventoryClient.online ? "#173a24" : "#3a3320")

                Column {
                    id: statusColumn
                    x: Theme.paddingMedium
                    y: Theme.paddingMedium
                    width: parent.width - 2 * Theme.paddingMedium
                    spacing: Theme.paddingSmall / 2

                    Label {
                        width: parent.width
                        text: InventoryClient.simulateOffline
                              ? "Офлайн (симуляция)"
                              : (InventoryClient.online ? "Онлайн" : "Офлайн")
                        color: InventoryClient.online && !InventoryClient.simulateOffline
                               ? "#4ade80" : "#fbbf24"
                        font.pixelSize: Theme.fontSizeSmall
                        font.bold: true
                    }

                    Label {
                        width: parent.width
                        text: InventoryClient.statusMessage
                        wrapMode: Text.WordWrap
                        color: Theme.primaryColor
                        font.pixelSize: Theme.fontSizeSmall
                    }

                    Label {
                        width: parent.width
                        text: "Предметов: " + InventoryClient.model.count
                              + "   ·   В очереди: " + InventoryClient.pendingCount
                        color: Theme.secondaryColor
                        font.pixelSize: Theme.fontSizeExtraSmall
                    }
                }
            }

            Item {
                width: 1
                height: Theme.paddingMedium
            }
        }

        delegate: ListItem {
            id: delegate
            contentHeight: Theme.itemSizeLarge

            onClicked: {
                pageStack.push(Qt.resolvedUrl("ItemPage.qml"), {
                    itemId: itemId,
                    itemName: name,
                    itemQuantity: quantity,
                    itemLocation: location,
                    itemCondition: condition
                })
            }

            Column {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                anchors.verticalCenter: parent.verticalCenter
                spacing: Theme.paddingSmall / 2

                Label {
                    width: parent.width
                    text: name
                    color: delegate.highlighted ? Theme.highlightColor : Theme.primaryColor
                    font.pixelSize: Theme.fontSizeMedium
                    truncationMode: TruncationMode.Elide
                }

                Row {
                    spacing: Theme.paddingMedium

                    Label {
                        text: "Кол-во: " + quantity
                        color: Theme.secondaryColor
                        font.pixelSize: Theme.fontSizeExtraSmall
                    }

                    Label {
                        text: location
                        color: Theme.secondaryColor
                        font.pixelSize: Theme.fontSizeExtraSmall
                        elide: Text.ElideRight
                        width: Math.min(implicitWidth, Theme.itemSizeHuge)
                    }

                    Label {
                        text: conditionLabel
                        color: page.conditionColor(condition)
                        font.pixelSize: Theme.fontSizeExtraSmall
                    }
                }
            }
        }

        footer: ListItem {
            contentHeight: Theme.itemSizeMedium

            onClicked: {
                pageStack.push(Qt.resolvedUrl("ItemPage.qml"), {
                    itemId: "",
                    itemName: "",
                    itemQuantity: 1,
                    itemLocation: "",
                    itemCondition: "new"
                })
            }

            Label {
                anchors.centerIn: parent
                text: "+ Добавить предмет"
                color: Theme.highlightColor
                font.pixelSize: Theme.fontSizeMedium
            }
        }

        ViewPlaceholder {
            enabled: listView.count === 0
            text: "Список пуст"
            hintText: "Потяните вниз, чтобы обновить, или добавьте предмет"
        }

        PullDownMenu {
            MenuItem {
                text: InventoryClient.pendingCount > 0
                      ? "Обновить и отправить изменения (" + InventoryClient.pendingCount + ")"
                      : "Обновить"
                enabled: !InventoryClient.busy
                onClicked: InventoryClient.refresh()
            }
            MenuItem {
                text: "Настройки"
                onClicked: pageStack.push(Qt.resolvedUrl("SettingsPage.qml"))
            }
            MenuItem {
                text: "О программе"
                onClicked: pageStack.push(Qt.resolvedUrl("AboutPage.qml"))
            }
        }

        VerticalScrollDecorator { }
    }

    BusyIndicator {
        anchors.centerIn: parent
        size: BusyIndicatorSize.Large
        running: InventoryClient.busy
        visible: running
    }
}
```

### Б.14 SettingsPage.qml

Файл: `aurora-app/qml/pages/SettingsPage.qml`.

```
import QtQuick 2.0
import Sailfish.Silica 1.0

Page {
    id: page

    SilicaFlickable {
        anchors.fill: parent
        contentHeight: content.height + Theme.paddingLarge

        Column {
            id: content
            width: parent.width
            spacing: Theme.paddingLarge

            PageHeader {
                title: "Настройки"
            }

            TextField {
                id: urlField
                objectName: "serverUrlField"
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                label: "Адрес сервера"
                placeholderText: "https://10.0.2.2:8443"
                text: InventoryClient.baseUrl
                inputMethodHints: Qt.ImhUrlCharactersOnly | Qt.ImhNoPredictiveText
            }

            TextField {
                id: userField
                objectName: "loginUserField"
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                label: "Логин"
                text: "admin"
                inputMethodHints: Qt.ImhNoPredictiveText
            }

            TextField {
                id: passwordField
                objectName: "loginPasswordField"
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                label: "Пароль"
                text: "admin123"
                echoMode: TextInput.Password
            }

            Row {
                x: Theme.horizontalPageMargin
                spacing: Theme.paddingLarge

                Button {
                    objectName: "settingsLoginButton"
                    text: InventoryClient.loggedIn ? "Войти заново" : "Войти"
                    enabled: !InventoryClient.busy
                    onClicked: {
                        InventoryClient.baseUrl = urlField.text
                        InventoryClient.login(userField.text, passwordField.text)
                    }
                }

                Button {
                    objectName: "settingsLogoutButton"
                    visible: InventoryClient.loggedIn
                    enabled: !InventoryClient.busy
                    text: "Выйти"
                    onClicked: InventoryClient.logout()
                }
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: InventoryClient.loggedIn
                      ? "Пользователь: " + InventoryClient.username
                        + " (" + InventoryClient.role + ")"
                      : "Вход не выполнен"
                wrapMode: Text.WordWrap
                color: Theme.secondaryColor
                font.pixelSize: Theme.fontSizeSmall
            }

            Button {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: "Обновить (в очереди: " + InventoryClient.pendingCount + ")"
                enabled: !InventoryClient.busy
                onClicked: InventoryClient.refresh()
            }

            Button {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: InventoryClient.simulateOffline
                      ? "Выключить офлайн-режим"
                      : "Включить офлайн-режим"
                onClicked: InventoryClient.setSimulateOffline(!InventoryClient.simulateOffline)
            }

            Button {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: "Загрузить кэш без сети"
                onClicked: InventoryClient.loadCacheOnly()
            }

            Button {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: "Запустить демо-сценарий"
                onClicked: InventoryClient.startDemo()
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: "Кэш SQLite: " + InventoryClient.cachePath
                wrapMode: Text.WrapAnywhere
                color: Theme.secondaryColor
                font.pixelSize: Theme.fontSizeExtraSmall
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: InventoryClient.statusMessage
                wrapMode: Text.WordWrap
                color: InventoryClient.statusIsError ? "#f87171" : Theme.secondaryColor
                font.pixelSize: Theme.fontSizeSmall
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: "Демо-пользователи сервера: admin/admin123, user/user123, "
                      + "viewer/viewer123."
                wrapMode: Text.WordWrap
                color: Theme.secondaryColor
                font.pixelSize: Theme.fontSizeExtraSmall
            }
        }
    }
}
```

### Б.15 ru.mai.aurorainventory.pro

Файл: `aurora-app/ru.mai.aurorainventory.pro`.

```
TARGET = ru.mai.aurorainventory

CONFIG += auroraapp

PKGCONFIG +=

QT += network sql

RESOURCES += resources.qrc

SOURCES += \
    src/main.cpp \
    src/itemmodel.cpp \
    src/localcache.cpp \
    src/inventoryclient.cpp

HEADERS += \
    src/itemmodel.h \
    src/localcache.h \
    src/inventoryclient.h

DISTFILES += \
    rpm/ru.mai.aurorainventory.spec \
    rpm/ru.mai.aurorainventory.changes.in \
    rpm/ru.mai.aurorainventory.changes.run.in

AURORAAPP_ICONS = 86x86 108x108 128x128 172x172
```

### Б.16 ru.mai.aurorainventory.desktop

Файл: `aurora-app/ru.mai.aurorainventory.desktop`.

```
[Desktop Entry]
Type=Application
X-Nemo-Application-Type=silica-qt5
Icon=ru.mai.aurorainventory
Exec=/usr/bin/ru.mai.aurorainventory
Name=Aurora Inventory
Name[ru]=Инвентарь

[X-Application]
Permissions=Internet
OrganizationName=ru.mai
ApplicationName=aurorainventory
ExecDBus=/usr/bin/ru.mai.aurorainventory
```

### Б.17 resources.qrc

Файл: `aurora-app/resources.qrc`.

```
<RCC>
    <qresource prefix="/certs">
        <file alias="ca.crt">certs/ca.crt</file>
    </qresource>
</RCC>
```

### Б.18 ca.crt

Файл: `aurora-app/certs/ca.crt`.

```
-----BEGIN CERTIFICATE-----
MIIDpTCCAo2gAwIBAgIUdzDFLMdGwuBK4TJNcKzf0MaVSDYwDQYJKoZIhvcNAQEL
BQAwYjELMAkGA1UEBhMCUlUxDzANBgNVBAgMBk1vc2NvdzEMMAoGA1UECgwDTUFJ
MRMwEQYDVQQLDApMYWJvcmF0b3J5MR8wHQYDVQQDDBZNQUkgTGFiMDIgSW52ZW50
b3J5IENBMB4XDTI2MTEwNzE5MDY0MVoXDTM2MTEwNDE5MDY0MVowYjELMAkGA1UE
BhMCUlUxDzANBgNVBAgMBk1vc2NvdzEMMAoGA1UECgwDTUFJMRMwEQYDVQQLDApM
YWJvcmF0b3J5MR8wHQYDVQQDDBZNQUkgTGFiMDIgSW52ZW50b3J5IENBMIIBIjAN
BgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkHUvQhLGZQK1sdRMVhR1XTen7oNT
iNhM9M7brUQoAr579CIbXTFwJmGPtbw3RQtBgrcyME5vjIbwt/fkD9ZxAM1jf+pD
yinlR+vL6u+Iry4Mwf5i5sFyQPz8lodQHHFt5M2cp+OK4KO7/WNorkGNDQt72tRh
DKsyyvKYA/J89ONDKWcoCIEX4B99+E4szLOyq0CE6DKHkzP4QqHGgDSEiBq/HX9O
wGMx2m7WQk1ajiyklS9uf04qOo0tRLx+TOYiip+8mqTPb/tmjvpFXB6koYurDoBB
6j0tzrjeF8jsy3YmPTxMtolJb+z7mThMzMvGpoS2JmcER4g/cM7osBuuuwIDAQAB
o1MwUTAdBgNVHQ4EFgQUM6dEs3nDyq/SgNS2H5HXSaZqajwwHwYDVR0jBBgwFoAU
M6dEs3nDyq/SgNS2H5HXSaZqajwwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0B
AQsFAAOCAQEAW8eINzbwQENwgGYzwcX+3OSvuYkbgmb1Mhz9QB1wUV/Dg6Tb+sDi
UxfYCSOLvKaQ17+L5YRABm7T1hQX+HMJ5YLCab4/Yfng7EuL+Hg5qTWgdL4DJ+ed
kqWXBnWlCPEEwx3wlsRVB3JdOgtsWsWrjbIvtC6PBP2Pd01vOLfQ+ByH0hyE/Nvp
MVSQFh/fSuf2QYu52zV90klCVZx5s3Tod14BTtE8fJrXAHf4Sd1kK20eveYpGRc9
LKvGhGKhQ1FbvULL2k18FgZjynj475ivQGYC0TQ++LccAoPNaCl18PXtCDwiFYJw
x1YuUBW8Ir342j32N0r2sJX6CFjW4PRqVw==
-----END CERTIFICATE-----
```

### Б.19 ru.mai.aurorainventory.changes.in

Файл: `aurora-app/rpm/ru.mai.aurorainventory.changes.in`.

```
* Sat Nov 07 2026 MAI <student@mai.ru> 1.0.0-1
- Первая версия: REST-клиент инвентаря, QSettings/QNetworkCookieJar,
  SQLite-кэш и очередь операций, offline-режим, демо-сценарий
```

### Б.20 ru.mai.aurorainventory.changes.run.in

Файл: `aurora-app/rpm/ru.mai.aurorainventory.changes.run.in`.

```
#!/bin/bash
#
# Автоматическая генерация changelog из сообщений коммитов и аннотаций тегов
# (используется утилитой git-change-log в сборочном окружении Аврора ОС SDK).

git-change-log
```

### Б.21 ru.mai.aurorainventory.spec

Файл: `aurora-app/rpm/ru.mai.aurorainventory.spec`.

```
Name:       ru.mai.aurorainventory
Summary:    Инвентарь — REST-клиент с offline-кэшем (Аврора ОС)
Version:    1.0.0
Release:    1
License:    BSD-3-Clause
URL:        https://auroraos.ru
Source0:    %{name}-%{version}.tar.bz2

Requires:   sailfishsilica-qt5 >= 0.10.9
Requires:   qt5-qtsql
BuildRequires:  pkgconfig(auroraapp)
BuildRequires:  pkgconfig(Qt5Core)
BuildRequires:  pkgconfig(Qt5Qml)
BuildRequires:  pkgconfig(Qt5Quick)
BuildRequires:  pkgconfig(Qt5Network)
BuildRequires:  pkgconfig(Qt5Sql)

%description
Клиент REST API инвентаря для Аврора ОС (лабораторная работа №2, вариант 7).
Асинхронные HTTP-запросы через QNetworkAccessManager, JSON через QJsonDocument,
JWT и cookie в QSettings/QNetworkCookieJar, SQLite-кэш и очередь отложенных
операций через QtSql, offline-режим и синхронизация, обработка 4xx/5xx и
таймаутов. Демонстрационный сценарий запускается с ключом --demo.

%prep
%autosetup

%build
%qmake5
%make_build

%install
%make_install

%files
%defattr(-,root,root,-)
%{_bindir}/%{name}
%defattr(644,root,root,-)
%{_datadir}/%{name}
%{_datadir}/applications/%{name}.desktop
%{_datadir}/icons/hicolor/*/apps/%{name}.png
```

### Б.22 settings-login-test.cpp

Файл: `aurora-app/tests/settings-login-test.cpp`.

```
#include "inventoryclient.h"
#include <QGuiApplication>
#include <QQmlContext>
#include <QQmlExpression>
#include <QQuickItem>
#include <QQuickView>
#include <QTimer>
#include <iostream>

// Проверяет обработчики настоящей страницы настроек, а не прямой вызов login().
int main(int argc, char **argv)
{
    QGuiApplication app(argc, argv);
    app.setOrganizationName("ru.mai");
    app.setApplicationName("settings-login-test");
    InventoryClient client;
    QQuickView view;
    view.rootContext()->setContextProperty("InventoryClient", &client);
    view.setSource(QUrl::fromLocalFile(app.arguments().value(2,
        "/usr/share/ru.mai.aurorainventory/qml/pages/SettingsPage.qml")));
    if (!view.rootObject()) {
        std::cerr << "FAIL: страница настроек не загружена" << std::endl;
        return 1;
    }
    view.show();
    QObject *root = view.rootObject();
    QObject *url = root->findChild<QObject *>("serverUrlField");
    QObject *user = root->findChild<QObject *>("loginUserField");
    QObject *password = root->findChild<QObject *>("loginPasswordField");
    QObject *login = root->findChild<QObject *>("settingsLoginButton");
    QObject *logout = root->findChild<QObject *>("settingsLogoutButton");
    if (!url || !user || !password || !login || !logout) {
        std::cerr << "FAIL: поля или кнопки страницы не найдены" << std::endl;
        return 1;
    }
    view.rootContext()->setContextProperty("TestLoginButton", login);
    view.rootContext()->setContextProperty("TestLogoutButton", logout);
    url->setProperty("text", app.arguments().value(1, "https://10.0.2.2:8443"));
    const QStringList users = { "admin", "user", "viewer" };
    int index = 0;
    int phase = 0;
    auto click = [&](const QString &expression) {
        QQmlExpression call(view.rootContext(), root, expression);
        call.evaluate();
        if (call.hasError()) {
            std::cerr << "FAIL: " << call.error().toString().toStdString() << std::endl;
            app.exit(1);
        }
    };
    QTimer timer;
    timer.setInterval(200);
    QObject::connect(&timer, &QTimer::timeout, [&]() {
        if (client.busy()) return;
        if (phase == 0) {
            user->setProperty("text", users.at(index));
            password->setProperty("text", users.at(index) + "123");
            phase = 1;
            click("TestLoginButton.clicked(null)");
        } else if (phase == 1) {
            if (!client.loggedIn() || client.username() != users.at(index) || client.role() != users.at(index)) {
                std::cerr << "FAIL: вход " << users.at(index).toStdString() << ": "
                          << client.statusMessage().toStdString() << std::endl;
                app.exit(1);
                return;
            }
            std::cout << "PASS: вход из настроек — " << users.at(index).toStdString() << std::endl;
            phase = 2;
            click("TestLogoutButton.clicked(null)");
        } else {
            if (client.loggedIn()) { app.exit(1); return; }
            if (++index == users.size()) {
                std::cout << "PASS: выход из настроек после каждой учётной записи" << std::endl;
                app.exit(0);
            } else {
                phase = 0;
            }
        }
    });
    QTimer::singleShot(45000, [&]() { std::cerr << "FAIL: timeout" << std::endl; app.exit(1); });
    timer.start();
    return app.exec();
}
```

### Б.23 settings-login-test.pro

Файл: `aurora-app/tests/settings-login-test.pro`.

```
TEMPLATE = app
TARGET = settings-login-test
CONFIG += console c++11
CONFIG -= app_bundle
QT = core gui quick qml network sql
INCLUDEPATH += ../src
SOURCES += settings-login-test.cpp ../src/inventoryclient.cpp ../src/itemmodel.cpp ../src/localcache.cpp
HEADERS += ../src/inventoryclient.h ../src/itemmodel.h ../src/localcache.h
RESOURCES += ../resources.qrc
```

### Б.24 sync-test.cpp

Файл: `aurora-app/tests/sync-test.cpp`.

```
#include "inventoryclient.h"
#include <QCoreApplication>
#include <QJsonDocument>
#include <QJsonObject>
#include <QTimer>
#include <iostream>

// Интеграционный тест с настоящим HTTPS API и SQLite; настройки изолируются
// через XDG_CONFIG_HOME/XDG_DATA_HOME при запуске на эмуляторе.
int main(int argc, char **argv)
{
    QCoreApplication app(argc, argv);
    app.setOrganizationName("ru.mai");
    app.setApplicationName("inventory-sync-test");
    InventoryClient client;
    client.setBaseUrl(app.arguments().value(1, "https://10.0.2.2:8443"));
    int stage = 0;
    QString id;
    QString temporary;
    const QString name = "Unified refresh integration test";
    auto check = [&](bool ok, const char *message) {
        std::cout << (ok ? "PASS: " : "FAIL: ") << message << std::endl;
        if (!ok) app.exit(1);
        return ok;
    };
    auto quantity = [&]() {
        return QJsonDocument::fromJson(client.itemJson(id).toUtf8()).object().value("quantity").toInt();
    };
    QTimer timer;
    timer.setInterval(150);
    QObject::connect(&timer, &QTimer::timeout, [&]() {
        if (client.busy()) return;
        if (stage == 0) {
            if (!check(client.loggedIn(), "вход admin")) return;
            client.setSimulateOffline(true);
            client.createItem(name, 2, "Стенд", "new");
            for (int i = 0; i < client.model()->rowCount(); ++i) {
                const QModelIndex index = client.model()->index(i);
                if (client.model()->data(index, ItemModel::NameRole).toString() == name)
                    temporary = client.model()->data(index, ItemModel::IdRole).toString();
            }
            if (!check(temporary.startsWith("local-"), "офлайн-создание с временным id")) return;
            client.updateItem(temporary, name, 7, "Стенд", "good");
            client.refresh();
            if (!check(client.pendingCount() == 1 && !client.itemJson(temporary).isEmpty(),
                       "обновление офлайн сохраняет очередь и предмет")) return;
            client.setSimulateOffline(false);
            stage = 1;
            client.refresh();
        } else if (stage == 1) {
            for (int i = 0; i < client.model()->rowCount(); ++i) {
                const QModelIndex index = client.model()->index(i);
                if (client.model()->data(index, ItemModel::NameRole).toString() == name)
                    id = client.model()->data(index, ItemModel::IdRole).toString();
            }
            if (!check(client.pendingCount() == 0 && !id.isEmpty() && id != temporary && quantity() == 7,
                       "единое обновление отправляет правки и заменяет временный id")) return;
            stage = 2;
            client.login("viewer", "viewer123");
        } else if (stage == 2) {
            client.setSimulateOffline(true);
            client.updateItem(id, name, 99, "Стенд", "good");
            client.setSimulateOffline(false);
            stage = 3;
            client.refresh();
        } else if (stage == 3) {
            if (!check(client.pendingCount() == 1 && quantity() == 99,
                       "после 403 и чтения сервера локальная правка остаётся в кэше и очереди")) return;
            stage = 4;
            client.refresh();
        } else if (stage == 4) {
            if (!check(client.pendingCount() == 1 && quantity() == 99,
                       "повторное обновление после 403 не теряет локальные изменения")) return;
            stage = 5;
            client.login("admin", "admin123");
        } else if (stage == 5) {
            stage = 6;
            client.refresh();
        } else if (stage == 6) {
            if (!check(client.pendingCount() == 0 && quantity() == 99,
                       "сохранённая после 403 операция отправлена после входа admin")) return;
            stage = 7;
            client.deleteItem(id);
        } else {
            if (!check(client.itemJson(id).isEmpty(), "удаление тестового предмета")) return;
            app.exit(0);
        }
    });
    QTimer::singleShot(45000, [&]() { std::cerr << "FAIL: timeout" << std::endl; app.exit(1); });
    client.login("admin", "admin123");
    timer.start();
    return app.exec();
}
```

### Б.25 sync-test.pro

Файл: `aurora-app/tests/sync-test.pro`.

```
TEMPLATE = app
TARGET = sync-test
CONFIG += console c++11
CONFIG -= app_bundle
QT = core network sql
INCLUDEPATH += ../src
SOURCES += sync-test.cpp ../src/inventoryclient.cpp ../src/itemmodel.cpp ../src/localcache.cpp
HEADERS += ../src/inventoryclient.h ../src/itemmodel.h ../src/localcache.h
RESOURCES += ../resources.qrc
```
