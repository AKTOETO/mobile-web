import QtQuick 2.0
import Sailfish.Silica 1.0

/**
 * Список горизонтальных столбцов (популярные страницы).
 * items: [{ page, views, visitors }, …]
 */
Item {
    id: root

    property var items: []
    property color barColor: Theme.highlightColor
    property string emptyText: qsTr("Нет данных")

    function maxViews() {
        var maximum = 1
        for (var i = 0; i < items.length; i++) {
            maximum = Math.max(maximum, items[i].views || 0)
        }
        return maximum
    }

    implicitHeight: Math.max(Theme.itemSizeSmall, content.height)

    Column {
        id: content
        width: parent.width
        spacing: Theme.paddingMedium

        Repeater {
            model: root.items

            delegate: Column {
                width: content.width
                spacing: Theme.paddingSmall / 2

                Label {
                    width: parent.width
                    text: modelData.page
                    font.pixelSize: Theme.fontSizeExtraSmall
                    color: Theme.primaryColor
                    truncationMode: TruncationMode.Fade
                }

                Rectangle {
                    width: parent.width
                    height: Theme.fontSizeExtraSmall
                    radius: height / 2
                    color: Theme.rgba(root.barColor, 0.2)

                    Rectangle {
                        width: parent.width * (modelData.views || 0) / root.maxViews()
                        height: parent.height
                        radius: parent.radius
                        color: root.barColor
                    }
                }

                Label {
                    width: parent.width
                    text: qsTr("%1 просмотров · %2 посетителей")
                          .arg(modelData.views || 0)
                          .arg(modelData.visitors || 0)
                    font.pixelSize: Theme.fontSizeExtraSmall
                    color: Theme.secondaryColor
                    truncationMode: TruncationMode.Fade
                }
            }
        }
    }

    Label {
        anchors.centerIn: parent
        visible: root.items.length === 0
        text: root.emptyText
        font.pixelSize: Theme.fontSizeSmall
        color: Theme.secondaryColor
    }
}
