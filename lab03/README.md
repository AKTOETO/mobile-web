# ЛР №3 — Aurora Docker Lab

Вариант №7 «Инвентарь». **Все серверные компоненты работают в Docker Compose:**
`blue1`, `blue2`, `green1`, `green2`, `nginx`, `monitor`.
Серверных процессов Node.js и служб ЛР3 на хосте не требуется.

## Запуск одной командой

Из корня репозитория:

```bash
./lab03/lab up -d --build --wait
```

- **Панель для защиты:** http://localhost:9084
- REST через nginx: http://localhost:9083/api/health
- Каталог: http://localhost:9083/api/items
- Адрес в Aurora: `http://10.0.2.2:9083`

`lab` вызывает `docker --context default compose -f lab03/compose.yaml`:
используется native Docker Engine, глобальный контекст не меняется.
Docker Desktop для серверного стенда не требуется; его VM в данном окружении
зависала при повторных проверках, поэтому стенд от неё отделён.

После загрузки образов требуется только Docker/Compose; npm, Node.js, Python
и nginx на хосте для работы стенда не нужны. Клиент Aurora работает в VirtualBox.

## Демонстрация преподавателю

Полный сценарий на 3–5 минут: **[DEMO.md](DEMO.md)**.
Откройте панель и последовательно нажмите:

1. **Балансировка** — включаются реплики, выбирается blue; 40 настоящих запросов
   подтверждают ответы от обоих backend.
2. **Отказ реплики** — Docker останавливает `blue1` (на green — `green1`);
   40 запросов обслуживает вторая реплика, панель показывает остановленный контейнер.
3. **Восстановить** — контейнеры запускаются, проверяются их API, выполняется серия запросов.
4. **Blue → Green** — поток из 100 запросов идёт до, во время и после `nginx -s reload`;
   доказательство содержит обе версии и число ошибок. Green добавляет контроль дефицита.
5. **Откат на Blue** — аналогично проверяется возврат на версию 1.0.0.

Таблица nginx показывает настоящие адреса upstream и статусы попыток.
Например, итоговый HTTP 200 с попытками `502, 200` или `504, 200` означает,
что nginx сам повторил запрос к живой реплике. Непрерывные пробы панели не
повторяются на уровне клиента: ошибка nginx попадает в красный счётчик.

Встроенный генератор выполняет около 4 запросов/с даже при закрытой странице;
«Пауза проб» приостанавливает его. Счётчики относятся к пробам monitor, а журнал
и stub_status nginx включают также запросы приложения Aurora и браузера.
Распределение отдельной серии не обязано быть ровно 20:20: параллельно идут
фоновые пробы и запросы Aurora. Важны наличие ответов обеих реплик и ноль ошибок.

Проверяемые сценарии сохраняются в Docker volume `lab03_evidence`, переживают
пересоздание monitor и скачиваются кнопкой **Скачать JSON**. Полные доказательства
включают время, каждую пробу, backend, версию, HTTP-статус, задержку и строки nginx.
Операции управления сериализованы. Незадающийся/нездоровый target не активируется.

## Docker-архитектура

- backend образы `lab03-backend:1.0.0` и `lab03-backend:2.0.0`;
  каждая версия запущена в двух контейнерах;
- все backend слушают порт 3000 **только в сети Compose**;
- nginx публикует 9083, балансирует активную пару, поддерживает WebSocket Upgrade;
- monitor публикует **только 127.0.0.1:9084**, показывает Docker health, посылает
  реальные пробы и выполняет ограниченные команды Docker Engine API;
- monitor использует Docker socket, поэтому панель предназначена для локального
  управления учебным стендом; порт управления не публикуется в локальную сеть;
- `routing` — общий Docker volume конфигурации nginx (monitor RW, nginx читает);
- `nginx-logs` — JSON access log и error log; monitor читает журнал;
- `evidence` — история проверенных сценариев;
- контейнеры настроены на `restart: unless-stopped` и имеют healthcheck.

Внутренняя Docker-сеть `172.28.3.0/24` задаёт постоянные адреса backend:
Blue — `.11/.12`, Green — `.21/.22`. Панель берёт адреса из Docker inspect.
nginx использует эти внутренние IP: его перезапуск не зависит от DNS-имени
намеренно остановленной реплики. Адреса сохраняются и после пересоздания.
Во время штатного blue-green nginx не пересоздаётся.
Старые WebSocket соединения закрываются через 5 с после reload, клиент сам
переподключается. Непрерывность проверяется для REST; push восстанавливает соединение.

После запуска Docker Engine контейнеры автоматически восстанавливаются по restart
policy. Используется daemon контекста `default`, системная служба Docker. Собственные
systemd-службы ЛР3 на хосте отключены; прежний systemd-вариант больше не используется.

## Команды Docker

