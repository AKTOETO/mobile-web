'use strict';

/**
 * charts.js — рисование графиков на <canvas> без внешних библиотек.
 *
 * Доступны:
 *   Charts.drawLine  — временной ряд (просмотры и посетители);
 *   Charts.drawBars  — горизонтальные столбцы (популярные страницы);
 *   Charts.drawColumns — вертикальные столбцы (длительность сессий);
 *   Charts.drawDonut — кольцевая диаграмма (устройства).
 */

(function (global) {
  var PALETTE = ['#2f6df6', '#6b4df6', '#00a5a5', '#f2a33c', '#d64545', '#1c8a4a', '#8a8ff2', '#c2185b'];

  function theme() {
    var probe = global.document.body;
    var styles = global.getComputedStyle(probe);
    var read = function (name, fallback) {
      var value = styles.getPropertyValue(name);
      value = value ? String(value).trim() : '';
      return value || fallback;
    };
    return {
      text: read('--color-text', '#1c2333'),
      muted: read('--color-muted', '#64708a'),
      line: read('--color-line', '#dfe4ee'),
      surface: read('--color-surface', '#ffffff')
    };
  }

  /** Готовит canvas с учётом плотности пикселей экрана (ретина/телефон). */
  function setup(canvas) {
    var dpr = global.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(120, Math.floor(rect.width || canvas.clientWidth || 320));
    var h = Math.max(120, Math.floor(rect.height || canvas.clientHeight || 240));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '12px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    return { ctx: ctx, w: w, h: h, t: theme() };
  }

  function message(canvas, text) {
    var s = setup(canvas);
    s.ctx.fillStyle = s.t.muted;
    s.ctx.textAlign = 'center';
    s.ctx.fillText(text, s.w / 2, s.h / 2);
  }

  /** Округляет максимум шкалы до «красивого» числа. */
  function niceMax(value) {
    if (value <= 0) return 1;
    var magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    var normalized = value / magnitude;
    var step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return step * magnitude;
  }

  function truncate(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    var out = text;
    while (out.length > 3 && ctx.measureText(out + '…').width > maxWidth) out = out.slice(0, -1);
    return out + '…';
  }

  // ------------------------------------------------------------- line ------

  function drawLine(canvas, points, options) {
    options = options || {};
    if (!points || !points.length) return message(canvas, 'Нет данных за выбранный период');

    var s = setup(canvas);
    var ctx = s.ctx;
    var pad = { left: 42, right: 12, top: 14, bottom: 28 };
    var plotW = s.w - pad.left - pad.right;
    var plotH = s.h - pad.top - pad.bottom;

    var series = options.series || [{ key: 'views', color: PALETTE[0], label: 'просмотры' }];
    var max = 0;
    points.forEach(function (p) {
      series.forEach(function (se) { max = Math.max(max, Number(p[se.key]) || 0); });
    });
    var top = niceMax(max);

    // сетка и подписи оси Y
    ctx.strokeStyle = s.t.line;
    ctx.fillStyle = s.t.muted;
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    var steps = 4;
    for (var i = 0; i <= steps; i += 1) {
      var y = pad.top + (plotH * i) / steps;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
      ctx.fillText(String(Math.round(top * (1 - i / steps))), pad.left - 8, y);
    }

    var stepX = points.length > 1 ? plotW / (points.length - 1) : 0;
    var xAt = function (index) { return pad.left + stepX * index; };
    var yAt = function (value) { return pad.top + plotH - (Number(value) || 0) / top * plotH; };

    // заливка под первой линией
    var first = series[0];
    ctx.beginPath();
    points.forEach(function (p, index) {
      var x = xAt(index);
      var y = yAt(p[first.key]);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo(xAt(points.length - 1), pad.top + plotH);
    ctx.lineTo(xAt(0), pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = first.color + '22';
    ctx.fill();

    // линии серий
    series.forEach(function (se) {
      ctx.strokeStyle = se.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      points.forEach(function (p, index) {
        var x = xAt(index);
        var y = yAt(p[se.key]);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.fillStyle = se.color;
      points.forEach(function (p, index) {
        ctx.beginPath();
        ctx.arc(xAt(index), yAt(p[se.key]), 2.6, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // подписи оси X (не все, если их много)
    ctx.fillStyle = s.t.muted;
    ctx.textAlign = 'center';
    var every = Math.ceil(points.length / Math.max(2, Math.floor(plotW / 62)));
    points.forEach(function (p, index) {
      if (index % every !== 0 && index !== points.length - 1) return;
      ctx.fillText(p.label || '', xAt(index), pad.top + plotH + 14);
    });

    // легенда
    if (series.length > 1) {
      var legendX = pad.left;
      ctx.textAlign = 'left';
      series.forEach(function (se) {
        ctx.fillStyle = se.color;
        ctx.fillRect(legendX, pad.top - 8, 10, 4);
        ctx.fillStyle = s.t.muted;
        ctx.fillText(se.label, legendX + 14, pad.top - 6);
        legendX += 14 + ctx.measureText(se.label).width + 16;
      });
    }
  }

  // ------------------------------------------------------------- bars ------

  /** Горизонтальные столбцы: items = [{label, value, extra}] */
  function drawBars(canvas, items, options) {
    options = options || {};
    if (!items || !items.length) return message(canvas, 'Нет данных');

    var s = setup(canvas);
    var ctx = s.ctx;
    var pad = { left: 8, right: 46, top: 8, bottom: 8 };
    var labelWidth = Math.min(150, Math.max(70, Math.floor(s.w * 0.34)));
    var plotW = s.w - pad.left - pad.right - labelWidth;
    var rowHeight = Math.min(34, Math.max(18, Math.floor((s.h - pad.top - pad.bottom) / items.length)));

    var max = 0;
    items.forEach(function (item) { max = Math.max(max, Number(item.value) || 0); });
    var top = niceMax(max);

    items.forEach(function (item, index) {
      var y = pad.top + index * rowHeight;
      var barY = y + Math.floor((rowHeight - 12) / 2);
      var value = Number(item.value) || 0;
      var width = Math.max(2, Math.round((value / top) * plotW));

      ctx.fillStyle = s.t.text;
      ctx.textAlign = 'left';
      ctx.fillText(truncate(ctx, item.label, labelWidth - 6), pad.left, barY + 6);

      ctx.fillStyle = s.t.line;
      ctx.fillRect(pad.left + labelWidth, barY, plotW, 12);

      ctx.fillStyle = item.color || PALETTE[index % PALETTE.length];
      ctx.fillRect(pad.left + labelWidth, barY, width, 12);

      ctx.fillStyle = s.t.muted;
      ctx.textAlign = 'left';
      var caption = options.valueLabel ? options.valueLabel(item) : String(value);
      ctx.fillText(caption, pad.left + labelWidth + width + 6, barY + 6);
    });
  }

  // ----------------------------------------------------------- columns -----

  /** Вертикальные столбцы: items = [{label, value}] */
  function drawColumns(canvas, items) {
    if (!items || !items.length) return message(canvas, 'Нет данных');

    var s = setup(canvas);
    var ctx = s.ctx;
    var pad = { left: 40, right: 10, top: 14, bottom: 26 };
    var plotW = s.w - pad.left - pad.right;
    var plotH = s.h - pad.top - pad.bottom;

    var max = 0;
    items.forEach(function (item) { max = Math.max(max, Number(item.value) || 0); });
    var top = niceMax(max);

    ctx.strokeStyle = s.t.line;
    ctx.fillStyle = s.t.muted;
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    for (var i = 0; i <= 4; i += 1) {
      var y = pad.top + (plotH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
      ctx.fillText(String(Math.round(top * (1 - i / 4))), pad.left - 8, y);
    }

    var slot = plotW / items.length;
    var barWidth = Math.max(4, Math.min(28, Math.floor(slot * 0.62)));

    items.forEach(function (item, index) {
      var value = Number(item.value) || 0;
      var height = Math.max(1, Math.round((value / top) * plotH));
      var x = pad.left + slot * index + (slot - barWidth) / 2;
      var y = pad.top + plotH - height;
      ctx.fillStyle = item.color || PALETTE[index % PALETTE.length];
      ctx.fillRect(x, y, barWidth, height);

      if (slot > 26) {
        ctx.fillStyle = s.t.muted;
        ctx.textAlign = 'center';
        ctx.fillText(String(value), x + barWidth / 2, y - 8);
      }
    });

    ctx.fillStyle = s.t.muted;
    ctx.textAlign = 'center';
    var every = Math.ceil(items.length / Math.max(2, Math.floor(plotW / 54)));
    items.forEach(function (item, index) {
      if (index % every !== 0) return;
      var x = pad.left + slot * index + slot / 2;
      ctx.fillText(item.label || '', x, pad.top + plotH + 12);
    });
  }

  // ------------------------------------------------------------- donut -----

  /** entries = [{label, value}] */
  function drawDonut(canvas, entries) {
    if (!entries || !entries.length) return message(canvas, 'Нет данных');

    var s = setup(canvas);
    var ctx = s.ctx;
    var total = entries.reduce(function (acc, e) { return acc + (Number(e.value) || 0); }, 0);
    if (total <= 0) return message(canvas, 'Нет данных');

    var legendWidth = Math.min(170, Math.max(90, Math.floor(s.w * 0.4)));
    var chartArea = s.w - legendWidth;
    var radius = Math.min(chartArea, s.h) / 2 - 12;
    var inner = radius * 0.58;
    var cx = chartArea / 2;
    var cy = s.h / 2;

    var angle = -Math.PI / 2;
    entries.forEach(function (entry, index) {
      var slice = (Number(entry.value) || 0) / total * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = entry.color || PALETTE[index % PALETTE.length];
      ctx.fill();
      angle += slice;
    });

    // вырезанная середина
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = s.t.surface;
    ctx.fill();

    ctx.fillStyle = s.t.text;
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(String(total), cx, cy - 6);
    ctx.font = '11px "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillStyle = s.t.muted;
    ctx.fillText('сессий', cx, cy + 10);

    // легенда
    ctx.textAlign = 'left';
    var ly = cy - entries.length * 10;
    entries.forEach(function (entry, index) {
      var color = entry.color || PALETTE[index % PALETTE.length];
      var percent = Math.round((Number(entry.value) || 0) / total * 100);
      ctx.fillStyle = color;
      ctx.fillRect(chartArea + 4, ly - 5, 10, 10);
      ctx.fillStyle = s.t.text;
      ctx.fillText(entry.label, chartArea + 20, ly);
      ctx.fillStyle = s.t.muted;
      ctx.fillText(entry.value + ' (' + percent + '%)', chartArea + 20 + ctx.measureText(entry.label).width + 8, ly);
      ly += 20;
    });
  }

  global.Charts = {
    drawLine: drawLine,
    drawBars: drawBars,
    drawColumns: drawColumns,
    drawDonut: drawDonut,
    message: message,
    palette: PALETTE
  };
})(window);
