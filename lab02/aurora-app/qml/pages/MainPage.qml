import QtQuick 2.0
import Sailfish.Silica 1.0

Page {
    id: page

    function conditionColor(value) {
        if (value === "new") return "#4ade80"
        if (value === "good") return "#60a5fa"
        if (value === "used") return "#fbbf24"
        if (value === "broken") return "#f87171"
        return Theme.secondaryColor
    }

    SilicaListView {
        id: listView
        model: InventoryClient.model
        anchors.fill: parent

        header: Column {
            width: listView.width

            PageHeader {
                title: "Инвентарь"
            }

            Rectangle {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                height: statusColumn.height + Theme.paddingMedium * 2
                radius: Theme.paddingSmall
                color: InventoryClient.statusIsError
                       ? "#4a1f1f"
                       : (InventoryClient.online ? "#173a24" : "#3a3320")

                Column {
                    id: statusColumn
                    x: Theme.paddingMedium
                    y: Theme.paddingMedium
                    width: parent.width - 2 * Theme.paddingMedium
                    spacing: Theme.paddingSmall / 2

                    Label {
                        width: parent.width
                        text: InventoryClient.simulateOffline
                              ? "Офлайн (симуляция)"
                              : (InventoryClient.online ? "Онлайн" : "Офлайн")
                        color: InventoryClient.online && !InventoryClient.simulateOffline
                               ? "#4ade80" : "#fbbf24"
                        font.pixelSize: Theme.fontSizeSmall
                        font.bold: true
                    }

                    Label {
                        width: parent.width
                        text: InventoryClient.statusMessage
                        wrapMode: Text.WordWrap
                        color: Theme.primaryColor
                        font.pixelSize: Theme.fontSizeSmall
                    }

                    Label {
                        width: parent.width
                        text: "Предметов: " + InventoryClient.model.count
                              + "   ·   В очереди: " + InventoryClient.pendingCount
                        color: Theme.secondaryColor
                        font.pixelSize: Theme.fontSizeExtraSmall
                    }
                }
            }

            Item {
                width: 1
                height: Theme.paddingMedium
            }
        }

        delegate: ListItem {
            id: delegate
            contentHeight: Theme.itemSizeLarge

            onClicked: {
                pageStack.push(Qt.resolvedUrl("ItemPage.qml"), {
                    itemId: itemId,
                    itemName: name,
                    itemQuantity: quantity,
                    itemLocation: location,
                    itemCondition: condition
                })
            }

            Column {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                anchors.verticalCenter: parent.verticalCenter
                spacing: Theme.paddingSmall / 2

                Label {
                    width: parent.width
                    text: name
                    color: delegate.highlighted ? Theme.highlightColor : Theme.primaryColor
                    font.pixelSize: Theme.fontSizeMedium
                    truncationMode: TruncationMode.Elide
                }

                Row {
                    spacing: Theme.paddingMedium

                    Label {
                        text: "Кол-во: " + quantity
                        color: Theme.secondaryColor
                        font.pixelSize: Theme.fontSizeExtraSmall
                    }

                    Label {
                        text: location
                        color: Theme.secondaryColor
                        font.pixelSize: Theme.fontSizeExtraSmall
                        elide: Text.ElideRight
                        width: Math.min(implicitWidth, Theme.itemSizeHuge)
                    }

                    Label {
                        text: conditionLabel
                        color: page.conditionColor(condition)
                        font.pixelSize: Theme.fontSizeExtraSmall
                    }
                }
            }
        }

        footer: ListItem {
            contentHeight: Theme.itemSizeMedium

            onClicked: {
                pageStack.push(Qt.resolvedUrl("ItemPage.qml"), {
                    itemId: "",
                    itemName: "",
                    itemQuantity: 1,
                    itemLocation: "",
                    itemCondition: "new"
                })
            }

            Label {
                anchors.centerIn: parent
                text: "+ Добавить предмет"
                color: Theme.highlightColor
                font.pixelSize: Theme.fontSizeMedium
            }
        }

        ViewPlaceholder {
            enabled: listView.count === 0
            text: "Список пуст"
            hintText: "Потяните вниз, чтобы обновить, или добавьте предмет"
        }

        PullDownMenu {
            MenuItem {
                text: InventoryClient.pendingCount > 0
                      ? "Обновить и отправить изменения (" + InventoryClient.pendingCount + ")"
                      : "Обновить"
                enabled: !InventoryClient.busy
                onClicked: InventoryClient.refresh()
            }
            MenuItem {
                text: "Настройки"
                onClicked: pageStack.push(Qt.resolvedUrl("SettingsPage.qml"))
            }
            MenuItem {
                text: "О программе"
                onClicked: pageStack.push(Qt.resolvedUrl("AboutPage.qml"))
            }
        }

        VerticalScrollDecorator { }
    }

    BusyIndicator {
        anchors.centerIn: parent
        size: BusyIndicatorSize.Large
        running: InventoryClient.busy
        visible: running
    }
}
