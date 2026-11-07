import QtQuick 2.0
import Sailfish.Silica 1.0

Page {
    id: page

    property string demoLogText: ""
    property int demoLogs: 0

    function reload() {
        demoLogText = InventoryClient.demoLog()
        demoLogs++
    }

    Component.onCompleted: reload()

    Connections {
        target: InventoryClient
        onDemoLogChanged: page.reload()
    }

    SilicaFlickable {
        anchors.fill: parent
        contentHeight: header.height + logLabel.height + Theme.paddingLarge * 3

        Column {
            id: header
            width: parent.width

            PageHeader {
                title: "Демо-журнал"
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: "Файл: " + InventoryClient.demoLogPath
                color: Theme.secondaryColor
                font.pixelSize: Theme.fontSizeExtraSmall
                wrapMode: Text.WrapAnywhere
            }
        }

        Label {
            id: logLabel
            x: Theme.horizontalPageMargin
            y: header.height + Theme.paddingMedium
            width: parent.width - 2 * Theme.horizontalPageMargin
            text: page.demoLogText.length > 0 ? page.demoLogText : "Журнал пуст."
            wrapMode: Text.WrapAnywhere
            color: Theme.primaryColor
            font.pixelSize: Theme.fontSizeExtraSmall
        }
    }
}
