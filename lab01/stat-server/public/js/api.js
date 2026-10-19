'use strict';

/**
 * api.js — обёртка над fetch для асинхронных обращений к серверу.
 * Использует async/await, Promise, AbortController (таймаут запроса).
 * Подключается на всех страницах: /js/api.js
 */

(function (global) {
  var REQUEST_TIMEOUT_MS = 10000;

  function buildQuery(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (key) {
      var value = params[key];
      if (value === undefined || value === null || value === '') return;
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  async function request(path, options) {
    options = options || {};
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);

    try {
      var response = await fetch(path, {
        method: options.method || 'GET',
        headers: Object.assign({ Accept: 'application/json' }, options.headers || {}),
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit'
      });

      var text = await response.text();
      var data = null;
      try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }

      if (!response.ok) {
        var error = new Error((data && data.error) || ('Ошибка сервера: HTTP ' + response.status));
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Превышено время ожидания ответа сервера');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  var Api = {
    /** Сводка аналитики + данные для графиков. */
    getStats: function (params) {
      return request('/api/stats' + buildQuery(params));
    },
    /** Список страниц для выпадающего списка формы отчёта. */
    getPages: function () {
      return request('/api/pages');
    },
    /** Последние сессии. */
    getSessions: function (limit) {
      return request('/api/sessions' + buildQuery({ limit: limit }));
    },
    /** Сообщения из web-формы. */
    getFeedback: function () {
      return request('/api/feedback');
    },
    /** Отправка события статистики. */
    postEvent: function (payload) {
      return request('/api/events', { method: 'POST', body: payload });
    },
    /** Отправка формы обратной связи. */
    postFeedback: function (payload) {
      return request('/api/feedback', { method: 'POST', body: payload });
    },
    /** Добавление демонстрационных данных. */
    postSeed: function (payload) {
      return request('/api/seed', { method: 'POST', body: payload });
    },
    /** Очистка статистики. */
    postReset: function () {
      return request('/api/reset', { method: 'POST', body: { confirm: true } });
    },
    /** Ссылка на CSV-экспорт (для кнопки на дашборде). */
    exportUrl: function (params) {
      return '/api/export.csv' + buildQuery(params);
    },
    health: function () {
      return request('/api/health');
    }
  };

  global.Api = Api;
})(window);
