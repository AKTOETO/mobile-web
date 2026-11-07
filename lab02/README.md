# Лабораторная работа №2 — Инвентарь (вариант №7)

REST API с HTTPS, браузерная тестовая страница и нативное offline-приложение
для ОС Аврора. Задание — [`TASK.md`](TASK.md), план — [`PLAN.md`](PLAN.md),
отчёт — [`REPORT.md`](REPORT.md) и [`report/build/report.docx`](report/build/report.docx).

## Сервер

```bash
cd lab02/inventory-server
npm start          # https://localhost:8443/ и http://localhost:8080/ (301)
npm test           # 114 проверок API на временных портах
```

Сервер слушает `0.0.0.0`. Демо-пользователи: `admin/admin123`,
`user/user123`, `viewer/viewer123`. Данные — `data/inventory.json`, секрет JWT —
`data/jwt.secret`; каталог `data/` и ключи сертификатов не коммитятся.
Сертификат пересоздаётся скриптом `tools/gen-cert.sh`.

Тестовая страница: `https://localhost:8443/` (ручной режим) и
`https://localhost:8443/?auto=1` (автодемо из 14 шагов). Документация OpenAPI —
`/api/v1/openapi.json` и `/docs.html`.

## Приложение для Авроры

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

## Артефакты

`report/logs/` — логи тестов, сборки, установки и демонстраций;
`report/screenshots/` — снимки ПК и эмулятора; `report/images/` — схемы;
`report/build/` — собранные DOCX и PDF отчёта.
