/* Swagger UI: ES5 для браузера Авроры, без привязки к IP компьютера. */
(function () {
  'use strict';
  var status = document.getElementById('swagger-status');
  window.ui = SwaggerUIBundle({
    url: '/api/v1/openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    validatorUrl: null,
    docExpansion: 'list',
    defaultModelsExpandDepth: -1,
    supportedSubmitMethods: ['get', 'post', 'put', 'patch', 'delete'],
    presets: [SwaggerUIBundle.presets.apis],
    onComplete: function () {
      status.textContent = 'Готово. Сервер: ' + window.location.host;
      if (/(?:\?|&)auto=1(?:&|$)/.test(window.location.search)) {
        var script = document.createElement('script');
        script.src = '/js/swagger-demo.js';
        document.body.appendChild(script);
      }
    },
    responseInterceptor: function (response) {
      var url = response.url || '';
      if (/\/auth\/login(?:\?|$)/.test(url) && response.status === 200) {
        var data = response.obj || response.body || {};
        if (typeof data !== 'object' || !data.token) {
          try { data = JSON.parse(response.text); } catch (error) { data = {}; }
        }
        if (data.token) {
          window.ui.preauthorizeApiKey('bearerAuth', data.token);
          status.textContent = 'Вход выполнен. JWT применяется к запросам API.';
        }
      } else if (/\/auth\/logout(?:\?|$)/.test(url) && response.status === 204) {
        window.ui.authActions.logout(['bearerAuth']);
        status.textContent = 'Выполнен выход.';
      }
      if (window.__onSwaggerResponse) window.__onSwaggerResponse(response);
      return response;
    }
  });
}());
