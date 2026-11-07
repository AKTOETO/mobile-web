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
