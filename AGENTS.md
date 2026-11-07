# AGENTS.md — лабораторные работы (mobile-web)

Краткое руководство для всех, кто продолжает эти лабораторные работы: что где
лежит, как собрать, запустить и проверить, какие в окружении есть особенности.

## Структура репозитория

```
mobile-web/
├── README.md
├── AGENTS.md                 # этот файл
├── lab01/                    # ЛР №1: сервер статистики + WebSocket-клиент
│   ├── stat-server/          # Node.js без внешних зависимостей
│   ├── aurora-app/           # Qt/QML приложение под Аврора (QWebSocket)
│   └── report/               # артефакты и report.yaml (ГОСТ-отчёт)
├── lab02/                    # ЛР №2: REST API + HTTPS + offline-клиент
│   ├── TASK.md               # задание
│   ├── PLAN.md               # план и отметки о выполнении
│   ├── inventory-server/     # Node.js REST API, HTTPS, OpenAPI, тест-страница
│   ├── aurora-app/           # Qt/QML/C++ клиент: сеть, JSON, QSettings, SQLite
│   └── report/               # логи команд, скриншоты, демо-журналы
└── lab03/                    # задание следующей работы (docx)
```

Правило: каждая лабораторная — отдельная папка, свои `package.json`/`rpm`, тесты,
документация; общих зависимостей между работами нет. Стиль кода и документации —
как в `lab01` (комментарии и интерфейс на русском, для сервера — только встроенные
модули Node.js, для Авроры — Qt 5.6/Sailfish Silica).

## Окружение

| Что | Где |
|---|---|
| Aurora SDK 5.1.1.60 | `~/AuroraOS`, `sfdk` в `~/AuroraOS/bin` (в `PATH` по умолчанию нет) |
| Движок сборки (Docker) | образ `aurora-os-build-engine-5.1.1.60-base:bogdan`, контейнер `aurora-os-build-engine-5.1.1.60-base_bogdan` (порт 22 → `127.0.0.1:2222`) |
| Эмулятор (VirtualBox) | ВМ `AuroraOS-5.1.1.60-base`, ssh `defaultuser@127.0.0.1:2223` |
| Ключ ssh (эмулятор и движок) | `~/AuroraOS/vmshare/ssh/private_keys/sdk` |
| Проект внутри контейнера | смонтирован по тому же пути `/home/bogdan/MAI/AURORA-SDK-PROJECTS` |
| Sysroot цели x86_64 в контейнере | `/srv/mer/targets/AuroraOS-5.1.1.60-base-x86_64` (есть `Qt5Sql`, `Qt5Network`, `Qt5Quick`) |

```bash
export PATH="$HOME/AuroraOS/bin:$PATH"
sfdk --version            # SDK_RELEASE=5.1.1.60-base
sfdk engine status        # Docker-движок
VBoxManage list vms       # AuroraOS-5.1.1.60-base
```

Если контейнер движка не запущен, `sfdk build`/`sfdk shell` поднимают его сами.
Образ движка занимает ~19 ГБ; без него `sfdk build` падает на `pull access denied`.

### Полезные ssh-алиасы (в `~/.ssh/config`)

- `aurora-emu` — эмулятор (`defaultuser@127.0.0.1:2223`, ключ `~/AuroraOS/vmshare/ssh/private_keys/sdk`),
- `aurora-build` — движок сборки (`mersdk@127.0.0.1:2222`).

`defaultuser` на эмуляторе имеет sudo без пароля. На хосте `sudo` — с паролем,
поэтому системные сертификаты на ПК не ставим (в Firefox используем
`acceptInsecureCerts`).

## Сервер (Node.js)

- Запуск: `cd lab02/inventory-server && npm start` (`node server/server.js`).
- Только стандартные модули (`node:https`, `node:http`, `node:crypto`, `node:fs`,
  `node:path`, `node:os`) — никаких `npm install` для работы.
- Слушать нужно `0.0.0.0`, иначе телефон/эмулятор не достучится.
- HTTPS с самоподписанным сертификатом; сертификат и CA — в `certs/`, ключ
  генерируется скриптом `tools/gen-cert.sh`. Для доверия на эмуляторе CA
  кладётся в `/etc/pki/ca-trust/source/anchors/` и выполняется `update-ca-trust`
  (в образе Авроры он есть).
- Тесты: `npm test` — `node test/api-test.js` поднимает сервер на свободных
  портах с временным `DATA_DIR`, сам проверяет статусы/заголовки/кэш.
- Настройки — переменными окружения (`HTTPS_PORT`, `HTTP_PORT`, `DATA_DIR`,
  `DATA_FILE`, `CERT_DIR`, `JWT_TTL_SEC`, `LAB02_DEBUG=1`, `LAB02_LOG=1`), как в
  `lab01/stat-server/server/config.js`.
- Демо-пользователи: `admin/admin123`, `user/user123`, `viewer/viewer123`.
  `viewer` только читает, `user` создаёт/меняет, удаляет только `admin`.

## Приложение под Аврору (Qt/QML/C++)

- Qt 5.6.3: **нельзя** использовать API новее (`QOverload`,
  `qmlRegisterSingletonInstance`, `QUuid::WithoutBraces`, `setTransferTimeout` и
  т. п.). Таймауты — своим `QTimer`.
