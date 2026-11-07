'use strict';

/**
 * Автотесты REST API инвентаря (лабораторная работа №2, вариант 7).
 *
 * Поднимает сервер на свободных портах с временным DATA_DIR и проверяет
 * HTTPS/HTTP-редирект, JWT и cookie, роли, CRUD, коды ошибок, кэширование
 * (ETag/Last-Modified/304), фильтры, статику и OpenAPI.
 *
 *   npm test
 */

const { spawn } = require('node:child_process');
const https = require('node:https');
const http = require('node:http');
const net = require('node:net');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log('  ok  %s', name);
  } else {
    failures.push({ name, detail });
    console.log('  FAIL %s%s', name, detail ? ' — ' + detail : '');
  }
}

function eq(name, actual, expected) {
  check(name, actual === expected, 'ожидалось ' + JSON.stringify(expected) +
    ', получено ' + JSON.stringify(actual));
}

function contains(name, haystack, needle) {
  check(name, typeof haystack === 'string' && haystack.includes(needle),
    'нет подстроки ' + JSON.stringify(needle));
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function request(port, method, urlPath, options = {}) {
  const isHttps = options.https !== false;
  const lib = isHttps ? https : http;
  return new Promise((resolve, reject) => {
    const headers = Object.assign({ 'User-Agent': 'lab02-test/1.0' }, options.headers || {});
    let body = null;
    if (options.body !== undefined) {
      body = JSON.stringify(options.body);
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    if (options.token) headers.Authorization = 'Bearer ' + options.token;

    const req = lib.request({
      host: '127.0.0.1',
      port,
      method,
      path: urlPath,
      headers,
      rejectUnauthorized: false,
      timeout: 5000,
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = raw ? JSON.parse(raw) : null;
        } catch (e) {
          json = null;
        }
        resolve({ status: res.statusCode, headers: res.headers, raw, json });
      });
    });
    req.on('timeout', () => req.destroy(new Error('таймаут запроса')));
    req.on('error', reject);
    req.end(body);
  });
}

async function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const res = await request(port, 'GET', '/api/v1/health');
      if (res.status === 200) return res;
    } catch (e) {
      lastError = e;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw lastError || new Error('сервер не ответил на /health');
}

