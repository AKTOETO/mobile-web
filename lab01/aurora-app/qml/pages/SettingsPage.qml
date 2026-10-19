import QtQuick 2.0
import Sailfish.Silica 1.0

Page {
    id: page

    allowedOrientations: Orientation.All

    SilicaFlickable {
        anchors.fill: parent
        contentHeight: content.height + Theme.paddingLarge

        Column {
            id: content
            width: parent.width
            spacing: Theme.paddingMedium

            PageHeader { title: qsTr("Подключение") }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: qsTr("Укажите адрес сервера статистики в локальной сети. "
                          + "Порт по умолчанию 3000, путь канала — /ws.")
                font.pixelSize: Theme.fontSizeExtraSmall
                color: Theme.secondaryColor
                wrapMode: Text.WordWrap
            }

            TextField {
                id: urlField
                anchors { left: parent.left; right: parent.right }
                label: qsTr("Адрес WebSocket-сервера")
                text: StatClient.serverUrl
                placeholderText: "ws://192.168.1.100:3000/ws"
                inputMethodHints: Qt.ImhUrlCharactersOnly | Qt.ImhNoAutoUppercase

                EnterKey.enabled: true
                EnterKey.iconSource: "image://theme/icon-m-enter-accept"
                EnterKey.onClicked: {
                    StatClient.serverUrl = urlField.text
                    StatClient.reconnect()
                    focus = false
                }
            }

            Button {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: qsTr("Применить и подключиться")
                onClicked: {
                    StatClient.serverUrl = urlField.text
                    StatClient.reconnect()
                }
            }

            TextSwitch {
                text: qsTr("Переподключаться автоматически")
                description: qsTr("Повторять попытки соединения при обрыве связи")
                checked: StatClient.autoReconnect
                onCheckedChanged: StatClient.autoReconnect = checked
            }

            SectionHeader { text: qsTr("Состояние") }

            Column {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                spacing: Theme.paddingSmall / 2

                Label {
                    width: parent.width
                    text: qsTr("Статус: %1").arg(StatClient.status)
                    font.pixelSize: Theme.fontSizeSmall
                    color: StatClient.connected ? Theme.highlightColor : Theme.primaryColor
                    wrapMode: Text.WordWrap
                }
                Label {
                    width: parent.width
                    visible: StatClient.lastError.length > 0
                    text: qsTr("Ошибка: %1").arg(StatClient.lastError)
                    font.pixelSize: Theme.fontSizeExtraSmall
                    color: Theme.errorColor
                    wrapMode: Text.WordWrap
                }
                Label {
                    width: parent.width
                    text: qsTr("Получено сообщений: %1").arg(StatClient.messageCount)
                    font.pixelSize: Theme.fontSizeExtraSmall
                    color: Theme.secondaryColor
                }
            }

            Row {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                spacing: Theme.paddingSmall

                Button {
                    width: (parent.width - Theme.paddingSmall) / 2
                    text: qsTr("Подключиться")
                    enabled: !StatClient.connected
                    onClicked: StatClient.connectToServer()
                }
                Button {
                    width: (parent.width - Theme.paddingSmall) / 2
                    text: qsTr("Отключиться")
                    enabled: StatClient.connected
                    onClicked: StatClient.disconnectFromServer()
                }
            }

            Button {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: qsTr("Обновить данные")
                enabled: StatClient.connected
                onClicked: StatClient.refresh()
            }

            SectionHeader { text: qsTr("Проверка канала") }

            Button {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: qsTr("Отправить тестовое событие")
                enabled: StatClient.connected
                onClicked: StatClient.trackPageView("/aurora", "aurorastat:test")
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: qsTr("Если сервер не найден: проверьте, что ПК и телефон в одной сети, "
                          + "порт 3000 открыт, а в браузере ПК открывается адрес сервера.")
                font.pixelSize: Theme.fontSizeExtraSmall
                color: Theme.secondaryColor
                wrapMode: Text.WordWrap
            }
        }
    }
}
