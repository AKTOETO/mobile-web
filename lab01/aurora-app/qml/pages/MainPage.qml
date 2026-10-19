import QtQuick 2.0
import Sailfish.Silica 1.0
import "../components"

Page {
    id: page

    allowedOrientations: Orientation.All

    /** Безопасное чтение вложенного поля из StatClient.stats ("totals.pageViews"). */
    function statValue(path, fallback) {
        var node = StatClient.stats
        var parts = path.split(".")
        for (var i = 0; i < parts.length; i++) {
            if (node === undefined || node === null) {
                return fallback
            }
            node = node[parts[i]]
        }
        return (node === undefined || node === null) ? fallback : node
    }

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

    property var events: []

    Component.onCompleted: {
        if (!StatClient.connected) {
            StatClient.connectToServer()
        }
    }

    Connections {
        target: StatClient
        onEventReceived: {
            var label = event.device ? page.deviceLabel(event.device) : ""
            var list = page.events.slice()
            list.unshift({
                title: (event.type || "event") + "  " + (event.page || ""),
                subtitle: label + "  ·  " + StatClient.formatTime(event.ts)
            })
            if (list.length > 6) {
                list = list.slice(0, 6)
            }
            page.events = list
        }
    }

    SilicaFlickable {
        id: flickable
        anchors.fill: parent
        contentHeight: content.height + Theme.paddingLarge

        PullDownMenu {
            MenuItem {
                text: qsTr("Настройки подключения")
                onClicked: pageStack.push(Qt.resolvedUrl("SettingsPage.qml"))
            }
            MenuItem {
                text: qsTr("О приложении")
                onClicked: pageStack.push(Qt.resolvedUrl("AboutPage.qml"))
            }
        }

        Column {
            id: content
            width: parent.width
            spacing: Theme.paddingMedium

            PageHeader {
                title: qsTr("Статистика сайта")
                extraContent.children: [
                    IconButton {
                        objectName: "refreshButton"
                        icon.source: "image://theme/icon-m-refresh"
                        anchors.verticalCenter: parent.verticalCenter
                        onClicked: StatClient.refresh()
                    }
                ]
            }

            // Индикатор соединения
            Rectangle {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                height: connectionRow.height + Theme.paddingMedium
                radius: Theme.paddingSmall
                color: StatClient.connected
                       ? Theme.rgba(Theme.highlightColor, 0.18)
                       : Theme.rgba(Theme.errorColor, 0.18)
                border.width: 1
                border.color: StatClient.connected
                              ? Theme.highlightColor
                              : Theme.errorColor

                Row {
                    id: connectionRow
                    anchors.verticalCenter: parent.verticalCenter
                    x: Theme.paddingMedium
                    width: parent.width - 2 * Theme.paddingMedium
                    spacing: Theme.paddingMedium

                    Rectangle {
                        width: Theme.paddingMedium
                        height: width
                        radius: width / 2
                        anchors.verticalCenter: parent.verticalCenter
                        color: StatClient.connected ? "#43a047" : "#e53935"
                    }

                    Column {
                        width: parent.width - Theme.paddingMedium * 2
                        Label {
                            width: parent.width
                            text: StatClient.status
                            font.pixelSize: Theme.fontSizeSmall
                            color: Theme.primaryColor
                            truncationMode: TruncationMode.Fade
                        }
                        Label {
                            width: parent.width
                            text: StatClient.serverUrl
                            font.pixelSize: Theme.fontSizeExtraSmall
                            color: Theme.secondaryColor
                            truncationMode: TruncationMode.Fade
                        }
                    }
                }

                MouseArea {
                    anchors.fill: parent
                    onClicked: pageStack.push(Qt.resolvedUrl("SettingsPage.qml"))
                }
            }

            // KPI-плитки
            Grid {
                id: kpi
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                columns: 2
                spacing: Theme.paddingMedium

                StatCard {
                    width: (kpi.width - kpi.spacing) / 2
                    title: qsTr("Сейчас на сайте")
                    value: String(page.statValue("totals.activeNow", 0))
                    subtitle: qsTr("активны за 5 минут")
                    accentColor: "#4fc3f7"
                }
                StatCard {
                    width: (kpi.width - kpi.spacing) / 2
                    title: qsTr("Просмотры страниц")
                    value: String(page.statValue("totals.pageViews", 0))
                    subtitle: qsTr("за выбранный период")
                    accentColor: "#81c784"
                }
                StatCard {
                    width: (kpi.width - kpi.spacing) / 2
                    title: qsTr("Уникальные посетители")
                    value: String(page.statValue("totals.uniqueVisitors", 0))
                    subtitle: qsTr("уникальных идентификаторов")
                    accentColor: "#ffb74d"
                }
                StatCard {
                    width: (kpi.width - kpi.spacing) / 2
                    title: qsTr("Сессии")
                    value: String(page.statValue("totals.sessions", 0))
                    subtitle: StatClient.formatDuration(page.statValue("totals.avgSessionDurationSec", 0)) + " " + qsTr("в среднем")
                    accentColor: "#ba68c8"
                }
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: qsTr("За всё время: %1 просмотров, %2 посетителей, %3 сессий")
                      .arg(page.statValue("lifetime.pageViews", 0))
                      .arg(page.statValue("lifetime.uniqueVisitors", 0))
                      .arg(page.statValue("lifetime.sessions", 0))
                font.pixelSize: Theme.fontSizeExtraSmall
                color: Theme.secondaryColor
                wrapMode: Text.WordWrap
            }

            Button {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: qsTr("Открыть дашборд с графиками")
                onClicked: pageStack.push(Qt.resolvedUrl("DashboardPage.qml"))
            }

            Button {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: qsTr("Последние сессии")
                onClicked: pageStack.push(Qt.resolvedUrl("SessionsPage.qml"))
            }

            Button {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: qsTr("Проверить сбор: отправить событие")
                onClicked: StatClient.trackPageView("/aurora", "aurorastat:manual")
            }

            SectionHeader { text: qsTr("События в реальном времени") }

            Repeater {
                model: page.events

                delegate: ListItem {
                    contentHeight: Theme.itemSizeSmall
                    Label {
                        x: Theme.horizontalPageMargin
                        text: modelData.title
                        font.pixelSize: Theme.fontSizeSmall
                        color: Theme.primaryColor
                        truncationMode: TruncationMode.Fade
                    }
                    Label {
                        x: Theme.horizontalPageMargin
                        anchors.top: parent.top
                        anchors.topMargin: Theme.fontSizeSmall
                        text: modelData.subtitle
                        font.pixelSize: Theme.fontSizeExtraSmall
                        color: Theme.secondaryColor
                        truncationMode: TruncationMode.Fade
                    }
                }
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                visible: page.events.length === 0
                text: qsTr("Событий пока не было. Откройте сайт в браузере — события появятся здесь.")
                font.pixelSize: Theme.fontSizeExtraSmall
                color: Theme.secondaryColor
                wrapMode: Text.WordWrap
            }
        }
    }
}
