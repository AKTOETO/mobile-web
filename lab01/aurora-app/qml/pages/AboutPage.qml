import QtQuick 2.0
import Sailfish.Silica 1.0

Page {
    id: page

    allowedOrientations: Orientation.All

    SilicaFlickable {
        anchors.fill: parent
        contentHeight: layout.height + Theme.paddingLarge

        Column {
            id: layout
            width: parent.width

            PageHeader { title: qsTr("О приложении") }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                color: Theme.primaryColor
                font.pixelSize: Theme.fontSizeSmall
                wrapMode: Text.WordWrap
                text: qsTr("Aurora Stat — клиент сервера статистики аналитики сайта "
                           + "(лабораторная работа №1, вариант 7).\n\n"
                           + "Приложение подключается к серверу по WebSocket (канал /ws) "
                           + "и показывает: просмотры страниц, уникальных посетителей, "
                           + "сессии и их длительность, устройства посетителей и популярные "
                           + "страницы — в виде графиков, построенных средствами QML.")
            }

            SectionHeader { text: qsTr("Как пользоваться") }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                color: Theme.secondaryColor
                font.pixelSize: Theme.fontSizeSmall
                wrapMode: Text.WordWrap
                text: qsTr("1. Запустите сервер на компьютере: node server/server.js\n"
                           + "2. Узнайте адрес в локальной сети из вывода сервера.\n"
                           + "3. Откройте «Подключение» и введите адрес ws://<адрес>:3000/ws.\n"
                           + "4. Откройте сайт лабораторной работы в браузере — "
                           + "статистика будет обновляться на телефоне в реальном времени.")
            }

            SectionHeader { text: qsTr("Канал данных") }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                color: Theme.secondaryColor
                font.pixelSize: Theme.fontSizeSmall
                wrapMode: Text.WordWrap
                text: qsTr("WebSocket (RFC 6455) поверх TCP. Клиент подписывается на диапазон "
                           + "(24 часа, 7 дней, 30 дней, всё время) и получает обновления "
                           + "статистики, а также может отправлять собственные события.")
            }

            SectionHeader { text: qsTr("Сборка и лицензия") }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                color: Theme.secondaryColor
                font.pixelSize: Theme.fontSizeSmall
                wrapMode: Text.WordWrap
                text: qsTr("Qt/QML, Aurora OS SDK 5.1.1.60. Лицензия BSD-3-Clause. "
                           + "Учебный проект МАИ.")
            }

            Item { width: 1; height: Theme.paddingLarge }
        }
    }
}
