# Лабораторная работа №2 — Инвентарь (вариант №7)

REST API с HTTPS, браузерная тестовая страница и нативное offline-приложение
для ОС Аврора. Задание — [`TASK.md`](TASK.md), план — [`PLAN.md`](PLAN.md),
отчёт — [`REPORT.md`](REPORT.md) и [`report/build/report.docx`](report/build/report.docx).

## Сервер

```bash
cd lab02/inventory-server
npm start          # https://localhost:8443/ и http://localhost:8080/ (301)
npm test           # 122 проверки API на временных портах
```

Сервер слушает `0.0.0.0`. Демо-пользователи: `admin/admin123`,
`user/user123`, `viewer/viewer123`. Данные — `data/inventory.json`, секрет JWT —
`data/jwt.secret`; каталог `data/` и ключи сертификатов не коммитятся.
Сертификат пересоздаётся скриптом `tools/gen-cert.sh`.

Тестовая страница: `https://localhost:8443/` (ручной режим) и
`https://localhost:8443/?auto=1` (автодемо из 14 шагов).
Swagger UI — `/docs.html`: раскройте метод, нажмите `Try it out`, затем `Execute`.
Сначала выполните `POST /auth/login` с `admin/admin123`; полученный JWT
автоматически используется в следующих запросах. Проверка всех CRUD-кнопок —
`/docs.html?auto=1`. Описание `/api/v1/openapi.json` используется самим Swagger UI.

### Демонстрация в другой сети

```bash
cd lab02/inventory-server
npm run certs   # сохраняет CA, включает текущие IPv4 в сертификат сервера
npm start      # слушает все интерфейсы (0.0.0.0)
```

Текущие сетевые адреса и ссылки Swagger UI печатаются при запуске.
Откройте на телефоне `https://<IP-компьютера>:8443/docs.html`;
в приложении укажите `https://<IP-компьютера>:8443` в настройках.
Swagger UI берёт адрес из открытой страницы: менять код и пересобирать его
после смены сети не нужно. Для браузера установите CA по `CERTIFICATES.md`
или примите исключение для учебного сертификата. Устройства должны иметь
сетевой доступ друг к другу и к порту 8443 (учтите настройки Wi-Fi и firewall).

## Приложение для Авроры

CA встроен в приложение: вручную устанавливать сертификат для него не нужно.
После смены IP сервера достаточно изменить URL в настройках. Подробности
проверки TLS и отдельная инструкция по установке CA для браузера через SSH —
[`CERTIFICATES.md`](CERTIFICATES.md).

```bash
export PATH="$HOME/AuroraOS/bin:$PATH"
cd lab02/aurora-app
sfdk config target=AuroraOS-5.1.1.60-base-x86_64
sfdk build
scp -P 2223 RPMS/ru.mai.aurorainventory-1.0.0-1.x86_64.rpm defaultuser@127.0.0.1:/tmp/
ssh -p 2223 defaultuser@127.0.0.1 \
    'sudo pkcon install-local -y /tmp/ru.mai.aurorainventory-1.0.0-1.x86_64.rpm'
```

Запуск на эмуляторе — с переменными Wayland-сессии (см. `AGENTS.md`).
Ключ `--demo` выполняет полный цикл: CRUD, offline-кэш, синхронизацию,
замену временных id и обработку ошибок; журнал пишется в
`~/.local/share/ru.mai/aurorainventory/demo.log`.

Кнопка «Обновить» отправляет очередь локальных изменений и затем читает сервер.
Если часть операций не принята, они сохраняются вместе с локальными значениями.
Интеграционный тест этой операции: `aurora-app/tests/sync-test.pro`.
Вход и выход кнопками настоящей страницы настроек для трёх ролей проверяет
`aurora-app/tests/settings-login-test.pro` (нужна графическая сессия Авроры).

## Пересборка отчёта с полными исходниками

```bash
python3 lab02/report/src/append-sources.py
```

Скрипт обновляет приложения с исходниками в `REPORT.md`, затем собирает и
проверяет `report/build/report.docx` и `report.pdf`.

## Артефакты

`report/logs/` — логи тестов, сборки, установки и демонстраций;
`report/screenshots/` — снимки ПК и эмулятора; `report/images/` — схемы;
`report/build/` — собранные DOCX и PDF отчёта.
