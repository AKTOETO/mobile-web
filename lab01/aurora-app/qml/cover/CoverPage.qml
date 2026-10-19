import QtQuick 2.0
import Sailfish.Silica 1.0

CoverBackground {
    objectName: "defaultCover"

    Column {
        anchors.centerIn: parent
        width: parent.width - Theme.paddingLarge
        spacing: Theme.paddingSmall

        Image {
            anchors.horizontalCenter: parent.horizontalCenter
            source: Qt.resolvedUrl("../icons/aurorastat.svg")
            sourceSize { width: Theme.iconSizeMedium; height: Theme.iconSizeMedium }
        }

        Label {
            anchors.horizontalCenter: parent.horizontalCenter
            text: qsTr("Aurora Stat")
            font.pixelSize: Theme.fontSizeMedium
            color: Theme.primaryColor
        }

        Label {
            anchors.horizontalCenter: parent.horizontalCenter
            text: StatClient.connected
                  ? qsTr("%1 просмотров").arg(StatClient.counters.pageViews !== undefined
                                             ? StatClient.counters.pageViews : 0)
                  : qsTr("нет связи")
            font.pixelSize: Theme.fontSizeExtraSmall
            color: StatClient.connected ? Theme.highlightColor : Theme.secondaryColor
        }
    }
}
