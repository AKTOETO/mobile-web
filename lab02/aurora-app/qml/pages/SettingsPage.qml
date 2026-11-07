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
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                label: "Адрес сервера"
                placeholderText: "https://10.0.2.2:8443"
                text: InventoryClient.baseUrl
                inputMethodHints: Qt.ImhUrlCharactersOnly | Qt.ImhNoPredictiveText
            }

            TextField {
                id: userField
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                label: "Логин"
                text: "admin"
                inputMethodHints: Qt.ImhNoPredictiveText
            }

            TextField {
                id: passwordField
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
                    text: InventoryClient.loggedIn ? "Войти заново" : "Войти"
                    onClicked: {
                        InventoryClient.setBaseUrl(urlField.text)
                        InventoryClient.login(userField.text, passwordField.text)
                    }
                }

                Button {
                    visible: InventoryClient.loggedIn
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
                text: "Синхронизировать очередь (" + InventoryClient.pendingCount + ")"
                enabled: InventoryClient.pendingCount > 0 || !InventoryClient.online
                onClicked: InventoryClient.syncPending()
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
