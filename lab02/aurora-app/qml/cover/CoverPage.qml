import QtQuick 2.0
import Sailfish.Silica 1.0

CoverBackground {
    Column {
        anchors.centerIn: parent
        width: parent.width - 2 * Theme.paddingMedium
        spacing: Theme.paddingSmall

        Label {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "Инвентарь"
            color: Theme.primaryColor
            font.pixelSize: Theme.fontSizeLarge
            font.bold: true
        }

        Label {
            anchors.horizontalCenter: parent.horizontalCenter
            text: InventoryClient.online ? "онлайн" : "офлайн"
            color: InventoryClient.online ? "#4ade80" : "#fbbf24"
            font.pixelSize: Theme.fontSizeSmall
        }

        Label {
            anchors.horizontalCenter: parent.horizontalCenter
            text: InventoryClient.model.count + " предметов"
            color: Theme.secondaryColor
            font.pixelSize: Theme.fontSizeSmall
        }

        Label {
            anchors.horizontalCenter: parent.horizontalCenter
            visible: InventoryClient.pendingCount > 0
            text: InventoryClient.pendingCount + " в очереди"
            color: Theme.highlightColor
            font.pixelSize: Theme.fontSizeSmall
        }
    }

    CoverActionList {
        CoverAction {
            iconSource: "image://theme/icon-m-refresh"
            onTriggered: InventoryClient.refresh()
        }
    }
}
