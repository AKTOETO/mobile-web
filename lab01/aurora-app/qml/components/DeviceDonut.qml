import QtQuick 2.0
import Sailfish.Silica 1.0

/**
 * Кольцевая диаграмма распределения посетителей по устройствам.
 * data: { desktop: 21, aurora: 3, … }
 */
Item {
    id: root

    property var data: ({})
    property var palette: ["#4fc3f7", "#ff8a65", "#81c784", "#ba68c8",
                           "#ffd54f", "#4db6ac", "#f06292", "#a1887f"]
    property string emptyText: qsTr("Нет данных")

    implicitHeight: Math.max(Theme.itemSizeLarge * 2.4, legend.height)

    function entries() {
        var list = []
        if (data) {
            for (var key in data) {
                if (data.hasOwnProperty(key)) {
                    list.push({ label: key, value: data[key] })
                }
            }
        }
        list.sort(function (a, b) { return b.value - a.value })
        return list
    }

    function total() {
        var list = entries()
        var sum = 0
        for (var i = 0; i < list.length; i++) {
            sum += list[i].value
        }
        return sum
    }

    Canvas {
        id: donut
        width: Math.min(parent.height, parent.width * 0.45)
        height: width
        anchors.left: parent.left
        anchors.verticalCenter: parent.verticalCenter
        onWidthChanged: requestPaint()
        onHeightChanged: requestPaint()

        onPaint: {
            var ctx = getContext("2d")
            var w = width
            var h = height
            ctx.clearRect(0, 0, w, h)

            var list = root.entries()
            var sum = root.total()
            if (list.length === 0 || sum <= 0) {
                ctx.fillStyle = Theme.secondaryColor
                ctx.font = Theme.fontSizeSmall + "px sans-serif"
                ctx.textAlign = "center"
                ctx.fillText(root.emptyText, w / 2, h / 2)
                return
            }

            var cx = w / 2
            var cy = h / 2
            var outer = Math.min(w, h) / 2 - 2
            var inner = outer * 0.62
            var start = -Math.PI / 2

            for (var i = 0; i < list.length; i++) {
                var end = start + (list[i].value / sum) * Math.PI * 2
                ctx.beginPath()
                ctx.moveTo(cx + inner * Math.cos(start), cy + inner * Math.sin(start))
                ctx.arc(cx, cy, outer, start, end, false)
                ctx.arc(cx, cy, inner, end, start, true)
                ctx.closePath()
                ctx.fillStyle = root.palette[i % root.palette.length]
                ctx.fill()
                start = end
            }

            ctx.fillStyle = Theme.primaryColor
            ctx.font = "bold " + Theme.fontSizeMedium + "px sans-serif"
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.fillText(String(sum), cx, cy)
            ctx.textBaseline = "alphabetic"
        }
    }

    Column {
        id: legend
        anchors.left: donut.right
        anchors.leftMargin: Theme.paddingMedium
        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        spacing: Theme.paddingSmall / 2

        Repeater {
            model: root.entries()

            Row {
                width: legend.width
                spacing: Theme.paddingSmall

                Rectangle {
                    width: Theme.fontSizeSmall * 0.6
                    height: width
                    radius: width / 2
                    color: root.palette[index % root.palette.length]
                    anchors.verticalCenter: parent.verticalCenter
                }

                Label {
                    width: parent.width - Theme.fontSizeSmall
                    text: modelData.label + " — " + modelData.value
                    font.pixelSize: Theme.fontSizeSmall
                    color: Theme.primaryColor
                    truncationMode: TruncationMode.Fade
                }
            }
        }
    }

    Connections {
        target: root
        onDataChanged: donut.requestPaint()
    }
}
