import QtQuick 2.0
import Sailfish.Silica 1.0

Page {
    id: page

    property string itemId: ""
    property string itemName: ""
    property int itemQuantity: 1
    property string itemLocation: ""
    property string itemCondition: "new"

    readonly property bool isNew: itemId.length === 0

    function conditionIndex(value) {
        if (value === "good") return 1
        if (value === "used") return 2
        if (value === "broken") return 3
        return 0
    }

    function conditionValue(index) {
        if (index === 1) return "good"
        if (index === 2) return "used"
        if (index === 3) return "broken"
        return "new"
    }

    function save() {
        var quantity = parseInt(quantityField.text)
        if (isNaN(quantity) || quantity < 0) quantity = 0
        if (isNew) {
            InventoryClient.createItem(nameField.text, quantity,
                                       locationField.text,
                                       conditionValue(conditionBox.currentIndex))
        } else {
            InventoryClient.updateItem(page.itemId, nameField.text, quantity,
                                       locationField.text,
                                       conditionValue(conditionBox.currentIndex))
        }
        pageStack.pop()
    }

    SilicaFlickable {
        anchors.fill: parent
        contentHeight: content.height + Theme.paddingLarge

        Column {
            id: content
            width: parent.width
            spacing: Theme.paddingLarge

            PageHeader {
                title: page.isNew ? "Новый предмет" : "Редактирование"
            }

            TextField {
                id: nameField
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                label: "Название"
                placeholderText: "Например, дрель ударная"
                text: page.itemName
            }

            TextField {
                id: quantityField
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                label: "Количество"
                inputMethodHints: Qt.ImhDigitsOnly
                text: page.itemQuantity
                validator: IntValidator { bottom: 0; top: 1000000 }
            }

            TextField {
                id: locationField
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                label: "Место хранения"
                placeholderText: "Склад, стеллаж"
                text: page.itemLocation
            }

            ComboBox {
                id: conditionBox
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                label: "Состояние"
                currentIndex: page.conditionIndex(page.itemCondition)

                menu: ContextMenu {
                    MenuItem { text: "новый" }
                    MenuItem { text: "хорошее" }
                    MenuItem { text: "б/у" }
                    MenuItem { text: "неисправен" }
                }
            }

            Button {
                anchors.horizontalCenter: parent.horizontalCenter
                text: page.isNew ? "Создать" : "Сохранить"
                onClicked: page.save()
            }

            Button {
                anchors.horizontalCenter: parent.horizontalCenter
                visible: !page.isNew
                text: "Удалить"
                onClicked: {
                    remorse.execute(page, "Удаление предмета", function() {
                        InventoryClient.deleteItem(page.itemId)
                        pageStack.pop()
                    })
                }
            }

            Label {
                x: Theme.horizontalPageMargin
                width: parent.width - 2 * Theme.horizontalPageMargin
                text: "Без сети изменения сохраняются в локальной очереди (SQLite) "
                      + "и отправляются на сервер при синхронизации."
                wrapMode: Text.WordWrap
                color: Theme.secondaryColor
                font.pixelSize: Theme.fontSizeSmall
            }
        }
    }

    RemorseItem {
        id: remorse
    }
}
