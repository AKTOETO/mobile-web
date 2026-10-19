import QtQuick 2.0
import Sailfish.Silica 1.0

Page {
    id: page

    allowedOrientations: Orientation.All

    function deviceLabel(key) {
        switch (key) {
        case "aurora": return qsTr("Аврора")
        case "desktop": return qsTr("Компьютер")
        case "mobile": return qsTr("Телефон")
        case "tablet": return qsTr("Планшет")
        case "bot": return qsTr("Робот")
        default: return key
        }
    }

    SilicaListView {
        id: listView
        anchors.fill: parent
        model: StatClient.sessions

        header: Column {
            width: listView.width

            PageHeader { title: qsTr("Последние сессии") }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: qsTr("Всего в периоде: %1").arg(StatClient.sessions.length)
                font.pixelSize: Theme.fontSizeExtraSmall
                color: Theme.secondaryColor
            }
        }

        delegate: ListItem {
            id: item
            contentHeight: itemColumn.height + Theme.paddingMedium

            Column {
                id: itemColumn
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                spacing: Theme.paddingSmall / 2

                Label {
                    width: parent.width
                    text: page.deviceLabel(modelData.device) + (modelData.open ? "  ·  " + qsTr("активна") : "")
                    font.pixelSize: Theme.fontSizeSmall
                    color: modelData.open ? Theme.highlightColor : Theme.primaryColor
                    truncationMode: TruncationMode.Fade
                }

                Label {
                    width: parent.width
                    text: qsTr("Посетитель: %1").arg(modelData.visitorId)
                    font.pixelSize: Theme.fontSizeExtraSmall
                    color: Theme.secondaryColor
                    truncationMode: TruncationMode.Fade
                }

                Label {
                    width: parent.width
                    text: qsTr("%1 → %2").arg(modelData.entryPage).arg(modelData.exitPage)
                    font.pixelSize: Theme.fontSizeExtraSmall
                    color: Theme.secondaryColor
                    truncationMode: TruncationMode.Fade
                }

                Label {
                    width: parent.width
                    text: qsTr("Просмотров: %1 · Действий: %2 · Длительность: %3")
                          .arg(modelData.pageViews)
                          .arg(modelData.actions)
                          .arg(StatClient.formatDuration(modelData.durationSec))
                    font.pixelSize: Theme.fontSizeExtraSmall
                    color: Theme.primaryColor
                    truncationMode: TruncationMode.Fade
                }

                Label {
                    width: parent.width
                    text: StatClient.formatTime(modelData.start)
                          + (modelData.end ? " — " + StatClient.formatTime(modelData.end) : "")
                    font.pixelSize: Theme.fontSizeExtraSmall
                    color: Theme.secondaryColor
                }
            }
        }

        VerticalScrollDecorator { flickable: listView }

        ViewPlaceholder {
            enabled: listView.count === 0
            text: qsTr("Сессий пока нет")
            hintText: qsTr("Подключитесь к серверу и откройте сайт в браузере")
        }
    }
}
