'use strict';

/**
 * dashboard.js — логика страницы статистики.
 *
 * Обрабатывает нажатия кнопок web-формы (Применить / Обновить / Демо-данные /
 * Экспорт CSV / Сбросить), асинхронно загружает данные через Api (fetch +
 * async/await + Promise.all) и рисует графики в Charts (canvas).
 */

(function (global) {
  var REFRESH_MS = 5000;

  var els = {
    form: document.getElementById('reportForm'),
    range: document.getElementById('range'),
    page: document.getElementById('page'),
    limit: document.getElementById('limit'),
    autoRefresh: document.getElementById('autoRefresh'),
    status: document.getElementById('reportStatus'),
    rangeBadge: document.getElementById('reportRange'),
    toast: document.getElementById('toast'),
    navToggle: document.getElementById('navToggle'),
    nav: document.getElementById('mainNav'),
    sessionsBody: document.querySelector('#sessionsTable tbody'),
    sourcesBody: document.querySelector('#sourcesTable tbody'),
    timelineNote: document.getElementById('timelineNote'),
    pagesNote: document.getElementById('pagesNote'),
    devicesNote: document.getElementById('devicesNote'),
    durationNote: document.getElementById('durationNote'),
    charts: {
      timeline: document.getElementById('timelineChart'),
      pages: document.getElementById('pagesChart'),
      devices: document.getElementById('devicesChart'),
      duration: document.getElementById('durationChart')
    }
  };

  var state = {
    range: '24h',
    page: '',
    limit: 15,
    autoRefresh: true,
    timer: null,
    lastStats: null,
    loading: false
  };

  var DEVICE_LABELS = {
    desktop: 'Компьютер',
    mobile: 'Телефон',
    tablet: 'Планшет',
    aurora: 'Аврора / Sailfish',
    bot: 'Боты'
  };

  // ------------------------------------------------------------- helpers ---

  function formatNumber(value) {
    var n = Number(value) || 0;
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function formatDuration(seconds) {
    var s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 60) return s + ' с';
    var minutes = Math.floor(s / 60);
    var rest = s % 60;
    if (minutes < 60) return minutes + ' мин ' + rest + ' с';
    var hours = Math.floor(minutes / 60);
    return hours + ' ч ' + (minutes % 60) + ' мин';
  }

  function formatTime(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    var pad = function (n) { return ('0' + n).slice(-2); };
    return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  var toastTimer = null;
  function toast(text, isError) {
    if (!els.toast) return;
    els.toast.textContent = text;
    els.toast.className = 'toast is-visible' + (isError ? ' is-error' : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.className = 'toast';
    }, 4000);
  }

  function setStatus(text) {
    if (els.status) els.status.textContent = text;
  }

  function readForm() {
    state.range = els.range ? els.range.value : '24h';
    state.page = els.page ? els.page.value : '';
    state.limit = els.limit ? Math.min(50, Math.max(1, Number(els.limit.value) || 15)) : 15;
    state.autoRefresh = els.autoRefresh ? els.autoRefresh.checked : false;
  }

  // ------------------------------------------------------------ rendering --

  function renderKpis(stats) {
    var values = {
      pageViews: formatNumber(stats.totals.pageViews),
      uniqueVisitors: formatNumber(stats.totals.uniqueVisitors),
      sessions: formatNumber(stats.totals.sessions),
      avgSessionDurationSec: formatDuration(stats.totals.avgSessionDurationSec),
      avgPagesPerSession: String(stats.totals.avgPagesPerSession),
      bounceRate: stats.totals.bounceRate + ' %',
      activeNow: formatNumber(stats.totals.activeNow),
      newVisitors: formatNumber(stats.totals.newVisitors),
      returningVisitors: formatNumber(stats.totals.returningVisitors),
      actions: formatNumber(stats.totals.actions)
    };
    Object.keys(values).forEach(function (key) {
      var node = document.querySelector('[data-kpi="' + key + '"]');
      if (node) node.textContent = values[key];
    });

    if (els.rangeBadge) {
      els.rangeBadge.textContent = stats.range.label +
        (stats.range.pageFilter ? ' · ' + stats.range.pageFilter : '');
    }
  }

  function renderCharts(stats) {
    Charts.drawLine(els.charts.timeline, stats.timeline, {
      series: [
        { key: 'views', color: Charts.palette[0], label: 'просмотры' },
        { key: 'visitors', color: Charts.palette[2], label: 'посетители' }
      ]
    });
    els.timelineNote.textContent = stats.timeline.length
      ? 'Точек на графике: ' + stats.timeline.length + ' (шаг ' +
        Math.round(stats.range.bucketMs / 60000) + ' мин)'
      : '';

    Charts.drawBars(els.charts.pages, stats.topPages.map(function (p, index) {
      return { label: p.page, value: p.views, color: Charts.palette[index % Charts.palette.length] };
    }), {
      valueLabel: function (item) { return item.value + ' просм. / ' + item.visitors + ' посещ.'; }
    });
    els.pagesNote.textContent = stats.topPages.length
      ? 'Всего страниц в статистике: ' + stats.topPages.length
      : '';

    var devices = Object.keys(stats.devices || {}).map(function (key, index) {
      return {
        label: DEVICE_LABELS[key] || key,
        value: stats.devices[key],
        color: Charts.palette[index % Charts.palette.length]
      };
    });
    Charts.drawDonut(els.charts.devices, devices);
    els.devicesNote.textContent = devices.length
      ? devices.map(function (d) { return d.label + ': ' + d.value; }).join(' · ')
      : '';

    var durations = stats.recentSessions.slice(0, 12).map(function (s, index) {
      return {
        label: formatTime(s.start).slice(0, 5),
        value: s.durationSec,
        color: s.open ? Charts.palette[3] : Charts.palette[0]
      };
    });
    Charts.drawColumns(els.charts.duration, durations);
    els.durationNote.textContent = durations.length
      ? 'Синим — закрытые сессии, оранжевым — ещё открытые (идёт heartbeat).'
      : '';
  }

  function renderSessions(stats) {
    if (!els.sessionsBody) return;
    els.sessionsBody.innerHTML = '';
    if (!stats.recentSessions.length) {
      els.sessionsBody.innerHTML = '<tr><td colspan="8">Сессий пока нет — откройте страницы сайта или нажмите «Демо-данные».</td></tr>';
      return;
    }
    stats.recentSessions.forEach(function (s) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + formatTime(s.start) + '</td>' +
        '<td title="' + s.visitorId + '">' + s.visitorId.slice(0, 8) + '…</td>' +
        '<td>' + (DEVICE_LABELS[s.device] || s.device) + '</td>' +
        '<td>' + formatDuration(s.durationSec) + '</td>' +
        '<td>' + s.pageViews + '</td>' +
        '<td>' + s.actions + '</td>' +
        '<td>' + s.entryPage + '</td>' +
        '<td>' + (s.open ? '<span class="tag tag-open">открыта</span>' : '<span class="tag">завершена</span>') + '</td>';
      els.sessionsBody.appendChild(tr);
    });
  }

  function renderSources(stats) {
    if (!els.sourcesBody) return;
    var rows = [];
    rows.push({ name: 'Прямые переходы (без источника)', count: stats.sources.direct });
    rows.push({ name: 'Внутри сайта', count: stats.sources.internal });
    (stats.sources.external || []).forEach(function (item) {
      rows.push({ name: 'Внешний: ' + item.host, count: item.count });
    });
    rows = rows.filter(function (row) { return row.count > 0; });

    els.sourcesBody.innerHTML = '';
    if (!rows.length) {
      els.sourcesBody.innerHTML = '<tr><td colspan="2">Данных нет.</td></tr>';
      return;
    }
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + row.name + '</td><td>' + row.count + '</td>';
      els.sourcesBody.appendChild(tr);
    });
  }

  // ------------------------------------------------------------- loading ---

  async function loadStats() {
    if (state.loading) return null;
    state.loading = true;
    setStatus('Загрузка данных…');

    try {
      var stats = await Api.getStats({ range: state.range, page: state.page, limit: state.limit });
      state.lastStats = stats;
      renderKpis(stats);
      renderCharts(stats);
      renderSessions(stats);
      renderSources(stats);
      setStatus(
        'Обновлено в ' + new Date(stats.generatedAt).toLocaleTimeString('ru-RU') +
        ' · всего за всё время: ' + formatNumber(stats.lifetime.pageViews) + ' просмотров, ' +
        formatNumber(stats.lifetime.uniqueVisitors) + ' посетителей'
      );
      return stats;
    } catch (err) {
      setStatus('Ошибка загрузки: ' + err.message);
      toast('Не удалось получить статистику: ' + err.message, true);
      return null;
    } finally {
      state.loading = false;
    }
  }

  async function loadPages() {
    if (!els.page) return;
    try {
      const data = await Api.getPages();
      const current = els.page.value;
      // Пересобираем список заново (кнопка «Демо-данные» не должна плодить дубли).
      els.page.innerHTML = '<option value="">все страницы</option>';
      data.pages.forEach(function (item) {
        var option = document.createElement('option');
        option.value = item.page;
        option.textContent = item.page + ' (' + item.views + ')';
        els.page.appendChild(option);
      });
      if (current) els.page.value = current;
    } catch (err) {
      toast('Не удалось загрузить список страниц: ' + err.message, true);
    }
  }

  // --------------------------------------------------------- auto refresh --

  function restartTimer() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (state.autoRefresh) {
      state.timer = setInterval(function () {
        if (global.document.visibilityState === 'visible') loadStats();
      }, REFRESH_MS);
    }
  }

  // ------------------------------------------------------------- actions ---

  async function handleSeed() {
    setStatus('Генерирую демонстрационные данные…');
    try {
      var result = await Api.postSeed({ visitors: 24, days: 7 });
      await loadPages();
      await loadStats();
      toast('Добавлено событий: ' + result.events + ', посетителей: ' + result.visitors);
    } catch (err) {
      toast('Ошибка: ' + err.message, true);
    }
  }

  async function handleReset() {
    if (!global.confirm('Очистить всю накопленную статистику? Это действие необратимо.')) return;
    try {
      await Api.postReset();
      await loadStats();
      toast('Статистика очищена');
    } catch (err) {
      toast('Ошибка сброса: ' + err.message, true);
    }
  }

  function handleExport() {
    var url = Api.exportUrl({ type: 'sessions', range: state.range, page: state.page, limit: state.limit });
    global.location.href = url;
    toast('CSV-файл с последними сессиями скачивается');
  }

  // ------------------------------------------------------------- binding ---

  function bindNav() {
    if (!els.navToggle || !els.nav) return;
    els.navToggle.addEventListener('click', function () {
      var open = els.nav.classList.toggle('is-open');
      els.navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function bindForm() {
    if (!els.form) return;

    els.form.addEventListener('submit', async function (event) {
      event.preventDefault();          // форма работает без перезагрузки страницы
      readForm();
      restartTimer();
      await loadStats();
      toast('Отчёт пересчитан');
    });

    var reload = document.getElementById('reloadReport');
    if (reload) reload.addEventListener('click', function () { loadStats(); });

    var seed = document.getElementById('seedDemo');
    if (seed) seed.addEventListener('click', handleSeed);

    var reset = document.getElementById('resetStats');
    if (reset) reset.addEventListener('click', handleReset);

    var exportBtn = document.getElementById('exportCsv');
    if (exportBtn) exportBtn.addEventListener('click', handleExport);

    [els.range, els.page, els.limit, els.autoRefresh].forEach(function (control) {
      if (!control) return;
      control.addEventListener('change', function () {
        readForm();
        restartTimer();
        loadStats();
      });
    });
  }

  function bindResize() {
    var timer = null;
    global.addEventListener('resize', function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        if (state.lastStats) renderCharts(state.lastStats);
      }, 200);
    });
  }

  // --------------------------------------------------------------- start ---

  async function init() {
    bindNav();
    bindForm();
    bindResize();
    readForm();
    await loadPages();
    await loadStats();
    restartTimer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
