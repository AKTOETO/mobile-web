import QtQuick 2.0
import Sailfish.Silica 1.0

ApplicationWindow {
    initialPage: Component {
        Page {
            SilicaFlickable {
                anchors.fill: parent
                contentHeight: column.height + Theme.paddingLarge
                Column {
                    id: column
                    width: parent.width - 2 * Theme.horizontalPageMargin
                    x: Theme.horizontalPageMargin
                    spacing: Theme.paddingSmall
                    PageHeader { title: "ЛР3 · Инвентарь" }
                    TextField {
                        id: address
                        width: parent.width
                        text: Client.baseUrl
                        label: "Балансировщик nginx"
                        placeholderText: "http://10.0.2.2:9083"
                        inputMethodHints: Qt.ImhUrlCharactersOnly
                        EnterKey.onClicked: { Client.configure(text); focus = false }
                    }
                    Row {
                        spacing: Theme.paddingMedium
                        Button { text: "Подключить"; onClicked: Client.configure(address.text) }
                        Button { text: "Обновить"; onClicked: Client.refresh() }
                    }
                    Label { text: Client.status; color: Theme.highlightColor; width: parent.width; wrapMode: Text.Wrap }
                    Label { text: "REST: " + Client.backend; width: parent.width; wrapMode: Text.Wrap }
                    Label { text: Client.items; width: parent.width; wrapMode: Text.Wrap; font.pixelSize: Theme.fontSizeSmall }
                    SectionHeader { text: "Push-уведомления: " + Client.pushCount }
                    Label { text: Client.push; width: parent.width; wrapMode: Text.Wrap; color: Theme.highlightColor; font.pixelSize: Theme.fontSizeSmall }
                    SectionHeader { text: "Журнал соединения" }
                    Label { text: Client.history; width: parent.width; wrapMode: Text.Wrap; font.pixelSize: Theme.fontSizeExtraSmall }
                }
                VerticalScrollDecorator { }
            }
        }
    }
    cover: Component {
        CoverBackground {
            Label { anchors.centerIn: parent; width: parent.width; text: "Инвентарь\n" + Client.backend; wrapMode: Text.Wrap; horizontalAlignment: Text.AlignHCenter }
        }
    }
}
