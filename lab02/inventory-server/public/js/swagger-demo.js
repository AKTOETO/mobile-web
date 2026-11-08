/* Проверка настоящих кнопок Swagger UI: /docs.html?auto=1. ES5. */
(function () {
  'use strict';
  var result = window.__swaggerDemo = { done: false, ok: false, steps: [] };
  var itemId = '';
  var status = document.getElementById('swagger-status');
  var steps = [
    ['get', '/health', null, 200],
    ['post', '/auth/login', { username: 'admin', password: 'admin123' }, 200],
    ['get', '/auth/me', null, 200],
    ['get', '/items', null, 200],
    ['post', '/items', { name: 'Swagger UI demo', quantity: 2, location: 'Стенд', condition: 'new' }, 201],
    ['get', '/items/{id}', null, 200],
    ['put', '/items/{id}', { name: 'Swagger UI demo', quantity: 3, location: 'Стенд', condition: 'good' }, 200],
    ['patch', '/items/{id}', { quantity: 4 }, 200],
    ['delete', '/items/{id}', null, 204],
    ['get', '/items/{id}', null, 404],
    ['post', '/auth/logout', null, 204]
  ];

  function finish(error) {
    result.done = true;
    result.ok = !error;
    if (error) result.error = String(error);
    status.textContent = 'Swagger UI: ' + result.steps.length + '/' + steps.length +
      (error ? ', ошибка: ' + error : ', все запросы выполнены кнопкой Execute');
    window.__onSwaggerResponse = null;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/v1/debug/demo-result?source=swagger&ok=' + (result.ok ? 1 : 0) +
      '&passed=' + result.steps.length + '&total=' + steps.length +
      '&detail=' + encodeURIComponent(error || navigator.userAgent), true);
    xhr.send();
  }

  function value(element, text) {
    // React отслеживает значение контролов: вызываем родной setter и input.
    var descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
    descriptor.set.call(element, text);
    var event = document.createEvent('Event');
    event.initEvent('input', true, true);
    element.dispatchEvent(event);
  }

  function next(index) {
    if (index === steps.length) { finish(); return; }
    var step = steps[index];
    var blocks = document.querySelectorAll('.opblock');
    var block = null;
    for (var i = 0; i < blocks.length; i++) {
      var method = blocks[i].querySelector('.opblock-summary-method');
      var path = blocks[i].querySelector('.opblock-summary-path');
      if (method && path && method.textContent.toLowerCase() === step[0] &&
          path.textContent.replace(/\s/g, '') === step[1]) block = blocks[i];
    }
    if (!block) { finish('Метод не найден: ' + step[0] + ' ' + step[1]); return; }
    if (block.className.indexOf('is-open') < 0) {
      (block.querySelector('.opblock-summary-control') || block.querySelector('.opblock-summary')).click();
    }
    setTimeout(function () {
      try {
        var tryButton = block.querySelector('.try-out__btn');
        if (tryButton && !block.querySelector('.execute')) tryButton.click();
        setTimeout(function () {
          try {
            if (step[2]) value(block.querySelector('textarea.body-param__text'), JSON.stringify(step[2], null, 2));
            if (step[1].indexOf('{id}') >= 0) {
              value(block.querySelector('.parameters-col_description input'), itemId);
            }
            var timer = setTimeout(function () { finish('Таймаут запроса ' + step[1]); }, 20000);
            window.__onSwaggerResponse = function (response) {
              clearTimeout(timer);
              if (response.status !== step[3]) {
                finish(step[0] + ' ' + step[1] + ': ' + response.status + ', ожидалось ' + step[3]);
                return;
              }
              var data = response.obj || response.body || {};
              if (typeof data !== 'object' || !data.id) {
                try { data = JSON.parse(response.text); } catch (error) { data = {}; }
              }
              if (step[0] === 'post' && step[1] === '/items') itemId = data.id;
              result.steps.push({ method: step[0], path: step[1], status: response.status });
              window.__onSwaggerResponse = null;
              setTimeout(function () { next(index + 1); }, 350);
            };
            setTimeout(function () { block.querySelector('.execute').click(); }, 700);
          } catch (error) { finish(error); }
        }, 200);
      } catch (error) { finish(error); }
    }, 200);
  }
  setTimeout(function () { next(0); }, 500);
}());