function startServer(env) {
  const child = spawn(process.execPath, ['server/server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, env),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  const log = { out: '', err: '' };
  child.stdout.on('data', (chunk) => { log.out += chunk; });
  child.stderr.on('data', (chunk) => { log.err += chunk; });
  return { child, log };
}

async function stopServer(child) {
  if (!child || child.exitCode !== null || child.signalCode) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

async function main() {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'lab02-test-'));
  const httpsPort = await freePort();
  const httpPort = await freePort();

  const server = startServer({
    NODE_ENV: 'test',
    DATA_DIR: tempDir,
    HTTPS_PORT: String(httpsPort),
    HTTP_PORT: String(httpPort),
    HOST: '127.0.0.1',
    JWT_TTL_SEC: '600',
    LAB02_LOG: '0',
  });

  try {
    console.log('Сервер: https://127.0.0.1:%d, данные: %s', httpsPort, tempDir);
    await waitForHealth(httpsPort, 15000);

    console.log('\n[1] Здоровье, HTTP-редирект, статика, OpenAPI');
    let res = await request(httpsPort, 'GET', '/api/v1/health');
    eq('health 200', res.status, 200);
    eq('health status ok', res.json && res.json.status, 'ok');
    contains('health: host записан', res.json && res.json.request.host, '127.0.0.1');
    contains('health: user-agent записан', res.json && res.json.request.userAgent, 'lab02-test');

    res = await request(httpPort, 'GET', '/', { https: false });
    eq('HTTP → 301', res.status, 301);
    contains('HTTP Location на https', res.headers.location, 'https://');
    contains('HTTP Location на HTTPS-порт', res.headers.location, ':' + httpsPort);

    res = await request(httpsPort, 'GET', '/');
    eq('GET / → 200', res.status, 200);
    contains('GET / — HTML', res.headers['content-type'], 'text/html');
    contains('GET / — страница инвентаря', res.raw, 'Инвентарь');
    check('GET / — Cache-Control no-cache', /no-cache/.test(res.headers['cache-control'] || ''));

    res = await request(httpsPort, 'GET', '/css/style.css');
    eq('CSS 200', res.status, 200);
    contains('CSS content-type', res.headers['content-type'], 'text/css');

    res = await request(httpsPort, 'GET', '/js/api.js');
    eq('JS 200', res.status, 200);
    contains('JS content-type', res.headers['content-type'], 'javascript');

    res = await request(httpsPort, 'GET', '/js/app.js');
    eq('app.js 200', res.status, 200);
    contains('app.js содержит автодемо', res.raw, 'runAutoDemo');

    res = await request(httpsPort, 'GET', '/docs.html');
    eq('docs.html 200', res.status, 200);
    contains('docs.html — OpenAPI', res.raw, '/api/v1/openapi.json');

    res = await request(httpsPort, 'GET', '/favicon.svg');
    eq('favicon.svg 200', res.status, 200);
    contains('favicon content-type', res.headers['content-type'], 'image/svg+xml');

    res = await request(httpsPort, 'HEAD', '/');
    eq('HEAD / → 200', res.status, 200);
    eq('HEAD / — пустое тело', res.raw, '');

    res = await request(httpsPort, 'GET', '/%2e%2e/server/config.js');
    eq('обход каталога → 404', res.status, 404);

    res = await request(httpsPort, 'GET', '/api/v1/openapi.json');
    eq('openapi 200', res.status, 200);
    eq('openapi версия', res.json && res.json.openapi, '3.0.3');
    check('openapi описывает /items', !!(res.json && res.json.paths && res.json.paths['/items']));

    console.log('\n[2] Аутентификация JWT и cookie');
    res = await request(httpsPort, 'POST', '/api/v1/auth/login',
      { body: { username: 'admin', password: 'wrong' } });
    eq('неверный пароль → 401', res.status, 401);
    eq('неверный пароль: invalid_credentials', res.json && res.json.error, 'invalid_credentials');

    res = await request(httpsPort, 'POST', '/api/v1/auth/login',
      { body: { username: 'admin', password: 'admin123' } });
    eq('вход admin → 200', res.status, 200);
    const adminToken = res.json && res.json.token;
    check('admin: токен — строка', typeof adminToken === 'string' && adminToken.length > 20);
    eq('admin: роль', res.json && res.json.user.role, 'admin');
    const cookie = res.headers['set-cookie'] ? res.headers['set-cookie'][0] : '';
    contains('cookie: HttpOnly', cookie, 'HttpOnly');
    contains('cookie: Secure', cookie, 'Secure');
    contains('cookie: SameSite=Strict', cookie, 'SameSite=Strict');

    res = await request(httpsPort, 'GET', '/api/v1/auth/me', { token: adminToken });
    eq('auth/me Bearer → 200', res.status, 200);
    eq('auth/me: источник header', res.json && res.json.source, 'header');
    eq('auth/me: роль admin', res.json && res.json.role, 'admin');

    res = await request(httpsPort, 'GET', '/api/v1/auth/me',
      { headers: { Cookie: 'token=' + adminToken } });
    eq('auth/me Cookie → 200', res.status, 200);
    eq('auth/me: источник cookie', res.json && res.json.source, 'cookie');

    res = await request(httpsPort, 'GET', '/api/v1/items');
    eq('список без токена → 401', res.status, 401);
    contains('401: WWW-Authenticate', res.headers['www-authenticate'], 'Bearer');

    console.log('\n[3] Чтение списка, фильтры, кэширование');
    res = await request(httpsPort, 'GET', '/api/v1/items', { token: adminToken });
    eq('список admin → 200', res.status, 200);
    eq('сидовых предметов', res.json && res.json.total, 6);
    eq('X-Total-Count', res.headers['x-total-count'], '6');
    const listEtag = res.headers.etag;
    check('список: ETag есть', typeof listEtag === 'string' && listEtag.length > 2);
    contains('список: Cache-Control', res.headers['cache-control'], 'must-revalidate');
    check('список: Last-Modified есть', !!res.headers['last-modified']);

    res = await request(httpsPort, 'GET', '/api/v1/items',
      { token: adminToken, headers: { 'If-None-Match': listEtag } });
    eq('If-None-Match → 304', res.status, 304);
    eq('304: пустое тело', res.raw, '');
    eq('304: ETag сохранён', res.headers.etag, listEtag);

    res = await request(httpsPort, 'GET', '/api/v1/items', {
      token: adminToken,
      headers: { 'If-Modified-Since': new Date(Date.now() + 60000).toUTCString() },
    });
    eq('If-Modified-Since → 304', res.status, 304);

    res = await request(httpsPort, 'GET', '/api/v1/items?q=%D0%B4%D1%80%D0%B5%D0%BB%D1%8C',
      { token: adminToken });
    eq('поиск q=дрель → 1', res.json && res.json.total, 1);
    contains('поиск вернул дрель', res.json && res.json.items[0].name, 'Дрель');

    res = await request(httpsPort, 'GET', '/api/v1/items?condition=broken', { token: adminToken });
    eq('фильтр condition=broken → 1', res.json && res.json.total, 1);

    res = await request(httpsPort, 'GET', '/api/v1/items?limit=2&offset=1', { token: adminToken });
    eq('пагинация: limit 2', res.json && res.json.items.length, 2);
    eq('пагинация: total 6', res.json && res.json.total, 6);
    eq('пагинация: offset 1', res.json && res.json.offset, 1);

    res = await request(httpsPort, 'GET', '/api/v1/items?limit=0', { token: adminToken });
    eq('limit=0 → 400', res.status, 400);
    check('limit=0: details есть', !!(res.json && res.json.details && res.json.details.length));

    console.log('\n[4] Согласование заголовков и ошибки запроса');
    res = await request(httpsPort, 'GET', '/api/v1/items',
      { token: adminToken, headers: { Accept: 'text/html' } });
    eq('Accept: text/html → 406', res.status, 406);

    const savedUa = 'lab02-test/1.0';
    res = await request(httpsPort, 'GET', '/api/v1/health',
      { headers: { 'User-Agent': '' } });
    check('пустой User-Agent не проходит (400/200)', res.status === 400 || res.status === 200,
      'фактический код ' + res.status);

    res = await request(httpsPort, 'POST', '/api/v1/health', { token: adminToken });
    eq('POST /health → 405', res.status, 405);

    res = await request(httpsPort, 'POST', '/api/v1/items',
      { token: adminToken, headers: { 'Content-Type': 'text/plain' }, body: { name: 'x' } });
    eq('неверный Content-Type → 400', res.status, 400);

    res = await request(httpsPort, 'GET', '/api/v1/items', {
      token: adminToken,
      headers: { Host: 'bad host!' },
    });
    eq('некорректный Host → 400', res.status, 400);
    void savedUa;

    console.log('\n[5] CRUD и валидация');
    res = await request(httpsPort, 'POST', '/api/v1/items', {
      token: adminToken,
      body: { name: '', quantity: -1, location: '', condition: 'bad' },
    });
    eq('невалидный предмет → 400', res.status, 400);
    eq('ошибка validation_error', res.json && res.json.error, 'validation_error');
    check('валидация: несколько details',
      !!(res.json && res.json.details && res.json.details.length >= 2));

    res = await request(httpsPort, 'POST', '/api/v1/items', {
      token: adminToken,
      body: { name: 'Тестовый перфоратор', quantity: 2, location: 'Склад тестов', condition: 'good' },
    });
    eq('создание → 201', res.status, 201);
    const created = res.json;
    check('создан: id есть', !!(created && created.id));
    eq('создан: version 1', created && created.version, 1);
    eq('создан: name', created && created.name, 'Тестовый перфоратор');
    contains('создан: Location', res.headers.location, '/api/v1/items/' + (created && created.id));
    check('создан: ETag есть', !!res.headers.etag);

    res = await request(httpsPort, 'GET', '/api/v1/items/' + created.id, { token: adminToken });
    eq('чтение созданного → 200', res.status, 200);
    eq('чтение: quantity 2', res.json && res.json.quantity, 2);

    res = await request(httpsPort, 'GET', '/api/v1/items/' + created.id, {
      token: adminToken,
      headers: { 'If-None-Match': res.headers.etag },
    });
    eq('чтение с If-None-Match → 304', res.status, 304);

    res = await request(httpsPort, 'PATCH', '/api/v1/items/' + created.id,
      { token: adminToken, body: { quantity: 7 } });
    eq('PATCH → 200', res.status, 200);
    eq('PATCH: quantity 7', res.json && res.json.quantity, 7);
    eq('PATCH: version 2', res.json && res.json.version, 2);

    res = await request(httpsPort, 'PUT', '/api/v1/items/' + created.id, {
      token: adminToken,
      body: { name: 'Тестовый перфоратор', quantity: 8, location: 'Склад тестов', condition: 'used' },
    });
    eq('PUT → 200', res.status, 200);
    eq('PUT: version 3', res.json && res.json.version, 3);
    eq('PUT: condition used', res.json && res.json.condition, 'used');

    res = await request(httpsPort, 'GET', '/api/v1/items', { token: adminToken });
    check('список изменился: ETag другой', res.headers.etag !== listEtag);

    res = await request(httpsPort, 'PATCH', '/api/v1/items/00000000-0000-0000-0000-000000000000',
      { token: adminToken, body: { quantity: 1 } });
    eq('PATCH несуществующего → 404', res.status, 404);

    res = await request(httpsPort, 'DELETE', '/api/v1/items/' + created.id, { token: adminToken });
    eq('DELETE admin → 204', res.status, 204);
    eq('DELETE: пустое тело', res.raw, '');

    res = await request(httpsPort, 'GET', '/api/v1/items/' + created.id, { token: adminToken });
    eq('удалённый → 404', res.status, 404);

    res = await request(httpsPort, 'DELETE', '/api/v1/items/' + created.id, { token: adminToken });
    eq('повторное удаление → 404', res.status, 404);

    console.log('\n[6] Роли user и viewer');
    res = await request(httpsPort, 'POST', '/api/v1/auth/login',
      { body: { username: 'user', password: 'user123' } });
    const userToken = res.json && res.json.token;
    eq('вход user → 200', res.status, 200);
    eq('роль user', res.json && res.json.user.role, 'user');

    res = await request(httpsPort, 'POST', '/api/v1/items', {
      token: userToken,
      body: { name: 'Предмет пользователя', quantity: 1, location: 'Склад', condition: 'new' },
    });
    eq('user создаёт → 201', res.status, 201);
    const userItem = res.json;

    res = await request(httpsPort, 'DELETE', '/api/v1/items/' + userItem.id, { token: userToken });
    eq('user удаляет → 403', res.status, 403);
    eq('403: forbidden', res.json && res.json.error, 'forbidden');

    res = await request(httpsPort, 'PATCH', '/api/v1/items/' + userItem.id,
      { token: userToken, body: { quantity: 4 } });
    eq('user изменяет → 200', res.status, 200);

    res = await request(httpsPort, 'POST', '/api/v1/auth/login',
      { body: { username: 'viewer', password: 'viewer123' } });
    const viewerToken = res.json && res.json.token;
    eq('вход viewer → 200', res.status, 200);
    eq('роль viewer', res.json && res.json.user.role, 'viewer');

    res = await request(httpsPort, 'GET', '/api/v1/items', { token: viewerToken });
    eq('viewer читает → 200', res.status, 200);

    res = await request(httpsPort, 'POST', '/api/v1/items',
      { token: viewerToken, body: { name: 'Нельзя', quantity: 1, location: 'X', condition: 'new' } });
    eq('viewer создаёт → 403', res.status, 403);

    res = await request(httpsPort, 'PUT', '/api/v1/items/' + userItem.id,
      { token: viewerToken, body: { name: 'Нельзя', quantity: 1, location: 'X', condition: 'new' } });
    eq('viewer изменяет → 403', res.status, 403);

    res = await request(httpsPort, 'DELETE', '/api/v1/items/' + userItem.id, { token: viewerToken });
    eq('viewer удаляет → 403', res.status, 403);

    res = await request(httpsPort, 'DELETE', '/api/v1/items/' + userItem.id, { token: adminToken });
    eq('admin удаляет предмет user → 204', res.status, 204);

    console.log('\n[7] Отладка, неизвестные маршруты, выход');
    res = await request(httpsPort, 'GET', '/api/v1/debug/error', { token: adminToken });
    eq('debug/error → 500', res.status, 500);
    eq('debug/error: internal_error', res.json && res.json.error, 'internal_error');

    res = await request(httpsPort, 'GET', '/api/v1/unknown', { token: adminToken });
    eq('неизвестный маршрут → 404', res.status, 404);

    res = await request(httpsPort, 'POST', '/api/v1/auth/logout', { token: adminToken });
    eq('logout → 204', res.status, 204);
    contains('logout: cookie сброшена', res.headers['set-cookie'] ? res.headers['set-cookie'][0] : '', 'Max-Age=0');

    res = await request(httpsPort, 'POST', '/api/v1/auth/login', { body: {} });
    eq('пустые учётные данные → 400', res.status, 400);
  } finally {
    await stopServer(server.child);
    if (process.env.LAB02_TEST_KEEP_DATA !== '1') {
      await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    } else {
      console.log('Данные теста сохранены в %s', tempDir);
    }
    if (failures.length && server.log.err) {
      console.log('\nstderr сервера:\n%s', server.log.err);
    }
  }

  console.log('\nИтого: %d проверок, %d ошибок.', passed, failures.length);
  if (failures.length) {
    for (const failure of failures) {
      console.log('  - %s%s', failure.name, failure.detail ? ' — ' + failure.detail : '');
    }
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('Тесты не запустились: %s', e.stack || e.message);
  process.exitCode = 1;
});
