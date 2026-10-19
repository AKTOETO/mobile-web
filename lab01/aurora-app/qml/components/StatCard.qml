import QtQuick 2.0
import Sailfish.Silica 1.0

/** KPI-плитка: подпись сверху, крупное значение, пояснение снизу. */
Rectangle {
    id: card

    property string title: ""
    property string value: "—"
    property string subtitle: ""
    property color accentColor: Theme.highlightColor

    radius: Theme.paddingSmall
    color: Theme.rgba(accentColor, 0.12)
    border.width: 1
    border.color: Theme.rgba(accentColor, 0.35)

    implicitHeight: Theme.itemSizeLarge + Theme.paddingLarge
    implicitWidth: Theme.itemSizeLarge * 2

    Column {
        anchors.fill: parent
        anchors.margins: Theme.paddingMedium
        spacing: Theme.paddingSmall / 2

        Label {
            width: parent.width
            text: card.title
            font.pixelSize: Theme.fontSizeExtraSmall
            color: Theme.secondaryColor
            truncationMode: TruncationMode.Fade
        }

        Label {
            id: valueLabel
            width: parent.width
            text: card.value
            font.pixelSize: Theme.fontSizeLarge
            font.bold: true
            color: card.accentColor
            truncationMode: TruncationMode.Fade
        }

        Label {
            width: parent.width
            text: card.subtitle
            visible: text.length > 0
            font.pixelSize: Theme.fontSizeExtraSmall
            color: Theme.secondaryColor
            truncationMode: TruncationMode.Fade
        }
    }
}
