'use strict';

/**
 * Сервер инвентаря (лабораторная работа №2, вариант 7).
 *
 * Только встроенные модули Node.js. HTTPS — основной протокол, HTTP отвечает
 * редиректом. REST API версионировано: /api/v1/. Аутентификация — JWT (HS256)
 * в заголовке Authorization и/или в cookie token. Кэширование — ETag,
 * Cache-Control, Last-Modified; условные запросы дают 304.
 *
 *   node server/server.js
 *   HTTPS_PORT=8443 HTTP_PORT=8080 node server/server.js
 */

const https = require('node:https');
const http = require('node:http');
const fsp = require('node:fs/promises');
const fs = require('node:fs');
const path = require('node:path');

const config = require('./config');
const Store = require('./store');
const openapi = require('./openapi');
const auth = require('./auth');
const { validateItem, isPlainObject } = require('./validation');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const API = config.apiPrefix;

// ---------------------------------------------------------------------------
// Ответы
// ---------------------------------------------------------------------------

function requestMeta(req) {
  return {
    host: req.headers.host || '',
    userAgent: req.headers['user-agent'] || '',
    accept: req.headers.accept || '',
    ip: (req.socket && req.socket.remoteAddress) || '',
  };
}

function baseHeaders(req) {
  const meta = requestMeta(req);
  return {
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Accept, Authorization, Cookie',
    'X-Request-Host': meta.host,
  };
}

function sendJson(req, res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, Object.assign(baseHeaders(req), {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...extra,
  }));
  res.end(body);
}

function sendError(req, res, status, code, message, details) {
  const payload = { error: code, message };
  if (details && details.length) payload.details = details;
  const extra = {};
  if (status === 401) extra['WWW-Authenticate'] = 'Bearer realm="inventory"';
  sendJson(req, res, status, payload, extra);
}

function sendNotModified(req, res, headers) {
  res.writeHead(304, Object.assign(baseHeaders(req), headers));
  res.end();
}

function sendEmpty(req, res, status, extra = {}) {
  res.writeHead(status, Object.assign(baseHeaders(req), extra));
  res.end();
}

// ---------------------------------------------------------------------------
// Заголовки запроса: Host, User-Agent, Accept
// ---------------------------------------------------------------------------

const HOST_RE = /^[A-Za-z0-9._\-]+(:\d+)?$|^\[[0-9A-Fa-f:.]+\](:\d+)?$/;

function checkRequestHeaders(req, res) {
  const meta = requestMeta(req);
  if (!meta.host) {
    sendError(req, res, 400, 'host_required', 'Заголовок Host обязателен (HTTP/1.1).');
    return false;
  }
  if (!HOST_RE.test(meta.host)) {
    sendError(req, res, 400, 'invalid_host', 'Некорректный заголовок Host.');
    return false;
  }
  if (!meta.userAgent) {
    sendError(req, res, 400, 'user_agent_required', 'Заголовок User-Agent обязателен.');
    return false;
  }
  return true;
}