```bash
./lab03/lab ps -a
./lab03/lab logs -f --tail 40
./lab03/lab stop blue1
./lab03/lab start blue1
./lab03/lab exec nginx nginx -T
./lab03/lab exec nginx cat /var/log/lab03/access.log
docker --context default stats
./lab03/lab down
```

`down` сохраняет volumes и результаты. `down -v` дополнительно удаляет историю
сценариев и текущий выбор релиза. Команда `up -d --build --wait` запускает стенд
снова, включая ранее остановленные реплики.

Опциональная короткая оболочка `python3 lab03/infra/control.py` поддерживает
`up`, `down`, `status`, `logs`, `test`, `start blue1`, `stop blue1`, `switch green`.
Она вызывает Compose/API панели и не запускает серверы на хосте.

## Проверки в контейнере

При работающем стенде:

```bash
./lab03/lab run --rm tests
./lab03/lab run --rm tests node websocket-test.js
python3 lab03/infra/control.py switch green
./lab03/lab run --rm tests node websocket-test.js
```

`infrastructure-test.js` проверяет пять сценариев, состояние остановленного
контейнера, отказ переключения на неготовый green, ограничения API управления,
реальный nginx access log и stub_status. Тесты изменяют состояние стенда;
их не запускать одновременно с ручной защитой или emulator-demo.

Проверка интерфейса Firefox и снимки (временный WebDriver на ПК):

```bash
node lab03/tests/browser-demo.js
```

## Aurora: сборка, подпись и запуск

**Пакеты для aarch64 и armv7hl собраны и подписаны.** Пути, команды и результаты
проверки архитектур: [ARM-BUILD.md](ARM-BUILD.md). Ниже — сборка x86_64 для эмулятора.

Из `lab03/aurora-app`:

```bash
~/AuroraOS/bin/sfdk -c target=AuroraOS-5.1.1.60-base-x86_64 build
python3 ../infra/sign-rpm.py
scp RPMS/ru.mai.auroradeploy-1.0.0-1.x86_64.rpm auremu:/tmp/
ssh auremu 'sudo pkcon install-local -y /tmp/ru.mai.auroradeploy-1.0.0-1.x86_64.rpm'
```

Сборка запускает rpmbuild в Docker-движке Aurora SDK. Существующий SDK-образ
хранится в Docker Desktop; для новой сборки предварительно запустить
`systemctl --user start docker-desktop`. Серверный стенд остаётся в отдельном
контексте `default`. Подпись выполняется
`rpmsign-external` тестовым сертификатом `~/AuroraOS/package-signing/regular_cert.pem`.
Временный закрытый ключ после подписи удаляется; ключа в репозитории нет.

Запуск GUI (из корня репозитория):

```bash
ssh -n auremu 'nohup env XDG_RUNTIME_DIR=/run/user/100000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/100000/dbus/user_bus_socket WAYLAND_DISPLAY=../../display/wayland-0 QT_QPA_PLATFORM=wayland /usr/bin/ru.mai.auroradeploy > /tmp/lab03-app.log 2>&1 < /dev/null &'
python3 lab03/tests/emulator-demo.py
ssh auremu 'sudo journalctl _EXE=/usr/bin/ru.mai.auroradeploy --no-pager'
```

Для повторного запуска сначала проверить `ssh auremu 'pidof ru.mai.auroradeploy'`:
не следует запускать второй экземпляр поверх работающего.
Qt пишет сообщения в journal, файл `/tmp/lab03-app.log` может оставаться пустым.
Физический телефон не использовался. HTTP/WS применяется в локальном стенде.

Приложение получает данные через nginx; таймаут REST — 3 с, повтор — 2–16 с,
WebSocket backoff — 1–16 с, watchdog — 10 с без сообщения. Каталог остаётся
на экране при полном отказе активной пары. Каталог read-only; green добавляет
`lowStock` для остатка менее 10 и push `lowStockCount`.

### Экран эмулятора

Текущий постоянный профиль: 768×1600, scale=1, масштабирование окна VirtualBox.
В госте используются `~/.config/aurora-display.env` и
`~/.config/systemd/user/lipstick.service.d/99-aurora-display.conf`.
Для изображения важно совпадение разрешений гостя и VirtualBox.
Файлы `infra/emulator-*.conf/env` относятся к прежнему временному профилю снимков,
для запуска серверного стенда не нужны.

## Отчёт и авторские исправления

- Итог: `report/report.docx`, `report/report.pdf`.
- Исходный отредактированный DOCX: `report/editor/edited-original.docx`.
- Извлечённые изменения: `report/editor/text.diff`, `changes.json`.
- Постоянные правила следующих отчётов: `../REPORTING.md`.
- Полные листинги и manifest обновляются сборкой:

```bash
python3 lab03/report/assemble.py
python3 ~/.agents/skills/gost-docx-report/scripts/build_report.py -c lab03/report/report.yaml --check
```
