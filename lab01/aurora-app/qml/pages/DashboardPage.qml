import QtQuick 2.0
import Sailfish.Silica 1.0
import "../components"

Page {
    id: page

    allowedOrientations: Orientation.All

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

    readonly property var rangeKeys: ["24h", "7d", "30d", "all"]
    readonly property var rangeTitles: [qsTr("24 ч"), qsTr("7 дней"), qsTr("30 дней"), qsTr("Всё время")]

    SilicaFlickable {
        id: flickable
        anchors.fill: parent
        contentHeight: content.height + Theme.paddingLarge

        PullDownMenu {
            MenuItem {
                text: qsTr("Обновить")
                onClicked: StatClient.refresh()
            }
        }

        Column {
            id: content
            width: parent.width
            spacing: Theme.paddingMedium

            PageHeader { title: qsTr("Дашборд") }

            // Выбор периода
            Row {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                spacing: Theme.paddingSmall

                Repeater {
                    model: page.rangeKeys.length

                    Button {
                        width: (parent.width - Theme.paddingSmall * 3) / 4
                        text: page.rangeTitles[index]
                        highlighted: StatClient.range === page.rangeKeys[index]
                        onClicked: StatClient.range = page.rangeKeys[index]
                    }
                }
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: qsTr("Период: %1 · обновлено %2")
                      .arg(page.statValue("range.label", ""))
                      .arg(StatClient.formatTime(page.statValue("generatedAt", 0)))
                font.pixelSize: Theme.fontSizeExtraSmall
                color: Theme.secondaryColor
            }

            SectionHeader { text: qsTr("Просмотры по времени") }

            Row {
                x: Theme.horizontalPageMargin
                spacing: Theme.paddingMedium

                Row {
                    spacing: Theme.paddingSmall
                    Rectangle {
                        width: Theme.fontSizeSmall * 0.5
                        height: 2
                        color: Theme.highlightColor
                        anchors.verticalCenter: parent.verticalCenter
                    }
                    Label {
                        text: qsTr("просмотры")
                        font.pixelSize: Theme.fontSizeExtraSmall
                        color: Theme.secondaryColor
                    }
                }
                Row {
                    spacing: Theme.paddingSmall
                    Rectangle {
                        width: Theme.fontSizeSmall * 0.5
                        height: 2
                        color: Theme.secondaryHighlightColor
                        anchors.verticalCenter: parent.verticalCenter
                    }
                    Label {
                        text: qsTr("посетители")
                        font.pixelSize: Theme.fontSizeExtraSmall
                        color: Theme.secondaryColor
                    }
                }
            }

            LineChart {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                points: page.statValue("timeline", [])
            }

            SectionHeader { text: qsTr("Устройства посетителей") }

            DeviceDonut {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                data: page.statValue("devices", ({}))
            }

            SectionHeader { text: qsTr("Популярные страницы") }

            BarList {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                items: page.statValue("topPages", [])
            }

            SectionHeader { text: qsTr("Источники переходов") }

            Column {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                spacing: Theme.paddingSmall / 2

                Repeater {
                    model: [
                        { title: qsTr("Прямые заходы"), value: page.statValue("sources.direct", 0) },
                        { title: qsTr("Внутренние переходы"), value: page.statValue("sources.internal", 0) }
                    ]

                    Label {
                        text: modelData.title + ": " + modelData.value
                        font.pixelSize: Theme.fontSizeSmall
                        color: Theme.primaryColor
                    }
                }

                Repeater {
                    model: page.statValue("sources.external", [])

                    Label {
                        text: qsTr("С сайта %1: %2").arg(modelData.host).arg(modelData.count)
                        font.pixelSize: Theme.fontSizeSmall
                        color: Theme.secondaryColor
                    }
                }
            }

            SectionHeader { text: qsTr("Показатели периода") }

            Column {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                spacing: Theme.paddingSmall / 2

                Label {
                    text: qsTr("Просмотров на сессию: %1").arg(page.statValue("totals.avgPagesPerSession", 0))
                    font.pixelSize: Theme.fontSizeSmall
                    color: Theme.primaryColor
                }
                Label {
                    text: qsTr("Показатель отказов: %1 %").arg(page.statValue("totals.bounceRate", 0))
                    font.pixelSize: Theme.fontSizeSmall
                    color: Theme.primaryColor
                }
                Label {
                    text: qsTr("Средняя длительность сессии: %1")
                          .arg(StatClient.formatDuration(page.statValue("totals.avgSessionDurationSec", 0)))
                    font.pixelSize: Theme.fontSizeSmall
                    color: Theme.primaryColor
                }
                Label {
                    text: qsTr("Максимальная длительность сессии: %1")
                          .arg(StatClient.formatDuration(page.statValue("totals.maxSessionDurationSec", 0)))
                    font.pixelSize: Theme.fontSizeSmall
                    color: Theme.primaryColor
                }
            }
        }
    }
}