/** Согласование Accept: клиент должен принимать application/json. */
function acceptsJson(req) {
  const header = (req.headers.accept || '').trim();
  if (!header) return true;
  for (const part of header.split(',')) {
    const [type, ...params] = part.trim().split(';');
    const q = params.find((p) => p.trim().startsWith('q='));
    if (q && Number(q.trim().slice(2)) === 0) continue;
    const mime = type.trim().toLowerCase();
    if (mime === 'application/json' || mime === 'application/*' || mime === '*/*') return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Тело запроса
// ---------------------------------------------------------------------------

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > config.maxBodyBytes) {
        reject(Object.assign(new Error('Тело запроса слишком большое'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(Object.assign(new Error('Некорректный JSON в теле запроса'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function requireJsonContentType(req, res) {
  const type = (req.headers['content-type'] || '').toLowerCase();
  if (!type.includes('application/json')) {
    sendError(req, res, 400, 'invalid_content_type',
      'Для тела запроса нужен Content-Type: application/json.');
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Аутентификация и права
// ---------------------------------------------------------------------------

let jwtSecret = '';

function currentActor(req) {
  const found = auth.tokenFromRequest(req, config.tokenCookie);
  if (!found.token) return null;
  const payload = auth.verifyToken(found.token, jwtSecret);
  if (!payload || !payload.sub) return null;
  const user = store.user(payload.sub);
  if (!user) return null;
  return { username: user.username, role: user.role, source: found.source };
}

function requireActor(req, res) {
  const actor = currentActor(req);
  if (!actor) {
    sendError(req, res, 401, 'unauthorized', 'Требуется аутентификация (JWT или cookie).');
    return null;
  }
  return actor;
}

function forbid(res, req, message) {
  sendError(req, res, 403, 'forbidden', message);
  return null;
}

// ---------------------------------------------------------------------------
// Кэширование
// ---------------------------------------------------------------------------

function listEtag(result) {
  return `"list-${result.rev}-${result.total}"`;
}

function itemEtag(item) {
  return `"item-${item.id}-${item.version}"`;
}

function httpDate(iso) {
  return new Date(iso).toUTCString();
}

function etagMatches(req, etag) {
  const header = req.headers['if-none-match'];
  if (!header) return false;
  return header.split(',').some((value) => {
    const v = value.trim();
    return v === '*' || v === etag || v === 'W/' + etag;
  });
}

function modifiedSinceMatches(req, iso) {
  const header = req.headers['if-modified-since'];
  if (!header) return false;
  const since = Date.parse(header);
  if (Number.isNaN(since)) return false;
  return Math.floor(new Date(iso).getTime() / 1000) * 1000 <= since;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

function parseListQuery(url) {
  const q = url.searchParams.get('q') || '';
  const condition = url.searchParams.get('condition') || '';
  const sort = url.searchParams.get('sort') || 'name';
  const order = url.searchParams.get('order') || 'asc';
  const limitRaw = url.searchParams.get('limit');
  const offsetRaw = url.searchParams.get('offset');

  const errors = [];
  if (condition && !['new', 'good', 'used', 'broken'].includes(condition)) {
    errors.push({ field: 'condition', message: 'condition: new|good|used|broken.' });
  }
  if (!['name', 'quantity', 'updatedAt', 'createdAt'].includes(sort)) {
    errors.push({ field: 'sort', message: 'sort: name|quantity|updatedAt|createdAt.' });
  }
  if (!['asc', 'desc'].includes(order)) {
    errors.push({ field: 'order', message: 'order: asc|desc.' });
  }

  let limit = 50;
  let offset = 0;
  if (limitRaw !== null) {
    limit = Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      errors.push({ field: 'limit', message: 'limit: целое 1..100.' });
    }
  }
  if (offsetRaw !== null) {
    offset = Number(offsetRaw);
    if (!Number.isInteger(offset) || offset < 0) {
      errors.push({ field: 'offset', message: 'offset: целое >= 0.' });
    }
  }

  return { errors, q, condition, sort, order, limit, offset };
}

async function handleLogin(req, res) {
  if (!requireJsonContentType(req, res)) return;
  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendError(req, res, e.status || 400, 'invalid_body', e.message);
  }
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password) {
    return sendError(req, res, 400, 'validation_error', 'Укажите username и password.',
      [{ field: 'username', message: 'Обязательное поле.' }, { field: 'password', message: 'Обязательное поле.' }]);
  }

  const user = store.authenticate(username, password);
  if (!user) {
    return sendError(req, res, 401, 'invalid_credentials', 'Неверный логин или пароль.');
  }

  const signed = auth.signToken({ sub: user.username, role: user.role }, jwtSecret, config.jwtTtlSec);
  const cookie = [
    `${config.tokenCookie}=${signed.token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${config.jwtTtlSec}`,
  ].join('; ');

  sendJson(req, res, 200, {
    token: signed.token,
    tokenType: 'Bearer',
    expiresIn: config.jwtTtlSec,
    user,
  }, { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' });
}

function handleLogout(req, res) {
  const cookie = [`${config.tokenCookie}=`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Strict',
    'Max-Age=0'].join('; ');
  sendEmpty(req, res, 204, { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' });
}

function handleMe(req, res, actor) {
  sendJson(req, res, 200, {
    username: actor.username,
    role: actor.role,
    source: actor.source,
  }, { 'Cache-Control': 'no-store' });
}

function handleListItems(req, res, url, actor) {
  const query = parseListQuery(url);
  if (query.errors.length) {
    return sendError(req, res, 400, 'validation_error', 'Некорректные параметры запроса.', query.errors);
  }

  const result = store.listItems(query);
  const etag = listEtag(result);
  const lastModified = httpDate(result.updatedAt);
  const cacheHeaders = {
    'ETag': etag,
    'Last-Modified': lastModified,
    'Cache-Control': 'private, max-age=0, must-revalidate',
  };

  if (etagMatches(req, etag) || modifiedSinceMatches(req, result.updatedAt)) {
    return sendNotModified(req, res, cacheHeaders);
  }

  sendJson(req, res, 200, {
    items: result.items,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
    filters: { q: result.q, condition: result.condition, sort: result.sort, order: result.order },
  }, Object.assign({
    'X-Total-Count': String(result.total),
  }, cacheHeaders));
}

async function handleCreateItem(req, res, actor) {
  if (actor.role === 'viewer') return forbid(res, req, 'Роль viewer не может создавать предметы.');
  if (!requireJsonContentType(req, res)) return;

  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendError(req, res, e.status || 400, 'invalid_body', e.message);
  }
  if (!isPlainObject(body)) {
    return sendError(req, res, 400, 'validation_error', 'Тело запроса должно быть объектом JSON.');
  }

  const check = validateItem(body);
  if (!check.ok) {
    return sendError(req, res, 400, 'validation_error', 'Проверьте поля запроса.', check.errors);
  }

  const item = await store.createItem(check.value);
  sendJson(req, res, 201, item, {
    'Location': `${API}/items/${item.id}`,
    'ETag': itemEtag(item),
    'Last-Modified': httpDate(item.updatedAt),
    'Cache-Control': 'no-store',
  });
}

function handleGetItem(req, res, id) {
  const item = store.getItem(id);
  if (!item) return sendError(req, res, 404, 'not_found', 'Предмет не найден.');

  const etag = itemEtag(item);
  const cacheHeaders = {
    'ETag': etag,
    'Last-Modified': httpDate(item.updatedAt),
    'Cache-Control': 'private, max-age=0, must-revalidate',
  };
  if (etagMatches(req, etag) || modifiedSinceMatches(req, item.updatedAt)) {
    return sendNotModified(req, res, cacheHeaders);
  }
  sendJson(req, res, 200, item, cacheHeaders);
}

async function handleReplaceItem(req, res, id, actor) {
  if (actor.role === 'viewer') return forbid(res, req, 'Роль viewer не может изменять предметы.');
  if (!store.getItem(id)) return sendError(req, res, 404, 'not_found', 'Предмет не найден.');
  if (!requireJsonContentType(req, res)) return;

  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendError(req, res, e.status || 400, 'invalid_body', e.message);
  }

  const check = validateItem(body);
  if (!check.ok) {
    return sendError(req, res, 400, 'validation_error', 'Проверьте поля запроса.', check.errors);
  }

  const item = await store.updateItem(id, check.value);
  sendJson(req, res, 200, item, {
    'ETag': itemEtag(item),
    'Last-Modified': httpDate(item.updatedAt),
    'Cache-Control': 'no-store',
  });
}

async function handlePatchItem(req, res, id, actor) {
  if (actor.role === 'viewer') return forbid(res, req, 'Роль viewer не может изменять предметы.');
  if (!store.getItem(id)) return sendError(req, res, 404, 'not_found', 'Предмет не найден.');
  if (!requireJsonContentType(req, res)) return;

  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return sendError(req, res, e.status || 400, 'invalid_body', e.message);
  }
  if (!isPlainObject(body) || Object.keys(body).length === 0) {
    return sendError(req, res, 400, 'validation_error', 'Нужно передать хотя бы одно поле.');
  }

  const check = validateItem(body, { partial: true });
  if (!check.ok) {
    return sendError(req, res, 400, 'validation_error', 'Проверьте поля запроса.', check.errors);
  }

  const item = await store.updateItem(id, check.value);
  sendJson(req, res, 200, item, {
    'ETag': itemEtag(item),
    'Last-Modified': httpDate(item.updatedAt),
    'Cache-Control': 'no-store',
  });
}

async function handleDeleteItem(req, res, id, actor) {
  if (actor.role !== 'admin') {
    return forbid(res, req, 'Удалять предметы может только роль admin.');
  }
  const deleted = await store.deleteItem(id);
  if (!deleted) return sendError(req, res, 404, 'not_found', 'Предмет не найден.');
  sendEmpty(req, res, 204, { 'Cache-Control': 'no-store' });
}

// ---------------------------------------------------------------------------
// Маршрутизация API
// ---------------------------------------------------------------------------

async function handleApi(req, res, url) {
  const method = req.method;
  const sub = url.pathname.slice(API.length) || '/';

  if (sub === '/openapi.json') {
    if (method !== 'GET') return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
    return sendJson(req, res, 200, openapi, { 'Cache-Control': 'public, max-age=60' });
  }

  if (sub === '/health') {
    if (method !== 'GET') return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
    const meta = requestMeta(req);
    return sendJson(req, res, 200, {
      status: 'ok',
      version: config.version,
      time: new Date().toISOString(),
      uptimeSec: Math.round((Date.now() - config.startedAt) / 1000),
      request: { host: meta.host, userAgent: meta.userAgent, accept: meta.accept },
    }, { 'Cache-Control': 'no-store' });
  }

  if (sub === '/auth/login') {
    if (method !== 'POST') return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
    return handleLogin(req, res);
  }

  if (sub === '/auth/logout') {
    if (method !== 'POST') return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
    return handleLogout(req, res);
  }

  if (sub === '/auth/me') {
    if (method !== 'GET') return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
    const actor = requireActor(req, res);
    if (!actor) return undefined;
    return handleMe(req, res, actor);
  }

  if (sub === '/debug/error') {
    if (method !== 'GET') return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
    if (!config.enableDebug) {
      return sendError(req, res, 404, 'not_found', 'Отладочный маршрут выключен.');
    }
    throw new Error('Тестовая внутренняя ошибка (debug/error)');
  }

  if (sub === '/items') {
    const actor = requireActor(req, res);
    if (!actor) return undefined;
    if (method === 'GET') return handleListItems(req, res, url, actor);
    if (method === 'POST') return handleCreateItem(req, res, actor);
    return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
  }

  const match = /^\/items\/([0-9a-fA-F-]+)$/.exec(sub);
  if (match) {
    const id = match[1].toLowerCase();
    const actor = requireActor(req, res);
    if (!actor) return undefined;
    if (method === 'GET') return handleGetItem(req, res, id);
    if (method === 'PUT') return handleReplaceItem(req, res, id, actor);
    if (method === 'PATCH') return handlePatchItem(req, res, id, actor);
    if (method === 'DELETE') return handleDeleteItem(req, res, id, actor);
    return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
  }

  return sendError(req, res, 404, 'not_found', 'Маршрут API не найден.');
}

// ---------------------------------------------------------------------------
// Статика
// ---------------------------------------------------------------------------

async function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendError(req, res, 405, 'method_not_allowed', 'Метод не поддерживается.', []);
  }

  let relative = decodeURIComponent(url.pathname);
  if (relative === '/' || relative === '') relative = '/index.html';

  const target = path.join(config.publicDir, path.normalize(relative));
  if (!target.startsWith(config.publicDir + path.sep) && target !== path.join(config.publicDir, 'index.html')) {
    return sendError(req, res, 404, 'not_found', 'Файл не найден.');
  }

  let stat;
  try {
    stat = await fsp.stat(target);
  } catch (e) {
    return sendError(req, res, 404, 'not_found', 'Файл не найден.');
  }
  if (!stat.isFile()) return sendError(req, res, 404, 'not_found', 'Файл не найден.');

  const ext = path.extname(target).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const isHtml = ext === '.html';
  const headers = Object.assign(baseHeaders(req), {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=300',
    'Last-Modified': stat.mtime.toUTCString(),
  });

  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  res.end(await fsp.readFile(target));
}

// ---------------------------------------------------------------------------
// HTTP-сервер (редирект на HTTPS) и общий диспетчер
// ---------------------------------------------------------------------------

function createRequestListener() {
  return async function onRequest(req, res) {
    const started = Date.now();
    try {
      // Базовый адрес не зависит от Host: заголовок проверяется отдельно,
      // а некорректный Host не должен приводить к 500 при разборе URL.
      const url = new URL(req.url, 'https://localhost');

      if (url.pathname === API || url.pathname.startsWith(API + '/')) {
        if (!checkRequestHeaders(req, res)) return;
        if (!acceptsJson(req)) {
          return sendError(req, res, 406, 'not_acceptable',
            'Клиент должен принимать application/json.');
        }
        await handleApi(req, res, url);
      } else if (url.pathname === '/openapi.json') {
        sendJson(req, res, 200, openapi, { 'Cache-Control': 'public, max-age=60' });
      } else {
        await serveStatic(req, res, url);
      }
    } catch (e) {
      console.error('[server] ошибка обработки %s %s: %s', req.method, req.url, e.stack || e.message);
      if (!res.headersSent) {
        sendError(req, res, 500, 'internal_error', 'Внутренняя ошибка сервера.');
      } else {
        res.end();
      }
    } finally {
      if (process.env.LAB02_LOG === '1') {
        console.log('[%s] %s %s -> %s (%d мс)',
          new Date().toISOString(), req.method, req.url, res.statusCode, Date.now() - started);
      }
    }
  };
}

function createHttpRedirectServer() {
  return http.createServer((req, res) => {
    const host = (req.headers.host || '').split(':')[0] || config.host;
    const location = `https://${host}:${config.httpsPort}${req.url}`;
    const body = `Перейдите на ${location}\n`;
    res.writeHead(301, {
      'Location': location,
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    });
    res.end(body);
  });
}

async function main() {
  let cert;
  let key;
  try {
    cert = fs.readFileSync(config.httpsCert);
    key = fs.readFileSync(config.httpsKey);
  } catch (e) {
    console.error('Не найден сертификат HTTPS: %s', e.message);
    console.error('Сгенерируйте его: npm run certs (tools/gen-cert.sh).');
    process.exit(1);
  }

  store = new Store(config);
  await store.load();
  jwtSecret = auth.loadSecret(config.secretFile);

  const listener = createRequestListener();
  const httpsServer = https.createServer({ cert, key }, listener);
  const httpServer = createHttpRedirectServer();

  await new Promise((resolve, reject) => {
    httpsServer.once('error', reject);
    httpsServer.listen(config.httpsPort, config.host, resolve);
  });
  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(config.httpPort, config.host, resolve);
  });

  console.log('Инвентарь API (лабораторная работа №2, вариант 7)');
  console.log('  HTTPS: https://%s:%d%s', config.host, config.httpsPort, API);
  console.log('  HTTP:  http://%s:%d/  (редирект на HTTPS)', config.host, config.httpPort);
  console.log('  OpenAPI: https://%s:%d%s/openapi.json', config.host, config.httpsPort, API);
  for (const lan of config.lanAddresses()) {
    console.log('  сеть: https://%s:%d/  (%s)', lan.address, config.httpsPort, lan.name);
  }

  function shutdown() {
    httpsServer.close();
    httpServer.close();
    setTimeout(() => process.exit(0), 100).unref();
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

let store = null;

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { createRequestListener, createHttpRedirectServer };