- Модули: `QT += network sql`; в `.spec` — `BuildRequires: pkgconfig(Qt5Network)`,
  `pkgconfig(Qt5Sql)`, `Requires: qt5-qtpcfont` не нужен, `qt5-qtbase`/`qt5-qtsql`
  подтягиваются зависимостями.
- `QSettings` читает `~/.config/<Organization>/<Application>.conf`; cookie
  удобно хранить там же (свой `QNetworkCookieJar` + `QSettings`).
- SQLite — через `QtSql`/`QSQLITE`, файл в `QStandardPaths::AppDataLocation`;
  в образе эмулятора есть плагин `/usr/lib/qt5/plugins/sqldrivers/libqsqlite.so`.
- Самоподписанный HTTPS: либо ставим CA в доверенные на устройстве (см. выше),
  либо в клиенте обрабатываем `QNetworkReply::sslErrors` (для учебной работы
  допустимо, обязательно документируется).

### Сборка и установка

```bash
export PATH="$HOME/AuroraOS/bin:$PATH"
cd lab02/aurora-app
sfdk config target=AuroraOS-5.1.1.60-base-x86_64
sfdk build                       # RPM: lab02/build-<target>-<Debug|Release>/RPMS/
sfdk deploy --pkcon              # поставить на запущенный эмулятор
```

Вручную: `scp` RPM на `defaultuser@127.0.0.1:2223:/tmp/` и
`sudo pkcon install-local -y /tmp/<pkg>.rpm`. Пакеты `aarch64`/`armv7hl` на
эмулятор x86_64 не ставятся.

### Запуск GUI на эмуляторе

Сессия — Wayland поверх eglfs, без переменных окружения приложение не поднимется:

```bash
nohup env XDG_RUNTIME_DIR=/run/user/100000 \
          WAYLAND_DISPLAY=../../display/wayland-0 \
          QT_QPA_PLATFORM=wayland \
          /usr/bin/ru.mai.aurorainventory > /tmp/app.log 2>&1 &
```

Актуальные значения: `sudo cat /proc/$(pidof lipstick)/environ | tr '\0' '\n' | grep -iE 'wayland|XDG|QT_'`.

## Сеть и особенности эмулятора

- Гость достаёт хост по **`10.0.2.2`** (NAT). Сервер на хосте должен слушать
  `0.0.0.0`. Внутренняя сеть `intnet` (`10.220.220.x`) с хостом не связана.
- В госте нет `ip`/`ifconfig` (смотреть `/proc/net/route`, `netstat -rn`), нет
  `python3`/`node`, но есть `curl` и `sailfish-qml`.
- **Браузер ставится на эмулятор из репозитория `omp`:**
  `sudo pkcon install -y sailfish-browser` (x86_64, версия 2.2.x; Gecko/embedlite).
  Запуск с нужными переменными и URL:
  `setsid env XDG_RUNTIME_DIR=/run/user/100000 WAYLAND_DISPLAY=../../display/wayland-0 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/100000/dbus/user_bus_socket QT_QPA_PLATFORM=wayland /usr/bin/sailfish-browser "https://10.0.2.2:8443/?auto=1" > /tmp/browser.log 2>&1 < /dev/null &`.
  Кэш браузера: `~/.cache/org.sailfishos/browser` (удалить, чтобы сбросить
  статику). Запасной вариант, если браузер недоступен — QML-«браузер» на
  `Sailfish.WebView` (QtWebKit) через `sailfish-qml`: у WebView есть
  `sslErrors`/`ignoreSslErrors()`.
- Тап-инжекта нет (`uinput`/`xdotool` отсутствуют, мышь в eglfs отключена).
  Поэтому сценарии на устройстве запускаются самим приложением
  (`--demo`), а нужные настройки кладутся в `QSettings`-файл заранее.
- Скриншоты экрана — только со стороны VirtualBox:
  `VBoxManage controlvm "AuroraOS-5.1.1.60-base" screenshotpng shot.png`.
- `ps` — BusyBox: нет `-C`; `pkill -f` может убить свой ssh-сеанс (шаблон
  совпадает с текстом команды) — надёжнее `kill $(pidof <имя>)`.

## Проверка и артефакты

- Сервер: `npm test` + `curl --cacert certs/ca.crt https://127.0.0.1:8443/api/v1/health`.
- ПК-браузер: Firefox через `geckodriver` с `acceptInsecureCerts: true`
  (см. `lab02/report/src/browser-demo.js`), скриншоты — WebDriver.
- Всё, что подтверждает выполнение (команды и их вывод, скриншоты браузера и
  эмулятора, демо-журналы), складывать в `lab02/report/`:
  `logs/`, `screenshots/`, `src/`. Подробный отчёт — позже из этих артефактов.

## Чего избегать

- Не коммитить артефакты сборки (`build-*`, `*.o`, `Makefile`, `*.pro.user`,
  RPMS) — они в `.gitignore`.
- Не хранить реальные секреты: JWT-секрет генерируется локально в `data/`
  (каталог в `.gitignore`), сертификаты — учебные, самоподписанные.
- Не менять историю git без явной просьбы.
