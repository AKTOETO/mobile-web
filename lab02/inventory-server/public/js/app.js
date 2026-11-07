'use strict';

/* Тестовая страница инвентаря: логин, CRUD, журнал запросов, автодемонстрация.
 * Код намеренно на ES5 + XMLHttpRequest — страница должна работать и в QtWebKit
 * на Авроре, и в обычном браузере на ПК. */
(function () {
  var Api = window.InventoryApi;

  var CONDITION_LABELS = {
    'new': 'новый',
    'good': 'хорошее',
    'used': 'б/у',
    'broken': 'неисправен'
  };

  var state = {
    token: '',
    user: null,
    items: [],
    editingId: null,
    etag: '',
    lastHeaders: null
  };

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function isAuto() { return /[?&]auto=1/.test(window.location.search); }

  function showBanner(text, kind) {
    var el = $('banner');
    el.className = 'banner ' + (kind || 'info');
    el.innerHTML = text;
  }

  function clearBanner() {
    var el = $('banner');
    el.className = 'banner hidden';
    el.innerHTML = '';
  }

  function setAuthStatus() {
    var el = $('auth-status');
    if (state.user) {
      el.className = 'status ok';
      el.innerHTML = 'Вошёл: <b>' + esc(state.user.username) + '</b> (' + esc(state.user.role) + ')';
    } else {
      el.className = 'status';
      el.textContent = 'Не выполнен вход';
    }
  }

  function statusClass(code) {
    if (code >= 200 && code < 300) return 'code code--2xx';
    if (code >= 300 && code < 400) return 'code code--3xx';
    if (code >= 400 && code < 500) return 'code code--4xx';
    if (code >= 500) return 'code code--5xx';
    return 'code';
  }

  function addLog(method, path, res, note) {
    var log = $('log');
    var empty = log.querySelector('.muted');
    if (empty) log.innerHTML = '';

    var entry = document.createElement('div');
    entry.className = 'log-entry';

    var head = document.createElement('div');
    head.className = 'log-head';
    if (!res) {
      head.innerHTML = '<span class="code code--5xx">ERR</span> <b>' + esc(method) + '</b> ' +
        esc(path) + ' — ' + esc(note);
    } else {
      var code = Math.round(res.status);
      head.innerHTML = '<span class="' + statusClass(code) + '">' + code + '</span> ' +
        '<b>' + esc(method) + '</b> ' + esc(path) + ' <span class="muted">' + res.ms + ' мс</span>' +
        (note ? ' — ' + esc(note) : '');
    }
    entry.appendChild(head);

    if (res && res.headers) {
      var h = res.headers;
      var interesting = [];
      ['etag', 'cache-control', 'last-modified', 'content-type', 'location', 'x-total-count'].forEach(function (name) {
        if (h[name]) interesting.push(name + ': ' + h[name]);
      });
      if (interesting.length) {
        var headersEl = document.createElement('div');
        headersEl.className = 'log-headers muted';
        headersEl.textContent = interesting.join(' · ');
        entry.appendChild(headersEl);
      }
      if (res.data !== null && res.data !== undefined) {
        var pre = document.createElement('pre');
        pre.className = 'log-body';
        var text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
        pre.textContent = text.length > 1200 ? text.slice(0, 1200) + '…' : text;
        entry.appendChild(pre);
      }
    }
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  function updateCacheInfo() {
    var el = $('cache-info');
    if (!state.lastHeaders) {
      el.textContent = 'Кэш: ещё не запрашивали список';
      return;
    }
    var h = state.lastHeaders;
    el.textContent = 'Кэш: ETag ' + (h.etag || '—') +
      ' · Last-Modified ' + (h['last-modified'] || '—') +
      ' · Cache-Control ' + (h['cache-control'] || '—');
  }

  function renderItems() {
    var body = $('items-body');
    if (!state.items.length) {
      body.innerHTML = '<tr><td colspan="5" class="muted">Предметов нет.</td></tr>';
      return;
    }
    var html = '';
    state.items.forEach(function (item) {
      html += '<tr>' +
        '<td>' + esc(item.name) + '</td>' +
        '<td class="num">' + esc(item.quantity) + '</td>' +
        '<td>' + esc(item.location) + '</td>' +
        '<td><span class="badge badge--' + esc(item.condition) + '">' + esc(CONDITION_LABELS[item.condition] || item.condition) + '</span></td>' +
        '<td class="actions">' +
        '<button class="small" data-action="edit" data-id="' + esc(item.id) + '">Изменить</button> ' +
        '<button class="small danger" data-action="delete" data-id="' + esc(item.id) + '">Удалить</button>' +
        '</td>' +
        '</tr>';
    });
    body.innerHTML = html;
  }

  function queryString() {
    var params = [];
    var q = $('filter-q').value.trim();
    var condition = $('filter-condition').value;
    if (q) params.push('q=' + encodeURIComponent(q));
    if (condition) params.push('condition=' + encodeURIComponent(condition));
    return params.length ? '?' + params.join('&') : '';
  }

  function refresh(callback, bustCache) {
    var path = '/items' + queryString();
    if (bustCache) path += (path.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
    Api.request('GET', path, { token: state.token }, function (err, res) {
      if (err) {
        showBanner('Не удалось получить список: ' + esc(err.message), 'error');
        addLog('GET', path, null, err.message);
        if (callback) callback(err);
        return;
      }
      addLog('GET', path, res);
      if (res.status === 200) {
        state.items = res.data.items || [];
        state.lastHeaders = res.headers;
        state.etag = res.headers.etag || '';
        updateCacheInfo();
        renderItems();
        clearBanner();
      } else if (res.status === 304 && !bustCache) {
        // Браузер отдал свою кэшированную копию; если данных ещё нет —
        // повторяем запрос с обходом кэша, иначе просто показываем прежние.
        if (!state.lastHeaders || !state.items.length) {
          refresh(callback, true);
          return;
        }
      } else {
        showBanner('Список не получен: ' + esc(res.data && res.data.message ? res.data.message : res.status), 'error');
      }
      if (callback) callback(null, res);
    });
  }

  function login(username, password, callback) {
    Api.request('POST', '/auth/login', {
      body: { username: username, password: password }
    }, function (err, res) {
      addLog('POST', '/auth/login', err ? null : res, err ? err.message : 'вход ' + username);
      if (err) {
        showBanner('Ошибка входа: ' + esc(err.message), 'error');
        if (callback) callback(err);
        return;
      }
      if (res.status === 200) {
        state.token = res.data.token;
        state.user = res.data.user;
        setAuthStatus();
        showBanner('Токен получен и сохранён в cookie (HttpOnly, Secure) и в памяти страницы.', 'ok');
      } else {
        showBanner('Вход не выполнен: ' + esc(res.data && res.data.message ? res.data.message : res.status), 'error');
      }
      if (callback) callback(null, res);
    });
  }

  function openEditor(item) {
    state.editingId = item ? item.id : null;
    $('editor-title').textContent = item ? 'Изменить предмет' : 'Новый предмет';
    $('f-name').value = item ? item.name : '';
    $('f-quantity').value = item ? item.quantity : 1;
    $('f-location').value = item ? item.location : '';
    $('f-condition').value = item ? item.condition : 'new';
    $('editor').className = 'editor';
    $('f-name').focus();
  }

  function closeEditor() {
    state.editingId = null;
    $('editor').className = 'editor hidden';
  }

  function saveEditor() {
    var payload = {
      name: $('f-name').value,
      quantity: Number($('f-quantity').value),
      location: $('f-location').value,
      condition: $('f-condition').value
    };
    var editing = state.editingId;
    var method = editing ? 'PUT' : 'POST';
    var path = editing ? '/items/' + editing : '/items';
    Api.request(method, path, { token: state.token, body: payload }, function (err, res) {
      if (err) {
        showBanner('Не удалось сохранить: ' + esc(err.message), 'error');
        addLog(method, path, null, err.message);
        return;
      }
      addLog(method, path, res);
      if (res.ok) {
        closeEditor();
        refresh();
      } else {
        var details = '';
        if (res.data && res.data.details) {
          details = ' <ul>' + res.data.details.map(function (d) {
            return '<li>' + esc(d.field) + ': ' + esc(d.message) + '</li>';
          }).join('') + '</ul>';
        }
        showBanner('Ошибка ' + res.status + ': ' + esc(res.data && res.data.message ? res.data.message : '') + details, 'error');
      }
    });
  }

  function deleteItem(id, name) {
    if (!isAuto() && !window.confirm('Удалить «' + name + '»?')) return;
    var path = '/items/' + id;
    Api.request('DELETE', path, { token: state.token }, function (err, res) {
      if (err) {
        addLog('DELETE', path, null, err.message);
        showBanner('Не удалось удалить: ' + esc(err.message), 'error');
        return;
      }
      addLog('DELETE', path, res);
      if (res.status === 204) {
        refresh();
      } else {
        showBanner('Удаление не выполнено: ' + res.status + ' ' +
          esc(res.data && res.data.message ? res.data.message : ''), 'error');
      }
    });
  }

  function runErrorCase(code) {
    if (code === '400') {
      Api.request('POST', '/items', {
        token: state.token,
        body: { name: '', quantity: -1, location: '', condition: 'bad' }
      }, function (err, res) {
        addLog('POST', '/items', err ? null : res, 'ожидаем 400');
      });
    } else if (code === '401') {
      Api.request('GET', '/items', {}, function (err, res) {
        addLog('GET', '/items', err ? null : res, 'без токена, ожидаем 401');
      });
    } else if (code === '403') {
      var previousToken = state.token;
      var previousUser = state.user;
      login('viewer', 'viewer123', function () {
        var viewerToken = state.token;
        Api.request('POST', '/items', {
          token: viewerToken,
          body: { name: 'Запрещено', quantity: 1, location: 'Склад', condition: 'new' }
        }, function (err, res) {
          addLog('POST', '/items', err ? null : res, 'роль viewer, ожидаем 403');
          state.token = previousToken;
          state.user = previousUser;
          setAuthStatus();
        });
      });
    } else if (code === '404') {
      Api.request('GET', '/items/00000000-0000-0000-0000-000000000000', {
        token: state.token
      }, function (err, res) {
        addLog('GET', '/items/<нет>', err ? null : res, 'ожидаем 404');
      });
    } else if (code === '500') {
      Api.request('GET', '/debug/error', { token: state.token }, function (err, res) {
        addLog('GET', '/debug/error', err ? null : res, 'ожидаем 500');
      });
    }
  }

  function check304() {
    if (!state.etag) {
      refresh(function () {
        if (!state.etag) {
          showBanner('Сначала войдите и получите список (нужен ETag).', 'error');
          return;
        }
        check304();
      });
      return;
    }
    Api.request('GET', '/items', {
      token: state.token,
      headers: { 'If-None-Match': state.etag }
    }, function (err, res) {
      addLog('GET', '/items', err ? null : res,
        'If-None-Match: ' + state.etag + ', ожидаем 304');
    });
  }

  // -------------------------------------------------------------------------
  // Автодемонстрация (?auto=1): последовательный CRUD + коды ответов.
  // -------------------------------------------------------------------------

  function runAutoDemo() {
    $('demo-panel').className = 'card';
    var list = $('demo-steps');
    list.innerHTML = '';
    var results = [];
    var adminToken = '';

    function record(name, expected, res) {
      var actual = res ? res.status : 0;
      var ok = expected === 0 ? !!res && res.ok : actual === expected;
      results.push({ name: name, expected: expected, actual: actual, ok: ok });
      var li = document.createElement('li');
      li.className = ok ? 'demo-ok' : 'demo-fail';
      li.innerHTML = (ok ? '✓ ' : '✗ ') + esc(name) + ' — ожидалось ' +
        (expected === 0 ? '2xx' : expected) + ', получено ' + actual;
      list.appendChild(li);
      return ok;
    }

    function call(method, path, options, name, expected, cb) {
      Api.request(method, path, options, function (err, res) {
        addLog(method, path, err ? null : res, name);
        record(name, expected, res);
        cb(err, res);
      });
    }

    var steps = [
      function (next) {
        call('POST', '/auth/login', { body: { username: 'admin', password: 'admin123' } },
          'Вход admin', 200, function (err, res) {
            if (res && res.status === 200) {
              adminToken = res.data.token;
              state.token = adminToken;
              state.user = res.data.user;
              setAuthStatus();
            }
            next();
          });
      },
      function (next) {
        // Параметр _ исключает попадание в дисковый кэш браузера (иначе
        // Gecko может сам прислать If-None-Match и вернуть 304 вместо 200).
        call('GET', '/items?demo=' + Date.now(), { token: adminToken },
          'Чтение списка', 200, function (err, res) {
          if (res && res.status === 200) {
            state.items = res.data.items || [];
            state.lastHeaders = res.headers;
            state.etag = res.headers.etag || '';
            updateCacheInfo();
            renderItems();
          }
          next();
        });
      },
      function (next) {
        call('GET', '/items', {
          token: adminToken,
          headers: { 'If-None-Match': state.etag }
        }, 'Повторное чтение с If-None-Match (кэш)', 304, function () { next(); });
      },
      function (next) {
        call('POST', '/items', {
          token: adminToken,
          body: { name: 'Демо-предмет (авто)', quantity: 1, location: 'Демо-склад', condition: 'new' }
        }, 'Создание предмета', 201, function (err, res) {
          if (res && res.status === 201) state.createdId = res.data.id;
          next();
        });
      },
      function (next) {
        call('GET', '/items/' + state.createdId, { token: adminToken },
          'Чтение созданного предмета', 200, function () { next(); });
      },
      function (next) {
        call('PATCH', '/items/' + state.createdId, {
          token: adminToken,
          body: { quantity: 9, condition: 'used' }
        }, 'Обновление (PATCH)', 200, function () { next(); });
      },
      function (next) {
        call('DELETE', '/items/' + state.createdId, { token: adminToken },
          'Удаление предмета', 204, function () { refresh(); next(); });
      },
      function (next) {
        call('POST', '/items', {
          token: adminToken,
          body: { name: '', quantity: -1, location: '', condition: 'bad' }
        }, 'Ошибка валидации', 400, function () { next(); });
      },
      function (next) {
        call('GET', '/items/00000000-0000-0000-0000-000000000000', { token: adminToken },
          'Несуществующий предмет', 404, function () { next(); });
      },
      function (next) {
        // Выход очищает HttpOnly-cookie: без неё и без заголовка получаем 401.
        call('POST', '/auth/logout', {}, 'Выход (сброс cookie)', 204, function () {
          call('GET', '/items', {}, 'Без токена', 401, function () { next(); });
        });
      },
      function (next) {
        call('POST', '/auth/login', { body: { username: 'viewer', password: 'viewer123' } },
          'Вход viewer', 200, function (err, res) {
            var viewerToken = res && res.data ? res.data.token : '';
            call('POST', '/items', {
              token: viewerToken,
              body: { name: 'Запрещено', quantity: 1, location: 'Склад', condition: 'new' }
            }, 'Создание от viewer (403)', 403, function () { next(); });
          });
      },
      function (next) {
        call('GET', '/debug/error', { token: adminToken }, 'Внутренняя ошибка (500)', 500,
          function () { next(); });
      },
      function () {
        state.token = adminToken;
        state.user = { username: 'admin', role: 'admin' };
        setAuthStatus();
        refresh();

        var ok = results.every(function (r) { return r.ok; });
        $('demo-summary').className = 'status ' + (ok ? 'ok' : 'error');
        $('demo-summary').textContent = ok
          ? 'Все ' + results.length + ' шагов выполнены с ожидаемыми кодами.'
          : 'Есть шаги с неожиданным кодом — см. список выше.';
        window.__demo = { done: true, ok: ok, steps: results, finishedAt: new Date().toISOString() };
        document.title = (ok ? 'OK ' : 'FAIL ') + 'demo — Инвентарь (ЛР №2)';
        if (window.console && console.log) {
          console.log('LAB02_DEMO_RESULT ' + JSON.stringify(window.__demo));
        }
        // Контрольный запрос: по журналу сервера видно, что автодемо доработало
        // до конца (удобно при проверке в браузере эмулятора без консоли).
        var passed = 0;
        results.forEach(function (r) { if (r.ok) passed += 1; });
        Api.request('GET', '/debug/demo-result?ok=' + (ok ? 1 : 0) +
          '&passed=' + passed + '&total=' + results.length, {}, function () {});
      }
    ];

    var index = 0;
    function next() {
      if (index >= steps.length) return;
      var stepFn = steps[index];
      index += 1;
      setTimeout(function () { stepFn(next); }, 120);
    }
    next();
  }

  function bind() {
    $('btn-login').onclick = function () {
      login($('login-user').value, $('login-pass').value, function () { refresh(); });
    };
    $('btn-logout').onclick = function () {
      Api.request('POST', '/auth/logout', { token: state.token }, function (err, res) {
        addLog('POST', '/auth/logout', err ? null : res, 'выход');
      });
      state.token = '';
      state.user = null;
      state.items = [];
      setAuthStatus();
      renderItems();
      showBanner('Выполнен выход, cookie сброшена.', 'info');
    };
    $('btn-refresh').onclick = function () { refresh(); };
    $('btn-create').onclick = function () { openEditor(null); };
    $('btn-save').onclick = saveEditor;
    $('btn-cancel').onclick = closeEditor;
    $('btn-304').onclick = check304;
    $('items-body').onclick = function (event) {
      var target = event.target;
      if (target.tagName !== 'BUTTON') return;
      var id = target.getAttribute('data-id');
      var action = target.getAttribute('data-action');
      if (action === 'edit') {
        state.items.forEach(function (item) {
          if (item.id === id) openEditor(item);
        });
      } else if (action === 'delete') {
        var name = '';
        state.items.forEach(function (item) { if (item.id === id) name = item.name; });
        deleteItem(id, name);
      }
    };
    var buttons = document.querySelectorAll('[data-error]');
    for (var i = 0; i < buttons.length; i += 1) {
      buttons[i].onclick = function () { runErrorCase(this.getAttribute('data-error')); };

    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    bind();
    updateCacheInfo();
    if (isAuto()) {
      setTimeout(runAutoDemo, 300);
    }
  });
})();
