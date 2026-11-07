'use strict';

/* Обёртка над XMLHttpRequest: ES5-совместимо (QtWebKit в Авроре). */
(function (global) {
  var API = '/api/v1';

  function parseHeaders(raw) {
    var headers = {};
    String(raw || '').trim().split(/[\r\n]+/).forEach(function (line) {
      var idx = line.indexOf(':');
      if (idx > 0) headers[line.slice(0, idx).toLowerCase()] = line.slice(idx + 1).trim();
    });
    return headers;
  }

  /**
   * @param {string} method
   * @param {string} path        путь относительно /api/v1
   * @param {object} options     { token, body, headers }
   * @param {function} callback  function (err, response)
   */
  function request(method, path, options, callback) {
    options = options || {};
    var xhr = new XMLHttpRequest();
    var started = Date.now();
    xhr.open(method, API + path, true);
    xhr.setRequestHeader('Accept', 'application/json');
    if (options.token) xhr.setRequestHeader('Authorization', 'Bearer ' + options.token);
    if (options.headers) {
      for (var name in options.headers) {
        if (Object.prototype.hasOwnProperty.call(options.headers, name)) {
          xhr.setRequestHeader(name, options.headers[name]);
        }
      }
    }
    var body = null;
    if (options.body !== undefined && options.body !== null) {
      body = JSON.stringify(options.body);
      xhr.setRequestHeader('Content-Type', 'application/json');
    }

    function finish(status, headers, data) {
      callback(null, {
        status: status,
        ok: status >= 200 && status < 300,
        headers: headers,
        data: data,
        ms: Date.now() - started
      });
    }

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var data = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch (e) {
        data = xhr.responseText;
      }
      finish(xhr.status, parseHeaders(xhr.getAllResponseHeaders()), data);
    };
    xhr.onerror = function () {
      callback(new Error('Сетевая ошибка: сервер недоступен'), null);
    };
    xhr.timeout = 8000;
    xhr.ontimeout = function () {
      callback(new Error('Таймаут запроса (8 с)'), null);
    };
    xhr.send(body);
  }

  global.InventoryApi = { request: request, API: API };
})(window);
