'use strict';

/* Рендер OpenAPI-описания без внешних библиотек (ES5, QtWebKit-совместимо). */
(function () {
  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function load(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status !== 200) {
        callback(new Error('HTTP ' + xhr.status));
        return;
      }
      try {
        callback(null, JSON.parse(xhr.responseText));
      } catch (e) {
        callback(e);
      }
    };
    xhr.onerror = function () { callback(new Error('Сетевая ошибка')); };
    xhr.send();
  }

  function renderOperation(method, path, op) {
    var html = '<div class="operation">';
    html += '<div class="operation__head">';
    html += '<span class="method method--' + esc(method) + '">' + esc(method.toUpperCase()) + '</span>';
    html += '<span class="path">' + esc(path) + '</span>';
    html += '<b>' + esc(op.summary || '') + '</b>';
    html += '</div>';
    if (op.description) html += '<p class="muted">' + esc(op.description) + '</p>';

    var params = op.parameters || [];
    if (params.length) {
      html += '<p><b>Параметры:</b> ' + params.map(function (p) {
        return '<code>' + esc(p.name) + '</code> (' + esc(p.in) + ')';
      }).join(', ') + '</p>';
    }

    if (op.requestBody) {
      var schema = null;
      try {
        schema = op.requestBody.content['application/json'].schema;
      } catch (e) { schema = null; }
      if (schema) {
        html += '<p><b>Тело запроса:</b></p><pre>' + esc(JSON.stringify(schema, null, 2)) + '</pre>';
      }
    }

    if (op.responses) {
      html += '<p><b>Ответы:</b></p><ul class="resp-list">';
      Object.keys(op.responses).forEach(function (code) {
        html += '<li><code>' + esc(code) + '</code> — ' + esc(op.responses[code].description || '') + '</li>';
      });
      html += '</ul>';
    }

    html += '</div>';
    return html;
  }

  function render(spec) {
    $('doc-title').textContent = spec.info.title + ' (v' + spec.info.version + ')';
    $('doc-description').textContent = spec.info.description || '';
    var schemes = spec.components && spec.components.securitySchemes
      ? Object.keys(spec.components.securitySchemes).map(function (name) {
        var s = spec.components.securitySchemes[name];
        return name + ': ' + (s.type === 'http' ? s.scheme : s.type + ' ' + s.in + '=' + s.name);
      })
      : [];
    $('doc-security').textContent = 'Аутентификация: ' + schemes.join(', ');

    var groups = {};
    Object.keys(spec.paths).forEach(function (path) {
      var pathItem = spec.paths[path];
      Object.keys(pathItem).forEach(function (method) {
        var op = pathItem[method];
        if (!op || typeof op !== 'object' || !op.responses) return;
        var tag = (op.tags && op.tags[0]) || 'other';
        groups[tag] = groups[tag] || [];
        groups[tag].push(renderOperation(method, spec.servers && spec.servers[0]
          ? spec.servers[0].url.replace(/\/$/, '') + path
          : path, op));
      });
    });

    var html = '';
    Object.keys(groups).forEach(function (tag) {
      html += '<section class="card"><h2>' + esc(tag) + '</h2>' + groups[tag].join('') + '</section>';
    });
    $('doc-groups').innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', function () {
    load('/api/v1/openapi.json', function (err, spec) {
      if (err) {
        $('doc-title').textContent = 'Не удалось загрузить OpenAPI: ' + err.message;
        return;
      }
      render(spec);
    });
  });
})();
