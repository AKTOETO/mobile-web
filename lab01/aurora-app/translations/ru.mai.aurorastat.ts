<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE TS>
<TS version="2.1" language="en">
<context>
    <name>AboutPage</name>
    <message>
        <source>О приложении</source>
        <translation>About</translation>
    </message>
    <message>
        <source>Aurora Stat — клиент сервера статистики аналитики сайта (лабораторная работа №1, вариант 7).

Приложение подключается к серверу по WebSocket (канал /ws) и показывает: просмотры страниц, уникальных посетителей, сессии и их длительность, устройства посетителей и популярные страницы — в виде графиков, построенных средствами QML.</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Как пользоваться</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>1. Запустите сервер на компьютере: node server/server.js
2. Узнайте адрес в локальной сети из вывода сервера.
3. Откройте «Подключение» и введите адрес ws://&lt;адрес&gt;:3000/ws.
4. Откройте сайт лабораторной работы в браузере — статистика будет обновляться на телефоне в реальном времени.</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Канал данных</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>WebSocket (RFC 6455) поверх TCP. Клиент подписывается на диапазон (24 часа, 7 дней, 30 дней, всё время) и получает обновления статистики, а также может отправлять собственные события.</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Сборка и лицензия</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Qt/QML, Aurora OS SDK 5.1.1.60. Лицензия BSD-3-Clause. Учебный проект МАИ.</source>
        <translation type="unfinished"></translation>
    </message>
</context>
<context>
    <name>BarList</name>
    <message>
        <source>Нет данных</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>%1 просмотров · %2 посетителей</source>
        <translation type="unfinished"></translation>
    </message>
</context>
<context>
    <name>CoverPage</name>
    <message>
        <source>Aurora Stat</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>%1 просмотров</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>нет связи</source>
        <translation type="unfinished"></translation>
    </message>
</context>
<context>
    <name>DashboardPage</name>
    <message>
        <source>Дашборд</source>
        <translation>Dashboard</translation>
    </message>
    <message>
        <source>Просмотры по времени</source>
        <translation>Page views over time</translation>
    </message>
    <message>
        <source>Устройства посетителей</source>
        <translation>Visitor devices</translation>
    </message>
    <message>
        <source>24 ч</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>7 дней</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>30 дней</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Всё время</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Обновить</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Период: %1 · обновлено %2</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>просмотры</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>посетители</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Популярные страницы</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Источники переходов</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Прямые заходы</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Внутренние переходы</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>С сайта %1: %2</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Показатели периода</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Просмотров на сессию: %1</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Показатель отказов: %1 %</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Средняя длительность сессии: %1</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Максимальная длительность сессии: %1</source>
        <translation type="unfinished"></translation>
    </message>
</context>
<context>
    <name>DeviceDonut</name>
    <message>
        <source>Нет данных</source>
        <translation type="unfinished"></translation>
    </message>
</context>
<context>
    <name>LineChart</name>
    <message>
        <source>Нет данных за выбранный период</source>
        <translation type="unfinished"></translation>
    </message>
</context>
<context>
    <name>MainPage</name>
    <message>
        <source>Статистика сайта</source>
        <translation>Site statistics</translation>
    </message>
    <message>
        <source>Открыть дашборд с графиками</source>
        <translation>Open dashboard with charts</translation>
    </message>
    <message>
        <source>Последние сессии</source>
        <translation>Recent sessions</translation>
    </message>
    <message>
        <source>Аврора</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Компьютер</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Телефон</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Планшет</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Робот</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Настройки подключения</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>О приложении</source>
        <translation type="unfinished">About</translation>
    </message>
    <message>
        <source>Сейчас на сайте</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>активны за 5 минут</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Просмотры страниц</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>за выбранный период</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Уникальные посетители</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>уникальных идентификаторов</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Сессии</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>в среднем</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>За всё время: %1 просмотров, %2 посетителей, %3 сессий</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Проверить сбор: отправить событие</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>События в реальном времени</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Событий пока не было. Откройте сайт в браузере — события появятся здесь.</source>
        <translation type="unfinished"></translation>
    </message>
</context>
<context>
    <name>SessionsPage</name>
    <message>
        <source>Аврора</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Компьютер</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Телефон</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Планшет</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Робот</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Последние сессии</source>
        <translation type="unfinished">Recent sessions</translation>
    </message>
    <message>
        <source>Всего в периоде: %1</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>активна</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Посетитель: %1</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>%1 → %2</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Просмотров: %1 · Действий: %2 · Длительность: %3</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Сессий пока нет</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Подключитесь к серверу и откройте сайт в браузере</source>
        <translation type="unfinished"></translation>
    </message>
</context>
<context>
    <name>SettingsPage</name>
    <message>
        <source>Подключение</source>
        <translation>Connection</translation>
    </message>
    <message>
        <source>Адрес WebSocket-сервера</source>
        <translation>WebSocket server address</translation>
    </message>
    <message>
        <source>Укажите адрес сервера статистики в локальной сети. Порт по умолчанию 3000, путь канала — /ws.</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Применить и подключиться</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Переподключаться автоматически</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Повторять попытки соединения при обрыве связи</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Состояние</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Статус: %1</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Ошибка: %1</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Получено сообщений: %1</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Подключиться</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Отключиться</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Обновить данные</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Проверка канала</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Отправить тестовое событие</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Если сервер не найден: проверьте, что ПК и телефон в одной сети, порт 3000 открыт, а в браузере ПК открывается адрес сервера.</source>
        <translation type="unfinished"></translation>
    </message>
</context>
<context>
    <name>StatClient</name>
    <message>
        <source>Не подключено</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>%1 с</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>%1 мин %2 с</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>%1 ч %2 мин</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Подключение к %1…</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Подключение к %1</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Отключено</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Отправлено событие pageview: %1</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Отправлено событие action: %1</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Подключено</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Соединение установлено</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Соединение потеряно</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Соединение закрыто</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Ошибка соединения: %1</source>
        <translation type="unfinished"></translation>
    </message>
    <message>
        <source>Переподключение через %1 с…</source>
        <translation type="unfinished"></translation>
    </message>
</context>
</TS>
