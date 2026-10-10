'use strict';

/**
 * app.js — поведение демонстрационного сайта.
 *
 * 1) Мобильное меню (бургер).
 * 2) Живые счётчики на главной (async fetch /api/stats).
 * 3) Форма фильтра каталога: кнопки «Применить», «Сбросить», «Показать ещё».
 * 4) Web-форма обратной связи: валидация + асинхронный POST /api/feedback.
 */

(function (global) {
  var document = global.document;

  // ------------------------------------------------------------- helpers ---

  function qs(selector) { return document.querySelector(selector); }
  function qsa(selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); }

  function formatDuration(seconds) {
    var s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 60) return s + ' с';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' мин ' + (s % 60) + ' с';
    return Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин';
  }

  function formatNumber(value) {
    return String(Number(value) || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  // ---------------------------------------------------------- mobile menu --

  function initNav() {
    var toggle = qs('#navToggle');
    var nav = qs('#mainNav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // ------------------------------------------------------- live counters ---

  async function initLiveStats() {
    var grid = qs('#liveStats');
    if (!grid) return;
    var note = qs('#statsNote');

    async function refresh() {
      try {
        var stats = await Api.getStats({ range: 'all' });
        var values = {
          pageViews: formatNumber(stats.lifetime.pageViews),
          uniqueVisitors: formatNumber(stats.lifetime.uniqueVisitors),
          sessions: formatNumber(stats.lifetime.sessions),
          avgSessionDurationSec: formatDuration(stats.lifetime.avgSessionDurationSec)
        };
        qsa('[data-stat]').forEach(function (node) {
          var key = node.getAttribute('data-stat');
          if (values[key] !== undefined) node.textContent = values[key];
        });
        if (note) {
          note.textContent = 'Сервер отвечает: просмотров всего — ' + formatNumber(stats.lifetime.pageViews) +
            ', сессий — ' + formatNumber(stats.lifetime.sessions) +
            ', на сайте сейчас — ' + stats.totals.activeNow + '.';
        }
      } catch (err) {
        if (note) note.textContent = 'Ошибка загрузки статистики: ' + err.message;
      }
    }

    await refresh();

    var button = qs('#refreshCounters');
    if (button) {
      button.addEventListener('click', async function () {
        button.disabled = true;
        await refresh();
        button.disabled = false;
      });
    }

    var demoAction = qs('#demoAction');
    if (demoAction) {
      var counter = 0;
      var actionNote = qs('#actionNote');
      demoAction.addEventListener('click', function () {
        counter += 1;
        if (actionNote) {
          actionNote.textContent = 'Отправлено событий action с этой страницы: ' + counter +
            ' (см. график «нажатий кнопок» на дашборде).';
        }
      });
    }
  }

  // ------------------------------------------------------------- catalog ---

  var PRODUCTS = [
    { id: 1, name: 'Смартфон Aurora X', category: 'phones', price: 21900, stock: true, note: 'ОС Аврора' },
    { id: 2, name: 'Смартфон Nova 5G', category: 'phones', price: 34900, stock: true, note: 'Android 14' },
    { id: 3, name: 'Смартфон Compact Lite', category: 'phones', price: 12900, stock: false, note: 'бюджетный' },
    { id: 4, name: 'Планшет Tab 10', category: 'tablets', price: 27500, stock: true, note: '10.1"' },
    { id: 5, name: 'Планшет Tab Pro 12', category: 'tablets', price: 45900, stock: true, note: '12.4", стилус' },
    { id: 6, name: 'Планшет Kids Tab', category: 'tablets', price: 14300, stock: false, note: 'детский режим' },
    { id: 7, name: 'Смарт-часы Watch S', category: 'wearable', price: 9900, stock: true, note: 'пульс, GPS' },
    { id: 8, name: 'Фитнес-браслет Band 6', category: 'wearable', price: 4500, stock: true, note: '14 дней без зарядки' },
    { id: 9, name: 'Наушники Air Buds', category: 'audio', price: 7800, stock: true, note: 'шумоподавление' },
    { id: 10, name: 'Гарнитура Studio Max', category: 'audio', price: 18900, stock: false, note: 'полноразмерные' },
    { id: 11, name: 'Колонка Boom Mini', category: 'audio', price: 5600, stock: true, note: 'Bluetooth 5.3' },
    { id: 12, name: 'Смартфон Aurora Pro', category: 'phones', price: 39900, stock: true, note: 'ОС Аврора, 512 ГБ' }
  ];

  var catalogState = { shown: 6, filtered: PRODUCTS.slice() };

  function renderCatalog() {
    var box = qs('#catalog');
    var note = qs('#filterNote');
    if (!box) return;

    box.innerHTML = '';
    var visible = catalogState.filtered.slice(0, catalogState.shown);

    if (!visible.length) {
      box.innerHTML = '<p class="muted">По фильтрам ничего не найдено. Измените условия.</p>';
    }

    visible.forEach(function (item) {
      var card = document.createElement('article');
      card.className = 'card';
      card.innerHTML =
        '<h3>' + item.name + '</h3>' +
        '<span class="badge">' + item.note + '</span>' +
        '<span class="price">' + formatNumber(item.price) + ' ₽</span>' +
        '<span class="badge">' + (item.stock ? 'в наличии' : 'нет в наличии') + '</span>';
      box.appendChild(card);
    });

    if (note) {
      note.textContent = 'Показано ' + visible.length + ' из ' + catalogState.filtered.length + '.';
    }

    var more = qs('#loadMore');
    if (more) more.disabled = catalogState.shown >= catalogState.filtered.length;
  }

  function readFilters() {
    return {
      category: (qs('#category') || {}).value || '',
      maxPrice: Number((qs('#maxPrice') || {}).value) || Infinity,
      search: ((qs('#search') || {}).value || '').trim().toLowerCase(),
      inStock: !!(qs('#inStock') && qs('#inStock').checked)
    };
  }

  function applyFilters() {
    var f = readFilters();
    catalogState.filtered = PRODUCTS.filter(function (item) {
      if (f.category && item.category !== f.category) return false;
      if (item.price > f.maxPrice) return false;
      if (f.inStock && !item.stock) return false;
      if (f.search && item.name.toLowerCase().indexOf(f.search) === -1) return false;
      return true;
    });
    catalogState.shown = 6;
    renderCatalog();
  }

  function initCatalog() {
    var form = qs('#filterForm');
    if (!form) return;

    renderCatalog();

    form.addEventListener('submit', function (event) {
      event.preventDefault();          // кнопка формы обрабатывается JS, без перезагрузки
      applyFilters();
      var note = qs('#filterNote');
      if (note) note.textContent += ' Фильтр применён, страница не перезагружалась.';
    });

    var reset = qs('#resetFilter');
    if (reset) {
      reset.addEventListener('click', function () {
        form.reset();
        if (qs('#maxPrice')) qs('#maxPrice').value = '60000';
        applyFilters();
      });
    }

    var more = qs('#loadMore');
    if (more) {
      more.addEventListener('click', function () {
        catalogState.shown += 6;
        renderCatalog();
      });
    }

    // Мгновенная реакция на изменение полей (кроме кнопки «Показать ещё»).
    ['#category', '#maxPrice', '#search', '#inStock'].forEach(function (selector) {
      var control = qs(selector);
      if (control) control.addEventListener('change', applyFilters);
    });
  }

  // ------------------------------------------------- feedback web-форма ----

  function showMessage(text, isOk) {
    var list = qs('#formMessages');
    if (!list) return;
    list.innerHTML = '';
    var li = document.createElement('li');
    if (isOk) li.className = 'ok';
    li.textContent = text;
    list.appendChild(li);
  }

  async function loadFeedback() {
    var body = qs('#feedbackTable tbody');
    if (!body) return;
    try {
      var data = await Api.getFeedback();
      body.innerHTML = '';
      if (!data.feedback.length) {
        body.innerHTML = '<tr><td colspan="5">Сообщений пока нет.</td></tr>';
        return;
      }
      data.feedback.forEach(function (item) {
        var tr = document.createElement('tr');
        var when = new Date(item.ts).toLocaleString('ru-RU');
        tr.innerHTML =
          '<td>' + when + '</td>' +
          '<td>' + item.name + '</td>' +
          '<td>' + item.email + '</td>' +
          '<td>' + item.topic + '</td>' +
          '<td>' + item.page + '</td>';
        body.appendChild(tr);
      });
    } catch (err) {
      body.innerHTML = '<tr><td colspan="5">Ошибка загрузки: ' + err.message + '</td></tr>';
    }
  }

  function initFeedbackForm() {
    var form = qs('#feedbackForm');
    if (!form) return;

    loadFeedback();

    var consent = qs('#trackConsent');
    if (consent && global.MAITracker) {
      consent.checked = global.MAITracker.hasConsent();
      consent.addEventListener('change', function () {
        global.MAITracker.setConsent(consent.checked);
      });
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();          // асинхронная отправка формы
      var status = qs('#formStatus');
      var button = qs('#sendFeedback');

      var payload = {
        name: (qs('#name').value || '').trim(),
        email: (qs('#email').value || '').trim(),
        topic: (qs('#topic') || {}).value || 'other',
        message: (qs('#message').value || '').trim(),
        page: global.location.pathname,
        visitorId: global.MAITracker ? global.MAITracker.visitorId : '',
        sessionId: global.MAITracker ? global.MAITracker.sessionId : ''
      };

      if (button) button.disabled = true;
      if (status) status.textContent = 'Отправка на сервер…';

      try {
        var result = await Api.postFeedback(payload);
        showMessage('Сообщение отправлено, номер ' + result.id.slice(0, 8) + '.', true);
        if (status) status.textContent = 'Сервер принял форму в ' + result.createdAt;
        form.reset();
        if (consent) consent.checked = global.MAITracker ? global.MAITracker.hasConsent() : true;
        await loadFeedback();
      } catch (err) {
        if (err.status === 422 && err.data && err.data.errors) {
          showMessage(err.data.errors.join(' '), false);
        } else {
          showMessage('Ошибка отправки: ' + err.message, false);
        }
        if (status) status.textContent = '';
      } finally {
        if (button) button.disabled = false;
      }
    });

    var clear = qs('#clearFeedback');
    if (clear) {
      clear.addEventListener('click', function () {
        var list = qs('#formMessages');
        if (list) list.innerHTML = '';
      });
    }
  }

  // --------------------------------------------------------------- start ---

  function init() {
    initNav();
    initLiveStats();
    initCatalog();
    initFeedbackForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
