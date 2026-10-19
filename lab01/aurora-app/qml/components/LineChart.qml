import QtQuick 2.0
import Sailfish.Silica 1.0

/**
 * График-линия по точкам временного ряда.
 * points: [{ t, label, views, visitors }, …]
 */
Item {
    id: root

    property var points: []
    property color viewsColor: Theme.highlightColor
    property color visitorsColor: Theme.secondaryHighlightColor
    property string emptyText: qsTr("Нет данных за выбранный период")
    property string gridColor: "rgba(255,255,255,0.18)"

    implicitHeight: Theme.itemSizeLarge * 3.2

    Canvas {
        id: canvas
        anchors.fill: parent
        onWidthChanged: requestPaint()
        onHeightChanged: requestPaint()

        onPaint: {
            var ctx = getContext("2d")
            var w = width
            var h = height
            ctx.clearRect(0, 0, w, h)

            var left = Theme.paddingLarge * 1.2
            var right = Theme.paddingSmall
            var top = Theme.paddingSmall
            var bottom = Theme.fontSizeSmall * 1.6
            var plotW = w - left - right
            var plotH = h - top - bottom

            var pts = root.points || []
            if (pts.length < 2 || plotW <= 0 || plotH <= 0) {
                ctx.fillStyle = Theme.secondaryColor
                ctx.font = Theme.fontSizeSmall + "px sans-serif"
                ctx.textAlign = "center"
                ctx.fillText(root.emptyText, w / 2, h / 2)
                return
            }

            var maxValue = 1
            for (var i = 0; i < pts.length; i++) {
                maxValue = Math.max(maxValue, pts[i].views || 0, pts[i].visitors || 0)
            }
            maxValue = Math.ceil(maxValue * 1.1)

            ctx.font = Theme.fontSizeExtraSmall + "px sans-serif"

            // Сетка и подписи оси Y
            ctx.strokeStyle = root.gridColor
            ctx.lineWidth = 1
            ctx.fillStyle = Theme.secondaryColor
            ctx.textAlign = "right"
            for (var g = 0; g <= 4; g++) {
                var gy = top + plotH * g / 4
                ctx.beginPath()
                ctx.moveTo(left, gy)
                ctx.lineTo(left + plotW, gy)
                ctx.stroke()
                var value = Math.round(maxValue * (1 - g / 4))
                ctx.fillText(String(value), left - 6, gy + Theme.fontSizeExtraSmall / 3)
            }

            var n = pts.length
            function xAt(idx) { return left + plotW * idx / (n - 1) }
            function yAt(v) { return top + plotH * (1 - Math.min(v, maxValue) / maxValue) }

            function drawSeries(field, color) {
                ctx.strokeStyle = color
                ctx.lineWidth = 2
                ctx.beginPath()
                for (var k = 0; k < n; k++) {
                    var x = xAt(k)
                    var y = yAt(pts[k][field] || 0)
                    if (k === 0) {
                        ctx.moveTo(x, y)
                    } else {
                        ctx.lineTo(x, y)
                    }
                }
                ctx.stroke()
            }

            drawSeries("views", root.viewsColor)
            drawSeries("visitors", root.visitorsColor)

            // Подписи оси X (не более пяти)
            ctx.fillStyle = Theme.secondaryColor
            ctx.textAlign = "center"
            var step = Math.max(1, Math.ceil(n / 5))
            for (var t = 0; t < n; t += step) {
                ctx.fillText(pts[t].label || "", xAt(t), h - Theme.fontSizeExtraSmall / 2)
            }
        }
    }

    Connections {
        target: root
        onPointsChanged: canvas.requestPaint()
    }
}
